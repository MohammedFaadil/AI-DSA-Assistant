/* eslint-disable no-console */
import 'dotenv/config';
import { PrismaClient, type Language, type Prisma } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';
import { BADGES, COMPANIES, TOPICS } from './taxonomy.js';
import { COMPANY_PROFILES } from './companyProfiles.js';
import { PROBLEMS } from './problems.js';
import { EXTRA_PROBLEMS } from './problems.extra.js';
import { ADVANCED_PROBLEMS } from './problems.advanced.js';
import { NEW_PROBLEMS } from './problems.new.js';
import { CURRICULUM } from './curriculum.js';
import { CURRICULUM_BLOCKS } from './curriculumBlocks.js';
import { deriveCases } from './verify.js';

const ALL_PROBLEMS = [...PROBLEMS, ...EXTRA_PROBLEMS, ...ADVANCED_PROBLEMS, ...NEW_PROBLEMS];
import { fingerprint } from '../../src/fingerprint.js';
import {
  CPP_STUB_BODY,
  JAVA_STUB_BODY,
  JS_STUB_BODY,
  PY_STUB_BODY,
  cppProgram,
  javaProgram,
  javascriptProgram,
  pythonProgram,
} from '../../src/harness.js';

const prisma = new PrismaClient();

/** Argon2id would need a native dep; scrypt is in Node core and is fine for seeds. */
function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

async function seedTaxonomy() {
  console.log('→ topics');
  // Two passes so parents exist before children reference them.
  for (const t of TOPICS) {
    await prisma.topic.upsert({
      where: { slug: t.slug },
      update: { name: t.name, description: t.description, order: t.order },
      create: { slug: t.slug, name: t.name, description: t.description, order: t.order },
    });
  }
  for (const t of TOPICS.filter((x) => x.parent)) {
    const parent = await prisma.topic.findUnique({ where: { slug: t.parent! } });
    if (parent) {
      await prisma.topic.update({ where: { slug: t.slug }, data: { parentId: parent.id } });
    }
  }

  console.log('→ companies');
  for (const c of COMPANIES) {
    await prisma.company.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: { slug: c.slug, name: c.name },
    });
  }

  console.log('→ badges');
  for (const b of BADGES) {
    await prisma.badge.upsert({
      where: { slug: b.slug },
      update: {
        name: b.name,
        description: b.description,
        icon: b.icon,
        tier: b.tier,
        criteria: b.criteria as Prisma.InputJsonValue,
        xpReward: b.xpReward,
      },
      create: {
        slug: b.slug,
        name: b.name,
        description: b.description,
        icon: b.icon,
        tier: b.tier,
        criteria: b.criteria as Prisma.InputJsonValue,
        xpReward: b.xpReward,
      },
    });
  }
}

async function seedCompanyProfiles() {
  console.log(`→ company profiles (${COMPANY_PROFILES.length})`);
  for (const p of COMPANY_PROFILES) {
    const company = await prisma.company.findUnique({ where: { slug: p.companySlug } });
    if (!company) {
      console.warn(`   ! company profile references unknown company: ${p.companySlug}`);
      continue;
    }
    await prisma.companyProfile.upsert({
      where: { companyId: company.id },
      update: {
        overview: p.overview,
        interviewProcess: p.interviewProcess,
        focusAreas: p.focusAreas,
        prepTips: p.prepTips,
      },
      create: {
        companyId: company.id,
        overview: p.overview,
        interviewProcess: p.interviewProcess,
        focusAreas: p.focusAreas,
        prepTips: p.prepTips,
      },
    });
  }
}

async function seedUsers() {
  console.log('→ users');
  const accounts = [
    {
      email: 'admin@aidsamentor.dev',
      username: 'admin',
      name: 'Platform Admin',
      role: 'ADMIN' as const,
      password: 'Admin123!',
      skillLevel: 'EXPERT' as const,
    },
    {
      email: 'demo@aidsamentor.dev',
      username: 'demo',
      name: 'Demo Learner',
      role: 'USER' as const,
      password: 'Demo123!',
      skillLevel: 'BEGINNER' as const,
    },
  ];

  for (const a of accounts) {
    const user = await prisma.user.upsert({
      where: { email: a.email },
      update: { role: a.role },
      create: {
        email: a.email,
        username: a.username,
        name: a.name,
        role: a.role,
        skillLevel: a.skillLevel,
        passwordHash: hashPassword(a.password),
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
    await prisma.learnerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, skillLevel: a.skillLevel },
    });
    await prisma.userStats.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
    await prisma.streak.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
  }
  console.log('   admin@aidsamentor.dev / Admin123!');
  console.log('   demo@aidsamentor.dev  / Demo123!');
}

const STARTER_LANGUAGES: Language[] = ['PYTHON', 'JAVASCRIPT', 'CPP', 'JAVA'];

let verificationSkipped = 0;

async function seedProblems() {
  console.log(`→ problems (${ALL_PROBLEMS.length})`);

  for (const p of ALL_PROBLEMS) {
    const problem = await prisma.problem.upsert({
      where: { slug: p.slug },
      update: {
        title: p.title,
        difficulty: p.difficulty,
        status: 'PUBLISHED',
        statement: p.statement,
        statementDigest: p.statementDigest,
        constraints: p.constraints,
        constraintsDigest: p.constraintsDigest,
        expectedTimeComplexity: p.expectedTime,
        expectedSpaceComplexity: p.expectedSpace,
        publishedAt: new Date(),
      },
      create: {
        slug: p.slug,
        title: p.title,
        difficulty: p.difficulty,
        status: 'PUBLISHED',
        statement: p.statement,
        statementDigest: p.statementDigest,
        constraints: p.constraints,
        constraintsDigest: p.constraintsDigest,
        expectedTimeComplexity: p.expectedTime,
        expectedSpaceComplexity: p.expectedSpace,
        publishedAt: new Date(),
      },
    });

    // Children are replaced wholesale — the seed is the source of truth.
    await prisma.$transaction([
      prisma.problemExample.deleteMany({ where: { problemId: problem.id } }),
      prisma.testCase.deleteMany({ where: { problemId: problem.id } }),
      prisma.hint.deleteMany({ where: { problemId: problem.id } }),
      prisma.starterCode.deleteMany({ where: { problemId: problem.id } }),
      prisma.referenceSolution.deleteMany({ where: { problemId: problem.id } }),
      prisma.problemTopic.deleteMany({ where: { problemId: problem.id } }),
      prisma.problemCompany.deleteMany({ where: { problemId: problem.id } }),
    ]);

    // Expected outputs — for BOTH the displayed examples and the judged test
    // cases — are DERIVED by running the reference solution. A hand-written
    // value that disagrees fails the seed loudly rather than shipping a wrong
    // number into the problem statement. (This is not hypothetical: an early
    // draft of "Minimum Path Sum" had a hand-typed example output that was
    // simply wrong — this check is what would have caught it.)
    const exampleDerivation = deriveCases(
      p.io,
      p.solution.python,
      p.examples.map((e) => ({ input: e.input, expectedOutput: e.output })),
    );
    if (exampleDerivation.mismatches.length > 0) {
      console.error(`\n✗ ${p.slug}: a displayed EXAMPLE's output disagrees with the reference solution.`);
      for (const m of exampleDerivation.mismatches.slice(0, 4)) {
        console.error(`   input: ${JSON.stringify(m.input)}`);
        console.error(`   declared: ${JSON.stringify(m.declared)}`);
        console.error(`   derived:  ${JSON.stringify(m.derived)}`);
      }
      throw new Error(`${p.slug}: example output and reference solution are inconsistent.`);
    }
    if (!exampleDerivation.verified) verificationSkipped += 1;

    await prisma.problemExample.createMany({
      data: p.examples.map((e, i) => ({
        problemId: problem.id,
        order: i,
        input: e.input,
        // Always the derived value, never the hand-typed one — so even a
        // silently-wrong `output` in problems.ts can never reach a learner.
        output: exampleDerivation.cases[i]?.expectedOutput ?? e.output,
        explanation: e.explanation,
      })),
    });

    const derivation = deriveCases(
      p.io,
      p.solution.python,
      [...p.sampleTests, ...p.hiddenTests].map((t) => ({
        input: t.input,
        expectedOutput: t.expectedOutput,
      })),
    );

    if (derivation.mismatches.length > 0) {
      console.error(`\n✗ ${p.slug}: declared test output disagrees with the reference solution.`);
      for (const m of derivation.mismatches.slice(0, 4)) {
        console.error(`   input: ${JSON.stringify(m.input)}`);
        console.error(`   declared: ${JSON.stringify(m.declared)}`);
        console.error(`   derived:  ${JSON.stringify(m.derived)}`);
      }
      throw new Error(`${p.slug}: test data and reference solution are inconsistent.`);
    }
    if (!derivation.verified) verificationSkipped += 1;

    const sampleCount = p.sampleTests.length;
    await prisma.testCase.createMany({
      data: derivation.cases.map((test, index) => ({
        problemId: problem.id,
        index,
        input: test.input,
        expectedOutput: test.expectedOutput,
        isHidden: index >= sampleCount,
        isSample: index < sampleCount,
      })),
    });

    await prisma.hint.createMany({
      data: p.hints.map((content, i) => ({
        problemId: problem.id,
        level: i + 1,
        content,
      })),
    });

    await prisma.editorial.upsert({
      where: { problemId: problem.id },
      update: {
        approachSummary: p.editorial.approachSummary,
        content: p.editorial.content,
        timeComplexity: p.editorial.timeComplexity,
        spaceComplexity: p.editorial.spaceComplexity,
      },
      create: {
        problemId: problem.id,
        approachSummary: p.editorial.approachSummary,
        content: p.editorial.content,
        timeComplexity: p.editorial.timeComplexity,
        spaceComplexity: p.editorial.spaceComplexity,
      },
    });

    const starters: Record<Language, string> = {
      PYTHON: pythonProgram(p.io, PY_STUB_BODY),
      JAVASCRIPT: javascriptProgram(p.io, JS_STUB_BODY),
      CPP: cppProgram(p.io, CPP_STUB_BODY(p.io.returns)),
      JAVA: javaProgram(p.io, JAVA_STUB_BODY(p.io.returns)),
      C: '',
      CSHARP: '',
      TYPESCRIPT: '',
      GO: '',
      RUST: '',
      PHP: '',
      KOTLIN: '',
      SWIFT: '',
    };

    await prisma.starterCode.createMany({
      data: STARTER_LANGUAGES.map((language) => ({
        problemId: problem.id,
        language,
        code: starters[language],
      })),
    });

    // The full reference program, plus the fingerprint the Response Guard uses.
    const referenceProgram = pythonProgram(p.io, p.solution.python);
    await prisma.referenceSolution.create({
      data: {
        problemId: problem.id,
        language: 'PYTHON',
        approachName: p.solution.approachName,
        code: referenceProgram,
        normalizedTokens: fingerprint(p.solution.python),
        timeComplexity: p.solution.time,
        spaceComplexity: p.solution.space,
        isPrimary: true,
      },
    });

    for (const slug of p.topics) {
      const topic = await prisma.topic.findUnique({ where: { slug } });
      if (topic) {
        await prisma.problemTopic.create({
          data: { problemId: problem.id, topicId: topic.id, relevance: 1 },
        });
      }
    }

    for (const c of p.companies) {
      const company = await prisma.company.findUnique({ where: { slug: c.slug } });
      if (company) {
        await prisma.problemCompany.create({
          data: { problemId: problem.id, companyId: company.id, frequency: c.frequency },
        });
      }
    }
  }

  // Feature the first problem as today's daily.
  await prisma.problem.updateMany({ data: { isDaily: false } });
  await prisma.problem.update({ where: { slug: 'two-sum' }, data: { isDaily: true } });
}

async function seedCurriculum() {
  console.log(`→ curriculum (${CURRICULUM.length} sections)`);

  for (const section of CURRICULUM) {
    const row = await prisma.curriculumSection.upsert({
      where: { slug: section.slug },
      update: {
        track: section.track,
        title: section.title,
        description: section.description,
        outcome: section.outcome,
        icon: section.icon,
        order: section.order,
        lesson: section.lesson,
        keyPatterns: section.keyPatterns,
        commonPitfall: section.commonPitfall,
        typicalTime: section.typicalTime,
        typicalSpace: section.typicalSpace,
      },
      create: {
        track: section.track,
        slug: section.slug,
        title: section.title,
        description: section.description,
        outcome: section.outcome,
        icon: section.icon,
        order: section.order,
        lesson: section.lesson,
        keyPatterns: section.keyPatterns,
        commonPitfall: section.commonPitfall,
        typicalTime: section.typicalTime,
        typicalSpace: section.typicalSpace,
      },
    });

    // Replaced wholesale — the seed is the source of truth for ordering.
    await prisma.curriculumItem.deleteMany({ where: { sectionId: row.id } });

    const entries = [
      ...section.core.map((slug) => ({ slug, isCore: true })),
      ...(section.depth ?? []).map((slug) => ({ slug, isCore: false })),
    ];

    let order = 0;
    const missing: string[] = [];
    for (const entry of entries) {
      const problem = await prisma.problem.findUnique({
        where: { slug: entry.slug },
        select: { id: true },
      });
      if (!problem) {
        missing.push(entry.slug);
        continue;
      }
      await prisma.curriculumItem.create({
        data: {
          sectionId: row.id,
          problemId: problem.id,
          order: order++,
          isCore: entry.isCore,
        },
      });
    }
    if (missing.length) {
      console.warn(`   ! ${section.slug} references unknown problems: ${missing.join(', ')}`);
    }
  }
}

async function seedCurriculumBlocks() {
  const slugs = Object.keys(CURRICULUM_BLOCKS);
  console.log(`→ curriculum blocks (${slugs.length} sections)`);

  for (const slug of slugs) {
    const section = await prisma.curriculumSection.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!section) {
      console.warn(`   ! curriculum blocks reference unknown section: ${slug}`);
      continue;
    }

    // Replaced wholesale — the seed is the source of truth for ordering.
    await prisma.curriculumSectionBlock.deleteMany({ where: { sectionId: section.id } });

    const blocks = CURRICULUM_BLOCKS[slug]!;
    await prisma.curriculumSectionBlock.createMany({
      data: blocks.map((b, order) => ({
        sectionId: section.id,
        kind: b.kind,
        heading: b.heading,
        body: b.body,
        order,
      })),
    });
  }
}

async function main() {
  console.log('Seeding AI DSA Mentor…\n');
  await seedTaxonomy();
  await seedCompanyProfiles();
  await seedUsers();
  await seedProblems();
  await seedCurriculum();
  await seedCurriculumBlocks();

  const byDifficulty = await prisma.problem.groupBy({
    by: ['difficulty'],
    where: { isGenerated: false },
    _count: { _all: true },
  });
  const counts = byDifficulty
    .map((row) => `${row.difficulty.toLowerCase()} ${row._count._all}`)
    .join(' · ');

  console.log(`\nDone. ${counts}`);
  if (verificationSkipped > 0) {
    console.warn(
      `\n! ${verificationSkipped} problem(s) could not be verified: no Python interpreter was ` +
      `found, so declared test outputs were trusted as-is.`,
    );
  } else {
    console.log('All test outputs derived from the reference solutions.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
