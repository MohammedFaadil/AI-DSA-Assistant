import { Router } from 'express';
import { z } from 'zod';
import { ChatSendSchema, FeedbackSchema, HintRequestSchema, LanguageSchema } from '@repo/contracts';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { LIMITS, rateLimit } from '../../middleware/rateLimit.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { aiService } from '../../providers/ai/aiService.client.js';
import * as ai from './ai.service.js';

export const aiRouter = Router();

aiRouter.use(authenticate);

aiRouter.post(
  '/chat',
  rateLimit(LIMITS.aiChat),
  validate(ChatSendSchema),
  asyncHandler(async (req, res) => {
    const result = await ai.runMentorTurn({
      userId: req.auth!.userId,
      problemId: req.body.problemId,
      sessionId: req.body.sessionId ?? null,
      language: req.body.language,
      code: req.body.code,
      cursor: req.body.cursor ?? null,
      selection: req.body.selection ?? null,
      userMessage: req.body.content,
      trigger: 'EXPLICIT_ASK',
    });
    res.json(result);
  }),
);

aiRouter.post(
  '/hint',
  rateLimit(LIMITS.aiChat),
  validate(HintRequestSchema),
  asyncHandler(async (req, res) => {
    const result = await ai.runMentorTurn({
      userId: req.auth!.userId,
      problemId: req.body.problemId,
      sessionId: req.body.sessionId ?? null,
      language: req.body.language,
      code: req.body.code,
      trigger: 'EXPLICIT_ASK',
      hintLevel: req.body.level ?? null,
      userMessage: null,
    });
    res.json(result);
  }),
);

aiRouter.post(
  '/explain',
  rateLimit(LIMITS.aiInline),
  validate(
    ChatSendSchema.extend({
      selection: z.string().min(1).max(4000),
    }),
  ),
  asyncHandler(async (req, res) => {
    const result = await ai.runMentorTurn({
      userId: req.auth!.userId,
      problemId: req.body.problemId,
      sessionId: req.body.sessionId ?? null,
      language: req.body.language,
      code: req.body.code,
      selection: req.body.selection,
      userMessage: req.body.content,
      trigger: 'EXPLICIT_ASK',
    });
    res.json(result);
  }),
);

aiRouter.post(
  '/complete',
  rateLimit(LIMITS.aiInline),
  validate(
    z.object({
      language: LanguageSchema,
      prefix: z.string().max(8000),
      suffix: z.string().max(4000),
      problemTitle: z.string().max(200),
    }),
  ),
  asyncHandler(async (req, res) => {
    // Ghost text is best-effort by design: a failure here must never surface
    // as an error in the editor, only as "no suggestion".
    try {
      const out = await aiService.complete(
        { requestId: req.requestId, maxTokens: 48, ...req.body },
        { requestId: req.requestId },
      );
      res.json(out);
    } catch {
      res.json({ requestId: req.requestId, text: '', cacheHit: false, model: null });
    }
  }),
);

aiRouter.get(
  '/conversations/:problemId',
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json(await ai.getConversation(req.auth!.userId, req.params.problemId!));
  }),
);

aiRouter.post(
  '/messages/:id/feedback',
  rateLimit(LIMITS.write),
  validate(FeedbackSchema),
  asyncHandler(async (req, res) => {
    await ai.recordFeedback(req.auth!.userId, req.params.id!, req.body.helpful, req.body.reason);
    res.status(204).end();
  }),
);

aiRouter.get(
  '/quota',
  asyncHandler(async (req, res) => {
    res.json(await ai.getQuota(req.auth!.userId));
  }),
);
