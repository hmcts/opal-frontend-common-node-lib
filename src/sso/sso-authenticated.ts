import { Request, Response } from 'express';
import { Jwt } from '../utils';

/**
 * Express handler that verifies whether the current session has a valid (non-expired) access token.
 *
 * Behavior:
 * - Reads the access token from `req.session.securityToken?.access_token`.
 * - Prevents caching of the endpoint by setting the `Cache-Control: no-store, must-revalidate` header.
 * - If the token is missing or expired (determined by `Jwt.isJwtExpired`), responds with HTTP 401 and sends `false`.
 * - If the token is present and not expired, responds with HTTP 200 and sends `true`.
 *
 * @param req - Express Request; expected to contain `session.securityToken?.access_token` (string).
 * @param res - Express Response used to set headers, status code, and send a boolean result.
 * @returns void
 *
 * @remarks
 * This endpoint is a lightweight authentication status check and has the side-effect of modifying response headers
 * and sending an HTTP status and boolean payload. It relies on `Jwt.isJwtExpired` for token expiry checks.
 *
 * @example
 * // GET /sso/authenticated
 * // -> 200 true   (valid token)
 * // -> 401 false  (missing or expired token)
 *
 * @see Jwt.isJwtExpired
 */
const ssoAuthenticatedHandler = (req: Request, res: Response) => {
  const accessToken = req.session.securityToken?.access_token;

  // Don't allow caching of this endpoint
  res.header('Cache-Control', 'no-store, must-revalidate');

  if (!accessToken || Jwt.isJwtExpired(accessToken)) {
    res.status(401).send(false);
  } else {
    res.status(200).send(true);
  }
};

export default ssoAuthenticatedHandler;
