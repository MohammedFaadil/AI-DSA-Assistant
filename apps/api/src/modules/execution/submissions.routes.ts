import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { LIMITS, rateLimit } from '../../middleware/rateLimit.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as execution from './execution.service.js';

export const submissionsRouter = Router();

submissionsRouter.use(authenticate);

submissionsRouter.get(
  '/',
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    const problemId = typeof req.query.problemId === 'string' ? req.query.problemId : undefined;
    const limit = Math.min(50, Number(req.query.limit) || 20);
    res.json({ items: await execution.listSubmissions(req.auth!.userId, problemId, limit) });
  }),
);

submissionsRouter.get(
  '/:id',
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json(await execution.getExecution(req.auth!.userId, req.params.id!));
  }),
);
