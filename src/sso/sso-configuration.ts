import { ConfidentialClientApplication, Configuration, LogLevel } from '@azure/msal-node';
import { Logger } from '@hmcts/nodejs-logging';

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
