import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb } from '../config/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { User, UserProfileResponse } from '@studyflow/shared/types.js';

export const usersRouter = Router();

usersRouter.use(authMiddleware);

const preferencesSchema = z.object({
  daily_study_cap_mins: z.number().int().min(30, 'Cap must be at least 30 minutes').max(1440, 'Cap cannot exceed 24 hours').optional(),
  preferred_study_start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be in HH:mm format (e.g. 09:00)').optional(),
  preferred_study_end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time must be in HH:mm format (e.g. 21:00)').optional(),
  university: z.string().max(150).optional().nullable(),
});

// Helper to get start of current month in UTC ISO string
function getStartOfMonthIso(): string {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  return start.toISOString();
}

// GET /api/v1/users/me
usersRouter.get('/me', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const user = req.user!;
    const db = getDb();
    const startOfMonth = getStartOfMonthIso();

    const usageCountRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM ai_usage_logs 
      WHERE user_id = ? AND feature_type = 'BREAKDOWN' AND created_at >= ?
    `).get(user.id, startOfMonth) as { count: number };

    const response: UserProfileResponse = {
      ...user,
      ai_breakdown_count_month: usageCountRow?.count || 0,
    };

    sendSuccess<UserProfileResponse>(res, response);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/users/me/preferences
usersRouter.patch('/me/preferences', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const user = req.user!;
    const validated = preferencesSchema.parse(req.body);
    const db = getDb();

    // Ensure preferred_study_start is before preferred_study_end if both provided or compared with current
    const start = validated.preferred_study_start ?? user.preferred_study_start;
    const end = validated.preferred_study_end ?? user.preferred_study_end;

    if (start >= end) {
      sendError(res, 'INVALID_PREFERENCE', 'Preferred study start time must be earlier than study end time', 400);
      return;
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (validated.daily_study_cap_mins !== undefined) {
      updates.push('daily_study_cap_mins = ?');
      values.push(validated.daily_study_cap_mins);
    }
    if (validated.preferred_study_start !== undefined) {
      updates.push('preferred_study_start = ?');
      values.push(validated.preferred_study_start);
    }
    if (validated.preferred_study_end !== undefined) {
      updates.push('preferred_study_end = ?');
      values.push(validated.preferred_study_end);
    }
    if (validated.university !== undefined) {
      updates.push('university = ?');
      values.push(validated.university?.trim() || null);
    }

    if (updates.length > 0) {
      values.push(user.id);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updatedUser = db.prepare(`
      SELECT id, email, full_name, university, subscription_tier,
             daily_study_cap_mins, preferred_study_start, preferred_study_end, created_at
      FROM users WHERE id = ?
    `).get(user.id) as User;

    sendSuccess<User>(res, updatedUser);
  } catch (error) {
    next(error);
  }
});
