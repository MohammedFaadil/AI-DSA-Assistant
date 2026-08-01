import { randomUUID } from 'node:crypto';
import { prisma } from '@repo/db';
import type {
  AgentType,
  AiMessageDto,
  AnalyzeRequest,
  AnalyzeResponse,
  AssistMode,
  Language,
  MentorTurn,
  Position,
  ResponseBlock,
  SessionSignals,
  TriggerType,
  Verdict,
} from '@repo/contracts';
import { AppError, notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { aiService } from '../../providers/ai/aiService.client.js';
import { buildEnvelope } from './envelope.builder.js';

/** Flattens structured blocks into the plain text stored on AiMessage.content. */
function blocksToText(blocks: ResponseBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'text':
        case 'question':
          return b.content;
        case 'code':
          return `\`\`\`${b.language}\n${b.content}\n\`\`\``;
        case 'diagnostic':
          return `**${b.severity}:** ${b.message}`;
        case 'complexity':
          return `Current: ${b.current} · Target: ${b.target}\n\n${b.explanation}`;
        case 'hint':
          return `**Hint ${b.level}.** ${b.content}`;
      }
    })
    .join('\n\n');
}

export interface MentorRequest {
  userId: string;
  problemId: string;
  sessionId?: string | null;
  language: Language;
  code: string;
  assistMode?: AssistMode;
  cursor?: Position | null;
  selection?: string | null;
  userMessage?: string | null;
  trigger: TriggerType;
  signals?: SessionSignals | null;
  hintLevel?: number | null;
}

export interface MentorResult {
  messageId: string;
  agent: AgentType;
  blocks: ResponseBlock[];
  content: string;
  followUp: string | null;
  cacheHit: boolean;
  fallbackUsed: boolean;
  latencyMs: number;
}

async function conversationFor(userId: string, problemId: string, assistMode: AssistMode) {
  return prisma.aiConversation.upsert({
    where: { userId_problemId: { userId, problemId } },
    update: { assistMode },
    create: { userId, problemId, assistMode },
  });
}

/**
 * A Stage-2 mentor turn.
 *
 * Every path here terminates in something useful: if the AI service is cold or
 * every model provider is rate-limited, we serve the problem's AUTHORED hints
 * from the database rather than an error toast (docs 01 §7).
 */
export async function runMentorTurn(req: MentorRequest): Promise<MentorResult> {
  const requestId = randomUUID();
  const assistMode = req.assistMode ?? (await resolveAssistMode(req.userId, req.sessionId));
  const conversation = await conversationFor(req.userId, req.problemId, assistMode);

  /**
   * The socket path already carries live signals from the 2-second tick, but a
   * plain REST question does not. Computing them here costs a few milliseconds
   * of deterministic analysis and is the difference between "start from the
   * constraints" and "your code is O(n²) and the constraints want O(n)" — both
   * for the model and for the no-provider fallback.
   */
  let signals = req.signals ?? null;
  if (!signals && req.code.trim()) {
    signals = await analyze({
      userId: req.userId,
      problemId: req.problemId,
      language: req.language,
      code: req.code,
      cursor: req.cursor ?? null,
      assistMode,
      behaviour: { idleMs: 0, editCount: 0, backspaces: 0, dwellLine: null, charsTyped: 0, elapsedMs: 0, sameErrorCount: 0, lastVerdict: null, stableForMs: 0, previousQuality: null },
      cooldowns: {},
    })
      .then((res) => res.signals)
      .catch(() => null);
  }

  if (req.userMessage) {
    await prisma.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: req.userMessage.slice(0, 4000),
      },
    });
  }

  const envelope = await buildEnvelope({
    requestId,
    userId: req.userId,
    problemId: req.problemId,
    sessionId: req.sessionId ?? null,
    trigger: req.trigger,
    assistMode,
    language: req.language,
    code: req.code,
    cursor: req.cursor,
    selection: req.selection,
    userMessage: req.userMessage,
    signals,
    hintLevel: req.hintLevel,
  });

  const started = Date.now();
  let turn: MentorTurn;
  let fallbackUsed = false;

  try {
    turn = await aiService.chat(envelope, { requestId });
  } catch (err) {
    const code = err instanceof AppError ? err.code : 'AI_PROVIDER_ERROR';
    logger.warn({ err, code, problemId: req.problemId }, 'mentor turn fell back to authored hints');
    turn = await authoredHintFallback(req.problemId, envelope.history.hintsUsed, requestId);
    fallbackUsed = true;
  }

  const content = blocksToText(turn.response.blocks);
  const message = await prisma.aiMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'ASSISTANT',
      agent: turn.response.agent,
      trigger: req.trigger,
      content,
      blocks: turn.response.blocks as never,
      model: turn.telemetry.model,
      promptTokens: turn.telemetry.promptTokens,
      completionTokens: turn.telemetry.completionTokens,
      latencyMs: turn.telemetry.latencyMs,
      cacheHit: turn.telemetry.cacheHit,
      guardRejections: turn.telemetry.guardRejections,
    },
  });

  await prisma.aiConversation.update({
    where: { id: conversation.id },
    data: {
      messageCount: { increment: req.userMessage ? 2 : 1 },
      totalTokens: { increment: turn.telemetry.promptTokens + turn.telemetry.completionTokens },
    },
  });

  await recordUsage(req.userId, turn);
  await recordConceptTags(req.userId, req.sessionId ?? null, turn.response.conceptTags);

  return {
    messageId: message.id,
    agent: turn.response.agent,
    blocks: turn.response.blocks,
    content,
    followUp: turn.response.followUp,
    cacheHit: turn.telemetry.cacheHit,
    fallbackUsed,
    latencyMs: Date.now() - started,
  };
}

/**
 * The zero-cost fallback. Authored hints are curated, correct and always
 * available — which makes "all LLM providers are down" a degraded experience
 * rather than a broken one.
 */
async function authoredHintFallback(
  problemId: string,
  hintsUsed: number[],
  requestId: string,
): Promise<MentorTurn> {
  const nextLevel = Math.min(3, (hintsUsed.length ? Math.max(...hintsUsed) : 0) + 1);
  const hint = await prisma.hint.findFirst({
    where: { problemId, level: nextLevel },
  });

  const blocks: ResponseBlock[] = hint
    ? [
        {
          type: 'text',
          content:
            'The live mentor is unavailable right now, so here is the next curated hint for this problem.',
        },
        { type: 'hint', level: hint.level, content: hint.content },
      ]
    : [
        {
          type: 'text',
          content:
            'The mentor is unavailable right now. Try re-reading the constraints — they usually tell you which complexity class is expected, and that narrows the approach considerably.',
        },
      ];

  return {
    requestId,
    response: { agent: 'FALLBACK', blocks, followUp: null, conceptTags: [] },
    telemetry: {
      model: null,
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 0,
      cacheHit: false,
      guardRejections: 0,
      fallbackUsed: true,
      routeReason: 'provider unavailable',
    },
  };
}

async function resolveAssistMode(userId: string, sessionId?: string | null): Promise<AssistMode> {
  if (sessionId) {
    const session = await prisma.workspaceSession.findUnique({
      where: { id: sessionId },
      select: { assistMode: true },
    });
    if (session) return session.assistMode;
  }
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { defaultAssistMode: true },
  });
  return settings?.defaultAssistMode ?? 'MODERATE';
}

async function recordUsage(userId: string, turn: MentorTurn): Promise<void> {
  if (!turn.telemetry.model) return;
  const day = new Date();
  const date = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  await prisma.aiUsageDaily
    .upsert({
      where: { date_userId_model: { date, userId, model: turn.telemetry.model } },
      update: {
        requests: { increment: 1 },
        promptTokens: { increment: turn.telemetry.promptTokens },
        completionTokens: { increment: turn.telemetry.completionTokens },
        ...(turn.telemetry.cacheHit ? { cacheHits: { increment: 1 } } : {}),
      },
      create: {
        date,
        userId,
        model: turn.telemetry.model,
        requests: 1,
        promptTokens: turn.telemetry.promptTokens,
        completionTokens: turn.telemetry.completionTokens,
        cacheHits: turn.telemetry.cacheHit ? 1 : 0,
      },
    })
    .catch(() => undefined);
}

async function recordConceptTags(
  userId: string,
  sessionId: string | null,
  tags: string[],
): Promise<void> {
  if (tags.length === 0) return;
  const topics = await prisma.topic.findMany({
    where: { slug: { in: tags } },
    select: { id: true },
  });
  if (topics.length === 0) return;
  await prisma.conceptEvent
    .createMany({
      data: topics.map((t) => ({
        userId,
        topicId: t.id,
        sessionId,
        kind: 'mentored',
        weight: 0.5,
      })),
    })
    .catch(() => undefined);
}

/* ── Stage 1 passthrough ─────────────────────────────────────────────────*/

export interface AnalyzeInput {
  userId: string;
  problemId: string;
  language: Language;
  code: string;
  previousCode?: string | null;
  cursor?: Position | null;
  assistMode: AssistMode;
  behaviour: AnalyzeRequest['behaviour'];
  cooldowns: Record<string, number>;
  lastVerdict?: Verdict | null;
}

export async function analyze(input: AnalyzeInput): Promise<AnalyzeResponse> {
  const [problem, profile, settings] = await Promise.all([
    prisma.problem.findUnique({
      where: { id: input.problemId },
      select: { expectedTimeComplexity: true, expectedSpaceComplexity: true },
    }),
    prisma.learnerProfile.findUnique({ where: { userId: input.userId } }),
    prisma.userSettings.findUnique({ where: { userId: input.userId } }),
  ]);
  if (!problem) throw notFound('That problem does not exist.', 'PROBLEM_NOT_FOUND');

  return aiService.analyze(
    {
      requestId: randomUUID(),
      language: input.language,
      code: input.code,
      previousCode: input.previousCode ?? null,
      cursor: input.cursor ?? null,
      expectedTime: problem.expectedTimeComplexity,
      expectedSpace: problem.expectedSpaceComplexity,
      behaviour: input.behaviour,
      assistMode: input.assistMode,
      cooldowns: input.cooldowns,
      confidence: profile?.confidence ?? 0.5,
      idleThresholdMs: (settings?.idleThresholdSec ?? 45) * 1000,
    },
    { requestId: randomUUID() },
  );
}

/* ── Conversation reads ──────────────────────────────────────────────────*/

export async function getConversation(userId: string, problemId: string, limit = 50) {
  const conversation = await prisma.aiConversation.findUnique({
    where: { userId_problemId: { userId, problemId } },
    include: {
      messages: { orderBy: { createdAt: 'asc' }, take: limit },
    },
  });
  if (!conversation) {
    return { id: null, problemId, assistMode: 'MODERATE' as AssistMode, messages: [] };
  }
  const messages: AiMessageDto[] = conversation.messages.map((m) => ({
    id: m.id,
    role: m.role,
    agent: m.agent,
    trigger: m.trigger,
    content: m.content,
    blocks: (m.blocks as ResponseBlock[] | null) ?? null,
    cacheHit: m.cacheHit,
    createdAt: m.createdAt.toISOString(),
  }));
  return {
    id: conversation.id,
    problemId,
    assistMode: conversation.assistMode,
    messages,
  };
}

export async function recordFeedback(
  userId: string,
  messageId: string,
  helpful: boolean,
  reason?: string,
): Promise<void> {
  await prisma.aiFeedback.upsert({
    where: { messageId_userId: { messageId, userId } },
    update: { helpful, reason },
    create: { messageId, userId, helpful, reason },
  });
}

export async function getQuota(userId: string) {
  const day = new Date();
  const date = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const rows = await prisma.aiUsageDaily.findMany({ where: { date, userId } });
  const tokensUsed = rows.reduce((sum, r) => sum + r.promptTokens + r.completionTokens, 0);
  const requests = rows.reduce((sum, r) => sum + r.requests, 0);
  const limit = Number(process.env.PER_USER_DAILY_TOKENS ?? 60_000);
  return {
    tokensUsed,
    tokensLimit: limit,
    requestsToday: requests,
    resetAt: new Date(date.getTime() + 86_400_000).toISOString(),
    degraded: tokensUsed >= limit,
  };
}
