import { prisma } from '@repo/db';
import type { ConceptEnvelope } from '@repo/contracts';
import { notFound } from '../../lib/errors.js';

export interface ConceptEnvelopeInput {
  requestId: string;
  userId: string;
  sectionSlug: string;
  userMessage?: string | null;
}

/**
 * Builds the AI Training envelope — deliberately not a repurposed
 * ContextEnvelope. There is no Problem, no solutionFingerprint, and no
 * `policy` object here: a curriculum tutor conversation has nothing to
 * protect, so it is unconditionally open by construction rather than gated
 * by an assist-mode policy the way problem-solving mentor turns are.
 */
export async function buildConceptEnvelope(input: ConceptEnvelopeInput): Promise<ConceptEnvelope> {
  const [section, conversation, profile, masteries, misconceptions] = await Promise.all([
    prisma.curriculumSection.findUnique({
      where: { slug: input.sectionSlug },
      select: {
        title: true,
        lesson: true,
        keyPatterns: true,
        commonPitfall: true,
        blocks: { orderBy: { order: 'asc' }, select: { heading: true, body: true } },
      },
    }),
    prisma.curriculumConversation.findFirst({
      where: { userId: input.userId, section: { slug: input.sectionSlug } },
      select: {
        summary: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: { role: true, content: true },
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

  if (!section) throw notFound('That curriculum section does not exist.', 'NOT_FOUND');

  // A digest, not the raw lesson dump — same truncation discipline as the
  // problem-solving envelope's recentMessages (envelope.builder.ts).
  const lessonDigest = [
    section.lesson,
    ...section.blocks.map((b) => `${b.heading}: ${b.body}`),
  ]
    .join('\n\n')
    .slice(0, 6000);

  const strong = masteries.filter((m) => m.mastery >= 0.7).map((m) => m.topic.slug);
  const weak = masteries.filter((m) => m.mastery < 0.4).map((m) => m.topic.slug);

  return {
    v: 1,
    requestId: input.requestId,
    userId: input.userId,
    userMessage: input.userMessage ?? null,
    section: {
      slug: input.sectionSlug,
      title: section.title,
      lessonDigest,
      keyPatterns: section.keyPatterns,
      commonPitfall: section.commonPitfall,
    },
    history: {
      hintsUsed: [],
      attemptCount: 0,
      recentMessages: (conversation?.messages ?? [])
        .slice()
        .reverse()
        .map((m) => ({ role: m.role, content: m.content.slice(0, 1500), agent: null })),
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
  };
}
