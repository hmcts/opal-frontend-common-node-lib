import { Logger } from '@hmcts/nodejs-logging';
import SessionStorageConfiguration from '@hmcts/opal-frontend-common-node/interfaces/session-storage-config';
import { RedisStore } from 'connect-redis';
import cookieParser from 'cookie-parser';
import { Application } from 'express';
import session from 'express-session';
import { createClient } from 'redis';
import FileStoreFactory from 'session-file-store';

const FileStore = FileStoreFactory(session);
const logger = Logger.getLogger('session-storage');

export default class SessionStorage {
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
        store: this.getStore(app, sessionStorage.redisEnabled, sessionStorage.redisConnectionString),
      }),
    );
  }

  private getStore(app: Application, enabled: boolean, connectionString: string) {
    if (enabled) {
      logger.info('Using Redis session store', connectionString);
      const client = createClient({
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

      client.on('error', (err) => {
        logger.error('Redis Client Error', err);
      });

      client.connect().catch(() => {
        process.exit();
      });

      app.locals['redisClient'] = client;
      return new RedisStore({ client });
    }

    return new FileStore({ path: '/tmp' });
  }
}
