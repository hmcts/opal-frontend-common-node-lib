import { Application } from 'express';
import bodyParser from 'body-parser';

import type { NextFunction, Request, Response } from 'express';

import { ssoAuthenticated, ssoLoginCallback, ssoLogin, ssoLogout, ssoLogoutCallback } from '../sso';
import {
  ssoLoginStub,
  ssoLoginCallbackStub,
  ssoAuthenticatedStub,
  ssoLogoutStub,
  ssoLogoutCallbackStub,
} from '../stubs/sso';
import opalApiProxy from '@hmcts/opal-frontend-common-node/proxy/opal-api-proxy';
import sessionExpiry from '@hmcts/opal-frontend-common-node/session/session-expiry';
import sessionUserState from '@hmcts/opal-frontend-common-node/session/session-user-state';
import ExpiryConfiguration from '@hmcts/opal-frontend-common-node/interfaces/session-expiry-config';
import RoutesConfiguration from '@hmcts/opal-frontend-common-node/interfaces/routes-config';
import ProxyConfiguration from '@hmcts/opal-frontend-common-node/interfaces/proxy-config';
import SsoConfiguration from '@hmcts/opal-frontend-common-node/interfaces/sso-config';
import SessionConfiguration from '@hmcts/opal-frontend-common-node/interfaces/session-config';

export class Routes {
  public enableFor(
    app: Application,
    ssoEnabled: boolean,
    expiryConfiguration: ExpiryConfiguration,
    routesConfiguration: RoutesConfiguration,
    sessionConfiguration: SessionConfiguration,
    proxyConfiguration: ProxyConfiguration,
    ssoConfiguration: SsoConfiguration,
  ): void {
    app.use(proxyConfiguration.opalApiProxyUrl, opalApiProxy(routesConfiguration.opalApiTarget));
    app.use(proxyConfiguration.opalFinesServiceProxyUrl, opalApiProxy(routesConfiguration.opalFinesServiceTarget));

    // Declare use of body-parser AFTER the use of proxy https://github.com/villadora/express-http-proxy
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));

    this.setupSSORoutes(
      app,
      ssoEnabled,
      routesConfiguration.opalApiTarget,
      routesConfiguration.frontendHostname,
      routesConfiguration.prefix,
      ssoConfiguration,
    );

    app.get(sessionConfiguration.userStateUrl, (req: Request, res: Response) => sessionUserState(req, res));
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

  private setupSSORoutes(
    app: Application,
    ssoEnabled: boolean,
    opalApiUrl: string,
    frontendHostname: string,
    prefix: string,
    ssoConfiguration: SsoConfiguration,
  ): void {
    const login = ssoEnabled ? ssoLogin : ssoLoginStub;
    const loginCallback = ssoEnabled ? ssoLoginCallback : ssoLoginCallbackStub;
    const logout = ssoEnabled ? ssoLogout : ssoLogoutStub;
    const logoutCallback = ssoEnabled ? ssoLogoutCallback : ssoLogoutCallbackStub;
    const authenticated = ssoEnabled ? ssoAuthenticated : ssoAuthenticatedStub;

    const loginCallbackType = ssoEnabled ? 'post' : 'get';

    app.get(ssoConfiguration.login, (req: Request, res: Response, next: NextFunction) =>
      login(req, res, next, opalApiUrl, frontendHostname),
    );

    const routePath = ssoConfiguration.loginCallback;
    const callbackHandler = (req: Request, res: Response, next: NextFunction) =>
      loginCallback(req, res, next, opalApiUrl);

    if (loginCallbackType === 'post') {
      app.post(routePath, callbackHandler);
    } else {
      app.get(routePath, callbackHandler);
    }

    app.get(ssoConfiguration.logout, (req: Request, res: Response, next: NextFunction) =>
      logout(req, res, next, opalApiUrl, frontendHostname),
    );
    app.get(ssoConfiguration.logoutCallback, (req: Request, res: Response, next: NextFunction) =>
      logoutCallback(req, res, next, prefix),
    );
    app.get(ssoConfiguration.authenticated, (req: Request, res: Response) => authenticated(req, res));
  }
}
