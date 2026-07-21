import type { Application } from 'express';
import type UserStateConfiguration from '../interfaces/user-state-config.js';
import { REDIS_CLIENT_APP_LOCAL_KEY } from '../constants/redis-client-app-local-key.js';
import { decodeObject } from '../utils/base64.js';

export interface RedisClient {
  get(key: string): Promise<string | null>;
  del?: (key: string) => Promise<number>;
  pTTL?: (key: string) => Promise<number>;
}

interface JwtPayload {
  [claim: string]: unknown;
}

export type CachedJsonObject = Record<string, unknown>;

export class RedisClientUnavailableError extends Error {
  public constructor() {
    super(`Redis client is not available at app.locals.${REDIS_CLIENT_APP_LOCAL_KEY}`);
    this.name = 'RedisClientUnavailableError';
  }
}

export class RedisCacheReadError extends Error {
  public constructor(options?: { cause?: unknown }) {
    super('Unable to read from Redis cache', options);
    this.name = 'RedisCacheReadError';
  }
}

export class RedisCacheDeleteError extends Error {
  public constructor(options?: { cause?: unknown }) {
    super('Unable to delete from Redis cache', options);
    this.name = 'RedisCacheDeleteError';
  }
}

export class RedisCacheParseError extends Error {
  public constructor() {
    super('Redis cache payload is not a JSON object');
    this.name = 'RedisCacheParseError';
  }
}

export type RedisCacheError =
  RedisClientUnavailableError | RedisCacheReadError | RedisCacheDeleteError | RedisCacheParseError;

export default class RedisService {
  /**
   * Decodes the payload segment of a JWT without validating the token signature.
   *
   * @param accessToken - JWT access token containing the user-identifying claim.
   * @returns The decoded payload object, or `null` when the token is malformed or the payload is not an object.
   */
  private decodeJwtPayload(accessToken: string): JwtPayload | null {
    const payload = accessToken.split('.')[1];

    if (!payload) {
      return null;
    }

    try {
      const decodedPayload = decodeObject<unknown>(payload);

      return decodedPayload && typeof decodedPayload === 'object' ? (decodedPayload as JwtPayload) : null;
    } catch {
      return null;
    }
  }

  /**
   * Reads the shared Redis client created by session storage from Express app locals.
   *
   * @param app - Express application that may hold shared clients on `locals`.
   * @returns A Redis-like client with a `get` method, or `null` when no compatible client is configured.
   */
  public getRedisClient(app: Application): RedisClient | null {
    const redisClient: unknown = app.locals[REDIS_CLIENT_APP_LOCAL_KEY];
    const candidate = redisClient as { get?: unknown };

    return typeof candidate?.get === 'function' ? (candidate as RedisClient) : null;
  }

  /**
   * Parses and validates a cached JSON object from Redis.
   *
   * @param cachedValue - JSON string returned from Redis.
   * @returns The parsed object payload, or `null` when the value is invalid JSON, an array, or not an object.
   */
  public parseCachedJsonObject(cachedValue: string): CachedJsonObject | null {
    try {
      const parsedValue: unknown = JSON.parse(cachedValue);

      return parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)
        ? (parsedValue as CachedJsonObject)
        : null;
    } catch {
      return null;
    }
  }

  /**
   * Builds a Redis cache key from a configured JWT claim.
   *
   * @param accessToken - JWT access token containing the user-identifying claim.
   * @param tokenClaim - Claim name to read from the JWT payload.
   * @param cacheKeyPrefix - Prefix to prepend to the claim value.
   * @returns The cache key, or `null` when the claim is missing or not a non-empty string.
   */
  public getCacheKey(accessToken: string, tokenClaim: string, cacheKeyPrefix: string): string | null {
    const userIdentifier = this.decodeJwtPayload(accessToken)?.[tokenClaim];

    if (typeof userIdentifier !== 'string' || !userIdentifier.trim()) {
      return null;
    }

    return `${cacheKeyPrefix}${userIdentifier}`;
  }

  /**
   * Attempts to load and parse a JSON object from Redis.
   *
   * A missing Redis key is treated as a cache miss. Missing Redis configuration, Redis read failures, and invalid cached
   * payloads are treated as cache errors because Redis is the source of truth for user state.
   *
   * @param app - Express application that may hold the Redis client on `locals`.
   * @param cacheKey - Redis key for the cached payload.
   * @returns The cached object, or `null` when no usable cached value is available.
   * @throws RedisCacheError when Redis cannot be read as the source of truth.
   */
  public async getCachedJsonObject(app: Application, cacheKey: string): Promise<CachedJsonObject | null> {
    const redisClient = this.getRedisClient(app);

    if (!redisClient) {
      throw new RedisClientUnavailableError();
    }

    let cachedValue: string | null;

    try {
      cachedValue = await redisClient.get(cacheKey);
    } catch (error: unknown) {
      throw new RedisCacheReadError({ cause: error });
    }

    if (cachedValue === null) {
      return null;
    }

    const cachedJsonObject = this.parseCachedJsonObject(cachedValue);

    if (!cachedJsonObject) {
      throw new RedisCacheParseError();
    }

    return cachedJsonObject;
  }

  /**
   * Reads the remaining Redis TTL for a cache entry in milliseconds.
   *
   * Redis returns -1 when the key has no expiry and -2 when the key does not exist. Those values, zero, and clients
   * without pTTL support are treated as absent TTLs.
   *
   * @param app - Express application that may hold the Redis client on `locals`.
   * @param cacheKey - Redis key for the cached payload.
   * @returns The positive TTL in milliseconds, or `null` when no positive TTL is available.
   * @throws RedisCacheError when Redis cannot be read as the source of truth.
   */
  public async getCacheTtlInMilliseconds(app: Application, cacheKey: string): Promise<number | null> {
    const redisClient = this.getRedisClient(app);

    if (!redisClient) {
      throw new RedisClientUnavailableError();
    }

    if (typeof redisClient.pTTL !== 'function') {
      return null;
    }

    try {
      const ttlMilliseconds = await redisClient.pTTL(cacheKey);

      return ttlMilliseconds > 0 ? ttlMilliseconds : null;
    } catch (error: unknown) {
      throw new RedisCacheReadError({ cause: error });
    }
  }

  /**
   * Deletes a cache entry from Redis.
   *
   * @param app - Express application that may hold the Redis client on `locals`.
   * @param cacheKey - Redis key for the cached payload.
   * @returns true when an entry was deleted, false when the key was not present.
   * @throws RedisCacheError when Redis cannot be written to.
   */
  public async deleteCachedJsonObject(app: Application, cacheKey: string): Promise<boolean> {
    const redisClient = this.getRedisClient(app);

    if (!redisClient || typeof redisClient.del !== 'function') {
      throw new RedisClientUnavailableError();
    }

    try {
      return (await redisClient.del(cacheKey)) > 0;
    } catch (error: unknown) {
      throw new RedisCacheDeleteError({ cause: error });
    }
  }

  /**
   * Attempts to load and parse a JSON object from Redis using a JWT-derived cache key.
   *
   * Invalid token payloads and missing identifying claims are treated as cache misses. Redis setup, read, and payload
   * errors are treated as cache errors.
   *
   * @param app - Express application that may hold the Redis client on `locals`.
   * @param accessToken - JWT access token containing the user-identifying claim.
   * @param userStateConfiguration - User-state route/cache configuration supplied by the application.
   * @returns The cached object, or `null` when no usable cached value is available.
   * @throws RedisCacheError when Redis cannot be read as the source of truth.
   */
  public async getCachedJsonObjectForAccessToken(
    app: Application,
    accessToken: string,
    userStateConfiguration: UserStateConfiguration,
  ): Promise<CachedJsonObject | null> {
    const { cacheKeyPrefix, tokenClaim } = userStateConfiguration;
    const cacheKey = this.getCacheKey(accessToken, tokenClaim, cacheKeyPrefix);

    if (!cacheKey) {
      return null;
    }

    return this.getCachedJsonObject(app, cacheKey);
  }
}
