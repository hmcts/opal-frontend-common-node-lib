import { createProxyMiddleware } from 'http-proxy-middleware';
import { Logger } from '@hmcts/nodejs-logging';

const logger = Logger.getLogger('opalApiProxy');

const opalApiProxy = (opalApiTarget: string, logEnabled: boolean) => {
  return createProxyMiddleware({
    target: opalApiTarget,
    changeOrigin: true,
    logger: console,
    on: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      proxyReq: (proxyReq, req: any) => {
        if (req.session.securityToken?.access_token) {
          proxyReq.setHeader('Authorization', `Bearer ${req.session.securityToken.access_token}`);
        }

        const requestIp = req.ip || 'unknown';
        proxyReq.setHeader('x-user-ip', requestIp);
        if (logEnabled) {
          logger.info(`client ip: ${requestIp}`);
        }
      },
    },
  });
};

export default opalApiProxy;
