process.env['APPLICATIONINSIGHTS_CONFIGURATION_CONTENT'] = '{}';
import * as appInsights from 'applicationinsights';
import AppInsightConfig from '../interfaces/app-insights-config';
import AppInsightsConfiguration from './app-insights-configuration';

// As of 2.9.0 issue reading bundled applicationinsights.json
// https://github.com/microsoft/ApplicationInsights-node.js/issues/1226
// Define config below...

export class AppInsights {
  enable(enabled: boolean, connectionString: string | null, cloudRoleName: string | null): AppInsightConfig {
    const appInsightsConfigInstance = new AppInsightsConfiguration();
    const appInsightsConfig = appInsightsConfigInstance.enableFor(enabled, connectionString, cloudRoleName);

    if (enabled && connectionString) {
      appInsights
        .setup(connectionString)
        .setAutoCollectRequests(true)
        .setAutoCollectPerformance(true, true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .setAutoCollectConsole(true, false)
        .setAutoCollectPreAggregatedMetrics(true)
        .setSendLiveMetrics(true)
        .setInternalLogging(false, true)
        .enableWebInstrumentation(false)
        .start();

      if (cloudRoleName) {
        appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRole] = cloudRoleName;
      }
      appInsights.defaultClient.trackTrace({
        message: 'App insights activated',
      });
    }

    return appInsightsConfig;
  }
}
