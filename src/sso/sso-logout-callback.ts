import { NextFunction, Request, Response } from 'express';
import { Logger } from '@hmcts/nodejs-logging';

const logger = Logger.getLogger('logout');

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
