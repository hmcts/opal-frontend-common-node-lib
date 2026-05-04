import type { Application } from 'express';

export interface RedisClient {
  get(key: string): Promise<string | null>;
}

export type CachedJsonObject = Record<string, unknown>;

/**
 * Reads the configured Redis client from Express app locals.
 *
 * @param app - Express application that may hold shared clients on `locals`.
 * @param redisClientKey - Key used to look up the Redis client from `app.locals`.
 * @returns A Redis-like client with a `get` method, or `null` when no compatible client is configured.
 */
export function getRedisClient(app: Application, redisClientKey: string): RedisClient | null {
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
export function parseCachedJsonObject(cachedValue: string): CachedJsonObject | null {
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
 * Attempts to load and parse a JSON object from Redis.
 *
 * Missing Redis configuration, Redis read failures, and invalid cached payloads are treated as cache misses.
 *
 * @param app - Express application that may hold the Redis client on `locals`.
 * @param cacheKey - Redis key for the cached payload.
 * @param redisClientKey - Key used to look up the Redis client from `app.locals`.
 * @returns The cached object, or `null` when no usable cached value is available.
 */
export async function getCachedJsonObject(
  app: Application,
  cacheKey: string,
  redisClientKey: string,
): Promise<CachedJsonObject | null> {
  const redisClient = getRedisClient(app, redisClientKey);

  if (!redisClient) {
    return null;
  }

  try {
    const cachedValue = await redisClient.get(cacheKey);

    return cachedValue ? parseCachedJsonObject(cachedValue) : null;
  } catch {
    return null;
  }
}
