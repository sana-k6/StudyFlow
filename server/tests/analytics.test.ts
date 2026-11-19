import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createDatabase, setDb } from '../src/config/db.js';
import Database from 'better-sqlite3';

describe('Stage 5 Analytics & Study Logs Integration Tests', () => {
  let testDb: Database.Database;
  let userCookie: string;
  let otherUserCookie: string;
  let moduleId: string;
  let assignmentId: string;
  let subtaskId: string;

  beforeEach(async () => {
    testDb = createDatabase(':memory:');
    setDb(testDb);

    // Register User 1
    const res1 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'analytics.student@bham.ac.uk',
        password: 'Password123!',
        full_name: 'Analytics Student',
      });
    userCookie = res1.headers['set-cookie'][0];

    // Register User 2
    const res2 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'other.student@bham.ac.uk',
        password: 'Password123!',
        full_name: 'Other Student',
      });
    otherUserCookie = res2.headers['set-cookie'][0];

    // Create Module
    const modRes = await request(app)
      .post('/api/v1/modules')
      .set('Cookie', userCookie)
      .send({ code: 'CS250', name: 'Computer Architecture', color_hex: '#6366F1' });
    moduleId = modRes.body.data.id;

    // Create Assignment due in 3 days (at-risk)
    const assignRes = await request(app)
      .post('/api/v1/assignments')
      .set('Cookie', userCookie)
      .send({
        module_id: moduleId,
        title: 'CPU Pipeline Simulator',
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        estimated_total_mins: 180,
      });
    assignmentId = assignRes.body.data.id;

    // Create Subtask
    const subRes = await request(app)
      .post(`/api/v1/assignments/${assignmentId}/subtasks`)
      .set('Cookie', userCookie)
      .send({ title: 'Implement Hazard Detection', estimated_mins: 60 });
    subtaskId = subRes.body.data.id;
  });

  afterEach(() => {
    testDb.close();
  });

  describe('Study Logging (POST /api/v1/analytics/study-logs)', () => {
    it('logs study session and updates subtask completed_mins', async () => {
      const res = await request(app)
        .post('/api/v1/analytics/study-logs')
        .set('Cookie', userCookie)
        .send({
          module_id: moduleId,
          subtask_id: subtaskId,
          duration_mins: 45,
          focus_rating: 4,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.duration_mins).toBe(45);
      expect(res.body.data.focus_rating).toBe(4);

      // Verify subtask completed_mins incremented
      const subtask = testDb.prepare('SELECT completed_mins, is_completed FROM subtasks WHERE id = ?').get(subtaskId) as any;
      expect(subtask.completed_mins).toBe(45);
      expect(subtask.is_completed).toBe(0);

      // Logging another 20 mins exceeds estimated 60 mins -> auto-completes subtask
      await request(app)
        .post('/api/v1/analytics/study-logs')
        .set('Cookie', userCookie)
        .send({
          module_id: moduleId,
          subtask_id: subtaskId,
          duration_mins: 20,
        });

      const updatedSubtask = testDb.prepare('SELECT completed_mins, is_completed FROM subtasks WHERE id = ?').get(subtaskId) as any;
      expect(updatedSubtask.completed_mins).toBe(65);
      expect(updatedSubtask.is_completed).toBe(1);
    });

    it('rejects logging for another user module with 400 INVALID_MODULE', async () => {
      const res = await request(app)
        .post('/api/v1/analytics/study-logs')
        .set('Cookie', otherUserCookie)
        .send({
          module_id: moduleId,
          duration_mins: 30,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_MODULE');
    });
  });

  describe('Analytics Summary (GET /api/v1/analytics/summary)', () => {
    it('aggregates total minutes, module breakdown, completion velocity, and at-risk deadlines', async () => {
      // Log two study sessions
      await request(app)
        .post('/api/v1/analytics/study-logs')
        .set('Cookie', userCookie)
        .send({ module_id: moduleId, duration_mins: 60, focus_rating: 5 });

      await request(app)
        .post('/api/v1/analytics/study-logs')
        .set('Cookie', userCookie)
        .send({ module_id: moduleId, duration_mins: 40, focus_rating: 4 });

      // Mark subtask complete
      await request(app)
        .patch(`/api/v1/subtasks/${subtaskId}`)
        .set('Cookie', userCookie)
        .send({ is_completed: true });

      const res = await request(app)
        .get('/api/v1/analytics/summary?range=7d')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      expect(res.body.error).toBeNull();
      expect(res.body.data.total_study_mins).toBe(100);

      // Module breakdown
      expect(res.body.data.hours_by_module.length).toBe(1);
      expect(res.body.data.hours_by_module[0].module_code).toBe('CS250');
      expect(res.body.data.hours_by_module[0].duration_mins).toBe(100);

      // Velocity
      expect(res.body.data.completion_velocity.total_subtasks).toBe(1);
      expect(res.body.data.completion_velocity.completed_subtasks).toBe(1);
      expect(res.body.data.completion_velocity.completion_rate).toBe(100);

      // At-risk deadline flagged (due in 3 days)
      expect(res.body.data.at_risk_deadlines.length).toBe(1);
      expect(res.body.data.at_risk_deadlines[0].title).toBe('CPU Pipeline Simulator');
      expect(res.body.data.at_risk_deadlines[0].days_left).toBeLessThanOrEqual(3);
    });

    it('isolates user analytics from other accounts', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/summary?range=7d')
        .set('Cookie', otherUserCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.total_study_mins).toBe(0);
      expect(res.body.data.hours_by_module.length).toBe(0);
      expect(res.body.data.completion_velocity.total_subtasks).toBe(0);
      expect(res.body.data.at_risk_deadlines.length).toBe(0);
    });
  });
});
