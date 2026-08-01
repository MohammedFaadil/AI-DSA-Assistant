import { Router } from 'express';
import { z } from 'zod';
import { PracticeGenerateSchema } from '@repo/contracts';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { LIMITS, rateLimit, type RateLimitClass } from '../../middleware/rateLimit.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as practice from './practice.service.js';

/**
 * Generation is by far the most expensive operation in the platform: a reasoning
 * model writing a full problem, then N executions to derive expected outputs.
 * It gets its own tight budget rather than sharing the chat allowance.
 */
const GENERATE_LIMIT: RateLimitClass = {
  name: 'practice-generate',
  limit: 12,
  windowSec: 3600,
  scope: 'user',
  durable: true,
  code: 'AI_QUOTA_EXCEEDED',
};

export const practiceRouter = Router();

practiceRouter.use(authenticate);

practiceRouter.post(
  '/generate',
  rateLimit(GENERATE_LIMIT),
  validate(PracticeGenerateSchema),
  asyncHandler(async (req, res) => {
    const result = await practice.generateProblem(
      req.auth!.userId,
      req.body.prompt,
      req.body.difficulty,
    );
    res.status(201).json(result);
  }),
);

practiceRouter.get(
  '/',
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json({ items: await practice.listGenerated(req.auth!.userId) });
  }),
);

practiceRouter.delete(
  '/:problemId',
  rateLimit(LIMITS.write),
  validate(z.object({ problemId: z.string().min(1) }), 'params'),
  asyncHandler(async (req, res) => {
    await practice.deleteGenerated(req.auth!.userId, req.params.problemId!);
    res.status(204).end();
  }),
);
