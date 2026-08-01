import { Router } from 'express';
import { z } from 'zod';
import { LibraryQuerySchema, SaveSolutionSchema } from '@repo/contracts';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { LIMITS, rateLimit } from '../../middleware/rateLimit.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as library from './library.service.js';

export const libraryRouter = Router();

libraryRouter.use(authenticate);

libraryRouter.get(
  '/',
  rateLimit(LIMITS.read),
  validate(LibraryQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    res.json(await library.listLibrary(req.auth!.userId, req.query as never));
  }),
);

libraryRouter.post(
  '/',
  rateLimit(LIMITS.write),
  validate(SaveSolutionSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await library.saveSolution(req.auth!.userId, req.body));
  }),
);

/* ── Saved curriculum sections & companies — registered before the generic
 * /:problemId routes below so "sections"/"companies" are never matched as a
 * problem id. ────────────────────────────────────────────────────────── */

libraryRouter.get(
  '/sections',
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json({ items: await library.listSavedSections(req.auth!.userId) });
  }),
);

libraryRouter.post(
  '/sections/:sectionSlug',
  rateLimit(LIMITS.write),
  asyncHandler(async (req, res) => {
    res.status(201).json(await library.saveSection(req.auth!.userId, req.params.sectionSlug!));
  }),
);

libraryRouter.delete(
  '/sections/:sectionSlug',
  rateLimit(LIMITS.write),
  asyncHandler(async (req, res) => {
    await library.removeSavedSection(req.auth!.userId, req.params.sectionSlug!);
    res.status(204).end();
  }),
);

libraryRouter.get(
  '/companies',
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json({ items: await library.listSavedCompanies(req.auth!.userId) });
  }),
);

libraryRouter.post(
  '/companies/:companySlug',
  rateLimit(LIMITS.write),
  asyncHandler(async (req, res) => {
    res.status(201).json(await library.saveCompany(req.auth!.userId, req.params.companySlug!));
  }),
);

libraryRouter.delete(
  '/companies/:companySlug',
  rateLimit(LIMITS.write),
  asyncHandler(async (req, res) => {
    await library.removeSavedCompany(req.auth!.userId, req.params.companySlug!);
    res.status(204).end();
  }),
);

libraryRouter.get(
  '/:problemId',
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json(await library.getEntry(req.auth!.userId, req.params.problemId!));
  }),
);

libraryRouter.patch(
  '/:problemId',
  rateLimit(LIMITS.write),
  validate(
    z.object({
      note: z.string().max(4000).optional(),
      tags: z.array(z.string().max(30)).max(8).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    res.json(await library.updateEntry(req.auth!.userId, req.params.problemId!, req.body));
  }),
);

libraryRouter.delete(
  '/:problemId',
  rateLimit(LIMITS.write),
  asyncHandler(async (req, res) => {
    await library.removeEntry(req.auth!.userId, req.params.problemId!);
    res.status(204).end();
  }),
);

/* ── Bookmarks and notes live alongside the library ───────────────────────*/

export const bookmarksRouter = Router();
bookmarksRouter.use(authenticate);

bookmarksRouter.get(
  '/',
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json({ items: await library.listBookmarks(req.auth!.userId) });
  }),
);

bookmarksRouter.post(
  '/:problemId/toggle',
  rateLimit(LIMITS.write),
  asyncHandler(async (req, res) => {
    res.json(await library.toggleBookmark(req.auth!.userId, req.params.problemId!));
  }),
);

export const notesRouter = Router();
notesRouter.use(authenticate);

notesRouter.get(
  '/:problemId',
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json(await library.getNote(req.auth!.userId, req.params.problemId!));
  }),
);

notesRouter.put(
  '/:problemId',
  rateLimit(LIMITS.write),
  validate(z.object({ content: z.string().max(20_000) })),
  asyncHandler(async (req, res) => {
    res.json(
      await library.upsertNote(req.auth!.userId, req.params.problemId!, req.body.content),
    );
  }),
);
