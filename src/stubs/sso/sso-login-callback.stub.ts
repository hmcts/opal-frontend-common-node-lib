import { NextFunction, Request, Response } from 'express';
import { Logger } from '@hmcts/nodejs-logging';
import axios from 'axios';

export default async (req: Request, res: Response, next: NextFunction, opalApiUrl: string) => {
  const INTERNAL_JWT = `${opalApiUrl}/testing-support/token/user`;
  const logger = Logger.getLogger('login-callback-stub');

  try {
    const email = req.query['email'] as string;
    const result = await axios.get(INTERNAL_JWT, {
      headers: { 'X-User-Email': email },
    });

    req.session.securityToken = result.data;

    req.session.save((err) => {
      if (err) {
        logger.error('Error saving session', err);
        return next(err);
      }
      logger.info('Session saved');
      res.redirect('/');
    });
  } catch (error) {
    logger.error('Error on login-stub callback', error);
    return next(error);
  }
};
