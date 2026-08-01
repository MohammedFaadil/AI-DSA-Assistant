import type {
  AssistMode,
  Language,
  QualityReport,
  SessionSignals,
  Verdict,
} from '@repo/contracts';

/**
 * Live session state.
 *
 * Deliberately in-process (ADR-006/010): this is the highest-frequency state
 * in the system and none of it is worth a database write. Behavioural counters
 * are accumulated here and flushed to SessionMetrics as ONE row per session.
 *
 * Written against an interface-shaped API so the multi-instance upgrade
 * (Redis-backed) is a one-file change (docs 06 §9).
 */
export interface LiveSession {
  sessionId: string;
  userId: string;
  problemId: string;
  language: Language;
  assistMode: AssistMode;

  code: string;
  previousCode: string;
  revision: number;
  cursor: { line: number; column: number } | null;
  lastSyncAt: number;

  // Behaviour accumulators — the client half of the signal set.
  startedAt: number;
  lastEditAt: number;
  editCount: number;
  backspaces: number;
  charsTyped: number;
  maxIdleGapMs: number;
  dwellLine: number | null;

  // Trigger bookkeeping.
  cooldowns: Record<string, number>;
  dismissals: Record<string, number>;
  lastSignals: SessionSignals | null;
  /** Latest strength reading; persisted once per submission, not per tick. */
  lastQuality: QualityReport | null;
  /** Line-by-line mode is opt-in per session and streams on each tick. */
  lineReviewEnabled: boolean;
  lastVerdict: Verdict | null;
  stableSince: number;

  /** Cancels an in-flight analysis when newer code arrives (docs 06 §6). */
  inFlightAnalysis: AbortController | null;
  analysisSeq: number;
}

const sessions = new Map<string, LiveSession>();

export function openLiveSession(init: {
  sessionId: string;
  userId: string;
  problemId: string;
  language: Language;
  assistMode: AssistMode;
  code: string;
  revision: number;
}): LiveSession {
  const existing = sessions.get(init.sessionId);
  if (existing) return existing;

  const now = Date.now();
  const session: LiveSession = {
    ...init,
    previousCode: init.code,
    cursor: null,
    lastSyncAt: now,
    startedAt: now,
    lastEditAt: now,
    editCount: 0,
    backspaces: 0,
    charsTyped: 0,
    maxIdleGapMs: 0,
    dwellLine: null,
    cooldowns: {},
    dismissals: {},
    lastSignals: null,
    lastQuality: null,
    lineReviewEnabled: false,
    lastVerdict: null,
    stableSince: now,
    inFlightAnalysis: null,
    analysisSeq: 0,
  };
  sessions.set(init.sessionId, session);
  return session;
}

export function getLiveSession(sessionId: string): LiveSession | undefined {
  return sessions.get(sessionId);
}

export function closeLiveSession(sessionId: string): LiveSession | undefined {
  const session = sessions.get(sessionId);
  if (session) {
    session.inFlightAnalysis?.abort();
    sessions.delete(sessionId);
  }
  return session;
}

/**
 * A dismissed suggestion lengthens that trigger's cooldown for this session.
 * A mentor who is ignored learns to be quieter (docs 07 §3).
 */
export function registerDismissal(session: LiveSession, trigger: string): void {
  session.dismissals[trigger] = (session.dismissals[trigger] ?? 0) + 1;
}

export function cooldownMultiplier(session: LiveSession, trigger: string): number {
  return Math.min(4, 1.5 ** (session.dismissals[trigger] ?? 0));
}

export function markTriggerFired(session: LiveSession, trigger: string, cooldownSec: number): void {
  session.cooldowns[trigger] =
    Date.now() + cooldownSec * 1000 * cooldownMultiplier(session, trigger);
}

/** Remaining cooldown per trigger, in seconds — sent to the AI service each tick. */
export function cooldownSnapshot(session: LiveSession): Record<string, number> {
  const now = Date.now();
  const out: Record<string, number> = {};
  for (const [trigger, until] of Object.entries(session.cooldowns)) {
    const remaining = Math.max(0, Math.round((until - now) / 1000));
    if (remaining > 0) out[trigger] = remaining;
  }
  return out;
}

export function sessionCount(): number {
  return sessions.size;
}

/** Sessions abandoned without a clean close are swept after 2 hours. */
export function sweepStale(maxAgeMs = 2 * 60 * 60_000): string[] {
  const cutoff = Date.now() - maxAgeMs;
  const removed: string[] = [];
  for (const [id, s] of sessions) {
    if (s.lastSyncAt < cutoff) {
      s.inFlightAnalysis?.abort();
      sessions.delete(id);
      removed.push(id);
    }
  }
  return removed;
}
