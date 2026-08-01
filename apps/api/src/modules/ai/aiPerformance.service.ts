import { prisma } from '@repo/db';
import type { AiPerformance } from '@repo/contracts';
import { env } from '../../config/env.js';

/**
 * AI performance tracker.
 *
 * Answers the questions that actually matter about the mentor: which agents are
 * being useful, how often the guard had to reject a response, whether the
 * learner's code strength is trending up, and how much of the budget is left.
 *
 * `deterministicOnly` is surfaced honestly — if no LLM provider is configured,
 * the UI must say so rather than presenting the deterministic fallback as if it
 * were the full agent system.
 */
export async function getAiPerformance(userId: string, days = 30): Promise<AiPerformance> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);

  const [messages, feedback, hintUnlocks, profile, snapshots, usage] = await Promise.all([
    prisma.aiMessage.findMany({
      where: {
        conversation: { userId },
        role: 'ASSISTANT',
        createdAt: { gte: from },
      },
      select: {
        id: true,
        agent: true,
        trigger: true,
        latencyMs: true,
        cacheHit: true,
        guardRejections: true,
        model: true,
        promptTokens: true,
        completionTokens: true,
      },
    }),
    prisma.aiFeedback.findMany({
      where: { userId, createdAt: { gte: from } },
      select: { messageId: true, helpful: true },
    }),
    prisma.hintUnlock.count({ where: { userId, unlockedAt: { gte: from } } }),
    prisma.learnerProfile.findUnique({ where: { userId } }),
    prisma.qualitySnapshot.findMany({
      where: { userId, createdAt: { gte: from } },
      orderBy: { createdAt: 'asc' },
      select: { overall: true, createdAt: true },
    }),
    prisma.aiUsageDaily.findMany({
      where: { userId, date: { gte: startOfUtcDay(to) } },
      select: { promptTokens: true, completionTokens: true },
    }),
  ]);

  const helpfulByMessage = new Map(feedback.map((f) => [f.messageId, f.helpful]));

  // ── per agent ──────────────────────────────────────────────────────────
  const agentBuckets = new Map<
    string,
    { count: number; latencySum: number; latencyCount: number; helpful: number; rated: number }
  >();

  for (const message of messages) {
    const key = message.agent ?? 'SYSTEM';
    const bucket =
      agentBuckets.get(key) ??
      { count: 0, latencySum: 0, latencyCount: 0, helpful: 0, rated: 0 };
    bucket.count += 1;
    if (message.latencyMs) {
      bucket.latencySum += message.latencyMs;
      bucket.latencyCount += 1;
    }
    const rating = helpfulByMessage.get(message.id);
    if (rating !== undefined) {
      bucket.rated += 1;
      if (rating) bucket.helpful += 1;
    }
    agentBuckets.set(key, bucket);
  }

  const byAgent = [...agentBuckets.entries()]
    .map(([agent, b]) => ({
      agent,
      count: b.count,
      helpfulRate: b.rated > 0 ? Number((b.helpful / b.rated).toFixed(2)) : null,
      avgLatencyMs: b.latencyCount > 0 ? Math.round(b.latencySum / b.latencyCount) : null,
    }))
    .sort((a, b) => b.count - a.count);

  // ── per trigger ────────────────────────────────────────────────────────
  const triggerCounts = new Map<string, number>();
  for (const message of messages) {
    const key = message.trigger ?? 'EXPLICIT_ASK';
    triggerCounts.set(key, (triggerCounts.get(key) ?? 0) + 1);
  }
  const byTrigger = [...triggerCounts.entries()]
    .map(([trigger, count]) => ({ trigger, count }))
    .sort((a, b) => b.count - a.count);

  // ── rates ──────────────────────────────────────────────────────────────
  const total = messages.length;
  const cacheHits = messages.filter((m) => m.cacheHit).length;
  // A message with no model recorded came from the deterministic fallback.
  const fallbacks = messages.filter((m) => m.model === null).length;
  const guardRejections = messages.reduce((sum, m) => sum + m.guardRejections, 0);

  // ── quality trend ──────────────────────────────────────────────────────
  const qualitySeries = snapshots.map((s) => ({
    date: s.createdAt.toISOString().slice(0, 10),
    score: s.overall,
  }));

  let avgQuality: number | null = null;
  let qualityTrend: number | null = null;
  if (snapshots.length > 0) {
    avgQuality = Math.round(
      snapshots.reduce((sum, s) => sum + s.overall, 0) / snapshots.length,
    );
    // Trend compares the first and last thirds rather than first-vs-last point,
    // so one unusually good or bad submission does not define the story.
    if (snapshots.length >= 4) {
      const third = Math.max(1, Math.floor(snapshots.length / 3));
      const early = snapshots.slice(0, third);
      const late = snapshots.slice(-third);
      const mean = (rows: typeof snapshots): number =>
        rows.reduce((sum, s) => sum + s.overall, 0) / rows.length;
      qualityTrend = Math.round(mean(late) - mean(early));
    }
  }

  const tokensToday = usage.reduce((sum, row) => sum + row.promptTokens + row.completionTokens, 0);
  const deterministicOnly = !env.OPENROUTER_API_KEY && !env.GROQ_API_KEY;

  return {
    window: { days, from: from.toISOString(), to: to.toISOString() },
    interactions: total,
    byAgent,
    byTrigger,
    hintsUnlocked: hintUnlocks,
    hintDependency: Number((profile?.hintDependency ?? 0).toFixed(2)),
    cacheHitRate: total > 0 ? Number((cacheHits / total).toFixed(2)) : 0,
    fallbackRate: total > 0 ? Number((fallbacks / total).toFixed(2)) : 0,
    guardRejections,
    tokensToday,
    tokenBudget: env.PER_USER_DAILY_TOKENS,
    avgQuality,
    qualityTrend,
    qualitySeries,
    deterministicOnly,
  };
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Records a code-strength reading for a submission.
 *
 * One row per submission, never per analysis tick — the meter updates every two
 * seconds and persisting that would blow the storage budget in docs 04 §6.
 */
export async function recordQualitySnapshot(
  userId: string,
  problemId: string,
  submissionId: string,
  report: {
    overall: number;
    grade: string;
    dimensions: { key: string; score: number }[];
  },
): Promise<void> {
  const pick = (key: string): number =>
    report.dimensions.find((d) => d.key === key)?.score ?? 0;

  await prisma.qualitySnapshot
    .upsert({
      where: { submissionId },
      update: {},
      create: {
        userId,
        problemId,
        submissionId,
        overall: report.overall,
        correctness: pick('correctness'),
        efficiency: pick('efficiency'),
        readability: pick('readability'),
        robustness: pick('robustness'),
        structure: pick('structure'),
        grade: report.grade.slice(0, 2),
      },
    })
    .catch(() => undefined);
}
