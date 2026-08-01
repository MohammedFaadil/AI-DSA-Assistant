import { prisma } from '@repo/db';
import type { Verdict } from '@repo/contracts';
import { logger } from '../../lib/logger.js';
import { leaderboardCache } from '../../lib/cache.js';

const XP_BY_DIFFICULTY = { EASY: 10, MEDIUM: 25, HARD: 50 } as const;

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Applied after every SUBMIT, outside the submission transaction, and
 * idempotent on the submission id: stats, mastery, streak and badges are all
 * derived state that can be safely recomputed or replayed (docs 04 §5).
 */
export async function recordSolve(
  userId: string,
  problemId: string,
  submissionId: string,
  verdict: Verdict,
): Promise<{
  xp: number;
  streak: number;
  solved: boolean;
  masteryDeltas: { topic: string; delta: number }[];
} | null> {
  try {
    const problem = await prisma.problem.findUniqueOrThrow({
      where: { id: problemId },
      select: {
        difficulty: true,
        topics: { include: { topic: { select: { id: true, slug: true } } } },
      },
    });

    const accepted = verdict === 'ACCEPTED';

    // "First time solved" is what earns XP — re-solving does not farm points.
    const priorAccepted = await prisma.submission.count({
      where: { userId, problemId, verdict: 'ACCEPTED', id: { not: submissionId } },
    });
    const firstSolve = accepted && priorAccepted === 0;

    const day = todayUtc();
    const xpEarned = firstSolve ? XP_BY_DIFFICULTY[problem.difficulty] : 0;

    await prisma.dailyActivity.upsert({
      where: { userId_date: { userId, date: day } },
      update: {
        submissionCount: { increment: 1 },
        ...(firstSolve ? { solvedCount: { increment: 1 }, xpEarned: { increment: xpEarned } } : {}),
      },
      create: {
        userId,
        date: day,
        submissionCount: 1,
        solvedCount: firstSolve ? 1 : 0,
        xpEarned,
      },
    });

    const masteryDeltas: { topic: string; delta: number }[] = [];
    for (const link of problem.topics) {
      // Exponential move toward 1 on success, toward 0 on failure, weighted by
      // how central the topic is to the problem. Bounded, monotone, and it
      // never lets one lucky solve claim mastery.
      const delta = accepted ? 0.18 * link.relevance : -0.06 * link.relevance;
      const existing = await prisma.topicMastery.findUnique({
        where: { userId_topicId: { userId, topicId: link.topic.id } },
      });
      const current = existing?.mastery ?? 0;
      const next = Math.max(0, Math.min(1, current + delta * (accepted ? 1 - current : 1)));

      await prisma.topicMastery.upsert({
        where: { userId_topicId: { userId, topicId: link.topic.id } },
        update: {
          mastery: next,
          attempts: { increment: 1 },
          ...(firstSolve ? { solved: { increment: 1 } } : {}),
          lastPracticedAt: new Date(),
          // Mastery decays if a topic goes unpractised for 30 days.
          decayAt: new Date(Date.now() + 30 * 86_400_000),
        },
        create: {
          userId,
          topicId: link.topic.id,
          mastery: Math.max(0, next),
          attempts: 1,
          solved: firstSolve ? 1 : 0,
          lastPracticedAt: new Date(),
          decayAt: new Date(Date.now() + 30 * 86_400_000),
        },
      });
      masteryDeltas.push({ topic: link.topic.slug, delta: Number((next - current).toFixed(3)) });
    }

    const stats = await prisma.userStats.upsert({
      where: { userId },
      update: {
        totalSubmissions: { increment: 1 },
        ...(accepted ? { totalAccepted: { increment: 1 } } : {}),
        ...(firstSolve
          ? {
              totalSolved: { increment: 1 },
              xp: { increment: xpEarned },
              ...(problem.difficulty === 'EASY' ? { easySolved: { increment: 1 } } : {}),
              ...(problem.difficulty === 'MEDIUM' ? { mediumSolved: { increment: 1 } } : {}),
              ...(problem.difficulty === 'HARD' ? { hardSolved: { increment: 1 } } : {}),
            }
          : {}),
      },
      create: {
        userId,
        totalSubmissions: 1,
        totalAccepted: accepted ? 1 : 0,
        totalSolved: firstSolve ? 1 : 0,
        xp: xpEarned,
        easySolved: firstSolve && problem.difficulty === 'EASY' ? 1 : 0,
        mediumSolved: firstSolve && problem.difficulty === 'MEDIUM' ? 1 : 0,
        hardSolved: firstSolve && problem.difficulty === 'HARD' ? 1 : 0,
      },
    });

    const streak = await updateStreak(userId, day);
    if (firstSolve) {
      leaderboardCache.clear();
      await evaluateBadges(userId);
      await maybePromoteSkillLevel(userId, stats.totalSolved);
    }

    return { xp: stats.xp, streak: streak.current, solved: firstSolve, masteryDeltas };
  } catch (err) {
    logger.error({ err, userId, submissionId }, 'progress update failed');
    return null;
  }
}

async function updateStreak(userId: string, day: Date) {
  const streak = await prisma.streak.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  const last = streak.lastActiveDate;
  if (last && last.getTime() === day.getTime()) return streak;

  const yesterday = new Date(day.getTime() - 86_400_000);
  const continues = last !== null && last.getTime() === yesterday.getTime();
  const current = continues ? streak.current + 1 : 1;

  return prisma.streak.update({
    where: { userId },
    data: {
      current,
      longest: Math.max(streak.longest, current),
      lastActiveDate: day,
    },
  });
}

async function maybePromoteSkillLevel(userId: string, totalSolved: number): Promise<void> {
  const level =
    totalSolved >= 150 ? 'EXPERT' : totalSolved >= 60 ? 'ADVANCED' : totalSolved >= 15 ? 'INTERMEDIATE' : 'BEGINNER';
  await prisma.user.update({ where: { id: userId }, data: { skillLevel: level } });
  await prisma.learnerProfile.updateMany({ where: { userId }, data: { skillLevel: level } });
}

/** Declarative badge criteria evaluated against live counters. */
async function evaluateBadges(userId: string): Promise<void> {
  const [badges, stats, streak, languages, noHintSolves] = await Promise.all([
    prisma.badge.findMany({ where: { isActive: true } }),
    prisma.userStats.findUnique({ where: { userId } }),
    prisma.streak.findUnique({ where: { userId } }),
    prisma.submission.findMany({
      where: { userId, verdict: 'ACCEPTED' },
      distinct: ['language'],
      select: { language: true },
    }),
    countNoHintSolves(userId),
  ]);
  if (!stats) return;

  for (const badge of badges) {
    const c = badge.criteria as { type: string; threshold: number; difficulty?: string };
    let progress = 0;

    switch (c.type) {
      case 'solve_count':
        progress =
          (c.difficulty === 'HARD'
            ? stats.hardSolved
            : c.difficulty === 'MEDIUM'
              ? stats.mediumSolved
              : c.difficulty === 'EASY'
                ? stats.easySolved
                : stats.totalSolved) / c.threshold;
        break;
      case 'streak':
        progress = (streak?.longest ?? 0) / c.threshold;
        break;
      case 'languages_used':
        progress = languages.length / c.threshold;
        break;
      case 'no_hint_solves':
        progress = noHintSolves / c.threshold;
        break;
      default:
        continue;
    }

    const capped = Math.min(1, progress);
    const existing = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
    });
    if (existing?.earnedAt) continue;

    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
      update: { progress: capped, ...(capped >= 1 ? { earnedAt: new Date() } : {}) },
      create: {
        userId,
        badgeId: badge.id,
        progress: capped,
        ...(capped >= 1 ? { earnedAt: new Date() } : {}),
      },
    });

    if (capped >= 1) {
      await prisma.userStats.update({
        where: { userId },
        data: { xp: { increment: badge.xpReward } },
      });
      await prisma.notification.create({
        data: {
          userId,
          type: 'BADGE_EARNED',
          title: `Badge unlocked: ${badge.name}`,
          body: badge.description,
          data: { slug: badge.slug },
        },
      });
    }
  }
}

async function countNoHintSolves(userId: string): Promise<number> {
  const solved = await prisma.submission.findMany({
    where: { userId, verdict: 'ACCEPTED' },
    distinct: ['problemId'],
    select: { problemId: true },
  });
  if (solved.length === 0) return 0;
  const hinted = await prisma.hintUnlock.findMany({
    where: { userId, problemId: { in: solved.map((s) => s.problemId) } },
    distinct: ['problemId'],
    select: { problemId: true },
  });
  return solved.length - hinted.length;
}

/* ── Read models ──────────────────────────────────────────────────────────*/

export async function getOverview(userId: string) {
  const [stats, streak, profile, totals, solvedByDifficulty] = await Promise.all([
    prisma.userStats.findUnique({ where: { userId } }),
    prisma.streak.findUnique({ where: { userId } }),
    prisma.learnerProfile.findUnique({ where: { userId } }),
    prisma.problem.groupBy({
      by: ['difficulty'],
      where: { status: 'PUBLISHED', deletedAt: null },
      _count: { _all: true },
    }),
    prisma.submission.findMany({
      where: { userId, verdict: 'ACCEPTED' },
      distinct: ['problemId'],
      select: { problem: { select: { difficulty: true } } },
    }),
  ]);

  const counts = { EASY: 0, MEDIUM: 0, HARD: 0 };
  for (const s of solvedByDifficulty) counts[s.problem.difficulty] += 1;
  const totalMap = { EASY: 0, MEDIUM: 0, HARD: 0 };
  for (const t of totals) totalMap[t.difficulty] = t._count._all;

  const totalSubmissions = stats?.totalSubmissions ?? 0;
  return {
    totalSolved: stats?.totalSolved ?? 0,
    totalProblems: totalMap.EASY + totalMap.MEDIUM + totalMap.HARD,
    byDifficulty: {
      EASY: { solved: counts.EASY, total: totalMap.EASY },
      MEDIUM: { solved: counts.MEDIUM, total: totalMap.MEDIUM },
      HARD: { solved: counts.HARD, total: totalMap.HARD },
    },
    acceptanceRate:
      totalSubmissions > 0 ? Number((((stats?.totalAccepted ?? 0) / totalSubmissions) * 100).toFixed(1)) : 0,
    totalSubmissions,
    xp: stats?.xp ?? 0,
    globalRank: stats?.globalRank ?? null,
    skillLevel: profile?.skillLevel ?? 'BEGINNER',
    streak: { current: streak?.current ?? 0, longest: streak?.longest ?? 0 },
    hintDependency: Number((profile?.hintDependency ?? 0).toFixed(2)),
    confidence: Number((profile?.confidence ?? 0.5).toFixed(2)),
  };
}

export async function getHeatmap(userId: string, year: number) {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const rows = await prisma.dailyActivity.findMany({
    where: { userId, date: { gte: from, lt: to } },
    orderBy: { date: 'asc' },
  });
  return {
    year,
    days: rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      solvedCount: r.solvedCount,
      submissionCount: r.submissionCount,
      activeMinutes: r.activeMinutes,
    })),
    totalActiveDays: rows.length,
  };
}

export async function getTopicMastery(userId: string) {
  const rows = await prisma.topicMastery.findMany({
    where: { userId },
    include: { topic: { select: { slug: true, name: true } } },
    orderBy: { mastery: 'desc' },
  });
  const now = Date.now();
  return rows.map((r) => ({
    slug: r.topic.slug,
    name: r.topic.name,
    mastery: Number(r.mastery.toFixed(2)),
    attempts: r.attempts,
    solved: r.solved,
    avgHintsUsed: Number(r.avgHintsUsed.toFixed(1)),
    lastPracticedAt: r.lastPracticedAt?.toISOString() ?? null,
    decaying: r.decayAt !== null && r.decayAt.getTime() < now,
  }));
}

export async function getAchievements(userId: string) {
  const [badges, earned] = await Promise.all([
    prisma.badge.findMany({ where: { isActive: true }, orderBy: { tier: 'asc' } }),
    prisma.userBadge.findMany({ where: { userId } }),
  ]);
  const byBadge = new Map(earned.map((e) => [e.badgeId, e]));
  return badges.map((b) => {
    const u = byBadge.get(b.id);
    return {
      slug: b.slug,
      name: b.name,
      description: b.description,
      icon: b.icon,
      tier: b.tier,
      progress: Number((u?.progress ?? 0).toFixed(2)),
      earnedAt: u?.earnedAt?.toISOString() ?? null,
      xpReward: b.xpReward,
    };
  });
}

export async function getLeaderboard(page: number, pageSize: number, currentUserId?: string) {
  const key = `lb:${page}:${pageSize}`;
  const cached = leaderboardCache.get(key) as
    | { items: unknown[]; total: number; page: number; pageSize: number; totalPages: number }
    | undefined;

  const data =
    cached ??
    (await (async () => {
      const [total, rows] = await Promise.all([
        prisma.userStats.count({ where: { xp: { gt: 0 } } }),
        prisma.userStats.findMany({
          where: { xp: { gt: 0 } },
          orderBy: [{ xp: 'desc' }, { totalSolved: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            user: { select: { id: true, username: true, name: true, avatarUrl: true } },
          },
        }),
      ]);
      const result = {
        items: rows.map((r, i) => ({
          rank: (page - 1) * pageSize + i + 1,
          userId: r.user.id,
          username: r.user.username,
          name: r.user.name,
          avatarUrl: r.user.avatarUrl,
          score: r.xp,
          solved: r.totalSolved,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
      leaderboardCache.set(key, result, 5 * 60_000);
      return result;
    })());

  return {
    ...data,
    items: (data.items as { userId: string }[]).map((row) => ({
      ...row,
      isCurrentUser: row.userId === currentUserId,
    })),
  };
}
