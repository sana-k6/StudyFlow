import { Router, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getDb } from '../config/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { parseIcsContent } from '../services/icsParser.js';
import { CalendarEvent, Module } from '@studyflow/shared/types.js';

export const calendarRouter = Router();
calendarRouter.use(authMiddleware);

const eventTypeEnum = z.enum(['LECTURE', 'TUTORIAL', 'EXAM', 'PERSONAL', 'AI_STUDY_BLOCK']);

const createEventSchema = z.object({
  title: z.string().min(1, 'Event title is required').max(200),
  event_type: eventTypeEnum,
  start_time: z.string().datetime({ message: 'start_time must be a valid ISO-8601 string' }),
  end_time: z.string().datetime({ message: 'end_time must be a valid ISO-8601 string' }),
  module_id: z.string().uuid().optional().nullable(),
  subtask_id: z.string().uuid().optional().nullable(),
  is_fixed: z.boolean().optional().default(true),
});

const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  event_type: eventTypeEnum.optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  module_id: z.string().uuid().optional().nullable(),
  subtask_id: z.string().uuid().optional().nullable(),
  is_fixed: z.boolean().optional(),
});

const importIcsSchema = z.object({
  ics_content: z.string().min(10, 'iCalendar content is required'),
});

type RawCalendarEventRow = Omit<CalendarEvent, 'is_fixed'> & { is_fixed: number };

function formatCalendarEvent(row: RawCalendarEventRow): CalendarEvent {
  return {
    ...row,
    is_fixed: Boolean(row.is_fixed),
  };
}

// GET /api/v1/calendar/events?start=ISO&end=ISO
calendarRouter.get('/events', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const { start, end } = req.query;
    const db = getDb();
    const userId = req.user!.id;

    let query = `
      SELECT id, user_id, module_id, subtask_id, external_uid, title, event_type, start_time, end_time, is_fixed
      FROM calendar_events
      WHERE user_id = ?
    `;
    const params: unknown[] = [userId];

    if (start && typeof start === 'string') {
      query += ` AND end_time >= ?`;
      params.push(start);
    }
    if (end && typeof end === 'string') {
      query += ` AND start_time <= ?`;
      params.push(end);
    }

    query += ` ORDER BY start_time ASC`;

    const events = db.prepare(query).all(...params) as RawCalendarEventRow[];
    const formatted = events.map(formatCalendarEvent);

    sendSuccess<CalendarEvent[]>(res, formatted);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/calendar/import-ics
calendarRouter.post('/import-ics', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const validated = importIcsSchema.parse(req.body);
    const parsedEvents = parseIcsContent(validated.ics_content);
    const db = getDb();
    const userId = req.user!.id;

    if (parsedEvents.length === 0) {
      sendError(res, 'NO_EVENTS_FOUND', 'No valid events found in provided iCalendar content', 400);
      return;
    }

    // Existing user modules
    const userModules = db.prepare('SELECT id, code FROM modules WHERE user_id = ?').all(userId) as Module[];
    const moduleMap = new Map<string, string>();
    for (const mod of userModules) {
      moduleMap.set(mod.code.toUpperCase(), mod.id);
    }

    const insertedIds: string[] = [];
    const transaction = db.transaction(() => {
      const upsertStmt = db.prepare(`
        INSERT INTO calendar_events (
          id, user_id, module_id, subtask_id, external_uid, title, event_type, start_time, end_time, is_fixed
        ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(user_id, external_uid) DO UPDATE SET
          title = excluded.title,
          start_time = excluded.start_time,
          end_time = excluded.end_time,
          module_id = COALESCE(excluded.module_id, calendar_events.module_id)
        WHERE calendar_events.event_type != 'AI_STUDY_BLOCK'
      `);

      for (const ev of parsedEvents) {
        let moduleId: string | null = null;
        if (ev.module_code) {
          const upperCode = ev.module_code.toUpperCase();
          if (moduleMap.has(upperCode)) {
            moduleId = moduleMap.get(upperCode)!;
          } else {
            // Auto-create module for the student
            const newModId = uuidv4();
            db.prepare(`
              INSERT INTO modules (id, user_id, code, name, color_hex)
              VALUES (?, ?, ?, ?, '#3B82F6')
            `).run(newModId, userId, upperCode, `${upperCode} Course`);
            moduleMap.set(upperCode, newModId);
            moduleId = newModId;
          }
        }

        const id = uuidv4();
        upsertStmt.run(
          id,
          userId,
          moduleId,
          ev.external_uid,
          ev.title,
          ev.event_type,
          ev.start_time,
          ev.end_time
        );
        insertedIds.push(id);
      }
    });

    transaction();

    sendSuccess(
      res,
      {
        imported_count: parsedEvents.length,
        message: `Successfully imported ${parsedEvents.length} calendar events`,
      },
      {},
      200
    );
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/calendar/events
calendarRouter.post('/events', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const validated = createEventSchema.parse(req.body);
    const db = getDb();
    const userId = req.user!.id;
    const id = uuidv4();

    db.prepare(`
      INSERT INTO calendar_events (
        id, user_id, module_id, subtask_id, external_uid, title, event_type, start_time, end_time, is_fixed
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      validated.module_id ?? null,
      validated.subtask_id ?? null,
      validated.title.trim(),
      validated.event_type,
      validated.start_time,
      validated.end_time,
      validated.is_fixed ? 1 : 0
    );

    const created = db.prepare(`
      SELECT id, user_id, module_id, subtask_id, external_uid, title, event_type, start_time, end_time, is_fixed
      FROM calendar_events WHERE id = ? AND user_id = ?
    `).get(id, userId) as RawCalendarEventRow;

    sendSuccess<CalendarEvent>(res, formatCalendarEvent(created), {}, 201);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/calendar/events/:id
calendarRouter.patch('/events/:id', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const validated = updateEventSchema.parse(req.body);
    const db = getDb();
    const userId = req.user!.id;
    const eventId = req.params.id;

    const existing = db.prepare('SELECT id FROM calendar_events WHERE id = ? AND user_id = ?').get(eventId, userId);
    if (!existing) {
      sendError(res, 'NOT_FOUND', 'Event not found or not owned by user', 404);
      return;
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (validated.title !== undefined) {
      updates.push('title = ?');
      values.push(validated.title.trim());
    }
    if (validated.event_type !== undefined) {
      updates.push('event_type = ?');
      values.push(validated.event_type);
    }
    if (validated.start_time !== undefined) {
      updates.push('start_time = ?');
      values.push(validated.start_time);
    }
    if (validated.end_time !== undefined) {
      updates.push('end_time = ?');
      values.push(validated.end_time);
    }
    if (validated.module_id !== undefined) {
      updates.push('module_id = ?');
      values.push(validated.module_id);
    }
    if (validated.subtask_id !== undefined) {
      updates.push('subtask_id = ?');
      values.push(validated.subtask_id);
    }
    if (validated.is_fixed !== undefined) {
      updates.push('is_fixed = ?');
      values.push(validated.is_fixed ? 1 : 0);
    }

    if (updates.length > 0) {
      values.push(eventId, userId);
      db.prepare(`UPDATE calendar_events SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
    }

    const updated = db.prepare(`
      SELECT id, user_id, module_id, subtask_id, external_uid, title, event_type, start_time, end_time, is_fixed
      FROM calendar_events WHERE id = ? AND user_id = ?
    `).get(eventId, userId) as RawCalendarEventRow;

    sendSuccess<CalendarEvent>(res, formatCalendarEvent(updated));
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/calendar/events/:id
calendarRouter.delete('/events/:id', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const db = getDb();
    const result = db.prepare(`
      DELETE FROM calendar_events WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user!.id);

    if (result.changes === 0) {
      sendError(res, 'NOT_FOUND', 'Event not found or not owned by user', 404);
      return;
    }

    sendSuccess(res, { id: req.params.id, deleted: true });
  } catch (error) {
    next(error);
  }
});
