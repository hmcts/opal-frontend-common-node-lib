import { createProxyMiddleware } from 'http-proxy-middleware';

const opalApiProxy = (opalApiTarget: string) => {
  return createProxyMiddleware({
    target: opalApiTarget,
    changeOrigin: true,
    logger: console,
    on: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      proxyReq: (proxyReq, req: any) => {
        const token = req.session?.securityToken?.access_token;
        if (token) {
          proxyReq.setHeader('Authorization', `Bearer ${token}`);
        }
      },
    },
  });
};

export default opalApiProxy;
