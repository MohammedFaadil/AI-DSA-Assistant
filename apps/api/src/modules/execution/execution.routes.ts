import { Router } from 'express';
import { CreateExecutionSchema } from '@repo/contracts';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { LIMITS, peek, rateLimit } from '../../middleware/rateLimit.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { LANGUAGE_INFO, executionRouter } from '../../providers/execution/index.js';
import * as execution from './execution.service.js';

export const executionRouter_ = Router();

executionRouter_.post(
  '/',
  authenticate,
  rateLimit(LIMITS.executionBurst),
  rateLimit(LIMITS.execution),
  validate(CreateExecutionSchema),
  asyncHandler(async (req, res) => {
    const started = await execution.startExecution(req.auth!.userId, req.body);
    // 202: the judge runs in the background and streams over the socket.
    res.status(202).json({ ...started, status: 'QUEUED' });
  }),
);

executionRouter_.get(
  '/quota',
  authenticate,
  asyncHandler(async (req, res) => {
    const state = peek(LIMITS.execution, req.auth!.userId);
    const health = await executionRouter.health();
    res.json({
      remaining: state.remaining,
      limit: LIMITS.execution.limit,
      resetAt: new Date(state.resetAt).toISOString(),
      provider: executionRouter.primaryName,
      degraded: health.every((h) => !h.healthy),
    });
  }),
);

executionRouter_.get('/languages', (_req, res) => {
  res.json({
    items: execution.supportedLanguages().map((language) => ({
      language,
      label: LANGUAGE_INFO[language].label,
      version: LANGUAGE_INFO[language].version,
      monacoId: LANGUAGE_INFO[language].monacoId,
      fileExtension: LANGUAGE_INFO[language].ext,
    })),
  });
});

executionRouter_.get(
  '/:id',
  authenticate,
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json(await execution.getExecution(req.auth!.userId, req.params.id!));
  }),
);
