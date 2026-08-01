import { z } from 'zod';
import {
  CodeSchema,
  CuidSchema,
  DifficultySchema,
  LanguageSchema,
  VerdictSchema,
} from './common.js';

/* ────────────────────────────────────────────────────────────────────────────
 * Code strength
 *
 * Produced by the deterministic quality engine on every 2-second tick, so it
 * costs nothing and can drive a live meter. `measurable: false` means the buffer
 * is empty or still the starter stub — the UI shows a neutral meter rather than
 * a red one, which would read as failure before the learner has started.
 * ──────────────────────────────────────────────────────────────────────────*/

export const QualityDimensionSchema = z.object({
  key: z.enum(['correctness', 'efficiency', 'readability', 'robustness', 'structure']),
  label: z.string(),
  score: z.number().int().min(0).max(100),
  weight: z.number(),
  notes: z.array(z.string()),
});
export type QualityDimension = z.infer<typeof QualityDimensionSchema>;

export const QualityReportSchema = z.object({
  overall: z.number().int().min(0).max(100),
  measurable: z.boolean(),
  grade: z.string(),
  headline: z.string(),
  dimensions: z.array(QualityDimensionSchema),
  topFix: z.string().nullable(),
  /** Delta vs. the last few ticks in this session — null until enough history
   * has accumulated. Lets the UI show a rising/falling indicator, not just a
   * static number. */
  trend: z.number().nullable().default(null),
});
export type QualityReport = z.infer<typeof QualityReportSchema>;

/* ── Line-by-line review ──────────────────────────────────────────────────*/

export const LineRoleSchema = z.enum(['GOOD', 'NEUTRAL', 'IMPROVE', 'RISK']);
export type LineRole = z.infer<typeof LineRoleSchema>;

export const LineNoteSchema = z.object({
  line: z.number().int().min(0),
  role: LineRoleSchema,
  what: z.string(),
  why: z.string().nullable(),
  fix: z.string().nullable(),
});
export type LineNote = z.infer<typeof LineNoteSchema>;

export const LineReviewSchema = z.object({
  notes: z.array(LineNoteSchema),
  annotatedLines: z.number().int(),
  improvableLines: z.number().int(),
  summary: z.string(),
});
export type LineReview = z.infer<typeof LineReviewSchema>;

export const LineReviewRequestSchema = z.object({
  problemId: CuidSchema,
  language: LanguageSchema,
  code: CodeSchema,
});

/* ── Practice Zone ────────────────────────────────────────────────────────*/

export const PracticeGenerateSchema = z.object({
  prompt: z.string().min(8, 'Describe what you want to practise in a few words').max(600),
  difficulty: DifficultySchema.optional(),
});
export type PracticeGenerateInput = z.infer<typeof PracticeGenerateSchema>;

export const PracticeResultSchema = z.object({
  problemId: z.string(),
  slug: z.string(),
  title: z.string(),
  difficulty: DifficultySchema,
  topics: z.array(z.string()),
  source: z.enum(['model', 'template']),
  testCount: z.number().int(),
  /** True when the reference solution passed every derived test — it always
   * should, and a false here means the generated problem was rejected. */
  verified: z.boolean(),
});
export type PracticeResult = z.infer<typeof PracticeResultSchema>;

export const GeneratedProblemSummarySchema = z.object({
  problemId: z.string(),
  slug: z.string(),
  title: z.string(),
  difficulty: DifficultySchema,
  topics: z.array(z.string()),
  prompt: z.string().nullable(),
  source: z.string().nullable(),
  solved: z.boolean(),
  createdAt: z.string(),
});
export type GeneratedProblemSummary = z.infer<typeof GeneratedProblemSummarySchema>;

/* ── Library ──────────────────────────────────────────────────────────────*/

export const SaveSolutionSchema = z.object({
  problemId: CuidSchema,
  language: LanguageSchema,
  code: CodeSchema,
  note: z.string().max(4000).optional(),
  tags: z.array(z.string().max(30)).max(8).optional(),
  submissionId: CuidSchema.optional(),
});
export type SaveSolutionInput = z.infer<typeof SaveSolutionSchema>;

export const LibraryEntrySchema = z.object({
  id: z.string(),
  problemId: z.string(),
  problemSlug: z.string(),
  problemTitle: z.string(),
  difficulty: DifficultySchema,
  topics: z.array(z.string()),
  language: LanguageSchema,
  code: z.string(),
  verdict: VerdictSchema.nullable(),
  runtimeMs: z.number().int().nullable(),
  qualityScore: z.number().int().nullable(),
  complexity: z.string().nullable(),
  note: z.string().nullable(),
  tags: z.array(z.string()),
  revision: z.number().int(),
  isGenerated: z.boolean(),
  updatedAt: z.string(),
});
export type LibraryEntry = z.infer<typeof LibraryEntrySchema>;

export const LibraryQuerySchema = z.object({
  search: z.string().max(120).optional(),
  difficulty: DifficultySchema.optional(),
  tag: z.string().max(30).optional(),
  sort: z.enum(['recent', 'quality', 'title']).default('recent'),
});

/* ── Curriculum ───────────────────────────────────────────────────────────
 *
 * The curriculum is concept-first: a section IS a concept (a lesson, key
 * patterns, a common pitfall, typical complexity), with attached problems as
 * practice rather than the primary content. Two independent tracks —
 * Foundations and Advanced — order the same problem catalogue differently
 * for a beginner-first pass vs. an interview-style deep pass.
 * ──────────────────────────────────────────────────────────────────────────*/

export const CurriculumTrackSchema = z.enum(['FOUNDATIONS', 'ADVANCED']);
export type CurriculumTrack = z.infer<typeof CurriculumTrackSchema>;

/** A saved curriculum section always joins the live section — never a
 * snapshot — so the library entry stays in sync automatically. */
export const SavedCurriculumSectionDtoSchema = z.object({
  id: z.string(),
  sectionSlug: z.string(),
  sectionTitle: z.string(),
  track: CurriculumTrackSchema,
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type SavedCurriculumSectionDto = z.infer<typeof SavedCurriculumSectionDtoSchema>;

export const SavedCompanyProfileDtoSchema = z.object({
  id: z.string(),
  companySlug: z.string(),
  companyName: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type SavedCompanyProfileDto = z.infer<typeof SavedCompanyProfileDtoSchema>;

/** Textbook-depth content, additive to `lesson` — an ordered, named block per
 * teaching beat (intro, intuition, a worked example, a pitfall...) so the
 * frontend can render a navigable table of contents instead of one wall of
 * text. */
export const CurriculumBlockKindSchema = z.enum([
  'INTRO',
  'INTUITION',
  'WALKTHROUGH',
  'EXAMPLE',
  'PITFALL',
  'COMPLEXITY',
  'SUMMARY',
]);
export type CurriculumBlockKind = z.infer<typeof CurriculumBlockKindSchema>;

export const CurriculumBlockSchema = z.object({
  kind: CurriculumBlockKindSchema,
  heading: z.string(),
  body: z.string(),
  order: z.number().int(),
});
export type CurriculumBlock = z.infer<typeof CurriculumBlockSchema>;

export const CurriculumProblemSchema = z.object({
  problemId: z.string(),
  slug: z.string(),
  title: z.string(),
  difficulty: DifficultySchema,
  isCore: z.boolean(),
  status: z.enum(['SOLVED', 'ATTEMPTED', 'TODO']),
});

export const CurriculumSectionSchema = z.object({
  track: CurriculumTrackSchema,
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  outcome: z.string(),
  icon: z.string().nullable(),
  order: z.number().int(),
  /** The concept lesson itself — markdown. This is the page's primary content. */
  lesson: z.string(),
  /** Textbook-depth content below the lesson overview, ordered. */
  blocks: z.array(CurriculumBlockSchema),
  keyPatterns: z.array(z.string()),
  commonPitfall: z.string().nullable(),
  typicalTime: z.string().nullable(),
  typicalSpace: z.string().nullable(),
  /** Total problems (core + depth) attached to this section, for the
   * reciprocal "see all N problems" link to the Problems page. */
  problemCount: z.number().int(),
  coreTotal: z.number().int(),
  coreSolved: z.number().int(),
  completion: z.number(),
  mastery: z.number(),
  /** Unlocked once the previous section IN THE SAME TRACK is 60% complete —
   * a syllabus is an ordering, and letting someone skip to graphs before
   * arrays is not help. */
  unlocked: z.boolean(),
  problems: z.array(CurriculumProblemSchema),
  nextUp: CurriculumProblemSchema.nullable(),
});
export type CurriculumSectionDto = z.infer<typeof CurriculumSectionSchema>;

export const ImprovementAreaSchema = z.object({
  kind: z.enum(['topic', 'quality', 'behaviour', 'misconception']),
  title: z.string(),
  detail: z.string(),
  action: z.string(),
  severity: z.enum(['high', 'medium', 'low']),
  metric: z.number().nullable(),
  problemSlug: z.string().nullable(),
});
export type ImprovementArea = z.infer<typeof ImprovementAreaSchema>;

/* ── AI performance tracker ───────────────────────────────────────────────*/

export const AiPerformanceSchema = z.object({
  window: z.object({ days: z.number().int(), from: z.string(), to: z.string() }),
  interactions: z.number().int(),
  byAgent: z.array(
    z.object({
      agent: z.string(),
      count: z.number().int(),
      helpfulRate: z.number().nullable(),
      avgLatencyMs: z.number().int().nullable(),
    }),
  ),
  byTrigger: z.array(z.object({ trigger: z.string(), count: z.number().int() })),
  hintsUnlocked: z.number().int(),
  hintDependency: z.number(),
  cacheHitRate: z.number(),
  fallbackRate: z.number(),
  guardRejections: z.number().int(),
  tokensToday: z.number().int(),
  tokenBudget: z.number().int(),
  /** Mean code-strength score, and how it has moved across the window. */
  avgQuality: z.number().nullable(),
  qualityTrend: z.number().nullable(),
  qualitySeries: z.array(z.object({ date: z.string(), score: z.number() })),
  /** True when no LLM provider is configured: the mentor is running on its
   * deterministic engine only, which the UI must say plainly. */
  deterministicOnly: z.boolean(),
});
export type AiPerformance = z.infer<typeof AiPerformanceSchema>;
