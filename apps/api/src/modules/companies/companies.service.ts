import { prisma } from '@repo/db';
import type { CompanyListItem, CompanyProfileDto } from '@repo/contracts';
import { notFound } from '../../lib/errors.js';

export async function listCompanies(): Promise<CompanyListItem[]> {
  const companies = await prisma.company.findMany({
    orderBy: { name: 'asc' },
    select: {
      slug: true,
      name: true,
      logoUrl: true,
      profile: { select: { companyId: true } },
      _count: { select: { problems: true } },
    },
  });

  return companies.map((c) => ({
    slug: c.slug,
    name: c.name,
    logoUrl: c.logoUrl,
    problemCount: c._count.problems,
    hasProfile: c.profile !== null,
  }));
}

export async function getCompanyProfile(slug: string, userId?: string): Promise<CompanyProfileDto> {
  const company = await prisma.company.findUnique({
    where: { slug },
    include: {
      profile: true,
      problems: {
        orderBy: { frequency: 'desc' },
        include: { problem: { select: { slug: true, title: true, difficulty: true, status: true, deletedAt: true } } },
      },
    },
  });
  if (!company) throw notFound('That company does not exist.', 'NOT_FOUND');

  const isSaved = userId
    ? (await prisma.savedCompanyProfile.findUnique({
        where: { userId_companyId: { userId, companyId: company.id } },
      })) !== null
    : false;

  return {
    slug: company.slug,
    name: company.name,
    logoUrl: company.logoUrl,
    overview: company.profile?.overview ?? null,
    interviewProcess: company.profile?.interviewProcess ?? null,
    focusAreas: company.profile?.focusAreas ?? [],
    prepTips: company.profile?.prepTips ?? null,
    questions: company.problems
      .filter((pc) => pc.problem.status === 'PUBLISHED' && pc.problem.deletedAt === null)
      .map((pc) => ({
        problemSlug: pc.problem.slug,
        problemTitle: pc.problem.title,
        difficulty: pc.problem.difficulty,
        frequency: pc.frequency,
      })),
    isSaved,
  };
}
