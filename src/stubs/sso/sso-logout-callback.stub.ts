import { NextFunction, Request, Response } from 'express';
import { Logger } from '@hmcts/nodejs-logging';

/**
 * Handles the SSO logout callback by destroying the user's session,
 * clearing the authentication cookie, and redirecting to the home page.
 *
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @param next - The next middleware function in the Express stack.
 * @param prefix - The prefix used for the authentication cookie to be cleared.
 *
 * @remarks
 * If an error occurs while destroying the session, it is logged and passed to the next middleware.
 */
const ssoLogoutCallback = (req: Request, res: Response, next: NextFunction, prefix: string) => {
  const logger = Logger.getLogger('logout-callback-stub');

  req.session.destroy((err) => {
    if (err) {
      logger.error(`Error destroying session: ${err}`);
      return next(err);
    }

    res.clearCookie(prefix);
    res.redirect('/');
  });
};

export default ssoLogoutCallback;
