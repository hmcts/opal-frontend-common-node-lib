import ProxyConfiguration from '../interfaces/proxy-config.js';

export const DEFAULT_PROXY_CONFIG: Readonly<ProxyConfiguration> = Object.freeze({
  opalFinesServiceUrl: null,
  opalUserServiceUrl: null,
  opalRmServiceUrl: null,
  timeoutInMilliseconds: null,
});
