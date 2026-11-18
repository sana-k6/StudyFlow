import { Router, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getDb } from '../config/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { Module } from '@studyflow/shared/types.js';

export const modulesRouter = Router();
modulesRouter.use(authMiddleware);

const createModuleSchema = z.object({
  code: z.string().min(1, 'Module code is required').max(30),
  name: z.string().min(1, 'Module name is required').max(150),
  color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color code').optional().default('#3B82F6'),
  credits: z.number().int().positive().optional().nullable(),
  semester: z.string().max(50).optional().nullable(),
});

// GET /api/v1/modules
modulesRouter.get('/', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const db = getDb();
    const modules = db.prepare(`
      SELECT id, user_id, code, name, color_hex, credits, semester
      FROM modules
      WHERE user_id = ?
      ORDER BY code ASC
    `).all(req.user!.id) as Module[];

    sendSuccess<Module[]>(res, modules);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/modules
modulesRouter.post('/', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const validated = createModuleSchema.parse(req.body);
    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO modules (id, user_id, code, name, color_hex, credits, semester)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.user!.id,
      validated.code.toUpperCase().trim(),
      validated.name.trim(),
      validated.color_hex,
      validated.credits ?? null,
      validated.semester?.trim() ?? null
    );

    const newModule = db.prepare(`
      SELECT id, user_id, code, name, color_hex, credits, semester
      FROM modules WHERE id = ? AND user_id = ?
    `).get(id, req.user!.id) as Module;

    sendSuccess<Module>(res, newModule, {}, 201);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/modules/:id
modulesRouter.delete('/:id', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const db = getDb();
    const result = db.prepare(`
      DELETE FROM modules
      WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user!.id);

    if (result.changes === 0) {
      sendError(res, 'NOT_FOUND', 'Module not found or not owned by user', 404);
      return;
    }

    sendSuccess(res, { id: req.params.id, deleted: true });
  } catch (error) {
    next(error);
  }
});
