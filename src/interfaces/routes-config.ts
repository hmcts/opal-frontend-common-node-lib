class RoutesConfiguration {
  frontendHostname = '';
  prefix = '';
  clientId = '';
  clientSecret = '';
  tenantId = '';
  microsoftUrl = '';
  internalServerErrorPath = '';

  constructor(initialValues?: Partial<RoutesConfiguration>) {
    Object.assign(this, initialValues);
  }
}

export default RoutesConfiguration;
