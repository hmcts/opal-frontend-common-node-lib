import { Request, Response } from 'express';
import { DateTime } from 'luxon';
import { Jwt } from '../../utils';

const sessionExpiry = (
  req: Request,
  res: Response,
  testMode: boolean,
  expiryTimeInMilliseconds: number,
  warningThresholdInMilliseconds: number,
) => {
  const accessToken = req.session.securityToken?.access_token;
  if (accessToken) {
    const payload = Jwt.parseJwt(accessToken);
    const jwtExpiry = testMode
      ? DateTime.now().plus({ milliseconds: expiryTimeInMilliseconds }).toISO()
      : DateTime.fromMillis(payload.exp * 1000).toISO();

    res.status(200).send({
      expiry: jwtExpiry,
      warningThresholdInMilliseconds: warningThresholdInMilliseconds,
    });
  } else {
    res.status(200).send({
      expiry: null,
      warningThresholdInMilliseconds: null,
    });
  }
};

export default sessionExpiry;
