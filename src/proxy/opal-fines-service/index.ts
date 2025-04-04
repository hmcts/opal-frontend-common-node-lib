import { createProxyMiddleware } from 'http-proxy-middleware';

const opalFinesServiceProxy = (opalFinesServiceTarget: string) => {
  return createProxyMiddleware({
    target: opalFinesServiceTarget,
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

export default opalFinesServiceProxy;
