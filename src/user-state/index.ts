import axios from 'axios';
import type { Application, Request, Response } from 'express';
import { Jwt } from '../utils/index.js';

const DEFAULT_CACHE_KEY_PREFIX = 'USER_STATE_';
const DEFAULT_ROUTE_PATH = '/api/user-state';
const DEFAULT_TOKEN_CLAIM = 'sub';
const DEFAULT_REDIS_CLIENT_KEY = 'redisClient';

interface JwtPayload {
  [claim: string]: unknown;
}

interface RedisClient {
  get(key: string): Promise<string | null>;
}

interface UserServiceResponse {
  data: unknown;
  status: number;
}

type UserStateRequest = Request & {
  session?: {
    securityToken?: {
      access_token?: string;
    };
  };
};

export interface UserStateRouteOptions {
  cacheKeyPrefix?: string;
  redisClientKey?: string;
  routePath?: string;
  tokenClaim?: string;
  userServiceBaseUrl: string;
  userStateUrl: string;
}

/**
 * Decodes the payload segment of a JWT without validating the token signature.
 *
 * @param accessToken - JWT access token read from the session.
 * @returns The decoded payload object, or `null` when the token is malformed or the payload is not an object.
 */
function decodeJwtPayload(accessToken: string): JwtPayload | null {
  const payload = accessToken.split('.')[1];

  if (!payload) {
    return null;
  }

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decodedPayload: unknown = JSON.parse(Buffer.from(paddedBase64, 'base64').toString('utf8'));

    return decodedPayload && typeof decodedPayload === 'object' ? (decodedPayload as JwtPayload) : null;
  } catch {
    return null;
  }
}

/**
 * Reads the configured Redis client from Express app locals.
 *
 * @param app - Express application that may hold shared clients on `locals`.
 * @param redisClientKey - Key used to look up the Redis client from `app.locals`.
 * @returns A Redis-like client with a `get` method, or `null` when no compatible client is configured.
 */
function getRedisClient(app: Application, redisClientKey: string): RedisClient | null {
  const redisClient: unknown = app.locals[redisClientKey];
  const candidate = redisClient as { get?: unknown };

  return typeof candidate?.get === 'function' ? (candidate as RedisClient) : null;
}

/**
 * Builds the Redis cache key from a configured JWT claim.
 *
 * @param accessToken - JWT access token containing the user-identifying claim.
 * @param tokenClaim - Claim name to read from the JWT payload.
 * @param cacheKeyPrefix - Prefix to prepend to the claim value.
 * @returns The cache key, or `null` when the claim is missing or not a non-empty string.
 */
function getCacheKey(accessToken: string, tokenClaim: string, cacheKeyPrefix: string): string | null {
  const userIdentifier = decodeJwtPayload(accessToken)?.[tokenClaim];

  if (typeof userIdentifier !== 'string' || !userIdentifier.trim()) {
    return null;
  }

  return `${cacheKeyPrefix}${userIdentifier}`;
}

/**
 * Parses and validates a cached user-state payload from Redis.
 *
 * @param cachedUserState - JSON string returned from Redis.
 * @returns The parsed object payload, or `null` when the value is invalid JSON, an array, or not an object.
 */
function parseCachedUserState(cachedUserState: string): unknown | null {
  try {
    const userState: unknown = JSON.parse(cachedUserState);

    return userState && typeof userState === 'object' && !Array.isArray(userState) ? userState : null;
  } catch {
    return null;
  }
}

/**
 * Attempts to load user state from Redis.
 *
 * Missing Redis configuration, Redis read failures, and invalid cached payloads are treated as cache misses so the
 * route can fall back to the user service.
 *
 * @param app - Express application that may hold the Redis client on `locals`.
 * @param cacheKey - Redis key for the user-state payload.
 * @param redisClientKey - Key used to look up the Redis client from `app.locals`.
 * @returns The cached user-state object, or `null` when no usable cached value is available.
 */
async function getCachedUserState(app: Application, cacheKey: string, redisClientKey: string): Promise<unknown | null> {
  const redisClient = getRedisClient(app, redisClientKey);

  if (!redisClient) {
    return null;
  }

  try {
    const cachedUserState = await redisClient.get(cacheKey);

    return cachedUserState ? parseCachedUserState(cachedUserState) : null;
  } catch {
    return null;
  }
}

/**
 * Requests user state from the configured user service using the session access token.
 *
 * The downstream status code and response body are passed through. Network or request failures return a `502`
 * response shape for the route to send.
 *
 * @param accessToken - JWT access token to send as a bearer token.
 * @param userServiceBaseUrl - Base URL for the user service.
 * @param userStateUrl - Path for the user-state endpoint.
 * @returns Response data and status to send from the Express route.
 */
async function getUserStateFromUserService(
  accessToken: string,
  userServiceBaseUrl: string,
  userStateUrl: string,
): Promise<UserServiceResponse> {
  try {
    const response = await axios.get<unknown>(`${userServiceBaseUrl}${userStateUrl}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      validateStatus: () => true,
    });

    return {
      data: response.data,
      status: response.status,
    };
  } catch {
    return {
      data: { message: 'Unable to retrieve user state' },
      status: 502,
    };
  }
}

/**
 * Registers the user-state route on an Express application.
 *
 * The route prevents HTTP caching and requires a present, non-expired session access token before deriving a cache key
 * or reading Redis. Valid requests return cached user state when available and otherwise proxy the user-service
 * response.
 *
 * @param app - Express application to register the route against.
 * @param options - User-state route configuration, including user-service location and optional cache settings.
 */
export function configureUserStateRoute(app: Application, options: UserStateRouteOptions): void {
  const cacheKeyPrefix = options.cacheKeyPrefix ?? DEFAULT_CACHE_KEY_PREFIX;
  const redisClientKey = options.redisClientKey ?? DEFAULT_REDIS_CLIENT_KEY;
  const routePath = options.routePath ?? DEFAULT_ROUTE_PATH;
  const tokenClaim = options.tokenClaim ?? DEFAULT_TOKEN_CLAIM;

  app.get(routePath, async (req: Request, res: Response) => {
    res.header('Cache-Control', 'no-store, must-revalidate');

    const accessToken = (req as UserStateRequest).session?.securityToken?.access_token;

    if (!accessToken || Jwt.isJwtExpired(accessToken)) {
      res.sendStatus(401);
      return;
    }

    const cacheKey = getCacheKey(accessToken, tokenClaim, cacheKeyPrefix);

    if (!cacheKey) {
      res.sendStatus(401);
      return;
    }

    const cachedUserState = await getCachedUserState(app, cacheKey, redisClientKey);

    if (cachedUserState) {
      res.status(200).json(cachedUserState);
      return;
    }

    const userStateResponse = await getUserStateFromUserService(
      accessToken,
      options.userServiceBaseUrl,
      options.userStateUrl,
    );

    res.status(userStateResponse.status).send(userStateResponse.data);
  });
}
