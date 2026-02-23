import * as propertiesVolume from '@hmcts/properties-volume';
import { Config } from 'config';
import { Application } from 'express';

export class PropertiesVolume {
  enableFor(server: Application, config: Config): Config {
    if (server.locals['ENV'] !== 'development') {
      propertiesVolume.addTo(config);
    }
    return config;
  }
}
