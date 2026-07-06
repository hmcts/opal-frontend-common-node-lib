import axios, { type AxiosResponse } from 'axios';
import type { Application } from 'express';
import { Logger } from '@hmcts/nodejs-logging';
import OpalUserServiceConfiguration from '../interfaces/opal-user-service-config.js';
import type UserStateConfiguration from '../interfaces/user-state-config.js';
import { getCachedUserStateForAccessToken } from '../user-state/user-state-cache.js';
import type RedisService from './redis-service.js';
import { withBoundedRetry } from './opal-user-service-retry.js';

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

interface UserStateCheckResponseData {
  user_id?: string;
}

interface UserConflictResponseData {
  resourceId?: string;
}

export interface HandleCheckUserOptions {
  app: Application;
  redisService?: RedisService;
  userStateConfiguration: UserStateConfiguration;
}

const RETRYABLE_AXIOS_ERROR_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED']);

function isRetryableAxiosError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (error.response) {
    return false;
  }

  return !!error.code && RETRYABLE_AXIOS_ERROR_CODES.has(error.code);
}

function getHeaderString(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getSafeAxiosLogDetails(error: unknown): Record<string, number | string | undefined> {
  if (!axios.isAxiosError(error)) {
    return { message: getErrorMessage(error) };
  }

  return {
    message: error.message,
    code: error.code,
    status: error.response?.status,
    statusText: error.response?.statusText,
  };
}

function getSafeRetryLogDetails(
  error: unknown,
  config: OpalUserServiceConfiguration,
): Record<string, number | string | undefined> {
  return {
    retryAttempts: config.retryAttempts,
    retryDelayInMilliseconds: config.retryDelayInMilliseconds,
    ...getSafeAxiosLogDetails(error),
  };
}

async function getCachedUserCheckResult(
  accessToken: string,
  options?: HandleCheckUserOptions,
): Promise<UserCheckResult | null> {
  if (!options) {
    logger.info('User-state cache lookup skipped during user check: cache configuration not provided');
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
      logger.info('User-state cache hit during user check');
      return { status: 200 };

    case 'invalid-token':
      logger.warn('Unable to derive user-state cache key during user check');
      return { status: 401 };

    case 'cache-error':
      logger.error('Unable to read cached user state when checking user', cachedUserState.error);
      return { status: 503 };

    case 'miss':
      logger.info('User-state cache miss during user check, checking opal-user-service');
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
  config: OpalUserServiceConfiguration,
  options?: HandleCheckUserOptions,
): Promise<UserCheckResult> {
  const cachedUserResult = await getCachedUserCheckResult(accessToken, options);

  if (cachedUserResult) {
    return cachedUserResult;
  }

  try {
    logger.info('Checking user state with opal-user-service');
    const response = await withBoundedRetry<AxiosResponse<UserStateCheckResponseData>>(
      () =>
        axios.get<UserStateCheckResponseData>(`${opalUserServiceTarget}${config.userStateUrl}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-New-Login': 'true',
          },
          timeout: config.timeoutInMilliseconds,
        }),
      {
        maxAttempts: config.retryAttempts,
        delayMs: config.retryDelayInMilliseconds,
        shouldRetry: (error) => isRetryableAxiosError(error),
      },
    );

    return {
      status: response.status,
      user_id: response.data?.user_id,
      version: getHeaderString(response.headers['etag']),
    };
  } catch (error: unknown) {
    if (axios.isAxiosError<UserConflictResponseData>(error)) {
      const response = error.response;
      const status = response?.status;

      if (response && status) {
        logger.info('opal-user-service user state check returned non-success response', { status });
        return {
          status,
          // For 409 conflicts, extract user_id from resourceId
          user_id: response.data?.resourceId,
          // Extract version from ETag header (same as success case)
          version: getHeaderString(response.headers['etag']),
        };
      }

      logger.error(
        'Retry exhausted when checking user state with opal-user-service',
        getSafeRetryLogDetails(error, config),
      );
      return { status: 500 };
    }

    logger.error('Unexpected error when checking user state', getSafeAxiosLogDetails(error));
    return { status: 500 };
  }
}

/**
 * Adds a new user via the opal-user-service
 * @param opalUserServiceTarget - The base URL of the opal-user-service
 * @param accessToken - The access token for authentication
 * @returns Promise<boolean> - true if successful, false otherwise
 */
async function addUser(
  opalUserServiceTarget: string,
  accessToken: string,
  config: OpalUserServiceConfiguration,
): Promise<boolean> {
  try {
    const response = await axios.post(
      `${opalUserServiceTarget}${config.addUserUrl}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: config.timeoutInMilliseconds,
      },
    );

    return response.status === 201 || response.status === 200;
  } catch (error: unknown) {
    logger.error('Error adding user', getSafeAxiosLogDetails(error));
    return false;
  }
}

export async function getUserStateFromUserService(
  opalUserServiceTarget: string,
  accessToken: string,
  config: OpalUserServiceConfiguration,
): Promise<UserStateLookupResult> {
  try {
    const response = await withBoundedRetry<AxiosResponse<unknown>>(
      () =>
        axios.get<unknown>(`${opalUserServiceTarget}${config.userStateUrl}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'X-New-Login': 'false',
          },
          timeout: config.timeoutInMilliseconds,
          validateStatus: () => true,
        }),
      {
        maxAttempts: config.retryAttempts,
        delayMs: config.retryDelayInMilliseconds,
        shouldRetry: (error) => isRetryableAxiosError(error),
      },
    );

    return {
      data: response.data,
      status: response.status,
    };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      logger.error(
        'Retry exhausted when retrieving user state from opal-user-service',
        getSafeRetryLogDetails(error, config),
      );
    } else {
      logger.error('Unexpected error when retrieving user state', getSafeAxiosLogDetails(error));
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
  config: OpalUserServiceConfiguration,
  userId: string,
  version: string,
): Promise<boolean> {
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'If-Match': version,
    };

    const response = await axios.put(
      `${opalUserServiceTarget}${config.updateUserUrl}/${userId}`,
      {},
      {
        headers,
        timeout: config.timeoutInMilliseconds,
      },
    );

    return response.status === 200;
  } catch (error: unknown) {
    logger.error('Error updating user', getSafeAxiosLogDetails(error));
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
  const userResult = await checkUserExists(opalUserServiceTarget, accessToken, config, options);

  switch (userResult.status) {
    case 200:
      logger.info('User exists, proceeding to frontend');
      return true;

    case 404: {
      logger.info('User not found, attempting to add user');
      const addResult = await addUser(opalUserServiceTarget, accessToken, config);
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
        config,
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
