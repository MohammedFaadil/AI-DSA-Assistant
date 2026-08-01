import { prisma } from '@repo/db';
import type { CurriculumSectionDto, ImprovementArea } from '@repo/contracts';

/** A section opens once the previous one is 60% of the way through its core set. */
const UNLOCK_THRESHOLD = 0.6;

/**
 * The curriculum as the learner sees it: ordered sections, per-section progress,
 * and the single next problem to attempt.
 *
 * Gating is deliberate. Letting someone jump to graph traversal before they can
 * write a clean linear scan is not freedom, it is a worse outcome — so a section
 * unlocks only once the previous one is substantially done.
 */
export async function getCurriculum(userId: string): Promise<CurriculumSectionDto[]> {
  const [sections, solved, attempted, masteries] = await Promise.all([
    prisma.curriculumSection.findMany({
      // Track first: unlock gating is per-track, so Foundations' last section
      // must not gate Advanced's first one.
      orderBy: [{ track: 'asc' }, { order: 'asc' }],
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: {
            problem: {
              select: {
                id: true,
                slug: true,
                title: true,
                difficulty: true,
                status: true,
                deletedAt: true,
                topics: { select: { topic: { select: { slug: true } } } },
              },
            },
          },
        },
        blocks: { orderBy: { order: 'asc' } },
      },
    }),
    prisma.submission.findMany({
      where: { userId, verdict: 'ACCEPTED' },
      distinct: ['problemId'],
      select: { problemId: true },
    }),
    prisma.submission.findMany({
      where: { userId, mode: 'SUBMIT' },
      distinct: ['problemId'],
      select: { problemId: true },
    }),
    prisma.topicMastery.findMany({
      where: { userId },
      include: { topic: { select: { slug: true } } },
    }),
  ]);

  const solvedIds = new Set(solved.map((s) => s.problemId));
  const attemptedIds = new Set(attempted.map((s) => s.problemId));
  const masteryBySlug = new Map(masteries.map((m) => [m.topic.slug, m.mastery]));

  const output: CurriculumSectionDto[] = [];
  // Keyed by track so Advanced's first section isn't gated by whatever
  // Foundations happened to end on — each track's first section is always open.
  const previousCompletionByTrack: Record<string, number> = {};

  for (const section of sections) {
    const previousCompletion = previousCompletionByTrack[section.track] ?? 1;
    const live = section.items.filter(
      (item) => item.problem.status === 'PUBLISHED' && item.problem.deletedAt === null,
    );

    const problems = live.map((item) => ({
      problemId: item.problem.id,
      slug: item.problem.slug,
      title: item.problem.title,
      difficulty: item.problem.difficulty,
      isCore: item.isCore,
      status: solvedIds.has(item.problem.id)
        ? ('SOLVED' as const)
        : attemptedIds.has(item.problem.id)
          ? ('ATTEMPTED' as const)
          : ('TODO' as const),
    }));

    const core = problems.filter((p) => p.isCore);
    const coreSolved = core.filter((p) => p.status === 'SOLVED').length;
    const completion = core.length ? coreSolved / core.length : 0;

    // Section mastery is the mean over the topics its problems actually cover,
    // which is a truer reading than counting solved problems alone.
    const topicSlugs = new Set(
      live.flatMap((item) => item.problem.topics.map((t) => t.topic.slug)),
    );
    const relevant = [...topicSlugs]
      .map((slug) => masteryBySlug.get(slug))
      .filter((value): value is number => value !== undefined);
    const mastery = relevant.length
      ? relevant.reduce((a, b) => a + b, 0) / relevant.length
      : 0;

    const unlocked = previousCompletion >= UNLOCK_THRESHOLD;
    const nextUp = problems.find((p) => p.isCore && p.status !== 'SOLVED') ?? null;

    output.push({
      track: section.track,
      slug: section.slug,
      title: section.title,
      description: section.description,
      outcome: section.outcome,
      icon: section.icon,
      order: section.order,
      lesson: section.lesson,
      blocks: section.blocks.map((b) => ({
        kind: b.kind,
        heading: b.heading,
        body: b.body,
        order: b.order,
      })),
      keyPatterns: section.keyPatterns,
      commonPitfall: section.commonPitfall,
      typicalTime: section.typicalTime,
      typicalSpace: section.typicalSpace,
      problemCount: problems.length,
      coreTotal: core.length,
      coreSolved,
      completion: Number(completion.toFixed(3)),
      mastery: Number(mastery.toFixed(2)),
      unlocked,
      problems,
      nextUp,
    });

    previousCompletionByTrack[section.track] = completion;
  }

  return output;
}

/**
 * "Things to improve" — a ranked, actionable list.
 *
 * Every entry names a concrete next action. A dashboard that says "your DP is
 * weak" without saying what to do about it is a scoreboard, not a mentor.
 */
export async function getImprovementAreas(userId: string): Promise<ImprovementArea[]> {
  const [masteries, profile, misconceptions, snapshots, metrics, hintUnlocks, solvedCount] =
    await Promise.all([
      prisma.topicMastery.findMany({
        where: { userId },
        include: { topic: { select: { slug: true, name: true } } },
        orderBy: { mastery: 'asc' },
      }),
      prisma.learnerProfile.findUnique({ where: { userId } }),
      prisma.misconceptionFlag.findMany({
        where: { userId, resolvedAt: null },
        orderBy: { occurrences: 'desc' },
        take: 4,
      }),
      prisma.qualitySnapshot.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      prisma.sessionMetrics.findMany({
        where: { session: { userId } },
        orderBy: { updatedAt: 'desc' },
        take: 12,
      }),
      prisma.hintUnlock.count({ where: { userId } }),
      prisma.submission.findMany({
        where: { userId, verdict: 'ACCEPTED' },
        distinct: ['problemId'],
        select: { problemId: true },
      }),
    ]);

  const areas: ImprovementArea[] = [];

  // ── weak topics ────────────────────────────────────────────────────────
  for (const mastery of masteries.filter((m) => m.attempts >= 1 && m.mastery < 0.55).slice(0, 3)) {
    const next = await prisma.problem.findFirst({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        isGenerated: false,
        topics: { some: { topicId: mastery.topicId } },
        id: { notIn: solvedCount.map((s) => s.problemId) },
      },
      orderBy: [{ difficulty: 'asc' }, { acceptanceRate: 'desc' }],
      select: { slug: true },
    });

    areas.push({
      kind: 'topic',
      title: mastery.topic.name,
      detail:
        `${Math.round(mastery.mastery * 100)}% mastery across ${mastery.attempts} ` +
        `attempt${mastery.attempts === 1 ? '' : 's'}` +
        (mastery.decayAt && mastery.decayAt < new Date() ? ' — and decaying from disuse.' : '.'),
      action: next
        ? `Practise it next with a problem you have not seen.`
        : `Revisit the problems you have already solved in this topic without hints.`,
      severity: mastery.mastery < 0.3 ? 'high' : 'medium',
      metric: Number(mastery.mastery.toFixed(2)),
      problemSlug: next?.slug ?? null,
    });
  }

  // ── code quality dimensions ────────────────────────────────────────────
  if (snapshots.length >= 3) {
    const mean = (pick: (s: (typeof snapshots)[number]) => number): number =>
      snapshots.reduce((sum, s) => sum + pick(s), 0) / snapshots.length;

    const dimensions = [
      { key: 'efficiency', label: 'Efficiency', value: mean((s) => s.efficiency),
        action: 'Before you code, write down the target complexity from the constraints, then check your loops against it.' },
      { key: 'readability', label: 'Readability', value: mean((s) => s.readability),
        action: 'Name variables after what they hold, and keep functions under ~40 lines.' },
      { key: 'robustness', label: 'Robustness', value: mean((s) => s.robustness),
        action: 'Start every solution by asking what happens on empty input and a single element.' },
      { key: 'correctness', label: 'Correctness', value: mean((s) => s.correctness),
        action: 'Trace one sample by hand before running — it catches most logic slips faster than the judge does.' },
      { key: 'structure', label: 'Structure', value: mean((s) => s.structure),
        action: 'Extract repeated blocks into a helper rather than copying them.' },
    ].sort((a, b) => a.value - b.value);

    const weakest = dimensions[0];
    if (weakest && weakest.value < 78) {
      areas.push({
        kind: 'quality',
        title: `${weakest.label} in your submitted code`,
        detail: `Averaging ${Math.round(weakest.value)}/100 across your last ${snapshots.length} submissions.`,
        action: weakest.action,
        severity: weakest.value < 60 ? 'high' : 'medium',
        metric: Math.round(weakest.value),
        problemSlug: null,
      });
    }
  }

  // ── hint dependency ────────────────────────────────────────────────────
  const solved = solvedCount.length;
  if (solved >= 3 && profile && profile.hintDependency > 0.45) {
    areas.push({
      kind: 'behaviour',
      title: 'Reaching for hints early',
      detail: `You have unlocked ${hintUnlocks} hints across ${solved} solved problems.`,
      action: 'Next problem, set a 10-minute timer before opening a hint. Being stuck is where the learning happens.',
      severity: profile.hintDependency > 0.7 ? 'high' : 'medium',
      metric: Number(profile.hintDependency.toFixed(2)),
      problemSlug: null,
    });
  }

  // ── behavioural: rewrite churn ─────────────────────────────────────────
  const churn = metrics.filter((m) => m.backspaceRatio > 0.4);
  if (metrics.length >= 4 && churn.length >= metrics.length / 2) {
    areas.push({
      kind: 'behaviour',
      title: 'Coding before deciding',
      detail: `In ${churn.length} of your last ${metrics.length} sessions you deleted more than you kept.`,
      action: 'Write the approach as three comment lines first, then fill them in. It cuts rewriting sharply.',
      severity: 'medium',
      metric: null,
      problemSlug: null,
    });
  }

  // ── recurring specific mistakes ────────────────────────────────────────
  for (const flag of misconceptions.slice(0, 2)) {
    areas.push({
      kind: 'misconception',
      title: flag.code.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      detail: `Seen ${flag.occurrences} time${flag.occurrences === 1 ? '' : 's'}. This is a pattern, not a one-off.`,
      action: 'Fix the pattern rather than the line — write the rule down somewhere you will see it again.',
      severity: flag.occurrences >= 4 ? 'high' : 'medium',
      metric: flag.occurrences,
      problemSlug: null,
    });
  }

  // Nothing to improve is itself worth saying — but only honestly.
  if (areas.length === 0) {
    areas.push({
      kind: 'topic',
      title: solved === 0 ? 'Solve your first problem' : 'Nothing is flagged right now',
      detail:
        solved === 0
          ? 'The improvement tracker needs a few submissions before it can say anything useful.'
          : 'Your mastery, code quality and habits are all in reasonable shape.',
      action: solved === 0 ? 'Start with an Easy array problem.' : 'Push into a harder difficulty band.',
      severity: 'low',
      metric: null,
      problemSlug: null,
    });
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return areas.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 7);
}
