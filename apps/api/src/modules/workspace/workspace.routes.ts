import { Router } from 'express';
import {
  CreateSessionSchema,
  DraftQuerySchema,
  SaveDraftSchema,
  UpdateSessionSchema,
} from '@repo/contracts';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { LIMITS, rateLimit } from '../../middleware/rateLimit.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as workspace from './workspace.service.js';

export const workspaceRouter = Router();

workspaceRouter.use(authenticate);

workspaceRouter.post(
  '/sessions',
  rateLimit(LIMITS.write),
  validate(CreateSessionSchema),
  asyncHandler(async (req, res) => {
    const { problemId, language, assistMode } = req.body;
    res.status(201).json(
      await workspace.openSession(req.auth!.userId, problemId, language, assistMode),
    );
  }),
);

workspaceRouter.patch(
  '/sessions/:id',
  rateLimit(LIMITS.write),
  validate(UpdateSessionSchema),
  asyncHandler(async (req, res) => {
    await workspace.updateSession(req.auth!.userId, req.params.id!, req.body);
    res.status(204).end();
  }),
);

workspaceRouter.post(
  '/sessions/:id/end',
  asyncHandler(async (req, res) => {
    await workspace.endSession(req.auth!.userId, req.params.id!);
    res.status(204).end();
  }),
);

workspaceRouter.get(
  '/drafts',
  rateLimit(LIMITS.read),
  validate(DraftQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { problemId, language } = req.query as unknown as {
      problemId: string;
      language: never;
    };
    res.json(await workspace.getDraft(req.auth!.userId, problemId, language));
  }),
);

workspaceRouter.put(
  '/drafts',
  rateLimit(LIMITS.write),
  validate(SaveDraftSchema),
  asyncHandler(async (req, res) => {
    res.json(await workspace.saveDraft(req.auth!.userId, req.body));
  }),
);
