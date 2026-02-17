import crypto from 'node:crypto';
import express from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Capture the exact bytes for JSON payloads (extend to more media types if needed).
 * @returns Express middleware that exposes the raw request body buffer.
 */
export const rawJson = (): RequestHandler => express.raw({ type: ['application/json', 'application/*+json'] });

/**
 * Extract the base64 digest token from a Content-Digest header.
 * @param value Header value that may contain the digest.
 */
function parseSha256Base64(value: string | undefined): string | null {
  if (!value) return null;
  const match = /sha-256=:(.+?):/i.exec(value);
  return match ? match[1] : null;
}

/**
 * Strictly verifies Content-Digest (sha-256) over the raw request body.
 * - Skips GET/HEAD and empty-body requests.
 * - Responds with 400 on missing, invalid, or mismatched digest.
 * @param req Express request carrying the raw buffer.
 * @param res Express response, used to emit 400 failures.
 * @param next Express next handler.
 */
export function verifyContentDigest(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD') return next();

  const body = req.body;
  const buffer = Buffer.isBuffer(body) ? body : null;
  if (!buffer || buffer.length === 0) return next();

  const header = req.header('Content-Digest');
  const expected = parseSha256Base64(header);
  if (!expected) {
    res.status(400).send('Missing or invalid Content-Digest');
    return;
  }

  const actual = crypto.createHash('sha256').update(buffer).digest('base64');
  if (actual !== expected) {
    res.status(400).send('Content-Digest verification failed');
    return;
  }

  next();
}
