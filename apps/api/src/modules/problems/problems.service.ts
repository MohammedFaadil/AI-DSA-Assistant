import { Prisma, prisma } from '@repo/db';
import type {
  Language,
  ProblemDetail,
  ProblemListQuery,
  ProblemsGrouped,
  ProblemSummary,
  ProblemUserStatus,
} from '@repo/contracts';
import { forbidden, notFound } from '../../lib/errors.js';
import { metaCache, problemCache } from '../../lib/cache.js';
import { LANGUAGE_INFO } from '../../providers/execution/index.js';

const STARTER_LANGUAGES: Language[] = ['PYTHON', 'JAVASCRIPT', 'CPP', 'JAVA'];

/**
 * Per-user solve state for a set of problems, in one query.
 *
 * Computed separately from the list query so an anonymous request never pays
 * for it, and so the list query itself stays a simple indexed scan.
 */
async function userStatuses(
  userId: string | undefined,
  problemIds: string[],
): Promise<Map<string, ProblemUserStatus>> {
  const map = new Map<string, ProblemUserStatus>();
  if (!userId || problemIds.length === 0) return map;

  const rows = await prisma.submission.groupBy({
    by: ['problemId', 'verdict'],
    where: { userId, problemId: { in: problemIds }, mode: 'SUBMIT' },
    _count: { _all: true },
  });

  for (const row of rows) {
    if (row.verdict === 'ACCEPTED') map.set(row.problemId, 'SOLVED');
    else if (!map.has(row.problemId)) map.set(row.problemId, 'ATTEMPTED');
  }
  return map;
}

export async function listProblems(query: ProblemListQuery, userId?: string) {
  const where: Prisma.ProblemWhereInput = {
    status: 'PUBLISHED',
    deletedAt: null,
    // Practice Zone problems are real Problems so the workspace works on them
    // unchanged, but they belong to one learner and must never appear in the
    // shared catalogue. They are listed from /v1/practice instead.
    isGenerated: false,
  };

  if (query.difficulty?.length) where.difficulty = { in: query.difficulty };
  if (query.search) where.title = { contains: query.search, mode: 'insensitive' };

  // Topic filter is AND: "show me problems that are BOTH arrays AND hashing".
  if (query.topics?.length) {
    where.AND = query.topics.map((slug) => ({ topics: { some: { topic: { slug } } } }));
  }
  // Company filter is OR: "asked at Google OR Amazon".
  if (query.companies?.length) {
    where.companies = { some: { company: { slug: { in: query.companies } } } };
  }

  const orderBy: Prisma.ProblemOrderByWithRelationInput[] = [];
  switch (query.sort) {
    case 'difficulty':
      orderBy.push({ difficulty: query.order }, { title: 'asc' });
      break;
    case 'acceptance':
      orderBy.push({ acceptanceRate: query.order });
      break;
    case 'newest':
      orderBy.push({ publishedAt: query.order === 'asc' ? 'asc' : 'desc' });
      break;
    default:
      orderBy.push({ createdAt: 'asc' });
  }

  const [total, rows] = await Promise.all([
    prisma.problem.count({ where }),
    prisma.problem.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { topics: { include: { topic: { select: { slug: true, name: true } } } } },
    }),
  ]);

  const statuses = await userStatuses(
    userId,
    rows.map((r) => r.id),
  );

  let items: ProblemSummary[] = rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    difficulty: p.difficulty,
    acceptanceRate: Number(p.acceptanceRate.toFixed(1)),
    totalSubmissions: p.totalSubmissions,
    isPremium: p.isPremium,
    topics: p.topics.map((t) => ({ slug: t.topic.slug, name: t.topic.name })),
    userStatus: statuses.get(p.id) ?? (userId ? 'TODO' : null),
  }));

  // Status filtering happens after hydration because it depends on an
  // aggregate over Submission that Prisma cannot express as a relation filter
  // without a correlated subquery. The page size is bounded at 100, so this is
  // a filter over at most 100 rows.
  if (query.status && userId) {
    items = items.filter((i) => i.userStatus === query.status);
  }

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getProblemBySlug(slug: string, userId?: string): Promise<ProblemDetail> {
  // Generated problems are private to one learner, so they are never served
  // from the shared cache and their ownership is checked on every read.
  const owner = await prisma.problem.findFirst({
    where: { slug },
    select: { isGenerated: true, generatedFor: true },
  });
  if (owner?.isGenerated && owner.generatedFor !== userId) {
    throw notFound('That problem does not exist.', 'PROBLEM_NOT_FOUND');
  }
  const isPrivate = owner?.isGenerated === true;

  const cacheKey = `problem:${slug}`;
  const cached = isPrivate ? undefined : (problemCache.get(cacheKey) as ProblemDetail | undefined);

  const base =
    cached ??
    (await (async (): Promise<ProblemDetail> => {
      const p = await prisma.problem.findFirst({
        where: { slug, status: 'PUBLISHED', deletedAt: null },
        include: {
          examples: { orderBy: { order: 'asc' } },
          topics: { include: { topic: { select: { slug: true, name: true } } } },
          companies: {
            include: { company: true },
            orderBy: { frequency: 'desc' },
          },
          // Only sample tests are ever selected here. Hidden rows have no path
          // to a client response because no user-facing query asks for them.
          testCases: { where: { isHidden: false }, orderBy: { index: 'asc' } },
          starterCodes: { select: { language: true } },
          editorial: { select: { id: true } },
          _count: { select: { hints: true } },
        },
      });
      if (!p) throw notFound('That problem does not exist.', 'PROBLEM_NOT_FOUND');

      const detail: ProblemDetail = {
        id: p.id,
        slug: p.slug,
        title: p.title,
        difficulty: p.difficulty,
        acceptanceRate: Number(p.acceptanceRate.toFixed(1)),
        totalSubmissions: p.totalSubmissions,
        isPremium: p.isPremium,
        topics: p.topics.map((t) => ({ slug: t.topic.slug, name: t.topic.name })),
        userStatus: null,
        statement: p.statement,
        constraints: p.constraints,
        expectedTimeComplexity: p.expectedTimeComplexity,
        expectedSpaceComplexity: p.expectedSpaceComplexity,
        timeLimitMs: p.timeLimitMs,
        memoryLimitKb: p.memoryLimitKb,
        companies: p.companies.map((c) => ({
          slug: c.company.slug,
          name: c.company.name,
          logoUrl: c.company.logoUrl,
          frequency: c.frequency,
        })),
        examples: p.examples.map((e) => ({
          order: e.order,
          input: e.input,
          output: e.output,
          explanation: e.explanation,
          imageUrl: e.imageUrl,
        })),
        sampleTests: p.testCases.map((t) => ({
          id: t.id,
          index: t.index,
          input: t.input,
          expectedOutput: t.expectedOutput,
        })),
        hintCount: p._count.hints,
        hasEditorial: p.editorial !== null,
        languages: p.starterCodes
          .map((s) => s.language)
          .filter((l) => STARTER_LANGUAGES.includes(l)),
        likeCount: p.likeCount,
        dislikeCount: p.dislikeCount,
        isBookmarked: false,
      };
      if (!isPrivate) problemCache.set(cacheKey, detail, 10 * 60_000);
      return detail;
    })());

  // Per-user fields are applied to a copy so the cached object stays neutral.
  if (!userId) return { ...base, userStatus: null, isBookmarked: false };

  const [statuses, bookmark] = await Promise.all([
    userStatuses(userId, [base.id]),
    prisma.bookmark.findUnique({
      where: { userId_problemId: { userId, problemId: base.id } },
      select: { id: true },
    }),
  ]);

  return {
    ...base,
    userStatus: statuses.get(base.id) ?? 'TODO',
    isBookmarked: bookmark !== null,
  };
}

export async function getStarterCode(slug: string, language: Language): Promise<string> {
  const key = `starter:${slug}:${language}`;
  const cached = metaCache.get(key) as string | undefined;
  if (cached !== undefined) return cached;

  const problem = await prisma.problem.findUnique({ where: { slug }, select: { id: true } });
  if (!problem) throw notFound('That problem does not exist.', 'PROBLEM_NOT_FOUND');

  const row = await prisma.starterCode.findUnique({
    where: { problemId_language: { problemId: problem.id, language } },
  });
  const code = row?.code ?? '';
  metaCache.set(key, code, 60 * 60_000);
  return code;
}

/**
 * Hint metadata. Content for a level is returned only once that level has been
 * unlocked — the client is never trusted to hide it.
 */
export async function getHints(slug: string, userId?: string) {
  const problem = await prisma.problem.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: { id: true, hints: { orderBy: { level: 'asc' } } },
  });
  if (!problem) throw notFound('That problem does not exist.', 'PROBLEM_NOT_FOUND');

  const unlocked = userId
    ? new Set(
        (
          await prisma.hintUnlock.findMany({
            where: { userId, problemId: problem.id },
            select: { level: true },
          })
        ).map((h) => h.level),
      )
    : new Set<number>();

  const hints = problem.hints.map((h) => ({
    level: h.level,
    unlocked: unlocked.has(h.level),
    content: unlocked.has(h.level) ? h.content : null,
  }));

  const nextLevel = hints.find((h) => !h.unlocked)?.level ?? null;
  return { hints, nextLevel };
}

export async function unlockHint(slug: string, level: number, userId: string) {
  const problem = await prisma.problem.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: { id: true, hints: { where: { level }, take: 1 } },
  });
  if (!problem) throw notFound('That problem does not exist.', 'PROBLEM_NOT_FOUND');

  const hint = problem.hints[0];
  if (!hint) throw notFound('That hint level does not exist.');

  await prisma.hintUnlock.upsert({
    where: { userId_problemId_level: { userId, problemId: problem.id, level } },
    update: {},
    create: { userId, problemId: problem.id, hintId: hint.id, level, source: 'USER_REQUEST' },
  });

  // Hint dependency is a first-class signal: it feeds trigger thresholds and
  // the Progress Agent's narrative, so it is updated at the moment of unlock.
  await recomputeHintDependency(userId);

  return { level, content: hint.content };
}

async function recomputeHintDependency(userId: string): Promise<void> {
  const [unlocks, solved] = await Promise.all([
    prisma.hintUnlock.count({ where: { userId } }),
    prisma.submission.findMany({
      where: { userId, verdict: 'ACCEPTED', mode: 'SUBMIT' },
      distinct: ['problemId'],
      select: { problemId: true },
    }),
  ]);
  const denominator = Math.max(1, solved.length);
  await prisma.learnerProfile.updateMany({
    where: { userId },
    data: { hintDependency: Math.min(1, unlocks / (denominator * 3)) },
  });
}

export async function getEditorial(slug: string, userId?: string) {
  const problem = await prisma.problem.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: { id: true, editorial: true },
  });
  if (!problem?.editorial) throw notFound('No editorial for this problem yet.');

  if (problem.editorial.isLockedUntilSolved) {
    const solved = userId
      ? await prisma.submission.findFirst({
          where: { userId, problemId: problem.id, verdict: 'ACCEPTED' },
          select: { id: true },
        })
      : null;
    if (!solved) {
      throw forbidden('Solve this problem first to unlock the editorial.');
    }
  }

  return {
    approachSummary: problem.editorial.approachSummary,
    content: problem.editorial.content,
    timeComplexity: problem.editorial.timeComplexity,
    spaceComplexity: problem.editorial.spaceComplexity,
    videoUrl: problem.editorial.videoUrl,
  };
}

export async function getFacets() {
  return metaCache.wrap('facets', 60 * 60_000, async () => {
    const [topics, companies] = await Promise.all([
      prisma.topic.findMany({
        orderBy: { order: 'asc' },
        select: { slug: true, name: true, _count: { select: { problems: true } } },
      }),
      prisma.company.findMany({
        orderBy: { name: 'asc' },
        select: { slug: true, name: true, logoUrl: true, _count: { select: { problems: true } } },
      }),
    ]);
    return {
      topics: topics
        .filter((t) => t._count.problems > 0)
        .map((t) => ({ slug: t.slug, name: t.name, count: t._count.problems })),
      companies: companies
        .filter((c) => c._count.problems > 0)
        .map((c) => ({ slug: c.slug, name: c.name, logoUrl: c.logoUrl, count: c._count.problems })),
      languages: STARTER_LANGUAGES.map((l) => ({
        language: l,
        label: LANGUAGE_INFO[l].label,
        version: LANGUAGE_INFO[l].version,
        monacoId: LANGUAGE_INFO[l].monacoId,
        fileExtension: LANGUAGE_INFO[l].ext,
      })),
    };
  });
}

export async function getDailyProblem(userId?: string): Promise<ProblemDetail | null> {
  const daily = await prisma.problem.findFirst({
    where: { isDaily: true, status: 'PUBLISHED' },
    select: { slug: true },
  });
  return daily ? getProblemBySlug(daily.slug, userId) : null;
}

/**
 * Recommendations are driven by mastery decay, not by a static list — the
 * weakest, least recently practised topics surface first (docs 04 §3.5).
 */
export async function getRecommended(userId: string, limit = 10) {
  const weak = await prisma.topicMastery.findMany({
    where: { userId },
    orderBy: [{ mastery: 'asc' }, { lastPracticedAt: 'asc' }],
    take: 4,
    select: { topicId: true },
  });

  const solvedIds = (
    await prisma.submission.findMany({
      where: { userId, verdict: 'ACCEPTED' },
      distinct: ['problemId'],
      select: { problemId: true },
    })
  ).map((s) => s.problemId);

  const rows = await prisma.problem.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      isGenerated: false,
      id: { notIn: solvedIds.length ? solvedIds : ['__none__'] },
      ...(weak.length
        ? { topics: { some: { topicId: { in: weak.map((w) => w.topicId) } } } }
        : {}),
    },
    orderBy: [{ difficulty: 'asc' }, { acceptanceRate: 'desc' }],
    take: limit,
    include: { topics: { include: { topic: { select: { slug: true, name: true } } } } },
  });

  return rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    difficulty: p.difficulty,
    acceptanceRate: Number(p.acceptanceRate.toFixed(1)),
    totalSubmissions: p.totalSubmissions,
    isPremium: p.isPremium,
    topics: p.topics.map((t) => ({ slug: t.topic.slug, name: t.topic.name })),
    userStatus: 'TODO' as const,
  }));
}

/**
 * Problems grouped by curriculum section — the Problems page's "By section"
 * view. Reads the same CurriculumSection/CurriculumItem data the Curriculum
 * page reads, so the two pages stay structurally in sync with nothing extra
 * to fall out of date.
 */
export async function listProblemsGroupedBySection(userId?: string): Promise<ProblemsGrouped> {
  const [sections, allPublished] = await Promise.all([
    prisma.curriculumSection.findMany({
      orderBy: [{ track: 'asc' }, { order: 'asc' }],
      select: {
        slug: true,
        title: true,
        track: true,
        order: true,
        items: {
          orderBy: { order: 'asc' },
          include: {
            problem: {
              include: { topics: { include: { topic: { select: { slug: true, name: true } } } } },
            },
          },
        },
      },
    }),
    prisma.problem.findMany({
      where: { status: 'PUBLISHED', deletedAt: null, isGenerated: false },
      select: { id: true },
    }),
  ]);

  const assignedIds = new Set(
    sections.flatMap((s) => s.items.map((i) => i.problem.id)).filter(Boolean),
  );
  const allIds = allPublished.map((p) => p.id);
  const statuses = await userStatuses(userId, allIds);

  const toSummary = (p: {
    id: string;
    slug: string;
    title: string;
    difficulty: ProblemSummary['difficulty'];
    acceptanceRate: number;
    totalSubmissions: number;
    isPremium: boolean;
    topics: { topic: { slug: string; name: string } }[];
  }): ProblemSummary => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    difficulty: p.difficulty,
    acceptanceRate: Number(p.acceptanceRate.toFixed(1)),
    totalSubmissions: p.totalSubmissions,
    isPremium: p.isPremium,
    topics: p.topics.map((t) => ({ slug: t.topic.slug, name: t.topic.name })),
    userStatus: statuses.get(p.id) ?? (userId ? 'TODO' : null),
  });

  const groupedSections = sections
    .map((s) => ({
      sectionSlug: s.slug,
      sectionTitle: s.title,
      track: s.track,
      order: s.order,
      problems: s.items
        .filter((i) => i.problem.status === 'PUBLISHED' && i.problem.deletedAt === null)
        .map((i) => toSummary(i.problem)),
    }))
    .filter((s) => s.problems.length > 0);

  const unassigned = await prisma.problem.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      isGenerated: false,
      id: { notIn: [...assignedIds] },
    },
    include: { topics: { include: { topic: { select: { slug: true, name: true } } } } },
  });

  return {
    sections: groupedSections,
    unassigned: unassigned.map((p) => toSummary(p)),
  };
}
