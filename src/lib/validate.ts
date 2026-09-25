import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import { badRequest } from './http-error';

export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(badRequest(formatZodError(result.error)));
      return;
    }

    req.body = result.data;
    next();
  };
}

function formatZodError(error: ZodError) {
  return error.issues.map((issue) => issue.message).join('; ');
}
