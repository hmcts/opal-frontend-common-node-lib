import AppInsightConfig from '../interfaces/app-insights-config';

export default class AppInsightsConfiguration {
  public enableFor(enabled: boolean, connectionString: string | null, cloudRoleName: string | null): AppInsightConfig {
    const appInsightsConfig: AppInsightConfig = {
      enabled: enabled,
      connectionString: null,
      cloudRoleName: null,
    };

    if (enabled && connectionString && cloudRoleName) {
      appInsightsConfig.connectionString = connectionString;
      appInsightsConfig.cloudRoleName = cloudRoleName;
    }

    return appInsightsConfig;
  }
}
