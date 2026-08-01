import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { LineReviewRequestSchema, TeachChatSendSchema } from '@repo/contracts';
import { prisma } from '@repo/db';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { LIMITS, rateLimit } from '../../middleware/rateLimit.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { notFound } from '../../lib/errors.js';
import { aiExtra } from '../../providers/ai/aiService.extra.js';
import * as curriculum from './curriculum.service.js';
import * as curriculumAi from './curriculumAi.service.js';
import { getAiPerformance } from '../ai/aiPerformance.service.js';

export const curriculumRouter = Router();

curriculumRouter.use(authenticate);

curriculumRouter.get(
  '/',
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json({ sections: await curriculum.getCurriculum(req.auth!.userId) });
  }),
);

curriculumRouter.get(
  '/improve',
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json({ areas: await curriculum.getImprovementAreas(req.auth!.userId) });
  }),
);

/* ── AI Training — a tutor thread scoped to one curriculum section ───────── */

curriculumRouter.post(
  '/:slug/chat',
  rateLimit(LIMITS.aiChat),
  validate(TeachChatSendSchema),
  asyncHandler(async (req, res) => {
    const result = await curriculumAi.runTeachingTurn(req.auth!.userId, req.params.slug!, req.body.content);
    res.json({ requestId: randomUUID(), message: result.message, readyForPractice: result.readyForPractice });
  }),
);

curriculumRouter.get(
  '/:slug/conversation',
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json(await curriculumAi.getTeachingConversation(req.auth!.userId, req.params.slug!));
  }),
);

curriculumRouter.post(
  '/:slug/handoff',
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json(await curriculumAi.handoffToPractice(req.auth!.userId, req.params.slug!));
  }),
);

/* ── AI performance tracker ───────────────────────────────────────────────*/

export const aiInsightsRouter = Router();
aiInsightsRouter.use(authenticate);

aiInsightsRouter.get(
  '/performance',
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
    res.json(await getAiPerformance(req.auth!.userId, days));
  }),
);

/**
 * Line-by-line review.
 *
 * Deterministic, so it is rate-limited as an ordinary read rather than against
 * the AI budget — toggling the mode on should never feel expensive.
 */
aiInsightsRouter.post(
  '/line-review',
  rateLimit(LIMITS.aiInline),
  validate(LineReviewRequestSchema),
  asyncHandler(async (req, res) => {
    const problem = await prisma.problem.findFirst({
      where: { id: req.body.problemId },
      select: { expectedTimeComplexity: true, isGenerated: true, generatedFor: true },
    });
    if (!problem || (problem.isGenerated && problem.generatedFor !== req.auth!.userId)) {
      throw notFound('That problem does not exist.', 'PROBLEM_NOT_FOUND');
    }

    const result = await aiExtra.lineReview({
      requestId: randomUUID(),
      language: req.body.language,
      code: req.body.code,
      expectedTime: problem.expectedTimeComplexity,
    });
    res.json(result.review);
  }),
);
