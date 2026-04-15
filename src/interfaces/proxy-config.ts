class ProxyConfiguration {
  opalApiUrl: string | null = null;
  opalFinesServiceUrl: string | null = null;
  opalUserServiceUrl: string | null = null;
  opalRmServiceUrl: string | null = null;

  constructor(initialValues?: Partial<ProxyConfiguration>) {
    Object.assign(this, initialValues);
  }
}

export default ProxyConfiguration;
