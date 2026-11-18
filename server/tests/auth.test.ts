import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createDatabase, setDb } from '../src/config/db.js';
import Database from 'better-sqlite3';

describe('Auth & User Lifecycle Integration Tests', () => {
  let testDb: Database.Database;

  beforeEach(() => {
    testDb = createDatabase(':memory:');
    setDb(testDb);
  });

  afterEach(() => {
    testDb.close();
  });

  it('standard API response envelope is adhered to on health check', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error', null);
    expect(res.body).toHaveProperty('meta');
    expect(res.body.data.status).toBe('healthy');
  });

  it('registers a new user successfully and sets HTTP-only cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'student@bham.ac.uk',
        password: 'Password123!',
        full_name: 'Alex Johnson',
        university: 'University of Birmingham',
      });

    expect(res.status).toBe(201);
    expect(res.body.error).toBeNull();
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe('student@bham.ac.uk');
    expect(res.body.data.user.full_name).toBe('Alex Johnson');
    expect(res.body.data.user.university).toBe('University of Birmingham');
    expect(res.body.data.user.subscription_tier).toBe('FREE');
    expect(res.body.data.user.daily_study_cap_mins).toBe(240);
    expect(res.body.data.user.preferred_study_start).toBe('09:00');
    expect(res.body.data.user.preferred_study_end).toBe('21:00');
    expect(res.body.data.user).not.toHaveProperty('password_hash');

    // Verify cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('token=');
    expect(cookies[0]).toContain('HttpOnly');
    expect(cookies[0]).toContain('SameSite=Strict');
  });

  it('rejects registration with duplicate email with 409', async () => {
    // First registration
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'alex@example.com',
        password: 'Password123!',
        full_name: 'Alex Johnson',
      });

    // Duplicate registration
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'alex@example.com',
        password: 'AnotherPassword!',
        full_name: 'Duplicate Alex',
      });

    expect(res.status).toBe(409);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('EMAIL_EXISTS');
  });

  it('rejects registration with short password or invalid email via Zod validation', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'invalid-email',
        password: '123',
        full_name: '',
      });

    expect(res.status).toBe(400);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
  });

  it('logs in registered user with correct credentials and sets cookie', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'student@example.com',
        password: 'SecretPassword123',
        full_name: 'Jane Doe',
      });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'student@example.com',
        password: 'SecretPassword123',
      });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.user.email).toBe('student@example.com');
    const cookies = res.headers['set-cookie'];
    expect(cookies[0]).toContain('token=');
  });

  it('rejects login with wrong password with 401', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'student@example.com',
        password: 'SecretPassword123',
        full_name: 'Jane Doe',
      });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'student@example.com',
        password: 'WrongPassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('GET /api/v1/users/me returns 401 when unauthorized', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/v1/users/me returns profile and breakdown count when authenticated', async () => {
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'student@example.com',
        password: 'SecretPassword123',
        full_name: 'Jane Doe',
      });

    const cookie = registerRes.headers['set-cookie'];

    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.email).toBe('student@example.com');
    expect(res.body.data.ai_breakdown_count_month).toBe(0);
  });

  it('PATCH /api/v1/users/me/preferences updates user preferences successfully', async () => {
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'student@example.com',
        password: 'SecretPassword123',
        full_name: 'Jane Doe',
      });

    const cookie = registerRes.headers['set-cookie'];

    const updateRes = await request(app)
      .patch('/api/v1/users/me/preferences')
      .set('Cookie', cookie)
      .send({
        daily_study_cap_mins: 360,
        preferred_study_start: '08:00',
        preferred_study_end: '22:00',
        university: 'Oxford',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.error).toBeNull();
    expect(updateRes.body.data.daily_study_cap_mins).toBe(360);
    expect(updateRes.body.data.preferred_study_start).toBe('08:00');
    expect(updateRes.body.data.preferred_study_end).toBe('22:00');
    expect(updateRes.body.data.university).toBe('Oxford');
  });

  it('PATCH /api/v1/users/me/preferences validates start time is before end time', async () => {
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'student@example.com',
        password: 'SecretPassword123',
        full_name: 'Jane Doe',
      });

    const cookie = registerRes.headers['set-cookie'];

    const updateRes = await request(app)
      .patch('/api/v1/users/me/preferences')
      .set('Cookie', cookie)
      .send({
        preferred_study_start: '20:00',
        preferred_study_end: '08:00',
      });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.error.code).toBe('INVALID_PREFERENCE');
  });

  it('POST /api/v1/auth/logout clears auth cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    const cookies = res.headers['set-cookie'];
    expect(cookies[0]).toMatch(/token=;/);
  });
});
