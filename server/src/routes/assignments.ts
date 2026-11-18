import { Router, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getDb } from '../config/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { Assignment, Subtask } from '@studyflow/shared/types.js';

export const assignmentsRouter = Router();
assignmentsRouter.use(authMiddleware);

const statusEnum = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']);

const createAssignmentSchema = z.object({
  module_id: z.string().uuid('Invalid module ID'),
  title: z.string().min(1, 'Assignment title is required').max(200),
  description: z.string().max(2000).optional().nullable(),
  due_date: z.string().datetime({ message: 'due_date must be a valid ISO-8601 string' }),
  weight_percentage: z.number().min(0).max(100).optional().default(0),
  estimated_total_mins: z.number().int().min(15).max(6000).optional().default(120),
});

const updateAssignmentSchema = z.object({
  module_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  due_date: z.string().datetime().optional(),
  weight_percentage: z.number().min(0).max(100).optional(),
  estimated_total_mins: z.number().int().min(15).max(6000).optional(),
  status: statusEnum.optional(),
});

const createSubtaskSchema = z.object({
  title: z.string().min(1, 'Subtask title is required').max(200),
  estimated_mins: z.number().int().min(10).max(240).optional().default(45),
  order_index: z.number().int().optional(),
});

const updateSubtaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  estimated_mins: z.number().int().min(10).max(240).optional(),
  completed_mins: z.number().int().min(0).max(1440).optional(),
  order_index: z.number().int().optional(),
  is_completed: z.boolean().optional(),
});

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

// GET /api/v1/assignments
assignmentsRouter.get('/', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const db = getDb();
    const userId = req.user!.id;

    const assignments = db.prepare(`
      SELECT a.id, a.user_id, a.module_id, a.title, a.description, a.due_date,
             a.weight_percentage, a.estimated_total_mins, a.priority_score, a.status,
             m.code as module_code, m.name as module_name, m.color_hex as module_color
      FROM assignments a
      LEFT JOIN modules m ON a.module_id = m.id
      WHERE a.user_id = ?
      ORDER BY a.due_date ASC
    `).all(userId) as Array<Assignment & { module_code?: string; module_name?: string; module_color?: string }>;

    // Fetch subtasks for all assignments of this user
    const subtasks = db.prepare(`
      SELECT s.id, s.assignment_id, s.title, s.order_index, s.estimated_mins, s.completed_mins, s.is_completed, s.ai_generated
      FROM subtasks s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE a.user_id = ?
      ORDER BY s.order_index ASC
    `).all(userId) as RawSubtaskRow[];

    const subtaskMap = new Map<string, Subtask[]>();
    for (const sub of subtasks) {
      const formattedSub = formatSubtask(sub);
      const list = subtaskMap.get(sub.assignment_id) || [];
      list.push(formattedSub);
      subtaskMap.set(sub.assignment_id, list);
    }

    const result = assignments.map((a) => ({
      ...a,
      subtasks: subtaskMap.get(a.id) || [],
    }));

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/assignments
assignmentsRouter.post('/', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const validated = createAssignmentSchema.parse(req.body);
    const db = getDb();
    const userId = req.user!.id;

    // Verify module belongs to user
    const module = db.prepare('SELECT id FROM modules WHERE id = ? AND user_id = ?').get(validated.module_id, userId);
    if (!module) {
      sendError(res, 'INVALID_MODULE', 'Module not found or not owned by user', 400);
      return;
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO assignments (
        id, user_id, module_id, title, description, due_date, weight_percentage, estimated_total_mins, priority_score, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'NOT_STARTED')
    `).run(
      id,
      userId,
      validated.module_id,
      validated.title.trim(),
      validated.description?.trim() ?? null,
      validated.due_date,
      validated.weight_percentage ?? 0,
      validated.estimated_total_mins ?? 120
    );

    const created = db.prepare(`
      SELECT id, user_id, module_id, title, description, due_date, weight_percentage, estimated_total_mins, priority_score, status
      FROM assignments WHERE id = ? AND user_id = ?
    `).get(id, userId) as Assignment;

    sendSuccess<Assignment>(res, { ...created, subtasks: [] } as any, {}, 201);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/assignments/:id
assignmentsRouter.patch('/:id', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const validated = updateAssignmentSchema.parse(req.body);
    const db = getDb();
    const userId = req.user!.id;
    const assignmentId = req.params.id;

    const existing = db.prepare('SELECT id FROM assignments WHERE id = ? AND user_id = ?').get(assignmentId, userId);
    if (!existing) {
      sendError(res, 'NOT_FOUND', 'Assignment not found or not owned by user', 404);
      return;
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (validated.module_id !== undefined) {
      const module = db.prepare('SELECT id FROM modules WHERE id = ? AND user_id = ?').get(validated.module_id, userId);
      if (!module) {
        sendError(res, 'INVALID_MODULE', 'Module not found or not owned by user', 400);
        return;
      }
      updates.push('module_id = ?');
      values.push(validated.module_id);
    }
    if (validated.title !== undefined) {
      updates.push('title = ?');
      values.push(validated.title.trim());
    }
    if (validated.description !== undefined) {
      updates.push('description = ?');
      values.push(validated.description?.trim() ?? null);
    }
    if (validated.due_date !== undefined) {
      updates.push('due_date = ?');
      values.push(validated.due_date);
    }
    if (validated.weight_percentage !== undefined) {
      updates.push('weight_percentage = ?');
      values.push(validated.weight_percentage);
    }
    if (validated.estimated_total_mins !== undefined) {
      updates.push('estimated_total_mins = ?');
      values.push(validated.estimated_total_mins);
    }
    if (validated.status !== undefined) {
      updates.push('status = ?');
      values.push(validated.status);
    }

    if (updates.length > 0) {
      values.push(assignmentId, userId);
      db.prepare(`UPDATE assignments SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
    }

    const updated = db.prepare(`
      SELECT id, user_id, module_id, title, description, due_date, weight_percentage, estimated_total_mins, priority_score, status
      FROM assignments WHERE id = ? AND user_id = ?
    `).get(assignmentId, userId) as Assignment;

    sendSuccess<Assignment>(res, updated);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/assignments/:id
assignmentsRouter.delete('/:id', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const db = getDb();
    const result = db.prepare(`
      DELETE FROM assignments WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user!.id);

    if (result.changes === 0) {
      sendError(res, 'NOT_FOUND', 'Assignment not found or not owned by user', 404);
      return;
    }

    sendSuccess(res, { id: req.params.id, deleted: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/assignments/:id/subtasks
assignmentsRouter.post('/:id/subtasks', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const validated = createSubtaskSchema.parse(req.body);
    const db = getDb();
    const userId = req.user!.id;
    const assignmentId = req.params.id;

    // Verify assignment belongs to user
    const assignment = db.prepare('SELECT id FROM assignments WHERE id = ? AND user_id = ?').get(assignmentId, userId);
    if (!assignment) {
      sendError(res, 'NOT_FOUND', 'Assignment not found or not owned by user', 404);
      return;
    }

    // Determine order_index if not provided
    let orderIndex = validated.order_index;
    if (orderIndex === undefined) {
      const maxOrderRow = db.prepare('SELECT MAX(order_index) as maxOrder FROM subtasks WHERE assignment_id = ?').get(assignmentId) as { maxOrder: number | null };
      orderIndex = (maxOrderRow?.maxOrder ?? -1) + 1;
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO subtasks (id, assignment_id, title, order_index, estimated_mins, completed_mins, is_completed, ai_generated)
      VALUES (?, ?, ?, ?, ?, 0, 0, 0)
    `).run(id, assignmentId, validated.title.trim(), orderIndex, validated.estimated_mins);

    const created = db.prepare(`
      SELECT id, assignment_id, title, order_index, estimated_mins, completed_mins, is_completed, ai_generated
      FROM subtasks WHERE id = ?
    `).get(id) as RawSubtaskRow;

    sendSuccess<Subtask>(res, formatSubtask(created), {}, 201);
  } catch (error) {
    next(error);
  }
});
