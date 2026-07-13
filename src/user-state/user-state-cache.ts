import type { Application } from 'express';
import type UserStateConfiguration from '../interfaces/user-state-config.js';
import RedisService, {
  RedisCacheParseError,
  RedisCacheReadError,
  RedisClientUnavailableError,
  type CachedJsonObject,
  type RedisCacheError,
} from '../services/redis-service.js';

export const USER_STATE_CACHE_FAILURE_MESSAGE = 'Unable to retrieve user state from cache';

export interface UserStateCacheLookupOptions {
  accessToken: string;
  app: Application;
  redisService?: RedisService;
  userStateConfiguration: UserStateConfiguration;
}

export type UserStateCacheLookupResult =
  | { status: 'hit'; cacheKey: string; userState: CachedJsonObject; ttlMilliseconds?: number }
  | { status: 'miss'; cacheKey: string }
  | { status: 'invalid-token' }
  | { status: 'cache-error'; error: RedisCacheError };

function isRedisCacheError(error: unknown): error is RedisCacheError {
  return (
    error instanceof RedisClientUnavailableError ||
    error instanceof RedisCacheReadError ||
    error instanceof RedisCacheParseError
  );
}

function getMatchingUserState(cachedUserState: CachedJsonObject | null, cacheKey: string): CachedJsonObject | null {
  if (!cachedUserState) {
    return null;
  }

  return cachedUserState['cache_name'] === cacheKey ? cachedUserState : null;
}

export async function getCachedUserStateForAccessToken({
  accessToken,
  app,
  redisService: configuredRedisService,
  userStateConfiguration,
}: UserStateCacheLookupOptions): Promise<UserStateCacheLookupResult> {
  const redisService = configuredRedisService ?? new RedisService();
  const cacheKey = redisService.getCacheKey(
    accessToken,
    userStateConfiguration.tokenClaim,
    userStateConfiguration.cacheKeyPrefix,
  );

  if (!cacheKey) {
    return { status: 'invalid-token' };
  }

  try {
    const cachedUserState = await redisService.getCachedJsonObject(app, cacheKey);
    const matchingUserState = getMatchingUserState(cachedUserState, cacheKey);

    if (!matchingUserState) {
      return { status: 'miss', cacheKey };
    }

    const ttlMilliseconds = await redisService.getCacheTtlInMilliseconds(app, cacheKey);

    return ttlMilliseconds === null
      ? { status: 'hit', cacheKey, userState: matchingUserState }
      : { status: 'hit', cacheKey, userState: matchingUserState, ttlMilliseconds };
  } catch (error: unknown) {
    if (!isRedisCacheError(error)) {
      throw error;
    }

    return { status: 'cache-error', error };
  }
}
