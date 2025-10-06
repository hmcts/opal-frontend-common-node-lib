import { Request, Response } from 'express';
import { Jwt } from '../../utils';

/**
 * Handles the SSO logout stub endpoint.
 *
 * - Prevents caching of the endpoint by setting appropriate headers.
 * - Checks for the presence and validity of the access token in the session.
 * - Responds with HTTP 401 and `false` if the access token is missing or expired.
 * - Responds with HTTP 200 and `true` if the access token is present and valid.
 *
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @returns Sends a boolean response indicating the validity of the access token.
 */
const handleSsoLogout = (req: Request, res: Response) => {
  // Don't allow caching of this endpoint
  res.header('Cache-Control', 'no-store, must-revalidate');

  const accessToken = req.session.securityToken?.access_token;

  if (!accessToken || Jwt.isJwtExpired(accessToken)) {
    return res.status(401).send(false);
  }

  return res.status(200).send(true);
};

export default handleSsoLogout;
