import LaunchDarklyConfig from '../interfaces/launch-darkly-config.js';

export class LaunchDarkly {
  public enableFor(enabled: boolean, stream: boolean, clientId: string | null): LaunchDarklyConfig {
    const launchDarklyConfig: LaunchDarklyConfig = {
      enabled: enabled,
      clientId: null,
      stream: stream,
    };

    if (launchDarklyConfig.enabled && clientId) {
      launchDarklyConfig.clientId = clientId;
    }

    return launchDarklyConfig;
  }
}
