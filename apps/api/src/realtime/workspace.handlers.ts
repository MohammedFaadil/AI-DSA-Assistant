import { randomUUID } from 'node:crypto';
import type { Socket } from 'socket.io';
import { prisma } from '@repo/db';
import type {
  AiSuggestion,
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  TriggerType,
} from '@repo/contracts';
import { logger } from '../lib/logger.js';
import { consumeLocal } from '../middleware/rateLimit.js';
import * as ai from '../modules/ai/ai.service.js';
import * as workspace from '../modules/workspace/workspace.service.js';
import * as problems from '../modules/problems/problems.service.js';
import { aiExtra } from '../providers/ai/aiService.extra.js';
import {
  closeLiveSession,
  cooldownSnapshot,
  getLiveSession,
  markTriggerFired,
  openLiveSession,
  registerDismissal,
  type LiveSession,
} from './session-registry.js';
import { sessionRoom } from './emitter.js';

type WorkspaceSocket = Socket<ClientToServerEvents, ServerToClientEvents, never, SocketData>;

/** Per-socket token buckets (docs 06 §7). Three breaches in a minute disconnects. */
const EVENT_BUCKETS: Record<string, { limit: number; windowSec: number }> = {
  'code:sync': { limit: 40, windowSec: 60 },
  'code:cursor': { limit: 60, windowSec: 60 },
  'behaviour:tick': { limit: 20, windowSec: 60 },
  'ai:chat:send': { limit: 20, windowSec: 3600 },
  'ai:hint:request': { limit: 15, windowSec: 3600 },
  'ai:ghost:request': { limit: 30, windowSec: 60 },
  '*': { limit: 200, windowSec: 60 },
};

function allow(socket: WorkspaceSocket, event: string): boolean {
  const spec = EVENT_BUCKETS[event] ?? EVENT_BUCKETS['*']!;
  const key = `sock:${socket.id}:${event}`;
  const aggregate = consumeLocal(`sock:${socket.id}:*`, EVENT_BUCKETS['*']!.limit, 60);
  const specific = consumeLocal(key, spec.limit, spec.windowSec);

  if (!specific.allowed || !aggregate.allowed) {
    const retryAfter = Math.ceil((specific.resetAt - Date.now()) / 1000);
    socket.emit('rate:limited', { event, retryAfter: Math.max(1, retryAfter) });
    return false;
  }
  return true;
}

/** Sessions belong to a user; a socket may only touch its own. */
async function assertOwnership(socket: WorkspaceSocket, sessionId: string): Promise<boolean> {
  if (socket.data.sessionIds.has(sessionId)) return true;
  const session = await prisma.workspaceSession.findFirst({
    where: { id: sessionId, userId: socket.data.userId },
    select: { id: true },
  });
  if (!session) return false;
  socket.data.sessionIds.add(sessionId);
  return true;
}

export function registerWorkspaceHandlers(socket: WorkspaceSocket): void {
  socket.on('session:join', async (payload, ack) => {
    try {
      if (!(await assertOwnership(socket, payload.sessionId))) {
        ack?.({ ok: false, error: 'Session not found.' });
        return;
      }

      const session = await prisma.workspaceSession.findUniqueOrThrow({
        where: { id: payload.sessionId },
        include: { problem: { select: { id: true } } },
      });

      const [draft, hintUnlocks, lastSubmission, attempts] = await Promise.all([
        workspace.getDraft(socket.data.userId, session.problemId, session.language),
        prisma.hintUnlock.findMany({
          where: { userId: socket.data.userId, problemId: session.problemId },
          select: { level: true },
        }),
        prisma.submission.findFirst({
          where: { userId: socket.data.userId, problemId: session.problemId },
          orderBy: { createdAt: 'desc' },
          select: { verdict: true },
        }),
        prisma.submission.count({
          where: { userId: socket.data.userId, problemId: session.problemId, mode: 'SUBMIT' },
        }),
      ]);

      const live = openLiveSession({
        sessionId: session.id,
        userId: socket.data.userId,
        problemId: session.problemId,
        language: session.language,
        assistMode: session.assistMode,
        code: draft?.code ?? '',
        revision: draft?.revision ?? 0,
      });
      live.lastVerdict = lastSubmission?.verdict ?? null;

      await socket.join(sessionRoom(session.id));

      const state = {
        sessionId: session.id,
        problemId: session.problemId,
        language: session.language,
        assistMode: session.assistMode,
        code: live.code,
        revision: live.revision,
        hintsUsed: hintUnlocks.map((h) => h.level),
        lastVerdict: live.lastVerdict,
        attemptCount: attempts,
      };
      socket.emit('session:state', state);
      ack?.({ ok: true, state });
    } catch (err) {
      logger.error({ err }, 'session:join failed');
      ack?.({ ok: false, error: 'Could not open that session.' });
    }
  });

  socket.on('session:leave', async ({ sessionId }) => {
    await socket.leave(sessionRoom(sessionId));
    socket.data.sessionIds.delete(sessionId);
    await flushAndClose(sessionId);
  });

  /* ── The 2-second tick — the hot path ─────────────────────────────────*/
  socket.on('code:sync', async (payload, ack) => {
    if (!allow(socket, 'code:sync')) return;
    const live = getLiveSession(payload.sessionId);
    if (!live || live.userId !== socket.data.userId) {
      ack?.({ ok: false, revision: 0, error: 'Session not active.' });
      return;
    }

    // Ignore anything at or behind what we have already processed. Without
    // this, a retrying client re-triggers analysis for code we already saw.
    if (payload.revision <= live.revision) {
      ack?.({ ok: true, revision: live.revision });
      return;
    }

    const now = Date.now();
    const gap = now - live.lastEditAt;
    live.maxIdleGapMs = Math.max(live.maxIdleGapMs, gap);
    live.previousCode = live.code;
    live.code = payload.code;
    live.revision = payload.revision;
    live.cursor = payload.cursor;
    live.lastSyncAt = now;
    live.lastEditAt = now;
    live.editCount += 1;

    const delta = payload.code.length - live.previousCode.length;
    if (delta > 0) live.charsTyped += delta;
    else if (delta < 0) live.backspaces += Math.abs(delta);

    // Structural stability feeds the COMPLEXITY_GAP trigger: we only comment
    // on an approach once the learner has stopped changing it.
    if (payload.code.trim() !== live.previousCode.trim()) live.stableSince = now;

    ack?.({ ok: true, revision: live.revision });

    // Persist the draft so code survives a disconnect. Fire-and-forget: the
    // editor is local-first and must never wait on the database (ADR-011).
    void workspace
      .saveDraft(socket.data.userId, {
        problemId: live.problemId,
        language: live.language,
        code: payload.code,
        revision: payload.revision,
      })
      .then((saved) => socket.emit('code:ack', { revision: saved.revision, savedAt: saved.updatedAt }))
      .catch(() => undefined);

    void runAnalysis(socket, live);
  });

  socket.on('code:cursor', ({ sessionId, line, column }) => {
    if (!allow(socket, 'code:cursor')) return;
    const live = getLiveSession(sessionId);
    if (!live) return;
    live.cursor = { line, column };
    live.dwellLine = line;
  });

  socket.on('behaviour:tick', (payload) => {
    if (!allow(socket, 'behaviour:tick')) return;
    const live = getLiveSession(payload.sessionId);
    if (!live) return;
    live.dwellLine = payload.dwellLine;
    live.maxIdleGapMs = Math.max(live.maxIdleGapMs, payload.idleMs);

    // An idle tick is the ONLY thing that can fire IDLE_STUCK — the user has
    // stopped typing, so no code:sync is coming to drive the analysis.
    if (payload.idleMs >= 20_000) void runAnalysis(socket, live, payload.idleMs);
  });

  /* ── Explicit mentor interaction ──────────────────────────────────────*/
  socket.on('ai:chat:send', async (payload, ack) => {
    if (!allow(socket, 'ai:chat:send')) {
      ack?.({ ok: false, error: 'RATE_LIMITED' });
      return;
    }
    const live = getLiveSession(payload.sessionId);
    if (!live) {
      ack?.({ ok: false, error: 'NOT_FOUND' });
      return;
    }

    socket.emit('ai:typing', { agent: 'PLANNER' });
    try {
      const result = await ai.runMentorTurn({
        userId: live.userId,
        problemId: live.problemId,
        sessionId: live.sessionId,
        language: live.language,
        code: live.code,
        assistMode: live.assistMode,
        cursor: live.cursor,
        selection: payload.selection ?? null,
        userMessage: payload.content,
        trigger: 'EXPLICIT_ASK',
        signals: live.lastSignals,
      });
      ack?.({ ok: true, messageId: result.messageId });
      emitTurn(socket, result, 'EXPLICIT_ASK');
    } catch (err) {
      logger.warn({ err }, 'ai chat failed');
      socket.emit('ai:message:error', {
        messageId: 'error',
        code: 'AI_PROVIDER_ERROR',
        message: 'The mentor could not answer that. Try again in a moment.',
        fallbackUsed: false,
      });
      ack?.({ ok: false, error: 'AI_PROVIDER_ERROR' });
    }
  });

  socket.on('ai:hint:request', async ({ sessionId, level }) => {
    if (!allow(socket, 'ai:hint:request')) return;
    const live = getLiveSession(sessionId);
    if (!live) return;

    const problem = await prisma.problem.findUnique({
      where: { id: live.problemId },
      select: { slug: true },
    });
    if (!problem) return;

    try {
      const existing = await problems.getHints(problem.slug, live.userId);
      const target = level ?? existing.nextLevel ?? 3;
      const unlocked = await problems.unlockHint(problem.slug, target, live.userId);
      socket.emit('ai:hint:unlocked', {
        level: unlocked.level,
        content: unlocked.content,
        remaining: Math.max(0, 3 - unlocked.level),
      });

      // The authored hint lands instantly; the AI then contextualises it
      // against the code actually on screen.
      const result = await ai.runMentorTurn({
        userId: live.userId,
        problemId: live.problemId,
        sessionId: live.sessionId,
        language: live.language,
        code: live.code,
        assistMode: live.assistMode,
        trigger: 'EXPLICIT_ASK',
        hintLevel: target,
        signals: live.lastSignals,
      });
      emitTurn(socket, result, 'EXPLICIT_ASK');
    } catch (err) {
      logger.warn({ err }, 'hint request failed');
    }
  });

  socket.on('ai:mode:set', async ({ sessionId, assistMode }) => {
    const live = getLiveSession(sessionId);
    if (!live) return;
    live.assistMode = assistMode;
    await workspace.updateSession(socket.data.userId, sessionId, { assistMode }).catch(() => undefined);
  });

  socket.on('ai:line-review:request', ({ sessionId }) => {
    const live = getLiveSession(sessionId);
    if (!live) return;
    // Toggling on runs a pass immediately rather than waiting for the next edit.
    live.lineReviewEnabled = true;
    void pushLineReview(socket, live);
  });

  socket.on('ai:dismiss', ({ sessionId, suggestionId }) => {
    const live = getLiveSession(sessionId);
    if (!live) return;
    // suggestionId is "<TRIGGER>:<seq>" — the trigger is what we penalise.
    registerDismissal(live, suggestionId.split(':')[0] ?? 'UNKNOWN');
  });

  socket.on('exec:subscribe', async ({ executionId }) => {
    const owned = await prisma.submission.findFirst({
      where: { id: executionId, userId: socket.data.userId },
      select: { id: true },
    });
    if (owned) await socket.join(`exec:${executionId}`);
  });

  socket.on('disconnect', async () => {
    for (const sessionId of socket.data.sessionIds) {
      await flushAndClose(sessionId);
    }
  });
}

/* ── Stage 1 → trigger → Stage 2 ─────────────────────────────────────────*/

/**
 * The whole pipeline in one function.
 *
 * Note what is NOT here: an LLM call. Analysis is deterministic and free; the
 * trigger decision returned by the AI service is what gates the ~5% of ticks
 * that are allowed to spend inference (docs 01 §5).
 */
async function runAnalysis(
  socket: WorkspaceSocket,
  live: LiveSession,
  idleMsOverride?: number,
): Promise<void> {
  if (!live.code.trim()) return;

  // Cancel-and-replace: exactly one analysis in flight per session, always
  // for the newest code (docs 06 §6).
  live.inFlightAnalysis?.abort();
  const controller = new AbortController();
  live.inFlightAnalysis = controller;
  const seq = ++live.analysisSeq;

  const now = Date.now();
  try {
    const analysis = await ai.analyze({
      userId: live.userId,
      problemId: live.problemId,
      language: live.language,
      code: live.code,
      previousCode: live.previousCode,
      cursor: live.cursor,
      assistMode: live.assistMode,
      behaviour: {
        idleMs: idleMsOverride ?? now - live.lastEditAt,
        editCount: live.editCount,
        backspaces: live.backspaces,
        dwellLine: live.dwellLine,
        charsTyped: live.charsTyped,
        elapsedMs: now - live.startedAt,
        sameErrorCount: 0,
        lastVerdict: live.lastVerdict,
        stableForMs: now - live.stableSince,
        previousQuality: live.lastQuality?.overall ?? null,
      },
      cooldowns: cooldownSnapshot(live),
    });

    // A newer analysis started while this one was in flight — discard.
    if (seq !== live.analysisSeq) return;
    live.lastSignals = analysis.signals;
    live.lastQuality = analysis.quality;

    // The strength meter rides along with the signals — same parse, no extra
    // cost, so the bar can move on every tick.
    socket.emit('ai:signals', {
      sessionId: live.sessionId,
      signals: analysis.signals,
      quality: analysis.quality,
      elapsedMs: analysis.elapsedMs,
    });

    if (live.lineReviewEnabled) void pushLineReview(socket, live);

    const suggestions = toSuggestions(analysis.signals, live.sessionId);
    if (suggestions.length) {
      socket.emit('ai:suggestion', { sessionId: live.sessionId, suggestions });
    }

    // ── The 5% path ────────────────────────────────────────────────────
    if (!analysis.decision.fired || !analysis.decision.trigger) return;

    const settings = await prisma.userSettings.findUnique({
      where: { userId: live.userId },
      select: { proactiveMentor: true },
    });
    if (settings && !settings.proactiveMentor) return;

    markTriggerFired(live, analysis.decision.trigger, analysis.decision.cooldownSec);
    socket.emit('ai:typing', { agent: analysis.decision.route ?? 'TUTOR' });

    const result = await ai.runMentorTurn({
      userId: live.userId,
      problemId: live.problemId,
      sessionId: live.sessionId,
      language: live.language,
      code: live.code,
      assistMode: live.assistMode,
      cursor: live.cursor,
      trigger: analysis.decision.trigger,
      signals: analysis.signals,
    });
    emitTurn(socket, result, analysis.decision.trigger);
  } catch (err) {
    // Stage 1 failing must be silent. The editor keeps working; the mentor is
    // simply quiet until the service is back.
    logger.debug({ err: (err as Error).message }, 'analysis unavailable');
  } finally {
    if (live.inFlightAnalysis === controller) live.inFlightAnalysis = null;
  }
}

/**
 * Streams per-line annotations. Deterministic, so it is safe to run on every
 * tick while the mode is on; failures are silent because a missing annotation
 * must never look like a broken editor.
 */
async function pushLineReview(socket: WorkspaceSocket, live: LiveSession): Promise<void> {
  if (!live.code.trim()) return;
  try {
    const problem = await prisma.problem.findUnique({
      where: { id: live.problemId },
      select: { expectedTimeComplexity: true },
    });
    const result = await aiExtra.lineReview({
      requestId: randomUUID(),
      language: live.language,
      code: live.code,
      expectedTime: problem?.expectedTimeComplexity ?? 'O(n)',
    });
    socket.emit('ai:line-review', { sessionId: live.sessionId, review: result.review });
  } catch {
    /* annotations are additive — silence beats an error toast */
  }
}

/** Deterministic findings → Monaco decorations. No LLM involved. */
function toSuggestions(
  signals: import('@repo/contracts').SessionSignals,
  sessionId: string,
): AiSuggestion[] {
  const out: AiSuggestion[] = signals.findings.slice(0, 12).map((f, i) => ({
    id: `${f.rule}:${sessionId}:${i}`,
    kind: 'diagnostic' as const,
    severity: f.severity,
    message: f.message,
    range: f.range,
    dismissible: f.severity !== 'ERROR',
  }));

  if (!signals.matchesExpectedBand && signals.complexityConfidence >= 0.6) {
    out.push({
      id: `COMPLEXITY_GAP:${sessionId}`,
      kind: 'complexity',
      severity: 'WARNING',
      message: `This looks like ${signals.inferredTime}. The constraints suggest something faster is expected.`,
      range: null,
      dismissible: true,
    });
  }
  return out;
}

function emitTurn(
  socket: WorkspaceSocket,
  result: Awaited<ReturnType<typeof ai.runMentorTurn>>,
  trigger: TriggerType,
): void {
  socket.emit('ai:message:start', {
    messageId: result.messageId,
    agent: result.agent,
    trigger,
  });
  for (const block of result.blocks) {
    socket.emit('ai:message:block', { messageId: result.messageId, block });
  }
  socket.emit('ai:message:done', {
    messageId: result.messageId,
    tokens: 0,
    latencyMs: result.latencyMs,
    cacheHit: result.cacheHit,
    fallbackUsed: result.fallbackUsed,
  });
}

/** One SessionMetrics row per session, written on close (ADR-010). */
async function flushAndClose(sessionId: string): Promise<void> {
  const live = closeLiveSession(sessionId);
  if (!live) return;
  const elapsedSec = Math.round((Date.now() - live.startedAt) / 1000);
  const total = live.charsTyped + live.backspaces;

  await workspace.flushMetrics(sessionId, {
    activeSeconds: elapsedSec,
    idleSeconds: Math.round(live.maxIdleGapMs / 1000),
    maxIdleGapSec: Math.round(live.maxIdleGapMs / 1000),
    editCount: live.editCount,
    charsTyped: live.charsTyped,
    backspaceRatio: total > 0 ? Number((live.backspaces / total).toFixed(3)) : 0,
    longestDwellLine: live.dwellLine ?? undefined,
    finalComplexity: live.lastSignals?.inferredTime,
    detectedAlgorithm: live.lastSignals?.algorithmFingerprint ?? undefined,
  });
}
