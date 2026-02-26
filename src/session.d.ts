import { SecurityToken } from './interfaces/index.js';

declare module 'express-session' {
  interface SessionData {
    user_state: undefined;
    securityToken: SecurityToken | undefined;
  }
}

export {};
