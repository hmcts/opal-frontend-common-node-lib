import AppInsightsConfig from './app-insights-config.js';
import LaunchDarklyConfig from './launch-darkly-config.js';

class TransferServerState {
  launchDarklyConfig!: LaunchDarklyConfig;
  ssoEnabled!: boolean;
  appInsightsConfig!: AppInsightsConfig;
  userStateCacheExpirationMilliseconds!: number;
}

export default TransferServerState;
