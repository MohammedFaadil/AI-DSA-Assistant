import { z } from 'zod';
import {
  CodeSchema,
  CuidSchema,
  ExecutionModeSchema,
  ExecutionStatusSchema,
  LanguageSchema,
  VerdictSchema,
} from './common.js';

export const CreateExecutionSchema = z.object({
  problemId: CuidSchema,
  sessionId: CuidSchema.optional(),
  language: LanguageSchema,
  code: CodeSchema,
  mode: ExecutionModeSchema.default('RUN'),
  stdin: z.string().max(16 * 1024).optional(),
});
export type CreateExecutionInput = z.infer<typeof CreateExecutionSchema>;

export const CreateExecutionResponseSchema = z.object({
  executionId: z.string(),
  status: ExecutionStatusSchema,
  totalTests: z.number().int(),
  estimatedMs: z.number().int(),
});

/**
 * Per-test result as returned to a client.
 *
 * `input` / `expectedOutput` / `stdout` are ALWAYS null for hidden tests —
 * the redaction happens in the serializer so no future endpoint can leak them
 * by forgetting to strip. `hidden: true` tells the UI to render a lock.
 */
export const TestResultSchema = z.object({
  order: z.number().int(),
  hidden: z.boolean(),
  verdict: VerdictSchema,
  runtimeMs: z.number().int().nullable(),
  memoryKb: z.number().int().nullable(),
  input: z.string().nullable(),
  expectedOutput: z.string().nullable(),
  stdout: z.string().nullable(),
  stderr: z.string().nullable(),
});
export type TestResult = z.infer<typeof TestResultSchema>;

export const ExecutionResultSchema = z.object({
  executionId: z.string(),
  problemId: z.string(),
  mode: ExecutionModeSchema,
  language: LanguageSchema,
  status: ExecutionStatusSchema,
  verdict: VerdictSchema,
  passedTests: z.number().int(),
  totalTests: z.number().int(),
  runtimeMs: z.number().int().nullable(),
  memoryKb: z.number().int().nullable(),
  compileOutput: z.string().nullable(),
  errorMessage: z.string().nullable(),
  inferredComplexity: z.string().nullable(),
  results: z.array(TestResultSchema),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});
export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;

export const ExecutionQuotaSchema = z.object({
  remaining: z.number().int(),
  limit: z.number().int(),
  resetAt: z.string(),
  provider: z.string(),
  degraded: z.boolean(),
});
export type ExecutionQuota = z.infer<typeof ExecutionQuotaSchema>;

export const LanguageInfoSchema = z.object({
  language: LanguageSchema,
  label: z.string(),
  version: z.string(),
  monacoId: z.string(),
  fileExtension: z.string(),
});
export type LanguageInfo = z.infer<typeof LanguageInfoSchema>;

/* ── Workspace drafts ──────────────────────────────────────────────────────*/

export const DraftQuerySchema = z.object({
  problemId: CuidSchema,
  language: LanguageSchema,
});

export const SaveDraftSchema = z.object({
  problemId: CuidSchema,
  language: LanguageSchema,
  code: CodeSchema,
  revision: z.number().int().min(0),
});
export type SaveDraftInput = z.infer<typeof SaveDraftSchema>;

export const DraftSchema = z.object({
  problemId: z.string(),
  language: LanguageSchema,
  code: z.string(),
  revision: z.number().int(),
  updatedAt: z.string(),
});
export type Draft = z.infer<typeof DraftSchema>;

/* ── Workspace sessions ───────────────────────────────────────────────────*/

export const CreateSessionSchema = z.object({
  problemId: CuidSchema,
  language: LanguageSchema,
  assistMode: z.enum(['EASY', 'MODERATE', 'HIGH']).default('MODERATE'),
});

export const UpdateSessionSchema = z.object({
  language: LanguageSchema.optional(),
  assistMode: z.enum(['EASY', 'MODERATE', 'HIGH']).optional(),
});

export const WorkspaceSessionSchema = z.object({
  id: z.string(),
  problemId: z.string(),
  language: LanguageSchema,
  assistMode: z.enum(['EASY', 'MODERATE', 'HIGH']),
  startedAt: z.string(),
});
export type WorkspaceSessionDto = z.infer<typeof WorkspaceSessionSchema>;
