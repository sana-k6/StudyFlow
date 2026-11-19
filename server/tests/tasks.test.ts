import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createDatabase, setDb } from '../src/config/db.js';
import Database from 'better-sqlite3';

describe('Next-Action Priority & Tasks Integration Tests', () => {
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
        email: 'alice@bham.ac.uk',
        password: 'Password123!',
        full_name: 'Alice Turing',
      });
    userCookie = res1.headers['set-cookie'][0];

    // Register User 2
    const res2 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'bob@bham.ac.uk',
        password: 'Password123!',
        full_name: 'Bob Lovelace',
      });
    otherUserCookie = res2.headers['set-cookie'][0];
  });

  afterEach(() => {
    testDb.close();
  });

  it('returns graceful fallback when student has no active tasks', async () => {
    const res = await request(app)
      .get('/api/v1/tasks/next-action')
      .set('Cookie', userCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.subtask).toBeNull();
    expect(res.body.data.urgency_score).toBe(0);
    expect(res.body.data.rationale).toContain('caught up');
  });

  it('determines highest priority task based on deadline urgency and weighting', async () => {
    // Create Module
    const modRes = await request(app)
      .post('/api/v1/modules')
      .set('Cookie', userCookie)
      .send({ code: 'CS201', name: 'Algorithms' });
    const moduleId = modRes.body.data.id;

    // Assignment 1: Due in 10 days, 20% weight
    const dueLater = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const a1Res = await request(app)
      .post('/api/v1/assignments')
      .set('Cookie', userCookie)
      .send({
        module_id: moduleId,
        title: 'Coursework 2',
        due_date: dueLater,
        weight_percentage: 20,
      });

    await request(app)
      .post(`/api/v1/assignments/${a1Res.body.data.id}/subtasks`)
      .set('Cookie', userCookie)
      .send({ title: 'Read specifications', estimated_mins: 30 });

    // Assignment 2: Due in 2 days, 50% weight (High Urgency!)
    const dueSoon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const a2Res = await request(app)
      .post('/api/v1/assignments')
      .set('Cookie', userCookie)
      .send({
        module_id: moduleId,
        title: 'Major Project Milestone',
        due_date: dueSoon,
        weight_percentage: 50,
      });

    const sub1Res = await request(app)
      .post(`/api/v1/assignments/${a2Res.body.data.id}/subtasks`)
      .set('Cookie', userCookie)
      .send({ title: 'Implement core parser', estimated_mins: 60, order_index: 0 });

    await request(app)
      .post(`/api/v1/assignments/${a2Res.body.data.id}/subtasks`)
      .set('Cookie', userCookie)
      .send({ title: 'Write integration tests', estimated_mins: 45, order_index: 1 });

    // Fetch Next Action
    const nextRes = await request(app)
      .get('/api/v1/tasks/next-action')
      .set('Cookie', userCookie);

    expect(nextRes.status).toBe(200);
    expect(nextRes.body.data.subtask.title).toBe('Implement core parser');
    expect(nextRes.body.data.assignment.title).toBe('Major Project Milestone');
    expect(nextRes.body.data.module.code).toBe('CS201');
    expect(nextRes.body.data.urgency_score).toBeGreaterThan(60);
    expect(nextRes.body.data.rationale).toContain('Major Project Milestone');

    // Complete the first subtask -> next action should advance to subtask 2
    await request(app)
      .patch(`/api/v1/subtasks/${sub1Res.body.data.id}`)
      .set('Cookie', userCookie)
      .send({ is_completed: true });

    const nextRes2 = await request(app)
      .get('/api/v1/tasks/next-action')
      .set('Cookie', userCookie);

    expect(nextRes2.body.data.subtask.title).toBe('Write integration tests');
  });

  it('guarantees user data isolation on next-action queries', async () => {
    // User 1 creates module and assignment
    const modRes = await request(app)
      .post('/api/v1/modules')
      .set('Cookie', userCookie)
      .send({ code: 'CS100', name: 'Intro' });

    const assignRes = await request(app)
      .post('/api/v1/assignments')
      .set('Cookie', userCookie)
      .send({
        module_id: modRes.body.data.id,
        title: 'Secret Assignment',
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

    await request(app)
      .post(`/api/v1/assignments/${assignRes.body.data.id}/subtasks`)
      .set('Cookie', userCookie)
      .send({ title: 'Top Secret Subtask' });

    // User 2 queries next-action -> should NOT see User 1's assignment
    const user2Res = await request(app)
      .get('/api/v1/tasks/next-action')
      .set('Cookie', otherUserCookie);

    expect(user2Res.status).toBe(200);
    expect(user2Res.body.data.subtask).toBeNull();
  });
});
