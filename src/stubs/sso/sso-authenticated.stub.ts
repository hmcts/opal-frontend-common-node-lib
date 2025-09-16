import { Request, Response } from 'express';
import { Jwt } from '../../utils';

/**
 * Express middleware that checks if the current session has a valid, non-expired access token.
 *
 * - Sets the `Cache-Control` header to prevent caching of the endpoint.
 * - Retrieves the `access_token` from the session.
 * - If the token is missing or expired (as determined by `Jwt.isJwtExpired`), responds with HTTP 401 and `false`.
 * - Otherwise, responds with HTTP 200 and `true`.
 *
 * @param req - The Express request object, expected to have a `session.securityToken.access_token` property.
 * @param res - The Express response object used to send the HTTP response.
 */
export default (req: Request, res: Response) => {
  // Don't allow caching of this endpoint
  res.header('Cache-Control', 'no-store, must-revalidate');

  const accessToken = req.session.securityToken?.access_token;

  if (!accessToken || Jwt.isJwtExpired(accessToken)) {
    res.status(401).send(false);
  }

  res.status(200).send(true);
};
