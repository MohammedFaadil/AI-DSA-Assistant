import { z } from 'zod';

/* ────────────────────────────────────────────────────────────────────────────
 * Domain enums — the single source of truth shared by web, api and (mirrored
 * as Pydantic) the AI service. These must stay in lockstep with schema.prisma;
 * the `contracts:check` CI job diffs them.
 * ──────────────────────────────────────────────────────────────────────────*/

export const RoleSchema = z.enum(['USER', 'MODERATOR', 'ADMIN']);
export type Role = z.infer<typeof RoleSchema>;

export const SkillLevelSchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']);
export type SkillLevel = z.infer<typeof SkillLevelSchema>;

export const DifficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD']);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const LanguageSchema = z.enum([
  'PYTHON',
  'C',
  'CPP',
  'JAVA',
  'CSHARP',
  'JAVASCRIPT',
  'TYPESCRIPT',
  'GO',
  'RUST',
  'PHP',
  'KOTLIN',
  'SWIFT',
]);
export type Language = z.infer<typeof LanguageSchema>;

export const AssistModeSchema = z.enum(['EASY', 'MODERATE', 'HIGH']);
export type AssistMode = z.infer<typeof AssistModeSchema>;

export const ExecutionModeSchema = z.enum(['RUN', 'SUBMIT']);
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;

export const ExecutionStatusSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export const VerdictSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'WRONG_ANSWER',
  'TIME_LIMIT_EXCEEDED',
  'MEMORY_LIMIT_EXCEEDED',
  'RUNTIME_ERROR',
  'COMPILATION_ERROR',
  'OUTPUT_LIMIT_EXCEEDED',
  'INTERNAL_ERROR',
]);
export type Verdict = z.infer<typeof VerdictSchema>;

export const FAILING_VERDICTS: Verdict[] = [
  'WRONG_ANSWER',
  'TIME_LIMIT_EXCEEDED',
  'MEMORY_LIMIT_EXCEEDED',
  'RUNTIME_ERROR',
  'COMPILATION_ERROR',
  'OUTPUT_LIMIT_EXCEEDED',
];

export const AgentTypeSchema = z.enum([
  'PLANNER',
  'TUTOR',
  'CODE_REVIEW',
  'HINT',
  'DEBUG',
  'COMPLEXITY',
  'PROGRESS',
  'SYSTEM',
  'FALLBACK',
]);
export type AgentType = z.infer<typeof AgentTypeSchema>;

export const MessageRoleSchema = z.enum(['USER', 'ASSISTANT', 'SYSTEM']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const TriggerTypeSchema = z.enum([
  'EXPLICIT_ASK',
  'IDLE_STUCK',
  'THRASHING',
  'COMPLEXITY_GAP',
  'REPEATED_COMPILE_ERROR',
  'RUNTIME_FAILURE',
  'MILESTONE',
  'GHOST_TEXT',
  'SESSION_SUMMARY',
  'QUALITY_DROP',
  'QUALITY_IMPROVED',
]);
export type TriggerType = z.infer<typeof TriggerTypeSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * Errors — every failure response in the system has exactly this shape.
 * ──────────────────────────────────────────────────────────────────────────*/

export const ErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'TOKEN_EXPIRED',
  'TOKEN_REUSED',
  'FORBIDDEN',
  'EMAIL_NOT_VERIFIED',
  'PREMIUM_REQUIRED',
  'NOT_FOUND',
  'PROBLEM_NOT_FOUND',
  'CONFLICT',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'STALE_REVISION',
  'UNPROCESSABLE',
  'EDITORIAL_LOCKED',
  'RATE_LIMITED',
  'EXECUTION_QUOTA_EXCEEDED',
  'AI_QUOTA_EXCEEDED',
  'EXECUTION_PROVIDER_ERROR',
  'AI_PROVIDER_ERROR',
  'AI_SERVICE_WARMING',
  'INTERNAL_ERROR',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
    requestId: z.string().optional(),
    retryAfter: z.number().int().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * Pagination
 * ──────────────────────────────────────────────────────────────────────────*/

export const CursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CursorQuery = z.infer<typeof CursorQuerySchema>;

export const OffsetQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type OffsetQuery = z.infer<typeof OffsetQuerySchema>;

export function cursorPage<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  });
}

export function offsetPage<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
    totalPages: z.number().int(),
  });
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface OffsetPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Shared primitives
 * ──────────────────────────────────────────────────────────────────────────*/

export const CuidSchema = z.string().min(1).max(64);
export const SlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a lowercase slug');

export const PositionSchema = z.object({
  line: z.number().int().min(0),
  column: z.number().int().min(0),
});
export type Position = z.infer<typeof PositionSchema>;

export const RangeSchema = z.object({
  startLine: z.number().int().min(0),
  startColumn: z.number().int().min(0),
  endLine: z.number().int().min(0),
  endColumn: z.number().int().min(0),
});
export type Range = z.infer<typeof RangeSchema>;

/** Hard cap on any code payload crossing a service boundary. */
export const MAX_CODE_BYTES = 64 * 1024;

export const CodeSchema = z
  .string()
  .max(MAX_CODE_BYTES, `Code must be under ${MAX_CODE_BYTES / 1024} KB`);
