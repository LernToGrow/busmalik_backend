import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export const checkRole = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, 'Forbidden: insufficient role', 403);
    }
    next();
  };
