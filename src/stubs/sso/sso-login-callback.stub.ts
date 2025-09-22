import { NextFunction, Request, Response } from 'express';
import { Logger } from '@hmcts/nodejs-logging';
import axios from 'axios';

/**
 * Express middleware stub for handling SSO login callback in a testing environment.
 *
 * This middleware simulates the login callback by minting a JWT token for a supplied email address
 * using the internal testing-support API. The token is then stored in the session for subsequent requests.
 *
 * @param req - Express request object, expects an 'email' query parameter.
 * @param res - Express response object.
 * @param next - Express next middleware function.
 * @param opalApiUrl - The base URL of the Opal API, used to construct the token minting endpoint.
 *
 * @remarks
 * - If the 'email' query parameter is missing, the middleware logs an error and calls `next` with the error.
 * - If token minting fails or the response does not contain an access token, an error is logged and passed to `next`.
 * - On success, the access token is stored in `req.session.securityToken` and the user is redirected to the root path.
 * - Intended for use in test and development environments only.
 */
export default async (req: Request, res: Response, next: NextFunction, opalApiUrl: string) => {
  const logger = Logger.getLogger('login-callback-stub');

  try {
    const email = (req.query['email'] as string | undefined)?.trim();
    if (!email) {
      const error = new Error('No email provided on login callback.');
      logger.error(error);
      return next(error);
    }

    const internalJwtUrl = `${opalApiUrl}/testing-support/token/user`;

    // Ask testing-support to mint a token for the supplied email
    const result = await axios.get(internalJwtUrl, {
      headers: { 'X-User-Email': email },
    });

    // testing-support may return just a JWT string or a structured token object
    const data = result.data;
    const access_token = typeof data === 'string' ? data : data?.access_token;

    if (!access_token) {
      const error = new Error('Token minting failed: missing access_token.');
      logger.error(error, { data });
      return next(error);
    }

    // Persist only what we need for subsequent calls
    req.session.securityToken = { user_state: undefined, access_token };

    req.session.save((err) => {
      if (err) {
        logger.error('Error saving session', err);
        return next(err);
      }
      return res.redirect('/');
    });
  } catch (error) {
    logger.error('Error on login-stub callback', error);
    return next(error);
  }
};
