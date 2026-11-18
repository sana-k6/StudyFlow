import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { getDb } from '../config/db.js';
import { sendError } from '../utils/response.js';
import { User } from '@studyflow/shared/types.js';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // Extract token from HTTP-only cookie or Authorization header fallback
  let token: string | undefined = req.cookies?.token;

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }

  if (!token) {
    sendError(res, 'UNAUTHORIZED', 'Authentication token missing', 401);
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    const db = getDb();

    const user = db
      .prepare(`
        SELECT id, email, full_name, university, subscription_tier, 
               daily_study_cap_mins, preferred_study_start, preferred_study_end, created_at
        FROM users
        WHERE id = ?
      `)
      .get(decoded.userId) as User | undefined;

    if (!user) {
      sendError(res, 'UNAUTHORIZED', 'User not found or session revoked', 401);
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    sendError(res, 'UNAUTHORIZED', 'Invalid or expired authentication token', 401);
  }
}
