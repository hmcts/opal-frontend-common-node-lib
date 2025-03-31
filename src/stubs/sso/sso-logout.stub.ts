import { Request, Response, NextFunction } from 'express';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default async (req: Request, res: Response, next: NextFunction) => {
  res.redirect('/sso/logout-callback');
};
