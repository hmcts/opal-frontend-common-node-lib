import { Router } from 'express';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import { Logger } from '@hmcts/nodejs-logging';
import { Socket } from 'node:net';
import type { ServerResponse } from 'node:http';

const logger = Logger.getLogger('opalApiProxy');
import { rawJson, verifyContentDigest } from '../middlewares/digest-verify.middleware.js';
import { verifyResponseDigest } from '../utils/response-digest.js';

type ProxyErrorResponse = {
  title: string;
  status: number;
  detail: string;
  retriable: boolean;
};

const RETRYABLE_PROXY_ERROR_CODES = new Set(['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT']);

/**
 * Narrows the proxy error response target to an HTTP response before writing to it.
 */
function isServerResponse(res: ServerResponse | Socket): res is ServerResponse {
  return !(res instanceof Socket);
}

/**
 * Identifies timeout and transport failures that callers may safely mark as retryable.
 */
function isRetryableProxyError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as Error & { code?: unknown }).code;
  return typeof code === 'string' && RETRYABLE_PROXY_ERROR_CODES.has(code);
}

/**
 * Creates the problem response body returned by the proxy error handler.
 */
function createProxyErrorResponse(
  status: number,
  title: string,
  detail: string,
  retriable: boolean,
): ProxyErrorResponse {
  return { title, status, detail, retriable };
}

/**
 * Writes a deterministic proxy error response when Express has not already sent one.
 */
function sendProxyErrorResponse(res: ServerResponse | Socket, body: ProxyErrorResponse): void {
  if (!isServerResponse(res) || res.headersSent || res.writableEnded) {
    return;
  }

  res.statusCode = body.status;
  res.setHeader('Content-Type', 'application/problem+json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/**
 * Creates an Express router that validates request digests and proxies requests to the Opal API.
 * @param opalApiTarget Upstream Opal API base URL.
 * @param logEnabled Whether to log the client IP address added to the upstream request.
 * @param timeoutInMilliseconds Maximum time to wait for the upstream proxy request before timing out.
 * This is intentionally required so the consuming app owns environment-specific timeout configuration.
 * @returns Configured Express router that maps proxy timeout and transport failures without replaying requests.
 */
const opalApiProxy = (opalApiTarget: string, logEnabled: boolean, timeoutInMilliseconds: number) => {
  const router = Router();

  router.use(rawJson());
  router.use(verifyContentDigest);

  const handleProxyResponse = responseInterceptor(async (responseBuffer, proxyRes, _req, res) =>
    verifyResponseDigest(responseBuffer, proxyRes, res),
  );

  const proxy = createProxyMiddleware({
    target: opalApiTarget,
    changeOrigin: true,
    proxyTimeout: timeoutInMilliseconds,
    selfHandleResponse: true,
    on: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      proxyReq: (proxyReq, req: any) => {
        if (req.session.securityToken?.access_token) {
          proxyReq.setHeader('Authorization', `Bearer ${req.session.securityToken.access_token}`);
        }

        const forwardedForHeader = req.headers?.['x-forwarded-for'];
        const forwardedFor = Array.isArray(forwardedForHeader) ? forwardedForHeader.join(',') : forwardedForHeader;
        const requestIp = forwardedFor?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
        proxyReq.setHeader('x-user-ip', requestIp);
        if (logEnabled) {
          logger.info(`client ip: ${requestIp}`);
        }
        proxyReq.setHeader('Want-Content-Digest', 'sha-512');

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
      error: (error, _req, res) => {
        // Do not replay the request here: only the frontend knows whether it is safe to retry.
        if (isRetryableProxyError(error)) {
          logger.warn('Proxy timeout or transport failure when calling upstream service', {
            message: error.message,
            code: (error as Error & { code?: string }).code,
          });
          sendProxyErrorResponse(
            res,
            createProxyErrorResponse(504, 'Gateway Timeout', 'The upstream service did not respond in time.', true),
          );
          return;
        }

        // Keep other proxy failures deterministic without telling the frontend to retry them.
        logger.error('Unexpected proxy failure when calling upstream service', {
          message: error instanceof Error ? error.message : String(error),
          code: error instanceof Error ? (error as Error & { code?: string }).code : undefined,
        });
        sendProxyErrorResponse(
          res,
          createProxyErrorResponse(502, 'Bad Gateway', 'The upstream service could not be reached.', false),
        );
      },
    },
  });

  router.use(proxy);

  return router;
};

export default opalApiProxy;
