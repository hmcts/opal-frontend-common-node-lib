import { NextFunction, Response } from 'express';
import { Logger } from '@hmcts/nodejs-logging';
import { ConfidentialClientApplication } from '@azure/msal-node';

/**
 * Initiates the SSO login process by generating an authorization code URL and redirecting the user.
 *
 * @param res - The Express response object used to redirect the user.
 * @param next - The Express next middleware function for error handling.
 * @param msalInstance - An instance of MSAL ConfidentialClientApplication used to generate the auth code URL.
 * @param frontendHostname - The base URL of the frontend application.
 * @param ssoLoginCallback - The callback path to be appended to the frontend hostname for redirection after login.
 *
 * @remarks
 * This function constructs the authorization code URL with the required scopes and redirect URI,
 * then redirects the user to the authentication provider. If an error occurs, it logs the error and
 * passes it to the next middleware.
 */
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
