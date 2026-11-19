import { Router, Response, NextFunction } from 'express';
import { getDb } from '../config/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { sendSuccess } from '../utils/response.js';
import { User } from '@studyflow/shared/types.js';

export const billingRouter = Router();
billingRouter.use(authMiddleware);

// POST /api/v1/billing/upgrade-mock
billingRouter.post('/upgrade-mock', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const db = getDb();
    const userId = req.user!.id;

    db.prepare(`
      UPDATE users SET subscription_tier = 'PRO' WHERE id = ?
    `).run(userId);

    const updatedUser = db.prepare(`
      SELECT id, email, full_name, university, subscription_tier,
             daily_study_cap_mins, preferred_study_start, preferred_study_end, created_at
      FROM users WHERE id = ?
    `).get(userId) as User;

    sendSuccess<User>(res, updatedUser);
  } catch (error) {
    next(error);
  }
});
