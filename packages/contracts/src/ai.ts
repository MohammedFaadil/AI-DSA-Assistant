import { z } from 'zod';
import { QualityReportSchema } from './quality.js';
import {
  AgentTypeSchema,
  AssistModeSchema,
  CodeSchema,
  CuidSchema,
  DifficultySchema,
  LanguageSchema,
  MessageRoleSchema,
  PositionSchema,
  RangeSchema,
  TriggerTypeSchema,
  VerdictSchema,
} from './common.js';

/* ────────────────────────────────────────────────────────────────────────────
 * STAGE 1 — SessionSignals
 *
 * Everything below is produced deterministically by Tree-sitter + static rules
 * in under ~20 ms. No LLM is involved. This is what lets the mentor "watch"
 * every 2 seconds at zero cost.
 * ──────────────────────────────────────────────────────────────────────────*/

export const SeveritySchema = z.enum(['INFO', 'WARNING', 'ERROR']);
export type Severity = z.infer<typeof SeveritySchema>;

export const FindingSchema = z.object({
  rule: z.string(),
  message: z.string(),
  severity: SeveritySchema,
  range: RangeSchema,
  symbol: z.string().nullable().default(null),
});
export type Finding = z.infer<typeof FindingSchema>;

export const FunctionInfoSchema = z.object({
  name: z.string(),
  startLine: z.number().int(),
  endLine: z.number().int(),
  paramCount: z.number().int(),
  hasReturn: z.boolean(),
  loopDepth: z.number().int(),
  isRecursive: z.boolean(),
});

export const DiffSummarySchema = z.object({
  changedLines: z.number().int(),
  addedNodes: z.number().int(),
  removedNodes: z.number().int(),
  addedCorrectStructure: z.boolean(),
  touchedFunctions: z.array(z.string()),
});

export const SessionSignalsSchema = z.object({
  // structure
  parseOk: z.boolean(),
  errorRanges: z.array(RangeSchema),
  currentFunction: z.string().nullable(),
  scopeChain: z.array(z.string()),
  cursorNodeKind: z.string().nullable(),
  functions: z.array(FunctionInfoSchema),
  dataStructures: z.array(z.string()),
  lineCount: z.number().int(),

  // control flow
  maxLoopDepth: z.number().int(),
  hasRecursion: z.boolean(),
  hasMemoization: z.boolean(),
  branchCount: z.number().int(),

  // static findings
  findings: z.array(FindingSchema),

  // algorithmic
  inferredTime: z.string(),
  inferredSpace: z.string(),
  complexityConfidence: z.number().min(0).max(1),
  algorithmFingerprint: z.string().nullable(),
  matchesExpectedBand: z.boolean(),

  // change + behaviour
  semanticDiff: DiffSummarySchema,
  idleMs: z.number().int(),
  editVelocity: z.number(),
  backspaceRatio: z.number(),
  thrashScore: z.number().min(0).max(1),
  dwellLine: z.number().int().nullable(),
  progressEstimate: z.number().min(0).max(1),
});
export type SessionSignals = z.infer<typeof SessionSignalsSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * The Context Envelope — the ONE contract object crossing the API↔AI seam.
 *
 * `policy` is computed server-side from assist mode + hint history. The model
 * cannot talk its way out of it: the Response Guard re-validates against this
 * exact object after generation.
 * ──────────────────────────────────────────────────────────────────────────*/

export const MentorPolicySchema = z.object({
  maxCodeLines: z.number().int().min(0).max(200),
  mayRevealAlgorithmName: z.boolean(),
  mayWriteSolutionCode: z.boolean(),
  hintLevel: z.number().int().min(1).max(3).nullable(),
  language: z.string().default('en'),
});
export type MentorPolicy = z.infer<typeof MentorPolicySchema>;

export const EnvelopeProblemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  difficulty: DifficultySchema,
  statementDigest: z.string(),
  constraintsDigest: z.string(),
  topics: z.array(z.string()),
  expectedTime: z.string(),
  expectedSpace: z.string(),
});

export const EnvelopeCodeSchema = z.object({
  language: LanguageSchema,
  buffer: CodeSchema,
  cursor: PositionSchema.nullable(),
  selection: z.string().nullable(),
  recentEdits: z.array(z.string()).max(20),
});

export const EnvelopeExecutionSchema = z.object({
  lastVerdict: VerdictSchema.nullable(),
  compilerStderr: z.string().nullable(),
  failingTest: z
    .object({ input: z.string(), expected: z.string(), actual: z.string() })
    .nullable(),
  sameErrorCount: z.number().int().default(0),
});

export const EnvelopeHistorySchema = z.object({
  hintsUsed: z.array(z.number().int()),
  attemptCount: z.number().int(),
  recentMessages: z
    .array(z.object({ role: MessageRoleSchema, content: z.string(), agent: AgentTypeSchema.nullable() }))
    .max(12),
  conversationSummary: z.string().nullable(),
});

export const EnvelopeLearnerSchema = z.object({
  skillLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
  confidence: z.number().min(0).max(1),
  hintDependency: z.number().min(0).max(1),
  weakTopics: z.array(z.string()),
  strongTopics: z.array(z.string()),
  misconceptions: z.array(z.string()),
});

export const ContextEnvelopeSchema = z.object({
  v: z.literal(1),
  requestId: z.string(),
  userId: z.string(),
  sessionId: z.string().nullable(),
  trigger: TriggerTypeSchema,
  assistMode: AssistModeSchema,
  userMessage: z.string().max(4000).nullable(),
  problem: EnvelopeProblemSchema,
  code: EnvelopeCodeSchema,
  signals: SessionSignalsSchema.nullable(),
  execution: EnvelopeExecutionSchema,
  history: EnvelopeHistorySchema,
  learner: EnvelopeLearnerSchema,
  policy: MentorPolicySchema,
  /**
   * Identifier-insensitive token stream of the official solution.
   * Used ONLY by the Response Guard for local similarity comparison — it is
   * never placed in a prompt, so there is no context path that can leak it.
   */
  solutionFingerprint: z.string().nullable(),
  solved: z.boolean(),
});
export type ContextEnvelope = z.infer<typeof ContextEnvelopeSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * Stage 1 request/response (POST /v1/analyze)
 * ──────────────────────────────────────────────────────────────────────────*/

export const AnalyzeRequestSchema = z.object({
  requestId: z.string(),
  language: LanguageSchema,
  code: CodeSchema,
  previousCode: CodeSchema.nullable().default(null),
  cursor: PositionSchema.nullable().default(null),
  expectedTime: z.string().default('O(n)'),
  expectedSpace: z.string().default('O(1)'),
  behaviour: z
    .object({
      idleMs: z.number().int().default(0),
      editCount: z.number().int().default(0),
      backspaces: z.number().int().default(0),
      dwellLine: z.number().int().nullable().default(null),
      charsTyped: z.number().int().default(0),
      elapsedMs: z.number().int().default(0),
      sameErrorCount: z.number().int().default(0),
      lastVerdict: VerdictSchema.nullable().default(null),
      stableForMs: z.number().int().default(0),
      /** The previous tick's overall quality score, if any — lets the AI
       * service compute a trend and fire QUALITY_DROP/QUALITY_IMPROVED
       * without the API needing to duplicate scoring logic. */
      previousQuality: z.number().nullable().default(null),
    })
    .default({}),
  assistMode: AssistModeSchema.default('MODERATE'),
  cooldowns: z.record(z.string(), z.number()).default({}),
  confidence: z.number().min(0).max(1).default(0.5),
  idleThresholdMs: z.number().int().default(45_000),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const TriggerDecisionSchema = z.object({
  fired: z.boolean(),
  trigger: TriggerTypeSchema.nullable(),
  route: AgentTypeSchema.nullable(),
  reason: z.string(),
  cooldownSec: z.number().int(),
});
export type TriggerDecision = z.infer<typeof TriggerDecisionSchema>;

export const AnalyzeResponseSchema = z.object({
  requestId: z.string(),
  signals: SessionSignalsSchema,
  decision: TriggerDecisionSchema,
  // The strength meter comes from the same parse as the signals, so it is free.
  quality: QualityReportSchema,
  elapsedMs: z.number(),
});
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * Stage 2 — agent responses
 * ──────────────────────────────────────────────────────────────────────────*/

export const ResponseBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), content: z.string() }),
  z.object({
    type: z.literal('code'),
    language: z.string(),
    content: z.string(),
    caption: z.string().nullable().default(null),
  }),
  z.object({
    type: z.literal('question'),
    content: z.string(),
  }),
  z.object({
    type: z.literal('diagnostic'),
    severity: SeveritySchema,
    message: z.string(),
    range: RangeSchema.nullable().default(null),
  }),
  z.object({
    type: z.literal('complexity'),
    current: z.string(),
    target: z.string(),
    explanation: z.string(),
  }),
  z.object({
    type: z.literal('hint'),
    level: z.number().int().min(1).max(3),
    content: z.string(),
  }),
]);
export type ResponseBlock = z.infer<typeof ResponseBlockSchema>;

export const AgentResponseSchema = z.object({
  agent: AgentTypeSchema,
  blocks: z.array(ResponseBlockSchema).min(1),
  followUp: z.string().nullable().default(null),
  conceptTags: z.array(z.string()).default([]),
});
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export const GuardViolationSchema = z.object({
  rule: z.enum([
    'SCHEMA',
    'LINE_BUDGET',
    'HINT_LEVEL_FIDELITY',
    'SOLUTION_SIMILARITY',
    'POLICY_FIDELITY',
    'SAFETY',
  ]),
  detail: z.string(),
});
export type GuardViolation = z.infer<typeof GuardViolationSchema>;

export const AgentTelemetrySchema = z.object({
  model: z.string().nullable(),
  promptTokens: z.number().int(),
  completionTokens: z.number().int(),
  latencyMs: z.number().int(),
  cacheHit: z.boolean(),
  guardRejections: z.number().int(),
  fallbackUsed: z.boolean(),
  routeReason: z.string(),
});
export type AgentTelemetry = z.infer<typeof AgentTelemetrySchema>;

export const MentorTurnSchema = z.object({
  requestId: z.string(),
  response: AgentResponseSchema,
  telemetry: AgentTelemetrySchema,
});
export type MentorTurn = z.infer<typeof MentorTurnSchema>;

/* ── Ghost text (FIM) ─────────────────────────────────────────────────────*/

export const CompleteRequestSchema = z.object({
  requestId: z.string(),
  language: LanguageSchema,
  prefix: z.string().max(8000),
  suffix: z.string().max(4000),
  problemTitle: z.string(),
  maxTokens: z.number().int().min(8).max(128).default(48),
});
export type CompleteRequest = z.infer<typeof CompleteRequestSchema>;

export const CompleteResponseSchema = z.object({
  requestId: z.string(),
  text: z.string(),
  cacheHit: z.boolean(),
  model: z.string().nullable(),
});
export type CompleteResponse = z.infer<typeof CompleteResponseSchema>;

/* ── Public API surface (client-facing) ───────────────────────────────────*/

export const ChatSendSchema = z.object({
  problemId: CuidSchema,
  sessionId: CuidSchema.optional(),
  content: z.string().min(1).max(4000),
  language: LanguageSchema,
  code: CodeSchema,
  cursor: PositionSchema.optional(),
  selection: z.string().max(4000).optional(),
});
export type ChatSendInput = z.infer<typeof ChatSendSchema>;

export const AiMessageDtoSchema = z.object({
  id: z.string(),
  role: MessageRoleSchema,
  agent: AgentTypeSchema.nullable(),
  trigger: TriggerTypeSchema.nullable(),
  content: z.string(),
  blocks: z.array(ResponseBlockSchema).nullable(),
  cacheHit: z.boolean(),
  createdAt: z.string(),
});
export type AiMessageDto = z.infer<typeof AiMessageDtoSchema>;

export const ConversationDtoSchema = z.object({
  id: z.string(),
  problemId: z.string(),
  assistMode: AssistModeSchema,
  messages: z.array(AiMessageDtoSchema),
  nextCursor: z.string().nullable(),
});
export type ConversationDto = z.infer<typeof ConversationDtoSchema>;

export const AiQuotaSchema = z.object({
  tokensUsed: z.number().int(),
  tokensLimit: z.number().int(),
  requestsToday: z.number().int(),
  resetAt: z.string(),
  degraded: z.boolean(),
});
export type AiQuota = z.infer<typeof AiQuotaSchema>;

export const HintRequestSchema = z.object({
  problemId: CuidSchema,
  sessionId: CuidSchema.optional(),
  level: z.number().int().min(1).max(3).optional(),
  language: LanguageSchema,
  code: CodeSchema,
});

export const FeedbackSchema = z.object({
  helpful: z.boolean(),
  reason: z.string().max(500).optional(),
});

/* ────────────────────────────────────────────────────────────────────────────
 * AI Training — a persistent tutor thread scoped to a curriculum section
 * rather than a problem. There is no solution to protect here, so unlike
 * ContextEnvelope there is no `policy`/`solutionFingerprint`: teaching mode
 * is unconditionally open by construction (the logical limit of the existing
 * "solved: true" branch that already opens up the problem-solving mentor).
 * ──────────────────────────────────────────────────────────────────────────*/

export const ConceptEnvelopeSectionSchema = z.object({
  slug: z.string(),
  title: z.string(),
  lessonDigest: z.string(),
  keyPatterns: z.array(z.string()),
  commonPitfall: z.string().nullable(),
});

export const ConceptEnvelopeSchema = z.object({
  v: z.literal(1),
  requestId: z.string(),
  userId: z.string(),
  userMessage: z.string().max(4000).nullable(),
  section: ConceptEnvelopeSectionSchema,
  history: EnvelopeHistorySchema,
  learner: EnvelopeLearnerSchema,
});
export type ConceptEnvelope = z.infer<typeof ConceptEnvelopeSchema>;

export const TeachResponseSchema = z.object({
  blocks: z.array(ResponseBlockSchema).min(1),
  followUp: z.string().nullable().default(null),
  readyForPractice: z.boolean().default(false),
});
export type TeachResponse = z.infer<typeof TeachResponseSchema>;

export const TeachChatSendSchema = z.object({
  content: z.string().min(1).max(4000),
});
export type TeachChatSendInput = z.infer<typeof TeachChatSendSchema>;

export const TeachMessageDtoSchema = z.object({
  id: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  blocks: z.array(ResponseBlockSchema).nullable(),
  createdAt: z.string(),
});
export type TeachMessageDto = z.infer<typeof TeachMessageDtoSchema>;

export const TeachConversationDtoSchema = z.object({
  id: z.string(),
  sectionSlug: z.string(),
  messages: z.array(TeachMessageDtoSchema),
});
export type TeachConversationDto = z.infer<typeof TeachConversationDtoSchema>;

export const TeachTurnResponseSchema = z.object({
  requestId: z.string(),
  message: TeachMessageDtoSchema,
  readyForPractice: z.boolean(),
});
export type TeachTurnResponse = z.infer<typeof TeachTurnResponseSchema>;

export const TeachHandoffResponseSchema = z.object({
  problemSlug: z.string().nullable(),
  problemTitle: z.string().nullable(),
  practiceGenerateHint: z.string().nullable(),
});
export type TeachHandoffResponse = z.infer<typeof TeachHandoffResponseSchema>;
