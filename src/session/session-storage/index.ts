import { Logger } from '@hmcts/nodejs-logging';
import SessionStorageConfiguration from '@hmcts/opal-frontend-common-node/interfaces/session-storage-config';
import { RedisStore } from 'connect-redis';
import cookieParser from 'cookie-parser';
import { Application } from 'express';
import session from 'express-session';
import { createClient, createCluster, type RedisClientType, type RedisClusterType } from 'redis';
import FileStoreFactory from 'session-file-store';
import { REDIS_CLIENT_APP_LOCAL_KEY } from '../../constants/redis-client-app-local-key.js';

const FileStore = FileStoreFactory(session);
const logger = Logger.getLogger('session-storage');

type RedisSessionClient = RedisClientType | RedisClusterType;

export default class SessionStorage {
  private getReconnectStrategy() {
    return function (retries: number) {
      if (retries > 20) {
        logger.log('Too many attempts to reconnect. Redis connection was terminated');
        return new Error('Too many retries.');
      } else {
        return retries * 500;
      }
    };
  }

  private createRedisClient(connectionString: string, clusterEnabled: boolean): RedisSessionClient {
    if (!clusterEnabled) {
      return createClient({
        url: connectionString,
        socket: {
          reconnectStrategy: this.getReconnectStrategy(),
        },
      });
    }

    const redisUrl = new URL(connectionString);

    return createCluster({
      rootNodes: [{ url: connectionString }],
      defaults: {
        ...(redisUrl.username ? { username: decodeURIComponent(redisUrl.username) } : {}),
        ...(redisUrl.password ? { password: decodeURIComponent(redisUrl.password) } : {}),
        socket: {
          tls: redisUrl.protocol === 'rediss:',
          reconnectStrategy: this.getReconnectStrategy(),
        },
      },
    });
  }

  private getStore(app: Application, enabled: boolean, connectionString: string, clusterEnabled: boolean) {
    if (enabled) {
      const redisUrl = new URL(connectionString);
      logger.info(
        `Using ${clusterEnabled ? 'clustered' : 'standalone'} Redis session store`,
        `${redisUrl.protocol}//${redisUrl.host}`,
      );
      const client = this.createRedisClient(connectionString, clusterEnabled);

      client.on('error', (err) => {
        logger.error('Redis Client Error', err);
      });
      client.on('node-error', (err) => {
        logger.error('Redis Cluster Node Error', err);
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
          sessionStorage.redisClusterEnabled === true,
        ),
      }),
    );
  }
}
