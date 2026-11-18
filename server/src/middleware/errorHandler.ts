import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/response.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    const errorDetails = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    sendError(
      res,
      'VALIDATION_ERROR',
      err.errors[0]?.message || 'Input validation failed',
      400,
      errorDetails
    );
    return;
  }

  if (err instanceof Error) {
    // Check for JSON parse errors
    if ('type' in err && (err as { type: string }).type === 'entity.parse.failed') {
      sendError(res, 'MALFORMED_JSON', 'Invalid JSON payload received', 400);
      return;
    }

    sendError(res, 'INTERNAL_SERVER_ERROR', err.message || 'An unexpected error occurred', 500);
    return;
  }

  sendError(res, 'UNKNOWN_ERROR', 'An unknown server error occurred', 500);
}
