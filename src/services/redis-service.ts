import type { Application } from 'express';
import type UserStateConfiguration from '../interfaces/user-state-config.js';
import { decodeObject } from '../utils/base64.js';

export interface RedisClient {
  get(key: string): Promise<string | null>;
}

interface JwtPayload {
  [claim: string]: unknown;
}

export type CachedJsonObject = Record<string, unknown>;

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
   * Reads the configured Redis client from Express app locals.
   *
   * @param app - Express application that may hold shared clients on `locals`.
   * @param redisClientKey - Key used to look up the Redis client from `app.locals`.
   * @returns A Redis-like client with a `get` method, or `null` when no compatible client is configured.
   */
  public getRedisClient(app: Application, redisClientKey: string): RedisClient | null {
    const redisClient: unknown = app.locals[redisClientKey];
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
   * Missing Redis configuration, Redis read failures, and invalid cached payloads are treated as cache misses.
   *
   * @param app - Express application that may hold the Redis client on `locals`.
   * @param cacheKey - Redis key for the cached payload.
   * @param redisClientKey - Key used to look up the Redis client from `app.locals`.
   * @returns The cached object, or `null` when no usable cached value is available.
   */
  public async getCachedJsonObject(
    app: Application,
    cacheKey: string,
    redisClientKey: string,
  ): Promise<CachedJsonObject | null> {
    const redisClient = this.getRedisClient(app, redisClientKey);

    if (!redisClient) {
      return null;
    }

    try {
      const cachedValue = await redisClient.get(cacheKey);

      return cachedValue ? this.parseCachedJsonObject(cachedValue) : null;
    } catch {
      return null;
    }
  }

  /**
   * Attempts to load and parse a JSON object from Redis using a JWT-derived cache key.
   *
   * Invalid token payloads and missing identifying claims are treated as cache misses.
   *
   * @param app - Express application that may hold the Redis client on `locals`.
   * @param accessToken - JWT access token containing the user-identifying claim.
   * @param userStateConfiguration - User-state route/cache configuration supplied by the application.
   * @returns The cached object, or `null` when no usable cached value is available.
   */
  public async getCachedJsonObjectForAccessToken(
    app: Application,
    accessToken: string,
    userStateConfiguration: UserStateConfiguration,
  ): Promise<CachedJsonObject | null> {
    const { cacheKeyPrefix, redisClientKey, tokenClaim } = userStateConfiguration;
    const cacheKey = this.getCacheKey(accessToken, tokenClaim, cacheKeyPrefix);

    if (!cacheKey) {
      return null;
    }

    return this.getCachedJsonObject(app, cacheKey, redisClientKey);
  }
}
