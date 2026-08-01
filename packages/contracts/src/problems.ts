import { z } from 'zod';
import { DifficultySchema, LanguageSchema, SlugSchema, VerdictSchema } from './common.js';
import { CurriculumTrackSchema } from './quality.js';

export const ProblemUserStatusSchema = z.enum(['SOLVED', 'ATTEMPTED', 'TODO']);
export type ProblemUserStatus = z.infer<typeof ProblemUserStatusSchema>;

export const ProblemListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  difficulty: z
    .union([DifficultySchema, z.array(DifficultySchema)])
    .optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v])),
  topics: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v])),
  companies: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v])),
  status: ProblemUserStatusSchema.optional(),
  sectionSlug: z.string().optional(),
  search: z.string().max(120).optional(),
  sort: z
    .enum(['default', 'difficulty', 'acceptance', 'frequency', 'newest'])
    .default('default'),
  order: z.enum(['asc', 'desc']).default('asc'),
});
export type ProblemListQuery = z.infer<typeof ProblemListQuerySchema>;

export const TopicRefSchema = z.object({
  slug: z.string(),
  name: z.string(),
});

export const CompanyRefSchema = z.object({
  slug: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  frequency: z.number().int().optional(),
});

export const ProblemSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  difficulty: DifficultySchema,
  acceptanceRate: z.number(),
  totalSubmissions: z.number().int(),
  isPremium: z.boolean(),
  topics: z.array(TopicRefSchema),
  userStatus: ProblemUserStatusSchema.nullable(),
});
export type ProblemSummary = z.infer<typeof ProblemSummarySchema>;

export const ProblemExampleSchema = z.object({
  order: z.number().int(),
  input: z.string(),
  output: z.string(),
  explanation: z.string().nullable(),
  imageUrl: z.string().nullable(),
});

export const SampleTestSchema = z.object({
  id: z.string(),
  index: z.number().int(),
  input: z.string(),
  expectedOutput: z.string(),
});

export const ProblemDetailSchema = ProblemSummarySchema.extend({
  statement: z.string(),
  constraints: z.string(),
  expectedTimeComplexity: z.string(),
  expectedSpaceComplexity: z.string(),
  timeLimitMs: z.number().int(),
  memoryLimitKb: z.number().int(),
  companies: z.array(CompanyRefSchema),
  examples: z.array(ProblemExampleSchema),
  sampleTests: z.array(SampleTestSchema),
  hintCount: z.number().int(),
  hasEditorial: z.boolean(),
  languages: z.array(LanguageSchema),
  likeCount: z.number().int(),
  dislikeCount: z.number().int(),
  isBookmarked: z.boolean(),
});
export type ProblemDetail = z.infer<typeof ProblemDetailSchema>;

/** Hint metadata only. Content is never included until the level is unlocked. */
export const HintMetaSchema = z.object({
  level: z.number().int().min(1).max(3),
  unlocked: z.boolean(),
  content: z.string().nullable(),
});
export type HintMeta = z.infer<typeof HintMetaSchema>;

export const HintsResponseSchema = z.object({
  hints: z.array(HintMetaSchema),
  nextLevel: z.number().int().nullable(),
});

export const EditorialSchema = z.object({
  approachSummary: z.string(),
  content: z.string(),
  timeComplexity: z.string(),
  spaceComplexity: z.string(),
  videoUrl: z.string().nullable(),
});

export const StarterCodeSchema = z.object({
  language: LanguageSchema,
  code: z.string(),
});

export const ProblemSlugParamSchema = z.object({ slug: SlugSchema });

export const ProblemStatsSchema = z.object({
  totalSubmissions: z.number().int(),
  totalAccepted: z.number().int(),
  acceptanceRate: z.number(),
  verdictBreakdown: z.record(VerdictSchema, z.number().int()),
});

/* ── Grouped-by-curriculum-section view ───────────────────────────────────
 * Mirrors the Curriculum page's section ordering exactly, so the two pages
 * stay structurally in sync — there is no separate "linked content" record
 * to fall out of date, both just read CurriculumSection/CurriculumItem. */

export const ProblemSectionGroupSchema = z.object({
  sectionSlug: z.string(),
  sectionTitle: z.string(),
  track: CurriculumTrackSchema,
  order: z.number().int(),
  problems: z.array(ProblemSummarySchema),
});
export type ProblemSectionGroup = z.infer<typeof ProblemSectionGroupSchema>;

export const ProblemsGroupedSchema = z.object({
  sections: z.array(ProblemSectionGroupSchema),
  /** Any published, non-generated problem not yet attached to a curriculum
   * section — empty today (100% coverage), kept so future catalogue
   * additions never silently vanish from the Problems page. */
  unassigned: z.array(ProblemSummarySchema),
});
export type ProblemsGrouped = z.infer<typeof ProblemsGroupedSchema>;
