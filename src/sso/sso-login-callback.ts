import { NextFunction, Request, Response } from 'express';
import { Logger } from '@hmcts/nodejs-logging';
import axios from 'axios';

export default async (req: Request, res: Response, next: NextFunction, opalApiUrl: string) => {
  const INTERNAL_USER_CALLBACK = `${opalApiUrl}/internal-user/handle-oauth-code`;
  const logger = Logger.getLogger('login-callback');

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await axios.post<any>(INTERNAL_USER_CALLBACK, req.body, {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });

    const securityToken = result.data;
    req.session.securityToken = securityToken;

    req.session.save((err) => {
      if (err) {
        logger.error('Error saving session', err);
        return next(err);
      }

      res.redirect('/');
    });
  } catch (error) {
    logger.error('Error on login-callback', error);
    return next(error);
  }
};
