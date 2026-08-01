import { Router } from 'express';
import { LeaderboardQuerySchema } from '@repo/contracts';
import { authenticate, optionalAuth } from '../../middleware/authenticate.js';
import { LIMITS, rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as progress from './progress.service.js';

export const progressRouter = Router();

progressRouter.get(
  '/overview',
  authenticate,
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json(await progress.getOverview(req.auth!.userId));
  }),
);

progressRouter.get(
  '/heatmap',
  authenticate,
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    const year = Number(req.query.year) || new Date().getUTCFullYear();
    res.json(await progress.getHeatmap(req.auth!.userId, year));
  }),
);

progressRouter.get(
  '/topics',
  authenticate,
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json({ items: await progress.getTopicMastery(req.auth!.userId) });
  }),
);

progressRouter.get(
  '/weak-topics',
  authenticate,
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    const all = await progress.getTopicMastery(req.auth!.userId);
    res.json({ items: all.filter((t) => t.mastery < 0.6).slice(0, 8) });
  }),
);

export const achievementsRouter = Router();

achievementsRouter.get(
  '/',
  authenticate,
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json({ items: await progress.getAchievements(req.auth!.userId) });
  }),
);

export const leaderboardRouter = Router();

leaderboardRouter.get(
  '/',
  optionalAuth,
  rateLimit(LIMITS.read),
  validate(LeaderboardQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    res.json(await progress.getLeaderboard(page, pageSize, req.auth?.userId));
  }),
);
