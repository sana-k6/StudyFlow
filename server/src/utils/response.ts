import { Response } from 'express';
import { ApiResponse } from '@studyflow/shared/types.js';

export function sendSuccess<T>(
  res: Response,
  data: T,
  meta: Record<string, unknown> = {},
  statusCode: number = 200
): Response<ApiResponse<T>> {
  const payload: ApiResponse<T> = {
    data,
    error: null,
    meta,
  };
  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400,
  details?: unknown,
  meta: Record<string, unknown> = {}
): Response<ApiResponse<null>> {
  const payload: ApiResponse<null> = {
    data: null,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    meta,
  };
  return res.status(statusCode).json(payload);
}
