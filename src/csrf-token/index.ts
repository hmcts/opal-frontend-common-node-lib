import { doubleCsrf } from 'csrf-csrf';
import { Application, Request } from 'express';

export class CSRFToken {
  public enableFor(app: Application, secret: string, cookieName: string, sameSite: boolean, secure: boolean): void {
    const ignore = ['/sso/login-callback'];

    const { doubleCsrfProtection } = doubleCsrf({
      getSecret: () => secret,
      cookieName: cookieName,
      cookieOptions: {
        sameSite: sameSite,
        secure: secure,
        path: '/',
      },
      getTokenFromRequest: (req) => {
        return req.cookies[cookieName].split('|')[0] || null;
      },
    });

    app.use((req, res, next) => {
      if (ignore.includes(req.url)) {
        next();
      } else {
        doubleCsrfProtection(req, res, next);
      }
    });

    app.use((req: Request, res, next) => {
      if (req.csrfToken) {
        req.csrfToken(true);
      }
      next();
    });
  }
}
