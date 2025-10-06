import { Request, Response, NextFunction } from 'express';
import { Logger } from '@hmcts/nodejs-logging';

const logger = Logger.getLogger('login-stub');

/**
 * Express middleware stub for simulating SSO login.
 *
 * If an `email` query parameter is present, redirects to the SSO login callback with the email.
 * Otherwise, logs an error and passes it to the next middleware.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 * @returns A redirect response or calls `next` with an error if no email is provided.
 */
export default async function ssoLoginStub(req: Request, res: Response, next: NextFunction) {
  const email = (req.query['email'] as string | undefined)?.trim();

  if (email) {
    return res.redirect(`/sso/login-callback?email=${encodeURIComponent(email)}`);
  }

  const error = new Error('No email provided.');
  logger.error('Error on login-stub', error);
  return next(error);
}
