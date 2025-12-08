import { Router } from 'express';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import { rawJson, verifyContentDigest } from '../middlewares/digest-verify.middleware.js';
import { verifyResponseDigest } from '../utils/response-digest.js';

/**
 * Creates an Express router that validates request digests and proxies requests to the Opal API.
 * @param opalApiTarget Upstream Opal API base URL.
 * @returns Configured Express router ready to mount in the host app.
 */
const opalApiProxy = (opalApiTarget: string) => {
  const router = Router();

  router.use(rawJson());
  router.use(verifyContentDigest);

  const handleProxyResponse = responseInterceptor(async (responseBuffer, proxyRes, _req, res) =>
    verifyResponseDigest(responseBuffer, proxyRes, res),
  );

  const proxy = createProxyMiddleware({
    target: opalApiTarget,
    changeOrigin: true,
    selfHandleResponse: true,
    on: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      proxyReq: (proxyReq, req: any) => {
        if (req.session.securityToken?.access_token) {
          proxyReq.setHeader('Authorization', `Bearer ${req.session.securityToken.access_token}`);
        }
        proxyReq.setHeader('Want-Content-Digest', 'sha-256');

        const body = req.body;
        const buffer = Buffer.isBuffer(body) ? body : null;
        if (buffer && buffer.length > 0) {
          proxyReq.setHeader('Content-Length', buffer.length.toString());
          proxyReq.write(buffer);
          proxyReq.end();
        }
      },
      proxyRes: (proxyRes, req, res) => {
        void handleProxyResponse(proxyRes, req, res);
      },
    },
  });

  router.use(proxy);

  return router;
};

export default opalApiProxy;
