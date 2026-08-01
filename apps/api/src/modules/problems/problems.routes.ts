import { Router } from 'express';
import { z } from 'zod';
import { LanguageSchema, ProblemListQuerySchema } from '@repo/contracts';
import { validate } from '../../middleware/validate.js';
import { authenticate, optionalAuth } from '../../middleware/authenticate.js';
import { LIMITS, rateLimit } from '../../middleware/rateLimit.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as problems from './problems.service.js';

export const problemsRouter = Router();

problemsRouter.get(
  '/',
  optionalAuth,
  rateLimit(LIMITS.read),
  validate(ProblemListQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    res.json(await problems.listProblems(req.query as never, req.auth?.userId));
  }),
);

problemsRouter.get(
  '/meta/facets',
  rateLimit(LIMITS.read),
  asyncHandler(async (_req, res) => {
    res.json(await problems.getFacets());
  }),
);

problemsRouter.get(
  '/grouped',
  optionalAuth,
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json(await problems.listProblemsGroupedBySection(req.auth?.userId));
  }),
);

problemsRouter.get(
  '/daily',
  optionalAuth,
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json(await problems.getDailyProblem(req.auth?.userId));
  }),
);

problemsRouter.get(
  '/recommended',
  authenticate,
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json({ items: await problems.getRecommended(req.auth!.userId) });
  }),
);

problemsRouter.get(
  '/:slug',
  optionalAuth,
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json(await problems.getProblemBySlug(req.params.slug!, req.auth?.userId));
  }),
);

problemsRouter.get(
  '/:slug/starter-code',
  rateLimit(LIMITS.read),
  validate(z.object({ language: LanguageSchema }), 'query'),
  asyncHandler(async (req, res) => {
    const language = (req.query as { language: never }).language;
    res.json({ language, code: await problems.getStarterCode(req.params.slug!, language) });
  }),
);

problemsRouter.get(
  '/:slug/hints',
  optionalAuth,
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json(await problems.getHints(req.params.slug!, req.auth?.userId));
  }),
);

problemsRouter.post(
  '/:slug/hints/:level/unlock',
  authenticate,
  rateLimit(LIMITS.write),
  asyncHandler(async (req, res) => {
    const level = Number(req.params.level);
    res.json(await problems.unlockHint(req.params.slug!, level, req.auth!.userId));
  }),
);

problemsRouter.get(
  '/:slug/editorial',
  optionalAuth,
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json(await problems.getEditorial(req.params.slug!, req.auth?.userId));
  }),
);
