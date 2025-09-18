import { Response } from 'express';
import { Logger } from '@hmcts/nodejs-logging';

/**
 * Logs out the user from Microsoft SSO by redirecting to the Azure logout endpoint.
 *
 * Constructs the Azure logout URL using the provided Microsoft URL with tenant ID and
 * the post-logout redirect URI, then redirects the response to this URL.
 * If an error occurs during the process, logs the error and sends a 500 response.
 *
 * @param res - The HTTP response object used to perform the redirect.
 * @param microsoftUrlWithTenantId - The base Microsoft URL including the tenant ID.
 * @param ssoLogoutCallback - The URI to redirect to after logout is complete.
 * @returns A promise that resolves when the logout process is complete.
 */
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
