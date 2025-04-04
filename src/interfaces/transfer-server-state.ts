import AppInsightsConfig from './app-insights-config';
import LaunchDarklyConfig from './launch-darkly-config';

class TransferServerState {
  launchDarklyConfig!: LaunchDarklyConfig;
  ssoEnabled!: boolean;
  appInsightsConfig!: AppInsightsConfig;
}

export default TransferServerState;
