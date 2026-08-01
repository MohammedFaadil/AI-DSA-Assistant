import { Router } from 'express';
import { optionalAuth } from '../../middleware/authenticate.js';
import { LIMITS, rateLimit } from '../../middleware/rateLimit.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as companies from './companies.service.js';

export const companiesRouter = Router();

companiesRouter.get(
  '/',
  rateLimit(LIMITS.read),
  asyncHandler(async (_req, res) => {
    res.json({ items: await companies.listCompanies() });
  }),
);

companiesRouter.get(
  '/:slug',
  optionalAuth,
  rateLimit(LIMITS.read),
  asyncHandler(async (req, res) => {
    res.json(await companies.getCompanyProfile(req.params.slug!, req.auth?.userId));
  }),
);
