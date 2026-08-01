import { Prisma, prisma } from '@repo/db';
import type { LibraryEntry, SaveSolutionInput } from '@repo/contracts';
import { notFound } from '../../lib/errors.js';

/**
 * The Library: a problem plus the answer the learner chose to keep.
 *
 * Deliberately distinct from Submission (every attempt, an audit trail) and from
 * Bookmark (a to-do marker). Saving is an editorial act — "this is the version I
 * want to remember" — so it stores the code, the strength reading at save time,
 * and the learner's own note about why it works.
 */
export async function saveSolution(
  userId: string,
  input: SaveSolutionInput,
): Promise<LibraryEntry> {
  const problem = await prisma.problem.findFirst({
    where: {
      id: input.problemId,
      deletedAt: null,
      // A learner may save their own generated problems, but not someone else's.
      OR: [{ isGenerated: false }, { isGenerated: true, generatedFor: userId }],
    },
    select: { id: true },
  });
  if (!problem) throw notFound('That problem does not exist.', 'PROBLEM_NOT_FOUND');

  // Enrich from the most recent run so the saved entry carries its verdict and
  // measured runtime rather than just raw text.
  const latest = await prisma.submission.findFirst({
    where: input.submissionId
      ? { id: input.submissionId, userId }
      : { userId, problemId: input.problemId, mode: 'SUBMIT' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, verdict: true, runtimeMs: true, inferredComplexity: true },
  });

  const snapshot = await prisma.qualitySnapshot.findFirst({
    where: { userId, problemId: input.problemId },
    orderBy: { createdAt: 'desc' },
    select: { overall: true },
  });

  const existing = await prisma.savedSolution.findUnique({
    where: { userId_problemId: { userId, problemId: input.problemId } },
    select: { revision: true },
  });

  const saved = await prisma.savedSolution.upsert({
    where: { userId_problemId: { userId, problemId: input.problemId } },
    update: {
      language: input.language,
      code: input.code,
      verdict: latest?.verdict ?? null,
      runtimeMs: latest?.runtimeMs ?? null,
      qualityScore: snapshot?.overall ?? null,
      complexity: latest?.inferredComplexity ?? null,
      // Absent note/tags mean "leave what I wrote before" rather than "clear it".
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      revision: (existing?.revision ?? 0) + 1,
      savedFromSubmissionId: latest?.id ?? null,
    },
    create: {
      userId,
      problemId: input.problemId,
      language: input.language,
      code: input.code,
      verdict: latest?.verdict ?? null,
      runtimeMs: latest?.runtimeMs ?? null,
      qualityScore: snapshot?.overall ?? null,
      complexity: latest?.inferredComplexity ?? null,
      note: input.note ?? null,
      tags: input.tags ?? [],
      savedFromSubmissionId: latest?.id ?? null,
    },
  });

  return toEntry(await hydrate(saved.id));
}

type Hydrated = Prisma.SavedSolutionGetPayload<{
  include: {
    problem: {
      select: {
        slug: true;
        title: true;
        difficulty: true;
        isGenerated: true;
        topics: { select: { topic: { select: { slug: true } } } };
      };
    };
  };
}>;

async function hydrate(id: string): Promise<Hydrated> {
  return prisma.savedSolution.findUniqueOrThrow({
    where: { id },
    include: {
      problem: {
        select: {
          slug: true,
          title: true,
          difficulty: true,
          isGenerated: true,
          topics: { select: { topic: { select: { slug: true } } } },
        },
      },
    },
  });
}

function toEntry(row: Hydrated): LibraryEntry {
  return {
    id: row.id,
    problemId: row.problemId,
    problemSlug: row.problem.slug,
    problemTitle: row.problem.title,
    difficulty: row.problem.difficulty,
    topics: row.problem.topics.map((t) => t.topic.slug),
    language: row.language,
    code: row.code,
    verdict: row.verdict,
    runtimeMs: row.runtimeMs,
    qualityScore: row.qualityScore,
    complexity: row.complexity,
    note: row.note,
    tags: row.tags,
    revision: row.revision,
    isGenerated: row.problem.isGenerated,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listLibrary(
  userId: string,
  query: { search?: string; difficulty?: 'EASY' | 'MEDIUM' | 'HARD'; tag?: string; sort: 'recent' | 'quality' | 'title' },
): Promise<{ items: LibraryEntry[]; tags: string[]; total: number }> {
  const where: Prisma.SavedSolutionWhereInput = { userId };
  if (query.tag) where.tags = { has: query.tag };
  if (query.search || query.difficulty) {
    where.problem = {
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
    };
  }

  const orderBy: Prisma.SavedSolutionOrderByWithRelationInput =
    query.sort === 'quality'
      ? { qualityScore: 'desc' }
      : query.sort === 'title'
        ? { problem: { title: 'asc' } }
        : { updatedAt: 'desc' };

  const [rows, all] = await Promise.all([
    prisma.savedSolution.findMany({
      where,
      orderBy,
      take: 200,
      include: {
        problem: {
          select: {
            slug: true,
            title: true,
            difficulty: true,
            isGenerated: true,
            topics: { select: { topic: { select: { slug: true } } } },
          },
        },
      },
    }),
    // Facets come from the whole library, not the filtered view — otherwise
    // selecting a tag hides every other tag and the filter becomes a dead end.
    prisma.savedSolution.findMany({ where: { userId }, select: { tags: true } }),
  ]);

  const tags = [...new Set(all.flatMap((row) => row.tags))].sort();
  return { items: rows.map(toEntry), tags, total: rows.length };
}

export async function getEntry(userId: string, problemId: string): Promise<LibraryEntry | null> {
  const row = await prisma.savedSolution.findUnique({
    where: { userId_problemId: { userId, problemId } },
    include: {
      problem: {
        select: {
          slug: true,
          title: true,
          difficulty: true,
          isGenerated: true,
          topics: { select: { topic: { select: { slug: true } } } },
        },
      },
    },
  });
  return row ? toEntry(row) : null;
}

export async function updateEntry(
  userId: string,
  problemId: string,
  patch: { note?: string; tags?: string[] },
): Promise<LibraryEntry> {
  const result = await prisma.savedSolution.updateMany({
    where: { userId, problemId },
    data: patch,
  });
  if (result.count === 0) throw notFound('That library entry does not exist.');

  const row = await prisma.savedSolution.findUniqueOrThrow({
    where: { userId_problemId: { userId, problemId } },
    select: { id: true },
  });
  return toEntry(await hydrate(row.id));
}

export async function removeEntry(userId: string, problemId: string): Promise<void> {
  const result = await prisma.savedSolution.deleteMany({ where: { userId, problemId } });
  if (result.count === 0) throw notFound('That library entry does not exist.');
}

/* ── Bookmarks: the lighter "come back to this" marker ────────────────────*/

export async function toggleBookmark(
  userId: string,
  problemId: string,
): Promise<{ bookmarked: boolean }> {
  const existing = await prisma.bookmark.findUnique({
    where: { userId_problemId: { userId, problemId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    return { bookmarked: false };
  }
  await prisma.bookmark.create({ data: { userId, problemId } });
  return { bookmarked: true };
}

export async function listBookmarks(userId: string) {
  const rows = await prisma.bookmark.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      problem: {
        select: {
          id: true,
          slug: true,
          title: true,
          difficulty: true,
          acceptanceRate: true,
          topics: { select: { topic: { select: { slug: true, name: true } } } },
        },
      },
    },
  });

  return rows.map((row) => ({
    problemId: row.problem.id,
    slug: row.problem.slug,
    title: row.problem.title,
    difficulty: row.problem.difficulty,
    acceptanceRate: Number(row.problem.acceptanceRate.toFixed(1)),
    topics: row.problem.topics.map((t) => ({ slug: t.topic.slug, name: t.topic.name })),
    createdAt: row.createdAt.toISOString(),
  }));
}

/* ── Notes ────────────────────────────────────────────────────────────────*/

export async function upsertNote(userId: string, problemId: string, content: string) {
  const note = await prisma.note.upsert({
    where: { userId_problemId: { userId, problemId } },
    update: { content },
    create: { userId, problemId, content },
  });
  return { content: note.content, updatedAt: note.updatedAt.toISOString() };
}

export async function getNote(userId: string, problemId: string) {
  const note = await prisma.note.findUnique({
    where: { userId_problemId: { userId, problemId } },
  });
  return note ? { content: note.content, updatedAt: note.updatedAt.toISOString() } : null;
}

/* ── Saved curriculum sections ───────────────────────────────────────────
 * Always joins the live section (slug/title/track), never a snapshot, so a
 * saved entry stays in sync with the section automatically. */

export async function saveSection(userId: string, sectionSlug: string) {
  const section = await prisma.curriculumSection.findUnique({ where: { slug: sectionSlug } });
  if (!section) throw notFound('That curriculum section does not exist.', 'NOT_FOUND');
  await prisma.savedCurriculumSection.upsert({
    where: { userId_sectionId: { userId, sectionId: section.id } },
    update: {},
    create: { userId, sectionId: section.id },
  });
  return { saved: true };
}

export async function removeSavedSection(userId: string, sectionSlug: string): Promise<void> {
  const section = await prisma.curriculumSection.findUnique({ where: { slug: sectionSlug } });
  if (!section) throw notFound('That curriculum section does not exist.', 'NOT_FOUND');
  await prisma.savedCurriculumSection.deleteMany({ where: { userId, sectionId: section.id } });
}

export async function listSavedSections(userId: string) {
  const rows = await prisma.savedCurriculumSection.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { section: { select: { slug: true, title: true, track: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    sectionSlug: row.section.slug,
    sectionTitle: row.section.title,
    track: row.section.track,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  }));
}

/* ── Saved companies ─────────────────────────────────────────────────────*/

export async function saveCompany(userId: string, companySlug: string) {
  const company = await prisma.company.findUnique({ where: { slug: companySlug } });
  if (!company) throw notFound('That company does not exist.', 'NOT_FOUND');
  await prisma.savedCompanyProfile.upsert({
    where: { userId_companyId: { userId, companyId: company.id } },
    update: {},
    create: { userId, companyId: company.id },
  });
  return { saved: true };
}

export async function removeSavedCompany(userId: string, companySlug: string): Promise<void> {
  const company = await prisma.company.findUnique({ where: { slug: companySlug } });
  if (!company) throw notFound('That company does not exist.', 'NOT_FOUND');
  await prisma.savedCompanyProfile.deleteMany({ where: { userId, companyId: company.id } });
}

export async function listSavedCompanies(userId: string) {
  const rows = await prisma.savedCompanyProfile.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { company: { select: { slug: true, name: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    companySlug: row.company.slug,
    companyName: row.company.name,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  }));
}
