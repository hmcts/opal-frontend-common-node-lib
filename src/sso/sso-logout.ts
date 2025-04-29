import { Response } from 'express';
import { Logger } from '@hmcts/nodejs-logging';

export default async function ssoLogout(
  res: Response,
  microsoftUrlWithTenantId: string,
  ssoLogoutCallback: string,
): Promise<void> {
  const logger = Logger.getLogger('sso-logout');

  try {
    const azureLogoutUrl = `${microsoftUrlWithTenantId}/oauth2/v2.0/logout?post_logout_redirect_uri=${ssoLogoutCallback}`;

    res.redirect(azureLogoutUrl);
  } catch (error) {
    logger.error('Error on SSO Logout:', error);
    res.status(500).send('Logout failed');
  }
}
