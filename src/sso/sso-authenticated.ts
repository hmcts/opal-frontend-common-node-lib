import { Request, Response } from 'express';
import { Jwt } from '../utils';

/**
 * Express middleware to check if the user is authenticated via SSO.
 *
 * Sets appropriate cache control headers to prevent caching of sensitive authentication responses.
 * Reads the access token from the session and checks if it is present and not expired.
 * Responds with HTTP 401 and `false` if the token is missing or expired, otherwise responds with HTTP 200 and `true`.
 *
 * @param req - Express request object, expected to have a session with a securityToken containing an access_token.
 * @param res - Express response object used to send the authentication status.
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
