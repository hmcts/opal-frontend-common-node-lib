import * as express from 'express';
import helmet from 'helmet';
import { Logger } from '@hmcts/nodejs-logging';

const logger = Logger.getLogger('helmet');
const self = "'self'";
const dynatraceDomain = '*.dynatrace.com';
const LaunchDarklyDomain = '*.launchdarkly.com';
const azureDomain = '*.azure.com';
const applicationInsightsDomain = '*.applicationinsights.azure.com';
/**
 * Module that enables helmet in the application
 * Removed redundant google fonts and aligned with rpx-xui-node-lib
 * https://github.com/hmcts/rpx-xui-node-lib/blob/056788aeb79ea2250cc3c8f92f6a5df689367a63/src/common/util/contentSecurityPolicy.ts
 */
export class Helmet {
  private readonly developmentMode: boolean;
  constructor(developmentMode: boolean) {
    this.developmentMode = developmentMode;
  }

  public enableFor(app: express.Express, enabled: boolean): void {
    if (enabled) {
      logger.info('Helmet enabled');
      // include default helmet functions
      const scriptSrc = [
        self,
        dynatraceDomain,
        "'sha256-+6WnXIl4mbFTCARd8N3COQmT3bJJmo32N8q8ZSQAIcU='",
        "'unsafe-inline'",
      ];

      if (this.developmentMode) {
        // Uncaught EvalError: Refused to evaluate a string as JavaScript because 'unsafe-eval'
        // is not an allowed source of script in the following Content Security Policy directive:
        // "script-src 'self' *.google-analytics.com 'sha256-+6WnXIl4mbFTCARd8N3COQmT3bJJmo32N8q8ZSQAIcU='".
        // seems to be related to webpack
        scriptSrc.push("'unsafe-eval'");
      }

      app.use(
        helmet({
          contentSecurityPolicy: {
            directives: {
              connectSrc: [self, dynatraceDomain, LaunchDarklyDomain, azureDomain, applicationInsightsDomain],
              defaultSrc: ["'none'"],
              fontSrc: [self, 'data:'],
              imgSrc: [self],
              objectSrc: [self],
              scriptSrc,
              styleSrc: [self, "'unsafe-inline'"],
              scriptSrcAttr: ["'unsafe-inline'"],
            },
          },
          referrerPolicy: { policy: 'origin' },
        }),
      );
    }
  }
}
