import type { Application, Request, Response } from 'express';
import { Logger } from '@hmcts/nodejs-logging';
import type OpalUserServiceConfiguration from '../interfaces/opal-user-service-config.js';
import type UserStateConfiguration from '../interfaces/user-state-config.js';
import { getUserStateFromUserService } from '../services/opal-user-service.js';
import RedisService from '../services/redis-service.js';
import { Jwt } from '../utils/index.js';
import {
  getCachedUserStateForAccessToken,
  USER_STATE_CACHE_FAILURE_MESSAGE,
  type UserStateCacheLookupResult,
} from './user-state-cache.js';

const logger = Logger.getLogger('user-state');
const CACHE_CONTROL_HEADER = 'Cache-Control';
const USER_STATE_CACHE_CONTROL_VALUE = 'no-store, must-revalidate';
const USER_STATE_CACHE_TTL_HEADER = 'X-OPAL-User-State-Cache-TTL-Ms';
const USER_STATE_CACHE_SOURCE_HEADER = 'X-OPAL-User-State-Cache-Source';
type UserStateCacheSource = 'redis-hit' | 'redis-repopulated';

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

function sendCacheFailureResponse(res: Response): void {
  res.status(503).send({ message: USER_STATE_CACHE_FAILURE_MESSAGE });
}

function setUserStateCacheHeaders(
  res: Response,
  cachedUserState: Extract<UserStateCacheLookupResult, { status: 'hit' }>,
  source: UserStateCacheSource,
): void {
  res.header(USER_STATE_CACHE_SOURCE_HEADER, source);

  if (cachedUserState.ttlMilliseconds !== undefined) {
    res.header(USER_STATE_CACHE_TTL_HEADER, String(cachedUserState.ttlMilliseconds));
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

  res.header(CACHE_CONTROL_HEADER, USER_STATE_CACHE_CONTROL_VALUE);

  const accessToken = getAccessToken(req);

  if (!accessToken || Jwt.isJwtExpired(accessToken)) {
    logger.warn('Unable to retrieve user state: missing or expired access token');
    res.sendStatus(401);
    return;
  }

  const cachedUserState = await getCachedUserStateForAccessToken({
    accessToken,
    app,
    includeTtlMilliseconds: true,
    redisService,
    userStateConfiguration,
  });

  switch (cachedUserState.status) {
    case 'hit':
      logger.info('User state cache hit');
      setUserStateCacheHeaders(res, cachedUserState, 'redis-hit');
      res.status(200).json(cachedUserState.userState);
      return;

    case 'invalid-token':
      logger.warn('Unable to derive user state cache key from access token');
      res.sendStatus(401);
      return;

    case 'cache-error':
      logger.error('Unable to retrieve user state from cache', cachedUserState.error);
      sendCacheFailureResponse(res);
      return;

    case 'miss':
      logger.info('User state cache miss, retrieving from opal-user-service');
      break;
  }

  const userStateResponse = await getUserStateFromUserService(opalUserServiceUrl, accessToken, opalUserServiceConfig);

  if (isSuccessfulResponse(userStateResponse.status)) {
    logger.info('opal-user-service returned successful response for user state, reading repopulated cache', {
      status: userStateResponse.status,
    });
    const repopulatedUserState = await getCachedUserStateForAccessToken({
      accessToken,
      app,
      includeTtlMilliseconds: true,
      redisService,
      userStateConfiguration,
    });

    switch (repopulatedUserState.status) {
      case 'hit':
        logger.info('Repopulated user state cache hit');
        setUserStateCacheHeaders(res, repopulatedUserState, 'redis-repopulated');
        res.status(200).json(repopulatedUserState.userState);
        return;

      case 'invalid-token':
        logger.warn('Unable to derive user state cache key from access token after opal-user-service response');
        res.sendStatus(401);
        return;

      case 'cache-error':
        logger.error('Unable to retrieve repopulated user state from cache', repopulatedUserState.error);
        sendCacheFailureResponse(res);
        return;

      case 'miss':
        logger.error('opal-user-service returned success but user state was not available in cache');
        res.status(502).send({ message: USER_STATE_CACHE_FAILURE_MESSAGE });
        return;
    }
  }

  logger.warn('opal-user-service returned non-success response for user state', { status: userStateResponse.status });
  sendDownstreamResponse(res, userStateResponse.status, userStateResponse.data);
}
