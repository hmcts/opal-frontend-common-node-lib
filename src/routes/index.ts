import { Application } from 'express';
import bodyParser from 'body-parser';
import type { NextFunction, Request, Response } from 'express';
import { ssoAuthenticated, ssoLogin, ssoLoginCallback } from '../sso';
import createMsalInstance from '../sso/sso-configuration';
import ssoLogout from '../sso/sso-logout';
import { ssoAuthenticatedStub, ssoLogoutCallbackStub, ssoLoginStub, ssoLoginCallbackStub } from '../stubs/sso';
import sessionExpiry from '@hmcts/opal-frontend-common-node/session/session-expiry';
import ExpiryConfiguration from '@hmcts/opal-frontend-common-node/interfaces/session-expiry-config';
import RoutesConfiguration from '@hmcts/opal-frontend-common-node/interfaces/routes-config';
import SsoConfiguration from '@hmcts/opal-frontend-common-node/interfaces/sso-config';
import SessionConfiguration from '@hmcts/opal-frontend-common-node/interfaces/session-config';
import ssoLogoutCallback from '../sso/sso-logout-callback';
import OpalUserServiceConfig from '../interfaces/opal-user-service-config';

export class Routes {
  private setupSSORoutes(
    app: Application,
    ssoConfiguration: SsoConfiguration,
    routesConfiguration: RoutesConfiguration,
    opalUserServiceConfig: OpalUserServiceConfig,
  ): void {
    if (!routesConfiguration.clientId || !routesConfiguration.clientSecret || !routesConfiguration.tenantId) {
      throw new Error('Missing essential SSO configuration fields: clientId, clientSecret, or tenantId');
    }

    // SSO CONFIGURATION
    const confidentialClient = createMsalInstance(
      routesConfiguration.clientId,
      routesConfiguration.clientSecret,
      routesConfiguration.tenantId,
      routesConfiguration.microsoftUrl,
    );

    // LOGIN
    app.get(ssoConfiguration.login, (req: Request, res: Response, next: NextFunction) =>
      ssoLogin(res, next, confidentialClient, routesConfiguration.frontendHostname, ssoConfiguration.loginCallback),
    );

    // LOGIN CALLBACK
    app.post(ssoConfiguration.loginCallback, (req: Request, res: Response) =>
      ssoLoginCallback(
        req,
        res,
        confidentialClient,
        routesConfiguration.clientId,
        routesConfiguration.frontendHostname,
        ssoConfiguration.loginCallback,
        routesConfiguration.opalUserServiceTarget,
        opalUserServiceConfig,
      ),
    );

    // LOGOUT
    app.get(ssoConfiguration.logout, (req: Request, res: Response) =>
      ssoLogout(
        res,
        `${routesConfiguration.microsoftUrl}${routesConfiguration.tenantId}`,
        `${routesConfiguration.frontendHostname}${ssoConfiguration.logoutCallback}`,
      ),
    );

    // LOGOUT CALLBACK
    app.get(ssoConfiguration.logoutCallback, (req: Request, res: Response, next: NextFunction) =>
      ssoLogoutCallback(req, res, next, routesConfiguration.prefix),
    );

    // AUTHENTICATED
    app.get(ssoConfiguration.authenticated, (req: Request, res: Response) => ssoAuthenticated(req, res));
  }

  private setupStubRoutes(
    app: Application,
    ssoConfiguration: SsoConfiguration,
    routesConfiguration: RoutesConfiguration,
  ): void {
    // LOGIN
    app.get(ssoConfiguration.login, (req: Request, res: Response, next: NextFunction) => ssoLoginStub(req, res, next));

    // LOGIN CALLBACK
    app.get(ssoConfiguration.loginCallback, (req: Request, res: Response, next: NextFunction) =>
      ssoLoginCallbackStub(req, res, next, routesConfiguration.opalApiTarget),
    );

    // LOGOUT
    app.get(ssoConfiguration.logout, (req: Request, res: Response, next: NextFunction) =>
      ssoLogoutCallbackStub(req, res, next, routesConfiguration.prefix),
    );

    // LOGOUT CALLBACK
    app.get(ssoConfiguration.logoutCallback, (req: Request, res: Response, next: NextFunction) =>
      ssoLogoutCallbackStub(req, res, next, routesConfiguration.prefix),
    );

    // AUTHENTICATED
    app.get(ssoConfiguration.authenticated, (req: Request, res: Response) => ssoAuthenticatedStub(req, res));
  }

  public enableFor(
    app: Application,
    ssoEnabled: boolean,
    expiryConfiguration: ExpiryConfiguration,
    routesConfiguration: RoutesConfiguration,
    sessionConfiguration: SessionConfiguration,
    ssoConfiguration: SsoConfiguration,
    opalUserServiceConfig: OpalUserServiceConfig,
  ): void {
    // Declare use of body-parser AFTER the use of proxy https://github.com/villadora/express-http-proxy
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));

    if (ssoEnabled) {
      this.setupSSORoutes(app, ssoConfiguration, routesConfiguration, opalUserServiceConfig);
    } else {
      this.setupStubRoutes(app, ssoConfiguration, routesConfiguration);
    }

    app.get(sessionConfiguration.sessionExpiryUrl, (req: Request, res: Response) =>
      sessionExpiry(
        req,
        res,
        expiryConfiguration.testMode,
        expiryConfiguration.expiryTimeInMilliseconds,
        expiryConfiguration.warningThresholdInMilliseconds,
      ),
    );
  }
}
