import { randomUUID } from 'node:crypto';
import { prisma } from '@repo/db';
import type { ResponseBlock, TeachConversationDto, TeachMessageDto, TeachResponse } from '@repo/contracts';
import { AppError, notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { aiService } from '../../providers/ai/aiService.client.js';
import { buildConceptEnvelope } from '../ai/conceptEnvelope.builder.js';

function blocksToText(blocks: ResponseBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'text':
        case 'question':
          return b.content;
        case 'code':
          return `\`\`\`${b.language}\n${b.content}\n\`\`\``;
        case 'diagnostic':
          return `**${b.severity}:** ${b.message}`;
        case 'complexity':
          return `Current: ${b.current} · Target: ${b.target}\n\n${b.explanation}`;
        case 'hint':
          return `**Hint ${b.level}.** ${b.content}`;
      }
    })
    .join('\n\n');
}

async function conversationFor(userId: string, sectionId: string) {
  const existing = await prisma.curriculumConversation.findUnique({
    where: { userId_sectionId: { userId, sectionId } },
  });
  if (existing) return existing;
  return prisma.curriculumConversation.create({ data: { userId, sectionId } });
}

async function sectionBySlug(slug: string) {
  const section = await prisma.curriculumSection.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true, lesson: true, keyPatterns: true },
  });
  if (!section) throw notFound('That curriculum section does not exist.', 'NOT_FOUND');
  return section;
}

export interface TeachTurnResult {
  message: TeachMessageDto;
  readyForPractice: boolean;
}

/**
 * A Stage-2 teaching turn — always maximally open (see conceptEnvelope.builder
 * and apps/ai/app/agents/teach.py), and always terminates in something
 * useful: if every model provider is unavailable, fall back to the section's
 * own authored lesson content rather than an error toast, mirroring
 * ai.service.ts's authoredHintFallback philosophy.
 */
export async function runTeachingTurn(
  userId: string,
  sectionSlug: string,
  content: string,
): Promise<TeachTurnResult> {
  const requestId = randomUUID();
  const section = await sectionBySlug(sectionSlug);
  const conversation = await conversationFor(userId, section.id);

  await prisma.curriculumMessage.create({
    data: { conversationId: conversation.id, role: 'USER', content: content.slice(0, 4000) },
  });

  const envelope = await buildConceptEnvelope({
    requestId,
    userId,
    sectionSlug,
    userMessage: content,
  });

  let turn: TeachResponse;
  try {
    turn = await aiService.teach(envelope, { requestId });
  } catch (err) {
    const code = err instanceof AppError ? err.code : 'AI_PROVIDER_ERROR';
    logger.warn({ err, code, sectionSlug }, 'teaching turn fell back to authored lesson content');
    turn = authoredTeachingFallback(section.lesson, section.keyPatterns);
  }

  const text = blocksToText(turn.blocks);
  const message = await prisma.curriculumMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: text,
      blocks: turn.blocks as never,
    },
  });

  await prisma.curriculumConversation.update({
    where: { id: conversation.id },
    data: { messageCount: { increment: 2 } },
  });

  return {
    message: {
      id: message.id,
      role: message.role,
      content: text,
      blocks: turn.blocks,
      createdAt: message.createdAt.toISOString(),
    },
    readyForPractice: turn.readyForPractice,
  };
}

function authoredTeachingFallback(lesson: string, keyPatterns: string[]): TeachResponse {
  const blocks: ResponseBlock[] = [
    {
      type: 'text',
      content:
        'The live tutor is unavailable right now, so here is the section’s own lesson content instead.',
    },
    { type: 'text', content: lesson },
  ];
  if (keyPatterns.length) {
    blocks.push({
      type: 'text',
      content: `Recognise it by: ${keyPatterns.join(' · ')}`,
    });
  }
  return { blocks, followUp: null, readyForPractice: false };
}

export async function getTeachingConversation(
  userId: string,
  sectionSlug: string,
): Promise<TeachConversationDto> {
  const section = await sectionBySlug(sectionSlug);
  const conversation = await prisma.curriculumConversation.findUnique({
    where: { userId_sectionId: { userId, sectionId: section.id } },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } },
  });

  if (!conversation) return { id: '', sectionSlug, messages: [] };

  const messages: TeachMessageDto[] = conversation.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    blocks: (m.blocks as ResponseBlock[] | null) ?? null,
    createdAt: m.createdAt.toISOString(),
  }));

  return { id: conversation.id, sectionSlug, messages };
}

export interface HandoffResult {
  problemSlug: string | null;
  problemTitle: string | null;
  practiceGenerateHint: string | null;
}

/** "Practise this now" — the next unsolved core problem in the section, or a
 * Practice Zone prompt hint built from the section's key patterns if every
 * core problem is already solved. */
export async function handoffToPractice(userId: string, sectionSlug: string): Promise<HandoffResult> {
  const section = await prisma.curriculumSection.findUnique({
    where: { slug: sectionSlug },
    select: {
      title: true,
      keyPatterns: true,
      items: {
        where: { isCore: true },
        orderBy: { order: 'asc' },
        include: { problem: { select: { id: true, slug: true, title: true, status: true, deletedAt: true } } },
      },
    },
  });
  if (!section) throw notFound('That curriculum section does not exist.', 'NOT_FOUND');

  const live = section.items.filter(
    (item) => item.problem.status === 'PUBLISHED' && item.problem.deletedAt === null,
  );
  const solved = new Set(
    (
      await prisma.submission.findMany({
        where: { userId, verdict: 'ACCEPTED', problemId: { in: live.map((i) => i.problem.id) } },
        distinct: ['problemId'],
        select: { problemId: true },
      })
    ).map((s) => s.problemId),
  );

  const next = live.find((item) => !solved.has(item.problem.id));
  if (next) {
    return { problemSlug: next.problem.slug, problemTitle: next.problem.title, practiceGenerateHint: null };
  }

  return {
    problemSlug: null,
    problemTitle: null,
    practiceGenerateHint: section.keyPatterns[0] ?? `a problem about ${section.title}`,
  };
}
