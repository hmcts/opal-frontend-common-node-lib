import { Request, Response } from 'express';
import { ConfidentialClientApplication } from '@azure/msal-node';
import 'express-session';
import { SecurityToken } from '../interfaces';
import { Logger } from '@hmcts/nodejs-logging';

const logger = Logger.getLogger('sso-login-callback');

/**
 * Handles the SSO login callback by exchanging the authorization code for tokens using MSAL,
 * storing the access token in the session, and redirecting the user to the frontend.
 *
 * @param req - The Express request object, expected to contain the authorization code in the body.
 * @param res - The Express response object, used to send responses or perform redirects.
 * @param msalInstance - An instance of MSAL ConfidentialClientApplication used to acquire tokens.
 * @param clientId - The client ID of the application, used to build the token request scope.
 * @param frontendHostname - The base URL of the frontend application, used for redirect URIs.
 * @param ssoLoginCallback - The path of the SSO login callback, appended to the frontend hostname for redirect URI.
 * @returns A promise that resolves when the callback handling is complete.
 *
 * @remarks
 * - If the authorization code is missing, responds with HTTP 400.
 * - On successful token acquisition, stores the access token in the session and redirects to the frontend.
 * - On error, logs the error and responds with HTTP 500.
 */
export default async function ssoLoginCallbackHandler(
  req: Request,
  res: Response,
  msalInstance: ConfidentialClientApplication,
  clientId: string,
  frontendHostname: string,
  ssoLoginCallback: string,
): Promise<void> {
  // Build the token request for MSAL using the auth code returned by the IdP.
  const tokenRequest = {
    code: req.body['code'] as string,
    scopes: [`api://${clientId}/opalinternaluser`],
    redirectUri: `${frontendHostname}${ssoLoginCallback}`,
  };

  if (!tokenRequest.code) {
    logger.warn('Missing authorization code on SSO callback');
    res.status(400).send('Missing authorization code');
    return;
  }

  try {
    // Exchange the authorization code for tokens (access token and ID token).
    const response = await msalInstance.acquireTokenByCode(tokenRequest);
    if (!response?.idTokenClaims) {
      throw new Error('Invalid token response.');
    }

    const accessToken = response.accessToken;

    // Persist only the access token in the session. User state is retrieved later via opal-user-service.
    const securityToken: SecurityToken = {
      user_state: undefined,
      access_token: accessToken,
    };

    // Store the token on the session and return to the frontend.
    req.session.securityToken = securityToken;
    res.redirect(frontendHostname);
  } catch (error) {
    logger.error('Error on SSO Login Callback', { error });
    res.status(500).send('SSO login callback failed');
  }
}
