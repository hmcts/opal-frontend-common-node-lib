process.env['APPLICATIONINSIGHTS_CONFIGURATION_CONTENT'] = '{}';
import * as appInsights from 'applicationinsights';
import AppInsightConfig from '../interfaces/app-insights-config.js';

// As of 2.9.0 issue reading bundled applicationinsights.json
// https://github.com/microsoft/ApplicationInsights-node.js/issues/1226
// Define config below...

type AppInsightsConfiguration = {
  setDistributedTracingMode: (mode: number) => AppInsightsConfiguration;
  setAutoCollectRequests: (enabled: boolean) => AppInsightsConfiguration;
  setAutoCollectPerformance: (enabled: boolean, collectExtendedMetrics: boolean) => AppInsightsConfiguration;
  setAutoCollectExceptions: (enabled: boolean) => AppInsightsConfiguration;
  setAutoCollectDependencies: (enabled: boolean) => AppInsightsConfiguration;
  setAutoCollectConsole: (enabled: boolean, collectConsoleLog: boolean) => AppInsightsConfiguration;
  setAutoCollectPreAggregatedMetrics: (enabled: boolean) => AppInsightsConfiguration;
  setSendLiveMetrics: (enabled: boolean) => AppInsightsConfiguration;
  setInternalLogging: (enabled: boolean, enableDebugLogging: boolean) => AppInsightsConfiguration;
  enableWebInstrumentation: (enabled: boolean) => AppInsightsConfiguration;
  start: () => unknown;
};

type AppInsightsSdk = {
  DistributedTracingModes: {
    AI_AND_W3C: number;
  };
  setup: (connectionString: string) => AppInsightsConfiguration;
  defaultClient: {
    context: {
      tags: Record<string, string>;
      keys: {
        cloudRole: string;
      };
    };
    trackTrace: (telemetry: { message: string }) => void;
  };
};

export class AppInsights {
  constructor(private readonly sdk: AppInsightsSdk = appInsights) {}

  enable(enabled: boolean, connectionString: string | null, cloudRoleName: string | null): AppInsightConfig {
    if (enabled && connectionString) {
      this.sdk
        .setup(connectionString)
        .setDistributedTracingMode(this.sdk.DistributedTracingModes.AI_AND_W3C)
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
        this.sdk.defaultClient.context.tags[this.sdk.defaultClient.context.keys.cloudRole] = cloudRoleName;
      }
      this.sdk.defaultClient.trackTrace({
        message: 'App insights activated',
      });
    }

    return { enabled, connectionString, cloudRoleName };
  }
}
