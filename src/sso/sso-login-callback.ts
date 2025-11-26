import { Request, Response } from 'express';
import { ConfidentialClientApplication } from '@azure/msal-node';
import 'express-session';
import { RoutesConfiguration, SecurityToken } from '../interfaces';
import { Logger } from '@hmcts/nodejs-logging';
import { handleCheckUser } from '../services/opal-user-service';
import OpalUserServiceConfiguration from '../interfaces/opal-user-service-config';

const logger = Logger.getLogger('sso-login-callback');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Handles the SSO login callback by processing the authorization code, acquiring tokens,
 * and managing the user in the Opal User Service. This function is designed to handle
 * transient network errors during token acquisition and ensures proper session management.
 *
 * @param req - The HTTP request object containing the authorization code in the body.
 * @param res - The HTTP response object used to send responses back to the client.
 * @param msalInstance - An instance of the MSAL ConfidentialClientApplication used to acquire tokens.
 * @param clientId - The client ID of the application registered in Azure AD.
 * @param frontendHostname - The hostname of the frontend application.
 * @param ssoLoginCallback - The relative path of the SSO login callback endpoint.
 * @param opalUserServiceTarget - The target URL of the Opal User Service for user validation.
 * @param opalUserServiceConfig - Configuration options for the Opal User Service.
 *
 * @returns A promise that resolves when the SSO login callback process is complete.
 *
 * @throws Will throw an error if token acquisition fails after retries or if user validation fails.
 */
export default async function ssoLoginCallbackHandler(
  req: Request,
  res: Response,
  msalInstance: ConfidentialClientApplication,
  ssoLoginCallback: string,
  routesConfiguration: RoutesConfiguration,
  opalUserServiceConfig: OpalUserServiceConfiguration,
): Promise<void> {
  // Build the token request for MSAL using the auth code returned by the IdP.
  const tokenRequest = {
    code: req.body['code'] as string,
    scopes: [`api://${routesConfiguration.clientId}/opalinternaluser`],
    redirectUri: `${routesConfiguration.frontendHostname}${ssoLoginCallback}`,
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

    // Validate and manage user in opal-user-service
    const userManagementSuccess = await handleCheckUser(
      routesConfiguration.opalUserServiceTarget,
      accessToken,
      opalUserServiceConfig,
    );
    if (!userManagementSuccess) {
      logger.error('User management failed after successful token acquisition');
      res.status(500).send('User validation failed');
      return;
    }

    const securityToken: SecurityToken = {
      user_state: undefined,
      access_token: accessToken,
    };

    req.session.securityToken = securityToken;
    req.session.save(() => res.redirect(routesConfiguration.frontendHostname));
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
