import { Router, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { computeFreeSlots, FixedInterval } from '../services/slotEngine.js';
import { generateScheduleMapping, SubtaskForScheduling } from '../services/geminiService.js';
import { CalendarEvent, User } from '@studyflow/shared/types.js';

export const scheduleRouter = Router();
scheduleRouter.use(authMiddleware);

const scheduleRateLimiter = createRateLimiter(10, 60 * 1000);

/**
 * Shared scheduling generator logic for both generate and rebalance endpoints
 */
async function executeScheduleGeneration(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
  isRebalance: boolean = false
): Promise<void> {
  try {
    const db = getDb();
    const userId = req.user!.id;

    // 1. Entitlement check (Must be PRO tier)
    const user = db.prepare(`
      SELECT subscription_tier, daily_study_cap_mins, preferred_study_start, preferred_study_end
      FROM users WHERE id = ?
    `).get(userId) as Pick<User, 'subscription_tier' | 'daily_study_cap_mins' | 'preferred_study_start' | 'preferred_study_end'>;

    if (user.subscription_tier !== 'PRO') {
      sendError(
        res,
        'PRO_TIER_REQUIRED',
        'Intelligent automatic schedule generation and rebalancing is a Pro feature. Upgrade your tier to unlock.',
        403
      );
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const horizonEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

    // 2. Query fixed calendar events over the 14-day horizon
    const fixedRows = db.prepare(`
      SELECT start_time, end_time
      FROM calendar_events
      WHERE user_id = ? AND is_fixed = 1 AND end_time >= ? AND start_time <= ?
      ORDER BY start_time ASC
    `).all(userId, nowIso, horizonEnd) as FixedInterval[];

    // 3. Compute deterministic free slots
    const slots = computeFreeSlots(fixedRows, {
      startDate: nowIso,
      days: 14,
      preferredStudyStart: user.preferred_study_start,
      preferredStudyEnd: user.preferred_study_end,
      dailyStudyCapMins: user.daily_study_cap_mins,
      minSlotDurationMins: 30,
      maxSlotDurationMins: 90,
    });

    if (slots.length === 0) {
      sendSuccess(res, {
        scheduled_count: 0,
        blocks: [],
        next_action_rationale: 'No free study windows available in your timetable over the next 14 days.',
      });
      return;
    }

    // 4. Query incomplete subtasks with parent assignment and module metadata
    const subtaskRows = db.prepare(`
      SELECT
        s.id, s.title, s.estimated_mins, s.assignment_id,
        a.due_date, a.weight_percentage,
        m.code as module_code, m.id as module_id
      FROM subtasks s
      JOIN assignments a ON s.assignment_id = a.id
      JOIN modules m ON a.module_id = m.id
      WHERE a.user_id = ? AND s.is_completed = 0 AND a.status != 'COMPLETED'
      ORDER BY a.due_date ASC, s.order_index ASC
    `).all(userId) as SubtaskForScheduling[];

    if (subtaskRows.length === 0) {
      sendSuccess(res, {
        scheduled_count: 0,
        blocks: [],
        next_action_rationale: 'All coursework is caught up! No incomplete subtasks found to schedule.',
      });
      return;
    }

    // 5. Call Gemini AI mapping
    const aiResult = await generateScheduleMapping(slots, subtaskRows);

    // 6. Deterministic Validation & Persistence
    const slotMap = new Map(slots.map((s) => [s.slot_id, s]));
    const subtaskMap = new Map(subtaskRows.map((st) => [st.id, st]));
    const createdBlocks: CalendarEvent[] = [];

    const transaction = db.transaction(() => {
      // Clear future AI study blocks
      db.prepare(`
        DELETE FROM calendar_events
        WHERE user_id = ? AND event_type = 'AI_STUDY_BLOCK' AND is_fixed = 0 AND start_time >= ?
      `).run(userId, nowIso);

      const insertBlockStmt = db.prepare(`
        INSERT INTO calendar_events (
          id, user_id, module_id, subtask_id, external_uid, title, event_type, start_time, end_time, is_fixed
        ) VALUES (?, ?, ?, ?, ?, ?, 'AI_STUDY_BLOCK', ?, ?, 0)
      `);

      for (const item of aiResult.assignments) {
        const slot = slotMap.get(item.slot_id);
        const subtask = subtaskMap.get(item.subtask_id);

        if (!slot || !subtask) continue;

        const blockId = uuidv4();
        const blockTitle = `Study: ${subtask.title}`;

        insertBlockStmt.run(
          blockId,
          userId,
          subtask.module_id,
          subtask.id,
          null, // manual / internal blocks have null external_uid
          blockTitle,
          slot.start_time,
          slot.end_time
        );

        createdBlocks.push({
          id: blockId,
          user_id: userId,
          module_id: subtask.module_id,
          subtask_id: subtask.id,
          external_uid: null,
          title: blockTitle,
          event_type: 'AI_STUDY_BLOCK',
          start_time: slot.start_time,
          end_time: slot.end_time,
          is_fixed: false,
        });
      }

      // Log AI Usage
      db.prepare(`
        INSERT INTO ai_usage_logs (id, user_id, feature_type, tokens_used, created_at)
        VALUES (?, ?, 'SCHEDULE_GEN', ?, ?)
      `).run(uuidv4(), userId, aiResult.tokens_used, nowIso);
    });

    transaction();

    sendSuccess(
      res,
      {
        scheduled_count: createdBlocks.length,
        blocks: createdBlocks,
        next_action_rationale: aiResult.next_action_rationale,
        is_rebalance: isRebalance,
      },
      {},
      200
    );
  } catch (error) {
    next(error);
  }
}

// POST /api/v1/schedule/generate
scheduleRouter.post('/generate', scheduleRateLimiter, (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  executeScheduleGeneration(req, res, next, false);
});

// POST /api/v1/schedule/rebalance
scheduleRouter.post('/rebalance', scheduleRateLimiter, (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  executeScheduleGeneration(req, res, next, true);
});
