import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { calculateNextAction } from '../services/priorityEngine.js';
import { sendSuccess } from '../utils/response.js';
import { NextActionResponse } from '@studyflow/shared/types.js';

export const tasksRouter = Router();
tasksRouter.use(authMiddleware);

// GET /api/v1/tasks/next-action
tasksRouter.get('/next-action', (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const userId = req.user!.id;
    const nextAction = calculateNextAction(userId);
    sendSuccess<NextActionResponse>(res, nextAction);
  } catch (error) {
    next(error);
  }
});
