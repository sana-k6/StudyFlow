import { Router, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getDb } from '../config/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AnalyticsSummary, StudyLog } from '@studyflow/shared/types.js';

export const analyticsRouter = Router();
analyticsRouter.use(authMiddleware);

const logStudySchema = z.object({
  module_id: z.string().uuid('Invalid module ID'),
  subtask_id: z.string().uuid('Invalid subtask ID').optional().nullable(),
  duration_mins: z.number().int().min(5, 'Minimum study time is 5 minutes').max(720, 'Maximum study time is 12 hours'),
  focus_rating: z.number().int().min(1).max(5).optional().nullable(),
  logged_at: z.string().datetime().optional(),
});

// GET /api/v1/analytics/summary?range=7d|30d
analyticsRouter.get('/summary', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const rangeParam = req.query.range === '30d' ? '30d' : '7d';
    const rangeDays = rangeParam === '30d' ? 30 : 7;

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = now.toISOString();

    // 1. Total Study Minutes in range
    const totalRow = db.prepare(`
      SELECT COALESCE(SUM(duration_mins), 0) as total
      FROM study_logs
      WHERE user_id = ? AND logged_at >= ?
    `).get(userId, cutoffDate) as { total: number };

    // 2. Hours by Module in range
    const hoursByModuleRows = db.prepare(`
      SELECT
        m.id as module_id,
        m.code as module_code,
        m.name as module_name,
        m.color_hex,
        COALESCE(SUM(s.duration_mins), 0) as duration_mins
      FROM modules m
      LEFT JOIN study_logs s ON m.id = s.module_id AND s.logged_at >= ?
      WHERE m.user_id = ?
      GROUP BY m.id, m.code, m.name, m.color_hex
      ORDER BY duration_mins DESC
    `).all(cutoffDate, userId) as Array<{
      module_id: string;
      module_code: string;
      module_name: string;
      color_hex: string;
      duration_mins: number;
    }>;

    // 3. Completion Velocity
    const velocityRow = db.prepare(`
      SELECT
        COUNT(s.id) as total,
        COALESCE(SUM(CASE WHEN s.is_completed = 1 THEN 1 ELSE 0 END), 0) as completed
      FROM subtasks s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE a.user_id = ?
    `).get(userId) as { total: number; completed: number };

    const totalSubtasks = velocityRow?.total || 0;
    const completedSubtasks = velocityRow?.completed || 0;
    const completionRate = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

    // 4. At-Risk Deadlines (due within 5 days or overdue, not marked COMPLETED)
    const activeAssignments = db.prepare(`
      SELECT a.id, a.title, a.due_date, a.estimated_total_mins
      FROM assignments a
      WHERE a.user_id = ? AND a.status != 'COMPLETED'
      ORDER BY a.due_date ASC
    `).all(userId) as Array<{ id: string; title: string; due_date: string; estimated_total_mins: number }>;

    const atRiskDeadlines: AnalyticsSummary['at_risk_deadlines'] = [];

    for (const assign of activeAssignments) {
      const dueMs = new Date(assign.due_date).getTime();
      const hoursLeft = (dueMs - now.getTime()) / (1000 * 60 * 60);
      const daysLeft = Math.ceil(hoursLeft / 24);

      // Flag if due within 5 days or already overdue
      if (daysLeft <= 5) {
        // Calculate remaining minutes from incomplete subtasks
        const subtaskSumRow = db.prepare(`
          SELECT COALESCE(SUM(estimated_mins - completed_mins), 0) as remaining
          FROM subtasks
          WHERE assignment_id = ? AND is_completed = 0
        `).get(assign.id) as { remaining: number };

        const remainingMins = subtaskSumRow.remaining > 0 ? subtaskSumRow.remaining : assign.estimated_total_mins;

        atRiskDeadlines.push({
          assignment_id: assign.id,
          title: assign.title,
          due_date: assign.due_date,
          remaining_mins: remainingMins,
          days_left: daysLeft,
        });
      }
    }

    const summary: AnalyticsSummary = {
      total_study_mins: totalRow?.total || 0,
      hours_by_module: hoursByModuleRows,
      completion_velocity: {
        completed_subtasks: completedSubtasks,
        total_subtasks: totalSubtasks,
        completion_rate: completionRate,
      },
      at_risk_deadlines: atRiskDeadlines,
    };

    sendSuccess<AnalyticsSummary>(res, summary, { range: rangeParam });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/analytics/study-logs
analyticsRouter.post('/study-logs', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const validated = logStudySchema.parse(req.body);
    const db = getDb();
    const userId = req.user!.id;

    // Verify module belongs to user
    const module = db.prepare('SELECT id FROM modules WHERE id = ? AND user_id = ?').get(validated.module_id, userId);
    if (!module) {
      sendError(res, 'INVALID_MODULE', 'Module not found or not owned by user', 400);
      return;
    }

    // If subtask_id provided, verify it belongs to user's assignment
    if (validated.subtask_id) {
      const subtask = db.prepare(`
        SELECT s.id, s.completed_mins, s.estimated_mins
        FROM subtasks s
        JOIN assignments a ON s.assignment_id = a.id
        WHERE s.id = ? AND a.user_id = ?
      `).get(validated.subtask_id, userId) as { id: string; completed_mins: number; estimated_mins: number } | undefined;

      if (!subtask) {
        sendError(res, 'INVALID_SUBTASK', 'Subtask not found or not owned by user', 400);
        return;
      }

      // Update completed_mins on subtask
      const newCompleted = subtask.completed_mins + validated.duration_mins;
      db.prepare(`
        UPDATE subtasks
        SET completed_mins = ?, is_completed = CASE WHEN ? >= estimated_mins THEN 1 ELSE is_completed END
        WHERE id = ?
      `).run(newCompleted, newCompleted, subtask.id);
    }

    const logId = uuidv4();
    const loggedAt = validated.logged_at || new Date().toISOString();

    db.prepare(`
      INSERT INTO study_logs (id, user_id, module_id, subtask_id, duration_mins, focus_rating, logged_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId,
      userId,
      validated.module_id,
      validated.subtask_id ?? null,
      validated.duration_mins,
      validated.focus_rating ?? null,
      loggedAt
    );

    const created = db.prepare(`
      SELECT id, user_id, module_id, subtask_id, duration_mins, focus_rating, logged_at
      FROM study_logs WHERE id = ?
    `).get(logId) as StudyLog;

    sendSuccess<StudyLog>(res, created, {}, 201);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/analytics/study-logs
analyticsRouter.get('/study-logs', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const db = getDb();
    const userId = req.user!.id;

    const logs = db.prepare(`
      SELECT
        s.id, s.user_id, s.module_id, s.subtask_id, s.duration_mins, s.focus_rating, s.logged_at,
        m.code as module_code, m.name as module_name, m.color_hex as module_color,
        st.title as subtask_title
      FROM study_logs s
      JOIN modules m ON s.module_id = m.id
      LEFT JOIN subtasks st ON s.subtask_id = st.id
      WHERE s.user_id = ?
      ORDER BY s.logged_at DESC
      LIMIT 25
    `).all(userId);

    sendSuccess(res, logs);
  } catch (error) {
    next(error);
  }
});
