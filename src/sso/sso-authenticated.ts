/**
 * SSO Authenticated Check
 *
 * Purpose:
 * - Lightweight endpoint to confirm whether the current session has a **valid (non-expired)** access token.
 * - Does not perform any backend calls; relies on local session only.
 *
 * Returns:
 * - 200 (body: true) when a token exists and is not expired.
 * - 401 (body: false) when the token is missing or expired.
 *
 * Caching:
 * - Sends `no-store`/`no-cache` headers to prevent intermediaries from caching the authentication state.
 */
import { Request, Response } from 'express';
import { Jwt } from '../utils';

/**
 * Express handler to check session authentication state.
 * @param req - Express request with potential session token.
 * @param res - Express response with boolean result.
 */
export default (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store, no-cache, private');
  res.set('Pragma', 'no-cache');

  // Read the access token from the session (set during the SSO login callback).
  const accessToken = req.session.securityToken?.access_token;
  // Validate expiry without decoding secrets; returns true when token is missing or expired.
  const isJwtExpired = Jwt.isJwtExpired(accessToken);

  if (!accessToken || isJwtExpired) {
    res.status(401).send(false);
  } else {
    res.status(200).send(true);
  }
};
