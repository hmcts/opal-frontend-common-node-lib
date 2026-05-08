import type { Application, Request, Response } from 'express';
import type OpalUserServiceConfiguration from '../interfaces/opal-user-service-config.js';
import type UserStateConfiguration from '../interfaces/user-state-config.js';
import { getUserStateFromUserService } from '../services/opal-user-service.js';
import RedisService, {
  RedisCacheParseError,
  RedisCacheReadError,
  RedisClientUnavailableError,
  type CachedJsonObject,
} from '../services/redis-service.js';
import { Jwt } from '../utils/index.js';

export interface UserStateHandlerOptions {
  app: Application;
  opalUserServiceConfig: OpalUserServiceConfiguration;
  opalUserServiceUrl: string;
  req: Request;
  res: Response;
  userStateConfiguration: UserStateConfiguration;
  redisService?: RedisService;
}

function getAccessToken(req: Request): string | null {
  return req.session.securityToken?.access_token ?? null;
}

function sendDownstreamResponse(res: Response, status: number, data: unknown): void {
  if (data === undefined) {
    res.sendStatus(status);
    return;
  }

  res.status(status).send(data);
}

function isSuccessfulResponse(status: number): boolean {
  return status >= 200 && status < 300;
}

function isRedisCacheError(error: unknown): boolean {
  return (
    error instanceof RedisClientUnavailableError ||
    error instanceof RedisCacheReadError ||
    error instanceof RedisCacheParseError
  );
}

function sendCacheFailureResponse(res: Response): void {
  res.status(503).send({ message: 'Unable to retrieve user state from cache' });
}

function getMatchingUserState(cachedUserState: CachedJsonObject | null, cacheKey: string): CachedJsonObject | null {
  if (!cachedUserState) {
    return null;
  }

  return cachedUserState['cache_name'] === cacheKey ? cachedUserState : null;
}

async function getCachedUserState(
  app: Application,
  cacheKey: string,
  redisService: RedisService,
  res: Response,
): Promise<CachedJsonObject | null | undefined> {
  try {
    return await redisService.getCachedJsonObject(app, cacheKey);
  } catch (error: unknown) {
    if (!isRedisCacheError(error)) {
      throw error;
    }

    sendCacheFailureResponse(res);
    return undefined;
  }
}

/**
 * Handles a user-state route request.
 *
 * Reads the logged-in user's Microsoft access token from the server-side session, derives the Redis key from the
 * configured AAD claim, returns cached user state when present, and calls opal-user-service on cache miss so the
 * backend can populate Redis with its configured TTL before reading Redis again.
 */
export async function getUserState({
  app,
  opalUserServiceConfig,
  opalUserServiceUrl,
  req,
  res,
  userStateConfiguration,
  redisService: configuredRedisService,
}: UserStateHandlerOptions): Promise<void> {
  const redisService = configuredRedisService ?? new RedisService();

  res.header('Cache-Control', 'no-store, must-revalidate');

  const accessToken = getAccessToken(req);

  if (!accessToken || Jwt.isJwtExpired(accessToken)) {
    res.sendStatus(401);
    return;
  }

  const cacheKey = redisService.getCacheKey(
    accessToken,
    userStateConfiguration.tokenClaim,
    userStateConfiguration.cacheKeyPrefix,
  );

  if (!cacheKey) {
    res.sendStatus(401);
    return;
  }

  const cachedUserState = await getCachedUserState(app, cacheKey, redisService, res);

  if (cachedUserState === undefined) {
    return;
  }

  const matchingCachedUserState = getMatchingUserState(cachedUserState, cacheKey);

  if (matchingCachedUserState) {
    res.status(200).json(matchingCachedUserState);
    return;
  }

  const userStateResponse = await getUserStateFromUserService(
    opalUserServiceUrl,
    accessToken,
    opalUserServiceConfig.userStateUrl,
  );

  if (isSuccessfulResponse(userStateResponse.status)) {
    const repopulatedUserState = await getCachedUserState(app, cacheKey, redisService, res);

    if (repopulatedUserState === undefined) {
      return;
    }

    const matchingRepopulatedUserState = getMatchingUserState(repopulatedUserState, cacheKey);

    if (matchingRepopulatedUserState) {
      res.status(200).json(matchingRepopulatedUserState);
      return;
    }

    res.status(502).send({ message: 'Unable to retrieve user state from cache' });
    return;
  }

  sendDownstreamResponse(res, userStateResponse.status, userStateResponse.data);
}
