import { prisma } from '@repo/db';
import type { AssistMode, Language, SaveDraftInput } from '@repo/contracts';
import { conflict, notFound } from '../../lib/errors.js';
import { aiService } from '../../providers/ai/aiService.client.js';
import { logger } from '../../lib/logger.js';

/**
 * Opening a workspace is the AI service's wake-up signal (ADR-004).
 *
 * The ping is fire-and-forget: by the time the user has read the problem
 * statement (20–40s) the container is warm, so the free-tier cold start is
 * absorbed by reading time instead of by a spinner on the first keystroke.
 */
export async function openSession(
  userId: string,
  problemId: string,
  language: Language,
  assistMode: AssistMode,
) {
  const problem = await prisma.problem.findFirst({
    where: { id: problemId, status: 'PUBLISHED', deletedAt: null },
    select: { id: true },
  });
  if (!problem) throw notFound('That problem does not exist.', 'PROBLEM_NOT_FOUND');

  aiService.warmUp();

  // Reuse a session that is still open for this (user, problem) so a page
  // refresh continues the same mentoring context rather than starting over.
  const existing = await prisma.workspaceSession.findFirst({
    where: { userId, problemId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });

  const session =
    existing ??
    (await prisma.workspaceSession.create({
      data: { userId, problemId, language, assistMode },
    }));

  if (existing && (existing.language !== language || existing.assistMode !== assistMode)) {
    await prisma.workspaceSession.update({
      where: { id: existing.id },
      data: { language, assistMode, lastActiveAt: new Date() },
    });
  }

  await prisma.sessionMetrics.upsert({
    where: { sessionId: session.id },
    update: {},
    create: { sessionId: session.id },
  });

  // The conversation is permanently attached to (user, problem) — a new
  // session joins the existing thread rather than creating a second one.
  await prisma.aiConversation.upsert({
    where: { userId_problemId: { userId, problemId } },
    update: { assistMode, sessionId: session.id },
    create: { userId, problemId, sessionId: session.id, assistMode },
  });

  return {
    id: session.id,
    problemId,
    language,
    assistMode,
    startedAt: session.startedAt.toISOString(),
  };
}

export async function updateSession(
  userId: string,
  sessionId: string,
  data: { language?: Language; assistMode?: AssistMode },
) {
  const result = await prisma.workspaceSession.updateMany({
    where: { id: sessionId, userId, endedAt: null },
    data: { ...data, lastActiveAt: new Date() },
  });
  if (result.count === 0) throw notFound('Session not found.');

  if (data.assistMode) {
    await prisma.aiConversation.updateMany({
      where: { sessionId },
      data: { assistMode: data.assistMode },
    });
  }
}

export async function endSession(userId: string, sessionId: string): Promise<void> {
  const session = await prisma.workspaceSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, startedAt: true, endedAt: true },
  });
  if (!session || session.endedAt) return;

  const activeMinutes = Math.max(
    1,
    Math.round((Date.now() - session.startedAt.getTime()) / 60_000),
  );

  await prisma.workspaceSession.update({
    where: { id: sessionId },
    data: { endedAt: new Date() },
  });

  const day = new Date();
  const utcDay = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  await prisma.dailyActivity.upsert({
    where: { userId_date: { userId, date: utcDay } },
    update: { activeMinutes: { increment: Math.min(activeMinutes, 240) } },
    create: { userId, date: utcDay, activeMinutes: Math.min(activeMinutes, 240) },
  });

  logger.debug({ sessionId, activeMinutes }, 'workspace session closed');
}

export async function getDraft(userId: string, problemId: string, language: Language) {
  const draft = await prisma.codeDraft.findUnique({
    where: { userId_problemId_language: { userId, problemId, language } },
  });
  if (!draft) return null;
  return {
    problemId,
    language,
    code: draft.code,
    revision: draft.revision,
    updatedAt: draft.updatedAt.toISOString(),
  };
}

/**
 * Last-write-wins on a monotonic revision.
 *
 * A client that has fallen behind (two tabs, or a reconnect after edits
 * elsewhere) gets 409 STALE_REVISION with the server's version rather than
 * silently clobbering newer code (docs 06 §6).
 */
export async function saveDraft(userId: string, input: SaveDraftInput) {
  const existing = await prisma.codeDraft.findUnique({
    where: {
      userId_problemId_language: {
        userId,
        problemId: input.problemId,
        language: input.language,
      },
    },
  });

  if (existing && input.revision < existing.revision) {
    throw conflict(
      'This draft was updated elsewhere. Reload to get the latest version.',
      'STALE_REVISION',
    );
  }

  const revision = Math.max(input.revision, (existing?.revision ?? 0)) + 1;

  const draft = await prisma.codeDraft.upsert({
    where: {
      userId_problemId_language: {
        userId,
        problemId: input.problemId,
        language: input.language,
      },
    },
    update: { code: input.code, revision },
    create: {
      userId,
      problemId: input.problemId,
      language: input.language,
      code: input.code,
      revision,
    },
  });

  return {
    problemId: input.problemId,
    language: input.language,
    code: draft.code,
    revision: draft.revision,
    updatedAt: draft.updatedAt.toISOString(),
  };
}

/** Periodic in-memory rollup flush. One row per session, never per event (ADR-010). */
export async function flushMetrics(
  sessionId: string,
  metrics: Partial<{
    activeSeconds: number;
    idleSeconds: number;
    maxIdleGapSec: number;
    editCount: number;
    backspaceRatio: number;
    charsTyped: number;
    thrashEvents: number;
    longestDwellLine: number;
    runCount: number;
    submitCount: number;
    compileErrors: number;
    runtimeErrors: number;
    hintsUsed: number;
    aiMessageCount: number;
    ghostAccepted: number;
    ghostRejected: number;
    finalComplexity: string;
    detectedAlgorithm: string;
  }>,
): Promise<void> {
  await prisma.sessionMetrics
    .upsert({
      where: { sessionId },
      update: metrics,
      create: { sessionId, ...metrics },
    })
    .catch((err: unknown) => logger.debug({ err, sessionId }, 'metrics flush skipped'));
}
