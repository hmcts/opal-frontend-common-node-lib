import { NextFunction, Response } from 'express';
import { Logger } from '@hmcts/nodejs-logging';
import { ConfidentialClientApplication } from '@azure/msal-node';

export default async (
  res: Response,
  next: NextFunction,
  msalInstance: ConfidentialClientApplication,
  frontendHostname: string,
  ssoLoginCallback: string,
) => {
  const logger = Logger.getLogger('sso-login');
  try {
    const authCodeUrl = await msalInstance.getAuthCodeUrl({
      scopes: ['user.read'],
      redirectUri: `${frontendHostname}${ssoLoginCallback}`,
      responseMode: 'form_post',
    });

    res.redirect(authCodeUrl);
  } catch (error) {
    logger.error('Error on SSO Login:', error);
    next(error);
  }
};
