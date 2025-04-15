import { createProxyMiddleware } from 'http-proxy-middleware';

const opalApiProxy = (opalApiTarget: string) => {
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
      },
    },
  });
};

export default opalApiProxy;
