import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { getDb } from './config/db.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { modulesRouter } from './routes/modules.js';
import { calendarRouter } from './routes/calendar.js';
import { assignmentsRouter } from './routes/assignments.js';
import { subtasksRouter } from './routes/subtasks.js';
import { tasksRouter } from './routes/tasks.js';
import { scheduleRouter } from './routes/schedule.js';
import { billingRouter } from './routes/billing.js';
import { analyticsRouter } from './routes/analytics.js';
import { errorHandler } from './middleware/errorHandler.js';
import { sendSuccess, sendError } from './utils/response.js';

export const app = express();

// Initialize DB on boot
getDb();

// Middlewares
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Base health check
app.get('/api/v1/health', (_req, res) => {
  sendSuccess(res, { status: 'healthy', timestamp: new Date().toISOString() });
});

// Mount Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/modules', modulesRouter);
app.use('/api/v1/calendar', calendarRouter);
app.use('/api/v1/assignments', assignmentsRouter);
app.use('/api/v1/subtasks', subtasksRouter);
app.use('/api/v1/tasks', tasksRouter);
app.use('/api/v1/schedule', scheduleRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/analytics', analyticsRouter);

// 404 Catch-All
app.use((_req, res) => {
  sendError(res, 'NOT_FOUND', 'Route not found', 404);
});

// Global Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(env.PORT, () => {
    console.log(`StudyFlow server running on http://localhost:${env.PORT}`);
  });
}
