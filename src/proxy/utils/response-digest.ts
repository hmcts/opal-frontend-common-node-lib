import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

type HeaderValue = string | string[] | undefined | null;

function firstHeaderValue(value: HeaderValue): string | undefined {
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : undefined;
  }
  return value ?? undefined;
}

/**
 * Extract base64 from a 'sha-256=:<base64>:' style header.
 */
export function parseSha256Base64(value: HeaderValue): string | null {
  const raw = firstHeaderValue(value);
  if (!raw) return null;
  const match = /sha-256=:(.+?):/i.exec(raw);
  return match ? match[1] : null;
}

/**
 * Compute base64 SHA-256 over the given bytes.
 */
export function sha256Base64(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('base64');
}

/**
 * Check whether a Content-Type should be verified.
 * Covers JSON and text content types for v1.
 */
export function isVerifiableContentType(value: HeaderValue): boolean {
  const raw = firstHeaderValue(value)?.toLowerCase();
  if (!raw) return false;
  const [type] = raw.split(';', 1);
  if (!type) return false;
  if (type.startsWith('text/')) return true;
  if (type === 'application/json') return true;
  return type.startsWith('application/') && type.endsWith('+json');
}

function failWithBadGateway(res: ServerResponse, message: string): Buffer {
  res.statusCode = 502;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.removeHeader('Content-Digest');
  return Buffer.from(message, 'utf8');
}

/**
 * Verifies upstream Content-Digest header against the decoded response buffer.
 * Returns the buffer unchanged on success, or a 502 response payload on failure.
 */
export function verifyResponseDigest(responseBuffer: Buffer, proxyRes: IncomingMessage, res: ServerResponse): Buffer {
  const digestHeader = proxyRes.headers['content-digest'];
  const contentTypeHeader = proxyRes.headers['content-type'];

  if (!digestHeader || !isVerifiableContentType(contentTypeHeader)) {
    return responseBuffer;
  }

  const expected = parseSha256Base64(digestHeader);
  if (!expected) {
    return failWithBadGateway(res, 'Upstream Content-Digest header malformed');
  }

  const actual = sha256Base64(responseBuffer);
  if (actual !== expected) {
    return failWithBadGateway(res, 'Upstream Content-Digest verification failed');
  }

  return responseBuffer;
}
