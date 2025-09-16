import { NextFunction, Request, Response } from 'express';
import { Logger } from '@hmcts/nodejs-logging';

const logger = Logger.getLogger('logout');

/**
 * Express middleware to handle SSO logout callback.
 *
 * Destroys the user's session, clears the authentication cookie, and redirects to the home page.
 *
 * @param req - Express request object.
 * @param res - Express response object.
 * @param next - Express next middleware function.
 * @param prefix - The name of the cookie to clear.
 */
export default (req: Request, res: Response, next: NextFunction, prefix: string) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Error destroying session', err);
      return next(err);
    }

    res.clearCookie(prefix);

    res.redirect('/');
  });
};
