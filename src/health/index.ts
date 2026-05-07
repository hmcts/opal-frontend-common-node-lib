import os from 'node:os';
import healthcheck from '@hmcts/nodejs-healthcheck';
import { Application } from 'express';
import { REDIS_CLIENT_APP_LOCAL_KEY } from '../constants/redis-client-app-local-key.js';

/**
 * Sets up the HMCTS info and health endpoints
 */
export class HealthCheck {
  public enableFor(app: Application, buildInfoName: string): void {
    const redisClient = app.locals[REDIS_CLIENT_APP_LOCAL_KEY];
    const redis = redisClient
      ? healthcheck.raw(() => redisClient.ping().then(healthcheck.up).catch(healthcheck.down))
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
