import { Router } from 'express';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import { Logger } from '@hmcts/nodejs-logging';
import { Socket } from 'node:net';
import type { IncomingMessage, ServerResponse } from 'node:http';

const logger = Logger.getLogger('opalApiProxy');
import { rawJson, verifyContentDigest } from '../middlewares/digest-verify.middleware.js';
import { verifyResponseDigest } from '../utils/response-digest.js';
import { resolveOperationId } from '../utils/operation-id.js';

type ProxyErrorResponse = {
  title: string;
  status: number;
  detail: string;
  retriable: boolean;
  operation_id: string;
};

type ProxyRequest = IncomingMessage & {
  path?: string;
  body?: unknown;
  session?: {
    securityToken?: {
      access_token?: string;
    };
  };
};

const NORMALISED_GATEWAY_STATUSES = new Set([502, 503, 504]);
const proxyStartTimes = new WeakMap<ProxyRequest, number>();
const RETRYABLE_PROXY_ERROR_CODES = new Set(['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT']);

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
  operationId: string,
): ProxyErrorResponse {
  return { title, status, detail, retriable, operation_id: operationId };
}

/**
 * Resolves the status-specific title used when rewriting upstream gateway failures.
 */
function getGatewayErrorTitle(statusCode: number): string {
  if (statusCode === 502) {
    return 'Bad Gateway';
  }
  if (statusCode === 503) {
    return 'Service Unavailable';
  }
  return 'Gateway Timeout';
}

/**
 * Resolves the status-specific detail used when the proxy creates a technical gateway error response.
 */
function getGatewayErrorDetail(statusCode: number): string {
  if (statusCode === 502) {
    return 'The backend service could not be reached.';
  }
  return 'The backend service did not respond in time.';
}

/**
 * Writes a deterministic proxy error response when Express has not already sent one.
 */
function sendProxyErrorResponse(res: ServerResponse | Socket, body: ProxyErrorResponse): void {
  if (!isServerResponse(res) || res.headersSent || res.writableEnded) {
    return;
  }

  const response = Buffer.from(JSON.stringify(body), 'utf8');

  res.statusCode = body.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Length', response.length.toString());
  res.end(response);
}

/**
 * Checks whether a parsed value is a plain object that can be inspected safely.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Identifies upstream OPAL problem responses that should pass through without rewriting.
 */
function isOpalProblemBody(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['title'] === 'string' &&
    typeof value['status'] === 'number' &&
    typeof value['detail'] === 'string'
  );
}

/**
 * Parses a buffered upstream response body as JSON, returning null for non-JSON payloads.
 */
function parseJsonBuffer(responseBuffer: Buffer): unknown {
  try {
    return JSON.parse(responseBuffer.toString('utf8')) as unknown;
  } catch {
    return null;
  }
}

/**
 * Checks whether a Content-Type header represents JSON or a structured JSON media type.
 */
function isJsonContentType(value: string | string[] | undefined): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  const type = raw?.toLowerCase().split(';', 1)[0];
  return type === 'application/json' || Boolean(type?.startsWith('application/') && type.endsWith('+json'));
}

/**
 * Extracts a safe error code for proxy failure logs without including the error message.
 */
function getErrorCode(error: unknown): string | undefined {
  return error instanceof Error ? (error as Error & { code?: string }).code : undefined;
}

/**
 * Extracts a safe error type for proxy failure logs without including the error message.
 */
function getErrorType(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

/**
 * Builds safe proxy failure metadata for logging without request bodies, headers, tokens, or user data.
 */
function createSafeProxyLogMetadata(
  req: ProxyRequest,
  opalApiTarget: string,
  operationId: string,
  statusCode: number,
  retriable: boolean,
  elapsedMs: number,
  error?: unknown,
) {
  const target = new URL(opalApiTarget);

  return {
    operationId,
    method: req.method,
    path: req.path || req.url,
    target: target.host,
    statusCode,
    elapsedMs,
    retriable,
    errorType: error ? getErrorType(error) : undefined,
    code: error ? getErrorCode(error) : undefined,
  };
}

/**
 * Calculates elapsed proxy time from the request start captured in the proxyReq handler.
 */
function getElapsedMs(req: ProxyRequest): number {
  const startTime = proxyStartTimes.get(req);
  if (!startTime) {
    return 0;
  }
  return Date.now() - startTime;
}

/**
 * Rewrites upstream gateway errors with non-OPAL bodies into the OPAL proxy error contract.
 * Existing OPAL problem responses pass through after response digest verification.
 */
function normaliseGatewayResponse(
  responseBuffer: Buffer,
  proxyRes: IncomingMessage,
  req: ProxyRequest,
  res: ServerResponse,
): Buffer {
  const statusCode = proxyRes.statusCode;
  if (!statusCode || !NORMALISED_GATEWAY_STATUSES.has(statusCode)) {
    return verifyResponseDigest(responseBuffer, proxyRes, res);
  }

  if (isOpalProblemBody(parseJsonBuffer(responseBuffer))) {
    return verifyResponseDigest(responseBuffer, proxyRes, res);
  }

  const operationId = resolveOperationId(req);
  const body = createProxyErrorResponse(
    statusCode,
    getGatewayErrorTitle(statusCode),
    getGatewayErrorDetail(statusCode),
    statusCode !== 502,
    operationId,
  );
  const normalisedResponse = Buffer.from(JSON.stringify(body), 'utf8');

  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Length', normalisedResponse.length.toString());
  res.removeHeader('Content-Digest');

  return normalisedResponse;
}

/**
 * Immediately sends a normalised OPAL response for non-JSON upstream gateway failures.
 * This avoids waiting indefinitely when a gateway sends error headers but never completes its body.
 */
function sendNormalisedGatewayResponse(proxyRes: IncomingMessage, req: ProxyRequest, res: ServerResponse): boolean {
  const statusCode = proxyRes.statusCode;
  if (
    !statusCode ||
    !NORMALISED_GATEWAY_STATUSES.has(statusCode) ||
    isJsonContentType(proxyRes.headers['content-type'])
  ) {
    return false;
  }

  sendProxyErrorResponse(
    res,
    createProxyErrorResponse(
      statusCode,
      getGatewayErrorTitle(statusCode),
      getGatewayErrorDetail(statusCode),
      statusCode !== 502,
      resolveOperationId(req),
    ),
  );
  proxyRes.destroy();
  return true;
}

/**
 * Creates an Express router that validates request digests and proxies requests to the Opal API.
 * @param opalApiTarget Backend Opal API base URL.
 * @param logEnabled Whether to log the client IP address added to the backend request.
 * @param timeoutInMilliseconds Maximum time to wait for the backend proxy request before timing out.
 * This is intentionally required so the consuming app owns environment-specific timeout configuration.
 * @returns Configured Express router that maps proxy timeout and transport failures without replaying requests.
 */
const opalApiProxy = (opalApiTarget: string, logEnabled: boolean, timeoutInMilliseconds: number) => {
  const router = Router();

  router.use(rawJson());
  router.use(verifyContentDigest);

  const handleProxyResponse = responseInterceptor(async (responseBuffer, proxyRes, req, res) =>
    normaliseGatewayResponse(responseBuffer, proxyRes, req, res),
  );

  const proxy = createProxyMiddleware({
    target: opalApiTarget,
    changeOrigin: true,
    proxyTimeout: timeoutInMilliseconds,
    selfHandleResponse: true,
    on: {
      proxyReq: (proxyReq, req) => {
        const proxyRequest = req as ProxyRequest;
        proxyStartTimes.set(proxyRequest, Date.now());

        if (proxyRequest.session?.securityToken?.access_token) {
          proxyReq.setHeader('Authorization', `Bearer ${proxyRequest.session.securityToken.access_token}`);
        }

        const forwardedForHeader = req.headers?.['x-forwarded-for'];
        const forwardedFor = Array.isArray(forwardedForHeader) ? forwardedForHeader.join(',') : forwardedForHeader;
        const requestIp = forwardedFor?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
        proxyReq.setHeader('x-user-ip', requestIp);
        if (logEnabled) {
          logger.info(`client ip: ${requestIp}`);
        }
        proxyReq.setHeader('Want-Content-Digest', 'sha-512');

        const body = proxyRequest.body;
        const buffer = Buffer.isBuffer(body) ? body : null;
        if (buffer && buffer.length > 0) {
          proxyReq.setHeader('Content-Length', buffer.length.toString());
          proxyReq.write(buffer);
          proxyReq.end();
        }
      },
      proxyRes: (proxyRes, req, res) => {
        if (sendNormalisedGatewayResponse(proxyRes, req, res)) {
          return;
        }
        void handleProxyResponse(proxyRes, req, res);
      },
      error: (error, req, res) => {
        // Do not replay the request here: only the frontend knows whether it is safe to retry.
        const operationId = resolveOperationId(req);
        const elapsedMs = getElapsedMs(req);
        if (isRetryableProxyError(error)) {
          logger.warn(
            `Proxy timeout or transport failure when calling ${opalApiTarget}`,
            createSafeProxyLogMetadata(req, opalApiTarget, operationId, 504, true, elapsedMs, error),
          );
          sendProxyErrorResponse(
            res,
            createProxyErrorResponse(504, getGatewayErrorTitle(504), getGatewayErrorDetail(504), true, operationId),
          );
          return;
        }

        // Keep other proxy failures deterministic without telling the frontend to retry them.
        logger.error(
          `Unexpected proxy failure when calling ${opalApiTarget}`,
          createSafeProxyLogMetadata(req, opalApiTarget, operationId, 502, false, elapsedMs, error),
        );
        sendProxyErrorResponse(
          res,
          createProxyErrorResponse(502, getGatewayErrorTitle(502), getGatewayErrorDetail(502), false, operationId),
        );
      },
    },
  });

  router.use(proxy);

  return router;
};

export default opalApiProxy;
export { createSafeProxyLogMetadata, resolveOperationId };
