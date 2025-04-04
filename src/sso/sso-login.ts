import { NextFunction, Request, Response } from 'express';
import { Logger } from '@hmcts/nodejs-logging';
import axios from 'axios';

export default async (
  req: Request,
  res: Response,
  next: NextFunction,
  opalApiUrl: string,
  frontendHostname: string,
) => {
  const INTERNAL_USER_LOGIN = `${opalApiUrl}/internal-user/login-or-refresh`;
  const logger = Logger.getLogger('login');

  // const env = process.env['NODE_ENV'] || 'development';
  // const hostname = env === 'development' ? config.get('frontend-hostname.dev') : config.get('frontend-hostname.prod');
  const url = `${INTERNAL_USER_LOGIN}?redirect_uri=${frontendHostname}/sso/login-callback`;

  try {
    const response = await axios.get(url);
    const redirectUrl = response.request.res.responseUrl;

    if (redirectUrl) {
      res.redirect(redirectUrl);
    } else {
      const error = new Error('Error trying to fetch login page');
      logger.error('Error on login', error);
      return next(error);
    }
  } catch (error) {
    logger.error('Error on login', error);
    return next(error);
  }
};
