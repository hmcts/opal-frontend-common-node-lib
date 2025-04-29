import { Request, Response } from 'express';
import { ConfidentialClientApplication } from '@azure/msal-node';
import 'express-session';
import { SecurityToken } from '../interfaces';
import { Logger } from '@hmcts/nodejs-logging';

interface CustomIdTokenClaims {
  preferred_username?: string;
  [key: string]: unknown;
}

export default async (
  req: Request,
  res: Response,
  msalInstance: ConfidentialClientApplication,
  frontendHostname: string,
  ssoLoginCallback: string,
) => {
  const logger = Logger.getLogger('sso-login-callback');

  const tokenRequest = {
    code: req.body['code'] as string,
    scopes: ['user.read'],
    redirectUri: `${frontendHostname}${ssoLoginCallback}`,
    enableSpaAuthorizationCode: true,
  };

  msalInstance
    .acquireTokenByCode(tokenRequest)
    .then((response) => {
      if (!response || !response.idTokenClaims) {
        throw new Error('Invalid token response.');
      }

      const idTokenClaims = response.idTokenClaims as CustomIdTokenClaims;

      const securityToken: SecurityToken = {
        user_state: {
          user_id: idTokenClaims.preferred_username ?? '',
          user_name: idTokenClaims.preferred_username ?? '',
          business_unit_user: [],
        },
        access_token: response.accessToken,
      };

      // Save important parts to session
      req.session.securityToken = securityToken;

      res.redirect(frontendHostname);
    })
    .catch((error) => {
      logger.error('Error on SSO Login Callback:', error);
      res.status(500).send(error);
    });
};
