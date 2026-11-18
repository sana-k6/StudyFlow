import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createDatabase, setDb } from '../src/config/db.js';
import Database from 'better-sqlite3';

describe('Stage 2 Academic Entities & Timetable Integration Tests', () => {
  let testDb: Database.Database;
  let userCookie: string;
  let otherUserCookie: string;

  beforeEach(async () => {
    testDb = createDatabase(':memory:');
    setDb(testDb);

    // Register User 1
    const res1 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'student1@bham.ac.uk',
        password: 'Password123!',
        full_name: 'Student One',
        university: 'University of Birmingham',
      });
    userCookie = res1.headers['set-cookie'][0];

    // Register User 2 (for IDOR isolation testing)
    const res2 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'student2@bham.ac.uk',
        password: 'Password123!',
        full_name: 'Student Two',
        university: 'University of Birmingham',
      });
    otherUserCookie = res2.headers['set-cookie'][0];
  });

  afterEach(() => {
    testDb.close();
  });

  describe('Modules CRUD', () => {
    it('creates and lists modules with strict user isolation', async () => {
      // Create module for User 1
      const createRes = await request(app)
        .post('/api/v1/modules')
        .set('Cookie', userCookie)
        .send({
          code: 'CS201',
          name: 'Data Structures and Algorithms',
          color_hex: '#10B981',
          credits: 20,
          semester: 'Autumn',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.error).toBeNull();
      expect(createRes.body.data.code).toBe('CS201');
      expect(createRes.body.data.name).toBe('Data Structures and Algorithms');

      // User 1 lists modules -> sees 1 module
      const listRes1 = await request(app)
        .get('/api/v1/modules')
        .set('Cookie', userCookie);

      expect(listRes1.status).toBe(200);
      expect(listRes1.body.data.length).toBe(1);
      expect(listRes1.body.data[0].code).toBe('CS201');

      // User 2 lists modules -> sees 0 modules (no leakage)
      const listRes2 = await request(app)
        .get('/api/v1/modules')
        .set('Cookie', otherUserCookie);

      expect(listRes2.status).toBe(200);
      expect(listRes2.body.data.length).toBe(0);
    });

    it('deletes module and forbids cross-user deletion', async () => {
      const createRes = await request(app)
        .post('/api/v1/modules')
        .set('Cookie', userCookie)
        .send({ code: 'MATH101', name: 'Calculus' });

      const moduleId = createRes.body.data.id;

      // User 2 attempts to delete User 1's module -> 404 IDOR protected
      const unauthorizedDelete = await request(app)
        .delete(`/api/v1/modules/${moduleId}`)
        .set('Cookie', otherUserCookie);

      expect(unauthorizedDelete.status).toBe(404);

      // User 1 deletes their module -> 200
      const authorizedDelete = await request(app)
        .delete(`/api/v1/modules/${moduleId}`)
        .set('Cookie', userCookie);

      expect(authorizedDelete.status).toBe(200);
      expect(authorizedDelete.body.data.deleted).toBe(true);
    });
  });

  describe('Calendar Events & ICS Import', () => {
    it('creates and retrieves calendar events within date ranges', async () => {
      const createRes = await request(app)
        .post('/api/v1/calendar/events')
        .set('Cookie', userCookie)
        .send({
          title: 'Artificial Intelligence Seminar',
          event_type: 'LECTURE',
          start_time: '2026-11-20T10:00:00.000Z',
          end_time: '2026-11-20T11:30:00.000Z',
          is_fixed: true,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.title).toBe('Artificial Intelligence Seminar');

      // Query covering the event
      const queryRes = await request(app)
        .get('/api/v1/calendar/events?start=2026-11-20T00:00:00.000Z&end=2026-11-20T23:59:59.000Z')
        .set('Cookie', userCookie);

      expect(queryRes.status).toBe(200);
      expect(queryRes.body.data.length).toBe(1);

      // Query outside the event
      const emptyRes = await request(app)
        .get('/api/v1/calendar/events?start=2026-11-21T00:00:00.000Z&end=2026-11-21T23:59:59.000Z')
        .set('Cookie', userCookie);

      expect(emptyRes.status).toBe(200);
      expect(emptyRes.body.data.length).toBe(0);
    });

    it('imports ICS timetable, auto-creates modules and deduplicates on external_uid', async () => {
      const sampleIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//University Timetable//EN
BEGIN:VEVENT
UID:timetable-event-999@univ.ac.uk
DTSTART:20261125T090000Z
DTEND:20261125T110000Z
SUMMARY:CS301 Distributed Systems Lecture
DESCRIPTION:Room G12
END:VEVENT
END:VCALENDAR`;

      // First import
      const importRes = await request(app)
        .post('/api/v1/calendar/import-ics')
        .set('Cookie', userCookie)
        .send({ ics_content: sampleIcs });

      expect(importRes.status).toBe(200);
      expect(importRes.body.data.imported_count).toBe(1);

      // Verify module CS301 was automatically registered for user
      const modulesRes = await request(app)
        .get('/api/v1/modules')
        .set('Cookie', userCookie);

      expect(modulesRes.body.data.some((m: any) => m.code === 'CS301')).toBe(true);

      // Second import with updated title for the same UID should update, not duplicate
      const updatedIcs = sampleIcs.replace('CS301 Distributed Systems Lecture', 'CS301 Distributed Systems Lecture (Moved to Hall B)');
      const reimportRes = await request(app)
        .post('/api/v1/calendar/import-ics')
        .set('Cookie', userCookie)
        .send({ ics_content: updatedIcs });

      expect(reimportRes.status).toBe(200);

      // Verify event count is still 1
      const eventsRes = await request(app)
        .get('/api/v1/calendar/events')
        .set('Cookie', userCookie);

      expect(eventsRes.body.data.length).toBe(1);
      expect(eventsRes.body.data[0].title).toContain('Moved to Hall B');
    });
  });

  describe('Assignments & Subtasks CRUD', () => {
    let moduleId: string;

    beforeEach(async () => {
      const modRes = await request(app)
        .post('/api/v1/modules')
        .set('Cookie', userCookie)
        .send({ code: 'CS105', name: 'Programming Languages' });
      moduleId = modRes.body.data.id;
    });

    it('creates assignment and verifies module ownership', async () => {
      const createRes = await request(app)
        .post('/api/v1/assignments')
        .set('Cookie', userCookie)
        .send({
          module_id: moduleId,
          title: 'Interpreter Project',
          description: 'Build a bytecode interpreter in Rust',
          due_date: '2026-12-15T23:59:00.000Z',
          weight_percentage: 40,
          estimated_total_mins: 360,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.title).toBe('Interpreter Project');
      expect(createRes.body.data.status).toBe('NOT_STARTED');

      // User 2 cannot create assignment under User 1's module
      const invalidModRes = await request(app)
        .post('/api/v1/assignments')
        .set('Cookie', otherUserCookie)
        .send({
          module_id: moduleId,
          title: 'Hacked Assignment',
          due_date: '2026-12-15T23:59:00.000Z',
        });

      expect(invalidModRes.status).toBe(400);
      expect(invalidModRes.body.error.code).toBe('INVALID_MODULE');
    });

    it('adds subtask, updates completion and progress status', async () => {
      const assignRes = await request(app)
        .post('/api/v1/assignments')
        .set('Cookie', userCookie)
        .send({
          module_id: moduleId,
          title: 'Coursework 1',
          due_date: '2026-12-01T12:00:00.000Z',
        });
      const assignmentId = assignRes.body.data.id;

      // Add Subtask
      const subtaskRes = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/subtasks`)
        .set('Cookie', userCookie)
        .send({
          title: 'Write Lexer and Parser',
          estimated_mins: 60,
        });

      expect(subtaskRes.status).toBe(201);
      expect(subtaskRes.body.data.title).toBe('Write Lexer and Parser');
      expect(subtaskRes.body.data.is_completed).toBe(false);

      const subtaskId = subtaskRes.body.data.id;

      // Mark Subtask Complete
      const patchSubtaskRes = await request(app)
        .patch(`/api/v1/subtasks/${subtaskId}`)
        .set('Cookie', userCookie)
        .send({
          is_completed: true,
          completed_mins: 55,
        });

      expect(patchSubtaskRes.status).toBe(200);
      expect(patchSubtaskRes.body.data.is_completed).toBe(true);
      expect(patchSubtaskRes.body.data.completed_mins).toBe(55);

      // Verify nested subtasks appear in GET /api/v1/assignments
      const getAssignments = await request(app)
        .get('/api/v1/assignments')
        .set('Cookie', userCookie);

      expect(getAssignments.body.data.length).toBe(1);
      expect(getAssignments.body.data[0].subtasks.length).toBe(1);
      expect(getAssignments.body.data[0].subtasks[0].is_completed).toBe(true);
    });
  });
});
