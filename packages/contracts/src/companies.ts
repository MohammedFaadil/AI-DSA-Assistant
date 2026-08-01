import { z } from 'zod';
import { DifficultySchema } from './common.js';

/* ────────────────────────────────────────────────────────────────────────────
 * Company interview prep.
 *
 * Content-integrity rule: every profile field is general, widely-known
 * industry framing only — never a specific fabricated claim (a date, a
 * quote, "this was asked at X"). Prep questions are sourced entirely from
 * the existing ProblemCompany tags and always labelled "commonly practiced
 * for prep", never "asked at" — the same honest framing every practice
 * platform uses for approximate, community-style company tags.
 * ──────────────────────────────────────────────────────────────────────────*/

export const CompanyListItemSchema = z.object({
  slug: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  problemCount: z.number().int(),
  hasProfile: z.boolean(),
});
export type CompanyListItem = z.infer<typeof CompanyListItemSchema>;

export const CompanyPrepQuestionSchema = z.object({
  problemSlug: z.string(),
  problemTitle: z.string(),
  difficulty: DifficultySchema,
  frequency: z.number().int(),
});
export type CompanyPrepQuestion = z.infer<typeof CompanyPrepQuestionSchema>;

export const CompanyProfileDtoSchema = z.object({
  slug: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  overview: z.string().nullable(),
  interviewProcess: z.string().nullable(),
  focusAreas: z.array(z.string()),
  prepTips: z.string().nullable(),
  questions: z.array(CompanyPrepQuestionSchema),
  isSaved: z.boolean(),
});
export type CompanyProfileDto = z.infer<typeof CompanyProfileDtoSchema>;
