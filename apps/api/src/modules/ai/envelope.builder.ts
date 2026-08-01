import { prisma } from '@repo/db';
import type {
  AssistMode,
  ContextEnvelope,
  Language,
  MentorPolicy,
  Position,
  SessionSignals,
  TriggerType,
} from '@repo/contracts';
import { notFound } from '../../lib/errors.js';

/**
 * Policy is computed server-side from assist mode and hint history — it is
 * never client-supplied, and the Response Guard re-validates the model's
 * output against this exact object (docs 01 §6, 07 §5).
 */
export function computePolicy(
  assistMode: AssistMode,
  hintLevel: number | null,
  solved: boolean,
): MentorPolicy {
  if (solved) {
    // Once the problem is solved there is nothing left to protect, so the
    // mentor is free to discuss and show the full solution.
    return {
      maxCodeLines: 200,
      mayRevealAlgorithmName: true,
      mayWriteSolutionCode: true,
      hintLevel,
      language: 'en',
    };
  }
  switch (assistMode) {
    case 'EASY':
      return {
        maxCodeLines: 3,
        mayRevealAlgorithmName: hintLevel !== null && hintLevel >= 3,
        mayWriteSolutionCode: false,
        hintLevel,
        language: 'en',
      };
    case 'MODERATE':
      return {
        maxCodeLines: 6,
        mayRevealAlgorithmName: hintLevel !== null && hintLevel >= 2,
        mayWriteSolutionCode: false,
        hintLevel,
        language: 'en',
      };
    case 'HIGH':
      return {
        maxCodeLines: 12,
        mayRevealAlgorithmName: true,
        mayWriteSolutionCode: false,
        hintLevel,
        language: 'en',
      };
  }
}

export interface EnvelopeInput {
  requestId: string;
  userId: string;
  problemId: string;
  sessionId: string | null;
  trigger: TriggerType;
  assistMode: AssistMode;
  language: Language;
  code: string;
  cursor?: Position | null;
  selection?: string | null;
  userMessage?: string | null;
  signals?: SessionSignals | null;
  hintLevel?: number | null;
  recentEdits?: string[];
}

/**
 * Assembles the one contract object crossing the API↔AI seam.
 *
 * The client never constructs AI context — which is why "why isn't this
 * working?" is unambiguous to the mentor, and why there is no free-form
 * instruction slot for an attacker to aim at (docs 05 §7).
 */
export async function buildEnvelope(input: EnvelopeInput): Promise<ContextEnvelope> {
  const [problem, conversation, profile, masteries, misconceptions] = await Promise.all([
    prisma.problem.findUnique({
      where: { id: input.problemId },
      select: {
        id: true,
        slug: true,
        title: true,
        difficulty: true,
        statementDigest: true,
        constraintsDigest: true,
        expectedTimeComplexity: true,
        expectedSpaceComplexity: true,
        topics: { include: { topic: { select: { slug: true } } } },
        referenceSolutions: {
          where: { isPrimary: true },
          select: { normalizedTokens: true },
          take: 1,
        },
      },
    }),
    prisma.aiConversation.findUnique({
      where: { userId_problemId: { userId: input.userId, problemId: input.problemId } },
      select: {
        summary: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: { role: true, content: true, agent: true },
        },
      },
    }),
    prisma.learnerProfile.findUnique({ where: { userId: input.userId } }),
    prisma.topicMastery.findMany({
      where: { userId: input.userId },
      include: { topic: { select: { slug: true } } },
      orderBy: { mastery: 'asc' },
    }),
    prisma.misconceptionFlag.findMany({
      where: { userId: input.userId, resolvedAt: null },
      orderBy: { occurrences: 'desc' },
      take: 5,
      select: { code: true },
    }),
  ]);

  if (!problem) throw notFound('That problem does not exist.', 'PROBLEM_NOT_FOUND');

  const [hintUnlocks, attempts, lastSubmission, solvedRow] = await Promise.all([
    prisma.hintUnlock.findMany({
      where: { userId: input.userId, problemId: input.problemId },
      select: { level: true },
      orderBy: { level: 'asc' },
    }),
    prisma.submission.count({
      where: { userId: input.userId, problemId: input.problemId, mode: 'SUBMIT' },
    }),
    prisma.submission.findFirst({
      where: { userId: input.userId, problemId: input.problemId },
      orderBy: { createdAt: 'desc' },
      include: {
        results: {
          where: { verdict: { not: 'ACCEPTED' } },
          include: { testCase: true },
          orderBy: { order: 'asc' },
          take: 1,
        },
      },
    }),
    prisma.submission.findFirst({
      where: { userId: input.userId, problemId: input.problemId, verdict: 'ACCEPTED' },
      select: { id: true },
    }),
  ]);

  const solved = solvedRow !== null;
  const hintsUsed = hintUnlocks.map((h) => h.level);
  const policy = computePolicy(
    input.assistMode,
    input.hintLevel ?? (hintsUsed.length ? Math.max(...hintsUsed) : null),
    solved,
  );

  // Only a VISIBLE failing test may be shown back to the user; hidden test
  // payloads never leave the API, not even into a prompt.
  const failing = lastSubmission?.results[0];
  const failingTest =
    failing && !failing.testCase.isHidden
      ? {
          input: failing.testCase.input.slice(0, 1000),
          expected: failing.testCase.expectedOutput.slice(0, 1000),
          actual: (failing.stdout ?? '').slice(0, 1000),
        }
      : null;

  const sameErrorCount = await countRepeatedError(input.userId, input.problemId, lastSubmission?.errorMessage);

  const strong = masteries.filter((m) => m.mastery >= 0.7).map((m) => m.topic.slug);
  const weak = masteries.filter((m) => m.mastery < 0.4).map((m) => m.topic.slug);

  return {
    v: 1,
    requestId: input.requestId,
    userId: input.userId,
    sessionId: input.sessionId,
    trigger: input.trigger,
    assistMode: input.assistMode,
    userMessage: input.userMessage ?? null,
    problem: {
      id: problem.id,
      slug: problem.slug,
      title: problem.title,
      difficulty: problem.difficulty,
      statementDigest: problem.statementDigest,
      constraintsDigest: problem.constraintsDigest,
      topics: problem.topics.map((t) => t.topic.slug),
      expectedTime: problem.expectedTimeComplexity,
      expectedSpace: problem.expectedSpaceComplexity,
    },
    code: {
      language: input.language,
      buffer: input.code,
      cursor: input.cursor ?? null,
      selection: input.selection ?? null,
      recentEdits: (input.recentEdits ?? []).slice(-20),
    },
    signals: input.signals ?? null,
    execution: {
      lastVerdict: lastSubmission?.verdict ?? null,
      compilerStderr: lastSubmission?.compileOutput?.slice(0, 2000) ?? null,
      failingTest,
      sameErrorCount,
    },
    history: {
      hintsUsed,
      attemptCount: attempts,
      // Stored newest-first for the query; the model reads them oldest-first.
      recentMessages: (conversation?.messages ?? [])
        .slice()
        .reverse()
        .map((m) => ({ role: m.role, content: m.content.slice(0, 1500), agent: m.agent })),
      conversationSummary: conversation?.summary ?? null,
    },
    learner: {
      skillLevel: profile?.skillLevel ?? 'BEGINNER',
      confidence: profile?.confidence ?? 0.5,
      hintDependency: profile?.hintDependency ?? 0,
      weakTopics: weak.slice(0, 5),
      strongTopics: strong.slice(0, 5),
      misconceptions: misconceptions.map((m) => m.code),
    },
    policy,
    solutionFingerprint: problem.referenceSolutions[0]?.normalizedTokens ?? null,
    solved,
  };
}

/** Feeds the REPEATED_COMPILE_ERROR trigger. */
async function countRepeatedError(
  userId: string,
  problemId: string,
  errorMessage: string | null | undefined,
): Promise<number> {
  if (!errorMessage) return 0;
  const signature = errorMessage.slice(0, 120);
  const recent = await prisma.submission.findMany({
    where: { userId, problemId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { errorMessage: true },
  });
  return recent.filter((r) => r.errorMessage?.slice(0, 120) === signature).length;
}
