import { Response } from 'express';

export const sendSuccess = (res: Response, data: unknown, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({ success: true, message, data });
};

export const sendError = (res: Response, message = 'Error', statusCode = 400, data: unknown = null) => {
  return res.status(statusCode).json({ success: false, message, data });
};
