/****
 * Get User State (Server-to-Server)
 *
 * Purpose:
 * - Factory that returns an Express handler which calls `opal-user-service` to retrieve the user's state.
 * - The call is made **server-to-server** from the Node layer, therefore the access token must be forwarded
 *   explicitly in the `Authorization` header (the frontend proxy cannot inject it here).
 *
 * Usage:
 *   app.get('/user/user-state', getUserState(process.env.OPAL_USER_SERVICE_BASE_URL));
 *
 * Returns:
 * - 200 with the `UserState` JSON payload from the user service.
 * - Pass-through status on known Axios errors, or 502 on network/unknown errors.
 *
 * Security & Observability:
 * - Adds `Authorization: Bearer &lt;access_token&gt;` using the token from the session.
 * - Forwards `x-correlation-id` from the incoming request for traceability.
 * - Sends `no-store`/`no-cache` headers to avoid stale state being cached by intermediaries.
 */
import type { RequestHandler } from 'express';
import axios, { AxiosError } from 'axios';
import { UserState } from '../../interfaces';
import { Logger } from '@hmcts/nodejs-logging';

/**
 * Creates an Express handler that fetches user state from opal-user-service.
 * @param opalUserServiceBaseUrl - Base URL for the opal-user-service (e.g. http://localhost:4555).
 * @returns Express RequestHandler
 */
const logger = Logger.getLogger('get-user-state');

const getUserState = (opalUserServiceBaseUrl: string): RequestHandler => {
  // Internal target endpoint on opal-user-service. The "0" placeholder is part of the service contract.
  const INTERNAL_GET_USER_STATE = `${opalUserServiceBaseUrl}/users/0/state`;
  return async (req, res): Promise<void> => {
    try {
      // Server-to-server call: attach Bearer token from the session and propagate correlation id.
      const { data } = await axios.get<UserState>(INTERNAL_GET_USER_STATE, {
        timeout: 10_000,
        headers: {
          Authorization: `Bearer ${req.session?.securityToken?.access_token}`,
          'x-correlation-id': req.headers['x-correlation-id'] ?? '',
        },
      });
      const userState: UserState = data;

      res.set('Cache-Control', 'no-store, no-cache, private');
      res.set('Pragma', 'no-cache');
      res.status(200).json(userState);
    } catch (err) {
      // Log a structured error for diagnostics (without leaking tokens).
      const e = err as AxiosError<{ message?: string; error?: string }>;
      const status = e.response?.status ?? 502;
      const message = e.response?.data?.message ?? e.message ?? 'Unable to fetch user state from opal-user-service';
      const code = e.response?.data?.error ?? 'user_state_fetch_failed';

      logger.error(
        { err: e.toJSON?.() ?? String(e), correlationId: req.headers['x-correlation-id'] },
        'fetchUserState error',
      );
      res.status(status).json({ error: code, message });
    }
  };
};

export default getUserState;
