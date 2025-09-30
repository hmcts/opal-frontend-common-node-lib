import os from 'node:os';
import healthcheck from '@hmcts/nodejs-healthcheck';
import { Application } from 'express';

/**
 * Sets up the HMCTS info and health endpoints
 */
export class HealthCheck {
  public enableFor(app: Application, buildInfoName: string): void {
    const redis = app.locals['redisClient']
      ? healthcheck.raw(() => app.locals['redisClient'].ping().then(healthcheck.up).catch(healthcheck.down))
      : null;

    healthcheck.addTo(app, {
      checks: {
        ...(redis ? { redis } : {}),
      },
      ...(redis
        ? {
            readinessChecks: {
              redis,
            },
          }
        : {}),
      buildInfo: {
        name: buildInfoName,
        host: os.hostname(),
        uptime: process.uptime(),
      },
    });
  }
}
