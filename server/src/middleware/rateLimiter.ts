import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware.js';
import { sendError } from '../utils/response.js';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export function createRateLimiter(maxRequests: number = 10, windowMs: number = 60 * 1000) {
  const store = new Map<string, RateLimitRecord>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const key = req.user?.id || req.ip || 'anonymous';
    const now = Date.now();
    const record = store.get(key);

    if (!record || now > record.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (record.count >= maxRequests) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      sendError(
        res,
        'RATE_LIMIT_EXCEEDED',
        `Too many requests. Please try again in ${retryAfterSec} seconds.`,
        429,
        { retryAfterSec }
      );
      return;
    }

    record.count += 1;
    next();
  };
}
