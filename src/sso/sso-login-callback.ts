import { Request, Response } from 'express';
import { ConfidentialClientApplication } from '@azure/msal-node';
import 'express-session';
import { SecurityToken } from '../interfaces';
import { Logger } from '@hmcts/nodejs-logging';

const logger = Logger.getLogger('sso-login-callback');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    // Retry acquireTokenByCode up to 3 times if it fails with a network error
    const maxRetries = 3;
    let response;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await msalInstance.acquireTokenByCode(tokenRequest);
        break;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isTransient = (e: any) =>
          e?.errorCode === 'network_error' || ['ECONNRESET', 'ETIMEDOUT'].includes(e?.code);
        if (isTransient(err) && attempt < maxRetries) {
          logger.warn(`Network error on acquireTokenByCode, retrying attempt ${attempt}...`);
          await sleep(200 * attempt);
          continue;
        }
        throw err;
      }
    }

    if (!response?.idTokenClaims) {
      throw new Error('Invalid token response.');
    }

    if (!response?.accessToken) throw new Error('No access token in token response');

    const accessToken = response.accessToken;

    const securityToken: SecurityToken = {
      user_state: undefined,
      access_token: accessToken,
    };

    req.session.securityToken = securityToken;
    req.session.save(() => res.redirect(frontendHostname));
    return;
  } catch (error) {
    logger.error('Error on SSO Login Callback', {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errorCode: (error as any)?.errorCode,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      correlationId: (error as any)?.correlationId,
    });
    res.status(500).send('SSO login callback failed');
  }
}
