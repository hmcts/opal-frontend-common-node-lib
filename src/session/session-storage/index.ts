import { Logger } from '@hmcts/nodejs-logging';
import SessionStorageConfiguration from '@hmcts/opal-frontend-common-node/interfaces/session-storage-config';
import { RedisStore } from 'connect-redis';
import cookieParser from 'cookie-parser';
import { Application } from 'express';
import session from 'express-session';
import { createClient, createCluster } from 'redis';
import FileStoreFactory from 'session-file-store';
import { REDIS_CLIENT_APP_LOCAL_KEY } from '../../constants/redis-client-app-local-key.js';

const FileStore = FileStoreFactory(session);
const logger = Logger.getLogger('session-storage');

export default class SessionStorage {
  private getRedisConnectionUrls(connectionString: string): URL[] {
    return connectionString.split(',').map((nodeConnectionString) => new URL(nodeConnectionString.trim()));
  }

  private getRedisConnectionLogMessage(connectionUrls: URL[]): string {
    return connectionUrls.map((redisUrl) => `${redisUrl.protocol}//${redisUrl.host}`).join(',');
  }

  private getStore(app: Application, enabled: boolean, connectionString: string, clusterEnabled: boolean) {
    if (enabled) {
      const redisConnectionUrls = this.getRedisConnectionUrls(connectionString);
      logger.info('Using Redis session store', {
        clusterEnabled,
        redisNodes: this.getRedisConnectionLogMessage(redisConnectionUrls),
      });
      const client = clusterEnabled
        ? createCluster({
            rootNodes: redisConnectionUrls.map((redisUrl) => ({ url: redisUrl.toString() })),
            defaults: {
              socket: {
                reconnectStrategy: function (retries) {
                  if (retries > 20) {
                    logger.log('Too many attempts to reconnect. Redis connection was terminated');
                    return new Error('Too many retries.');
                  } else {
                    return retries * 500;
                  }
                },
              },
            },
          })
        : createClient({
            url: connectionString,
            socket: {
              reconnectStrategy: function (retries) {
                if (retries > 20) {
                  logger.log('Too many attempts to reconnect. Redis connection was terminated');
                  return new Error('Too many retries.');
                } else {
                  return retries * 500;
                }
              },
            },
          });

      client.on('error', (error: unknown) => {
        if (clusterEnabled) {
          logger.error('Redis Cluster Client Error', error);
          return;
        }

        logger.error('Redis Client Error', error);
      });

      client.connect().catch(() => {
        process.exit();
      });

      app.locals[REDIS_CLIENT_APP_LOCAL_KEY] = client;
      return new RedisStore({ client });
    }

    return new FileStore({ path: '/tmp' });
  }
  public enableFor(app: Application, sessionStorage: SessionStorageConfiguration): void {
    app.use(cookieParser(sessionStorage.secret));
    app.set('trust proxy', 1);

    app.use(
      session({
        name: sessionStorage.prefix,
        resave: false,
        saveUninitialized: false,
        secret: sessionStorage.secret,
        cookie: {
          httpOnly: true,
          maxAge: sessionStorage.maxAge,
          sameSite: sessionStorage.sameSite,
          secure: sessionStorage.secure,
          domain: sessionStorage.domain,
        },
        rolling: true,
        store: this.getStore(
          app,
          sessionStorage.redisEnabled,
          sessionStorage.redisConnectionString,
          sessionStorage.clusterEnabled ?? false,
        ),
      }),
    );
  }
}
