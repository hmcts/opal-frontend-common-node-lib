import { ConfidentialClientApplication, Configuration, LogLevel } from '@azure/msal-node';
import { Logger } from '@hmcts/nodejs-logging';

/**
 * Creates and configures a new instance of `ConfidentialClientApplication` for Microsoft SSO authentication.
 *
 * @param clientId - The client (application) ID registered in Azure AD.
 * @param clientSecret - The client secret associated with the application.
 * @param tenantId - The Azure AD tenant ID.
 * @param microsoftUrl - The base Microsoft authority URL (e.g., "https://login.microsoftonline.com/").
 * @returns A configured `ConfidentialClientApplication` instance for use with MSAL.
 */
export default function ssoConfig(
  clientId: string,
  clientSecret: string,
  tenantId: string,
  microsoftUrl: string,
): ConfidentialClientApplication {
  const logger = Logger.getLogger('sso-msal-configuration');
  const msalConfig: Configuration = {
    auth: {
      clientId,
      authority: microsoftUrl + tenantId,
      clientSecret,
    },
    system: {
      loggerOptions: {
        loggerCallback(logLevel, message, containsPii) {
          if (containsPii) {
            return;
          }

          switch (logLevel) {
            case LogLevel.Error:
              logger.error('Error on SSO Configuration:', message);
              break;
            case LogLevel.Warning:
            case LogLevel.Info:
            case LogLevel.Verbose:
            default:
              break;
          }
        },
        piiLoggingEnabled: false,
        logLevel: LogLevel.Verbose,
      },
    },
  };

  return new ConfidentialClientApplication(msalConfig);
}
