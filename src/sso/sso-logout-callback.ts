import { NextFunction, Request, Response } from 'express';
import { Logger } from '@hmcts/nodejs-logging';
import type UserStateConfiguration from '../interfaces/user-state-config.js';
import RedisService from '../services/redis-service.js';

const logger = Logger.getLogger('sso-logout-callback');

export interface SsoLogoutCallbackOptions {
  redisService?: RedisService;
  userStateConfiguration?: UserStateConfiguration;
}

async function clearUserStateCache(req: Request, options: SsoLogoutCallbackOptions): Promise<void> {
  const { userStateConfiguration } = options;
  const accessToken = req.session.securityToken?.access_token;

  if (!userStateConfiguration) {
    logger.info('User state cache cleanup skipped during logout: cache configuration not provided');
    return;
  }

  if (!accessToken) {
    logger.info('User state cache cleanup skipped during logout: access token not available');
    return;
  }

  const redisService = options.redisService ?? new RedisService();
  const cacheKey = redisService.getCacheKey(
    accessToken,
    userStateConfiguration.tokenClaim,
    userStateConfiguration.cacheKeyPrefix,
  );

  if (!cacheKey) {
    logger.warn('Unable to derive user state cache key during logout');
    return;
  }

  const deleted = await redisService.deleteCachedJsonObject(req.app, cacheKey);

  if (deleted) {
    logger.info('Cleared user state cache on logout');
  } else {
    logger.info('User state cache entry not found during logout');
  }
}

/**
 * Express middleware to handle SSO logout callback.
 *
 * Destroys the user's session, clears the authentication cookie, and redirects to the home page.
 *
 * @param req - Express request object.
 * @param res - Express response object.
 * @param next - Express next middleware function.
 * @param prefix - The name of the cookie to clear.
 * @param options - Optional Redis user-state cache cleanup dependencies.
 */
export default async function handleLogoutCallback(
  req: Request,
  res: Response,
  next: NextFunction,
  prefix: string,
  options: SsoLogoutCallbackOptions = {},
) {
  logger.info('SSO logout callback received');

  try {
    await clearUserStateCache(req, options);
  } catch (error) {
    logger.error('Unable to clear user state cache during logout', error);
  }

  req.session.destroy((err) => {
    if (err) {
      logger.error('Error destroying session', err);
      return next(err);
    }

    res.clearCookie(prefix);

    logger.info('SSO logout callback completed, redirecting to home');
    res.redirect('/');
  });
}
