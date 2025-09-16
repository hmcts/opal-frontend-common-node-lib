/**
 * SSO Login Callback Handler
 *
 * Purpose:
 * - Handles the redirect from Azure AD/Microsoft Identity after a successful login.
 * - Exchanges the authorization code for an access token using MSAL (ConfidentialClientApplication).
 * - Stores only the access token in the session (under `req.session.securityToken.access_token`).
 * - Intentionally does **not** cache user state. User state is fetched on demand from the opal-user-service.
 *
 * Returns:
 * - 302 redirect to the provided `frontendHostname` on success.
 * - 400 if the authorization code is missing.
 * - 500 if the token exchange fails.
 *
 * Security:
 * - Uses the `api://{clientId}/opalinternaluser` scope to get a token for the backend API.
 * - Avoids logging sensitive tokens; errors are logged with context only.
 *
 * Notes:
 * - `frontendHostname` and `ssoLoginCallback` must combine to the same redirect URI registered in Azure AD.
 * - This handler should be mounted on the route configured as the redirect/callback in your app registration.
 */
import { Request, Response } from 'express';
import { ConfidentialClientApplication } from '@azure/msal-node';
import 'express-session';
import { SecurityToken } from '../interfaces';
import { Logger } from '@hmcts/nodejs-logging';

const logger = Logger.getLogger('sso-login-callback');

/**
 * Express handler for the SSO login callback.
 *
 * @param req - Express request containing the POSTed `code` (authorization code) in the body.
 * @param res - Express response.
 * @param msalInstance - A configured MSAL ConfidentialClientApplication used for code exchange.
 * @param clientId - The Azure App Registration (client) ID of the resource (opal user service audience).
 * @param frontendHostname - Absolute URL of the frontend host (used for redirectUri and final redirect).
 * @param ssoLoginCallback - The path component of the registered redirect URI (e.g. `/auth/callback`).
 * @returns void
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
