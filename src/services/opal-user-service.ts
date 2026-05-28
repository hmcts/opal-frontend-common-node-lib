import axios from 'axios';
import type { Application } from 'express';
import { Logger } from '@hmcts/nodejs-logging';
import OpalUserServiceConfiguration from '../interfaces/opal-user-service-config.js';
import type UserStateConfiguration from '../interfaces/user-state-config.js';
import { getCachedUserStateForAccessToken } from '../user-state/user-state-cache.js';
import type RedisService from './redis-service.js';

const logger = Logger.getLogger('opal-user-service');

export interface UserStateLookupResult {
  data: unknown;
  status: number;
}

interface UserCheckResult {
  status: number;
  user_id?: string;
  version?: string;
}

export interface HandleCheckUserOptions {
  app: Application;
  redisService?: RedisService;
  userStateConfiguration: UserStateConfiguration;
}

async function getCachedUserCheckResult(
  accessToken: string,
  options?: HandleCheckUserOptions,
): Promise<UserCheckResult | null> {
  if (!options) {
    return null;
  }

  const cachedUserState = await getCachedUserStateForAccessToken({
    accessToken,
    app: options.app,
    redisService: options.redisService,
    userStateConfiguration: options.userStateConfiguration,
  });

  switch (cachedUserState.status) {
    case 'hit':
      return { status: 200 };

    case 'invalid-token':
      return { status: 401 };

    case 'cache-error':
      logger.error('Unable to read cached user state when checking user', cachedUserState.error);
      return { status: 503 };

    case 'miss':
      return null;
  }
}

/**
 * Checks if a user exists in the opal-user-service
 * @param opalUserServiceTarget - The base URL of the opal-user-service
 * @param accessToken - The access token for authentication
 * @returns Promise<{status: number, user_id?: string, version?: string}>
 */
async function checkUserExists(
  opalUserServiceTarget: string,
  accessToken: string,
  userStateUrl: string,
  options?: HandleCheckUserOptions,
): Promise<UserCheckResult> {
  const cachedUserResult = await getCachedUserCheckResult(accessToken, options);

  if (cachedUserResult) {
    return cachedUserResult;
  }

  try {
    const response = await axios.get(`${opalUserServiceTarget}${userStateUrl}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-New-Login': 'true',
      },
    });

    return {
      status: response.status,
      user_id: response.data?.user_id,
      version: response.headers['etag'],
    };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status) {
        return {
          status,
          // For 409 conflicts, extract user_id from resourceId
          user_id: error.response?.data?.resourceId,
          // Extract version from ETag header (same as success case)
          version: error.response?.headers['etag'],
        };
      }

      logger.error('Axios error without response status when checking user state', {
        message: error.message,
        code: error.code,
      });
      return { status: 500 };
    }

    logger.error('Unexpected error when checking user state', error);
    return { status: 500 };
  }
}

/**
 * Adds a new user via the opal-user-service
 * @param opalUserServiceTarget - The base URL of the opal-user-service
 * @param accessToken - The access token for authentication
 * @returns Promise<boolean> - true if successful, false otherwise
 */
async function addUser(opalUserServiceTarget: string, accessToken: string, addUserUrl: string): Promise<boolean> {
  try {
    const response = await axios.post(
      `${opalUserServiceTarget}${addUserUrl}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.status === 201 || response.status === 200;
  } catch (error) {
    logger.error('Error adding user', error);
    return false;
  }
}

export async function getUserStateFromUserService(
  opalUserServiceTarget: string,
  accessToken: string,
  userStateUrl: string,
): Promise<UserStateLookupResult> {
  try {
    const response = await axios.get<unknown>(`${opalUserServiceTarget}${userStateUrl}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'X-New-Login': 'false',
      },
      validateStatus: () => true,
    });

    return {
      data: response.data,
      status: response.status,
    };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      logger.error('Axios error without response when retrieving user state', {
        message: error.message,
        code: error.code,
      });
    } else {
      logger.error('Unexpected error when retrieving user state', error);
    }

    return {
      data: { message: 'Unable to retrieve user state' },
      status: 502,
    };
  }
}

/**
 * Updates an existing user via the opal-user-service
 * @param opalUserServiceTarget - The base URL of the opal-user-service
 * @param accessToken - The access token for authentication
 * @param updateUserUrl - The update user endpoint URL
 * @param userId - The user ID to update
 * @param version - The version number for optimistic locking
 * @returns Promise<boolean> - true if successful, false otherwise
 */
async function updateUser(
  opalUserServiceTarget: string,
  accessToken: string,
  updateUserUrl: string,
  userId: string,
  version: string,
): Promise<boolean> {
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'If-Match': version,
    };

    const response = await axios.put(`${opalUserServiceTarget}${updateUserUrl}/${userId}`, {}, { headers });

    return response.status === 200;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('updateUser axios error', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method,
        message: error.message,
      });
    } else {
      logger.error('updateUser non-axios error', { error: String(error) });
    }
    return false;
  }
}

/**
 * Handles user validation and management after successful SSO login
 * @param opalUserServiceTarget - The base URL of the opal-user-service
 * @param accessToken - The access token for authentication
 * @returns Promise<boolean> - true if user management was successful, false otherwise
 */
export async function handleCheckUser(
  opalUserServiceTarget: string,
  accessToken: string,
  config: OpalUserServiceConfiguration,
  options?: HandleCheckUserOptions,
): Promise<boolean> {
  const userResult = await checkUserExists(opalUserServiceTarget, accessToken, config.userStateUrl, options);

  switch (userResult.status) {
    case 200:
      logger.info('User exists, proceeding to frontend');
      return true;

    case 404: {
      logger.info('User not found, attempting to add user');
      const addResult = await addUser(opalUserServiceTarget, accessToken, config.addUserUrl);
      if (addResult) {
        logger.info('User successfully added');
        return true;
      } else {
        logger.error('Failed to add user');
        return false;
      }
    }

    case 409: {
      logger.info('User conflict detected, attempting to update user');
      if (!userResult.user_id) {
        logger.error('Cannot update user: userId not available');
        return false;
      }

      if (!userResult.version) {
        logger.error('Cannot update user: version not available');
        return false;
      }

      const updateResult = await updateUser(
        opalUserServiceTarget,
        accessToken,
        config.updateUserUrl,
        userResult.user_id,
        userResult.version,
      );
      if (updateResult) {
        logger.info('User successfully updated');
        return true;
      } else {
        logger.error('Failed to update user');
        return false;
      }
    }

    default:
      logger.error('Error during user validation', { status: userResult.status });
      return false;
  }
}
