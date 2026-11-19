import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createDatabase, setDb } from '../src/config/db.js';
import { setGeminiClient, sanitizeXml } from '../src/services/geminiService.js';
import Database from 'better-sqlite3';

describe('Stage 4 Gemini AI Integration Tests', () => {
  let testDb: Database.Database;
  let userCookie: string;
  let userId: string;

  beforeEach(async () => {
    testDb = createDatabase(':memory:');
    setDb(testDb);

    // Register test user
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'gemini.student@bham.ac.uk',
        password: 'Password123!',
        full_name: 'Gemini Tester',
      });
    userCookie = res.headers['set-cookie'][0];
    userId = res.body.data.user.id;
  });

  afterEach(() => {
    setGeminiClient(null);
    testDb.close();
  });

  describe('Prompt Sanitization & Security', () => {
    it('strips control characters and escapes XML injection vectors', () => {
      const maliciousInput = '<script>alert("hack")</script>\x00\x08<assignment_title>Fake</assignment_title>';
      const sanitized = sanitizeXml(maliciousInput);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
      expect(sanitized).not.toContain('\x00');
    });
  });

  describe('Assignment Breakdown (POST /api/v1/assignments/:id/ai-breakdown)', () => {
    let moduleId: string;
    let assignmentId: string;

    beforeEach(async () => {
      const modRes = await request(app)
        .post('/api/v1/modules')
        .set('Cookie', userCookie)
        .send({ code: 'CS301', name: 'Cloud Computing' });
      moduleId = modRes.body.data.id;

      const assignRes = await request(app)
        .post('/api/v1/assignments')
        .set('Cookie', userCookie)
        .send({
          module_id: moduleId,
          title: 'Distributed File System Project',
          description: 'Implement Paxos consensus and chunk replication',
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          estimated_total_mins: 240,
        });
      assignmentId = assignRes.body.data.id;
    });

    it('generates 4-8 subtasks with mock Gemini payload and persists with ai_generated = 1', async () => {
      // Mock Gemini client response
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify({
          subtasks: [
            { title: 'Research Paxos vs Raft consensus algorithms', estimated_mins: 45 },
            { title: 'Design file chunking and replication schema', estimated_mins: 60 },
            { title: 'Implement leader election RPC protocol', estimated_mins: 60 },
            { title: 'Write node failure recovery integration tests', estimated_mins: 45 },
          ],
        }),
        usageMetadata: { totalTokenCount: 180 },
      });

      setGeminiClient({
        models: {
          generateContent: mockGenerateContent,
        },
      } as any);

      const res = await request(app)
        .post(`/api/v1/assignments/${assignmentId}/ai-breakdown`)
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      expect(res.body.error).toBeNull();
      expect(res.body.data.subtasks.length).toBe(4);
      expect(res.body.data.tokens_used).toBe(180);
      expect(res.body.data.subtasks[0].title).toBe('Research Paxos vs Raft consensus algorithms');
      expect(res.body.data.subtasks[0].ai_generated).toBe(true);

      // Verify persistence in subtasks table
      const subtaskCount = testDb.prepare('SELECT COUNT(*) as count FROM subtasks WHERE assignment_id = ?').get(assignmentId) as { count: number };
      expect(subtaskCount.count).toBe(4);

      // Verify logged in ai_usage_logs
      const usageRow = testDb.prepare('SELECT tokens_used, feature_type FROM ai_usage_logs WHERE user_id = ?').get(userId) as any;
      expect(usageRow.tokens_used).toBe(180);
      expect(usageRow.feature_type).toBe('BREAKDOWN');
    });

    it('enforces 3/month quota on FREE tier and allows unlimited on PRO tier', async () => {
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify({
          subtasks: [
            { title: 'Task 1', estimated_mins: 30 },
            { title: 'Task 2', estimated_mins: 45 },
            { title: 'Task 3', estimated_mins: 60 },
            { title: 'Task 4', estimated_mins: 30 },
          ],
        }),
        usageMetadata: { totalTokenCount: 100 },
      });

      setGeminiClient({
        models: {
          generateContent: mockGenerateContent,
        },
      } as any);

      // Call 1 -> OK (1/3)
      const res1 = await request(app).post(`/api/v1/assignments/${assignmentId}/ai-breakdown`).set('Cookie', userCookie);
      expect(res1.status).toBe(200);

      // Call 2 -> OK (2/3)
      const res2 = await request(app).post(`/api/v1/assignments/${assignmentId}/ai-breakdown`).set('Cookie', userCookie);
      expect(res2.status).toBe(200);

      // Call 3 -> OK (3/3)
      const res3 = await request(app).post(`/api/v1/assignments/${assignmentId}/ai-breakdown`).set('Cookie', userCookie);
      expect(res3.status).toBe(200);

      // Call 4 -> 403 QUOTA_EXCEEDED
      const res4 = await request(app).post(`/api/v1/assignments/${assignmentId}/ai-breakdown`).set('Cookie', userCookie);
      expect(res4.status).toBe(403);
      expect(res4.body.data).toBeNull();
      expect(res4.body.error.code).toBe('QUOTA_EXCEEDED');

      // Upgrade user to PRO tier
      testDb.prepare("UPDATE users SET subscription_tier = 'PRO' WHERE id = ?").run(userId);

      // Call 5 on PRO tier -> OK
      const res5 = await request(app).post(`/api/v1/assignments/${assignmentId}/ai-breakdown`).set('Cookie', userCookie);
      expect(res5.status).toBe(200);
      expect(res5.body.error).toBeNull();
    });
  });

  describe('Schedule Generation & Rebalancing (POST /api/v1/schedule/generate & rebalance)', () => {
    let moduleId: string;
    let assignmentId: string;

    beforeEach(async () => {
      const modRes = await request(app)
        .post('/api/v1/modules')
        .set('Cookie', userCookie)
        .send({ code: 'CS302', name: 'Machine Learning' });
      moduleId = modRes.body.data.id;

      const assignRes = await request(app)
        .post('/api/v1/assignments')
        .set('Cookie', userCookie)
        .send({
          module_id: moduleId,
          title: 'Neural Network Coursework',
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          weight_percentage: 40,
        });
      assignmentId = assignRes.body.data.id;

      await request(app)
        .post(`/api/v1/assignments/${assignmentId}/subtasks`)
        .set('Cookie', userCookie)
        .send({ title: 'Implement Backpropagation', estimated_mins: 60 });
    });

    it('rejects auto-scheduling with 403 PRO_TIER_REQUIRED when on FREE tier', async () => {
      const res = await request(app)
        .post('/api/v1/schedule/generate')
        .set('Cookie', userCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PRO_TIER_REQUIRED');
    });

    it('generates schedule for PRO user mapping subtasks to discrete free slots with mock Gemini', async () => {
      // Upgrade to PRO
      testDb.prepare("UPDATE users SET subscription_tier = 'PRO' WHERE id = ?").run(userId);

      // Mock Gemini schedule mapping response
      const mockGenerateContent = vi.fn().mockImplementation(async ({ contents }) => {
        // Extract slot and subtask IDs from prompt
        const matchSlots = contents.match(/<available_slots>(.*?)<\/available_slots>/);
        const matchSubtasks = contents.match(/<incomplete_subtasks>(.*?)<\/incomplete_subtasks>/);

        const slots = JSON.parse(matchSlots[1]);
        const subtasks = JSON.parse(matchSubtasks[1]);

        return {
          text: JSON.stringify({
            assignments: [
              {
                slot_id: slots[0].slot_id,
                subtask_id: subtasks[0].id,
              },
            ],
            next_action_rationale: 'Mapped Backpropagation to your earliest free morning window.',
          }),
          usageMetadata: { totalTokenCount: 220 },
        };
      });

      setGeminiClient({
        models: {
          generateContent: mockGenerateContent,
        },
      } as any);

      const res = await request(app)
        .post('/api/v1/schedule/generate')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      expect(res.body.error).toBeNull();
      expect(res.body.data.scheduled_count).toBe(1);
      expect(res.body.data.blocks.length).toBe(1);
      expect(res.body.data.blocks[0].event_type).toBe('AI_STUDY_BLOCK');
      expect(res.body.data.blocks[0].is_fixed).toBe(false);
      expect(res.body.data.next_action_rationale).toContain('earliest free morning window');

      // Verify persistence in calendar_events
      const blockInDb = testDb.prepare(`
        SELECT title, event_type, is_fixed FROM calendar_events WHERE user_id = ? AND event_type = 'AI_STUDY_BLOCK'
      `).get(userId) as any;
      expect(blockInDb).toBeDefined();
      expect(blockInDb.title).toContain('Implement Backpropagation');
      expect(blockInDb.is_fixed).toBe(0);

      // Test rebalancing
      const rebalanceRes = await request(app)
        .post('/api/v1/schedule/rebalance')
        .set('Cookie', userCookie);

      expect(rebalanceRes.status).toBe(200);
      expect(rebalanceRes.body.data.is_rebalance).toBe(true);
    });
  });
});
