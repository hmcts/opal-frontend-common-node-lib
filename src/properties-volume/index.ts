import * as propertiesVolume from '@hmcts/properties-volume';
import { IConfig } from 'config';
import { Application } from 'express';

export class PropertiesVolume {
  enableFor(server: Application, config: IConfig): IConfig {
    if (server.locals['ENV'] !== 'development') {
      propertiesVolume.addTo(config);
    }
    return config;
  }
}
