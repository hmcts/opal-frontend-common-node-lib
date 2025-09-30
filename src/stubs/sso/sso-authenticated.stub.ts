import { Request, Response } from 'express';
import { Jwt } from '../../utils';

/**
 * Middleware stub that validates whether the current request is authenticated via a JWT stored on the session.
 *
 * This handler:
 * - Reads the access token from req.session.securityToken?.access_token.
 * - Prevents caching of the response by setting the "Cache-Control" header to "no-store, must-revalidate".
 * - If there is no access token or the token is expired (via Jwt.isJwtExpired), it responds with HTTP 401 and a body of false.
 * - If the token exists and is valid, it responds with HTTP 200 and a body of true.
 *
 * The function writes the response directly to the provided Express Response object and does not return a value.
 *
 * @param req - The incoming Express Request. Expects a session object with an optional securityToken containing access_token.
 * @param res - The Express Response used to set headers, status, and send the boolean authentication result.
 *
 * @remarks
 * - This is a simple stub intended for testing or service-mocking; it performs no additional authentication logic beyond token existence and expiry check.
 * - Side effects: sets Cache-Control header and sends an HTTP response (status + boolean body).
 */
const ssoAuthenticatedStub = (req: Request, res: Response) => {
  const accessToken = req.session.securityToken?.access_token;

  // Don't allow caching of this endpoint
  res.header('Cache-Control', 'no-store, must-revalidate');

  if (!accessToken || Jwt.isJwtExpired(accessToken)) {
    res.status(401).send(false);
  } else {
    res.status(200).send(true);
  }
};

export default ssoAuthenticatedStub;
