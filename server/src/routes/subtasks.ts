import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb } from '../config/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { Subtask } from '@studyflow/shared/types.js';

export const subtasksRouter = Router();
subtasksRouter.use(authMiddleware);

type RawSubtaskRow = Omit<Subtask, 'is_completed' | 'ai_generated'> & {
  is_completed: number;
  ai_generated: number;
};

function formatSubtask(row: RawSubtaskRow): Subtask {
  return {
    ...row,
    is_completed: Boolean(row.is_completed),
    ai_generated: Boolean(row.ai_generated),
  };
}

const updateSubtaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  estimated_mins: z.number().int().min(10).max(240).optional(),
  completed_mins: z.number().int().min(0).max(1440).optional(),
  order_index: z.number().int().optional(),
  is_completed: z.boolean().optional(),
});

// PATCH /api/v1/subtasks/:id
subtasksRouter.patch('/:id', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const validated = updateSubtaskSchema.parse(req.body);
    const db = getDb();
    const userId = req.user!.id;
    const subtaskId = req.params.id;

    // Verify subtask belongs to an assignment owned by this user
    const existing = db.prepare(`
      SELECT s.id, s.assignment_id
      FROM subtasks s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE s.id = ? AND a.user_id = ?
    `).get(subtaskId, userId);

    if (!existing) {
      sendError(res, 'NOT_FOUND', 'Subtask not found or not owned by user', 404);
      return;
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (validated.title !== undefined) {
      updates.push('title = ?');
      values.push(validated.title.trim());
    }
    if (validated.estimated_mins !== undefined) {
      updates.push('estimated_mins = ?');
      values.push(validated.estimated_mins);
    }
    if (validated.completed_mins !== undefined) {
      updates.push('completed_mins = ?');
      values.push(validated.completed_mins);
    }
    if (validated.order_index !== undefined) {
      updates.push('order_index = ?');
      values.push(validated.order_index);
    }
    if (validated.is_completed !== undefined) {
      updates.push('is_completed = ?');
      values.push(validated.is_completed ? 1 : 0);
    }

    if (updates.length > 0) {
      values.push(subtaskId);
      db.prepare(`UPDATE subtasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare(`
      SELECT id, assignment_id, title, order_index, estimated_mins, completed_mins, is_completed, ai_generated
      FROM subtasks WHERE id = ?
    `).get(subtaskId) as RawSubtaskRow;

    sendSuccess<Subtask>(res, formatSubtask(updated));
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/subtasks/:id
subtasksRouter.delete('/:id', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const subtaskId = req.params.id;

    const existing = db.prepare(`
      SELECT s.id
      FROM subtasks s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE s.id = ? AND a.user_id = ?
    `).get(subtaskId, userId);

    if (!existing) {
      sendError(res, 'NOT_FOUND', 'Subtask not found or not owned by user', 404);
      return;
    }

    db.prepare('DELETE FROM subtasks WHERE id = ?').run(subtaskId);

    sendSuccess(res, { id: subtaskId, deleted: true });
  } catch (error) {
    next(error);
  }
});
