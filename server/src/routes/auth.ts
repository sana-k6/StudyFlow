import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { env } from '../config/env.js';
import { getDb } from '../config/db.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { User, AuthResponseData } from '@studyflow/shared/types.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  full_name: z.string().min(1, 'Full name is required'),
  university: z.string().optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

function setAuthCookie(res: Response, token: string): void {
  res.cookie('token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function clearAuthCookie(res: Response): void {
  res.clearCookie('token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
}

// POST /api/v1/auth/register
authRouter.post('/register', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = registerSchema.parse(req.body);
    const db = getDb();

    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(validated.email);
    if (existing) {
      sendError(res, 'EMAIL_EXISTS', 'An account with this email already exists', 409);
      return;
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(validated.password, saltRounds);
    const userId = uuidv4();
    const now = new Date().toISOString();

    const insert = db.prepare(`
      INSERT INTO users (
        id, email, password_hash, full_name, university,
        subscription_tier, daily_study_cap_mins, preferred_study_start, preferred_study_end, created_at
      ) VALUES (?, ?, ?, ?, ?, 'FREE', 240, '09:00', '21:00', ?)
    `);

    insert.run(
      userId,
      validated.email.toLowerCase().trim(),
      passwordHash,
      validated.full_name.trim(),
      validated.university?.trim() || null,
      now
    );

    const newUser = db.prepare(`
      SELECT id, email, full_name, university, subscription_tier,
             daily_study_cap_mins, preferred_study_start, preferred_study_end, created_at
      FROM users WHERE id = ?
    `).get(userId) as User;

    const token = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '7d' });
    setAuthCookie(res, token);

    sendSuccess<AuthResponseData>(
      res,
      { user: newUser },
      { token }, // Return token in meta as well for flexibility in testing / non-cookie clients
      201
    );
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/login
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = loginSchema.parse(req.body);
    const db = getDb();

    const userWithHash = db.prepare(`
      SELECT id, email, password_hash, full_name, university, subscription_tier,
             daily_study_cap_mins, preferred_study_start, preferred_study_end, created_at
      FROM users WHERE email = ?
    `).get(validated.email.toLowerCase().trim()) as (User & { password_hash: string }) | undefined;

    if (!userWithHash) {
      sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
      return;
    }

    const isMatch = await bcrypt.compare(validated.password, userWithHash.password_hash);
    if (!isMatch) {
      sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
      return;
    }

    const { password_hash, ...safeUser } = userWithHash;
    const token = jwt.sign({ userId: safeUser.id }, env.JWT_SECRET, { expiresIn: '7d' });
    setAuthCookie(res, token);

    sendSuccess<AuthResponseData>(
      res,
      { user: safeUser },
      { token },
      200
    );
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/logout
authRouter.post('/logout', (_req: Request, res: Response): void => {
  clearAuthCookie(res);
  sendSuccess(res, { message: 'Logged out successfully' }, {}, 200);
});
