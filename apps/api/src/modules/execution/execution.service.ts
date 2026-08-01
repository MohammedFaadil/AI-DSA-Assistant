import { prisma } from '@repo/db';
import type {
  CreateExecutionInput,
  ExecutionResult,
  Language,
  TestResult,
  Verdict,
} from '@repo/contracts';
import { notFound, unprocessable } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { executionRouter, type ExecutionCase } from '../../providers/execution/index.js';
import { emitTo, executionRoom, sessionRoom, userRoom } from '../../realtime/emitter.js';
import { problemCache } from '../../lib/cache.js';
import { recordSolve } from '../progress/progress.service.js';
import { analyze } from '../ai/ai.service.js';
import { recordQualitySnapshot } from '../ai/aiPerformance.service.js';

/**
 * Serializer + redactor.
 *
 * Hidden-test inputs, expected outputs and stdout are stripped HERE, in the
 * serializer, rather than in each controller — so no future endpoint can leak
 * them by forgetting to strip (docs 05 §4.3).
 */
function toTestResult(
  outcome: { index: number; verdict: Verdict; runtimeMs: number | null; memoryKb: number | null; stdout: string | null; stderr: string | null },
  testCase: { index: number; input: string; expectedOutput: string; isHidden: boolean },
): TestResult {
  if (testCase.isHidden) {
    return {
      order: testCase.index,
      hidden: true,
      verdict: outcome.verdict,
      runtimeMs: outcome.runtimeMs,
      memoryKb: outcome.memoryKb,
      input: null,
      expectedOutput: null,
      stdout: null,
      stderr: null,
    };
  }
  return {
    order: testCase.index,
    hidden: false,
    verdict: outcome.verdict,
    runtimeMs: outcome.runtimeMs,
    memoryKb: outcome.memoryKb,
    input: testCase.input,
    expectedOutput: testCase.expectedOutput,
    stdout: outcome.stdout?.slice(0, 2048) ?? null,
    stderr: outcome.stderr?.slice(0, 2048) ?? null,
  };
}

export interface StartedExecution {
  executionId: string;
  totalTests: number;
  estimatedMs: number;
}

/**
 * Starts an execution and returns immediately.
 *
 * The judge runs in the background and streams progress over the socket. A
 * synchronous request that waited for Judge0 would sit open long enough to be
 * killed by an idle proxy timeout on free tier (docs 03 §5).
 */
export async function startExecution(
  userId: string,
  input: CreateExecutionInput,
): Promise<StartedExecution> {
  const problem = await prisma.problem.findFirst({
    where: { id: input.problemId, status: 'PUBLISHED', deletedAt: null },
    select: {
      id: true,
      timeLimitMs: true,
      memoryLimitKb: true,
      starterCodes: { select: { language: true } },
    },
  });
  if (!problem) throw notFound('That problem does not exist.', 'PROBLEM_NOT_FOUND');

  const offered = problem.starterCodes.map((s) => s.language);
  if (!offered.includes(input.language)) {
    throw unprocessable(`This problem does not offer ${input.language}.`);
  }
  if (!executionRouter.supports(input.language)) {
    throw unprocessable(`No execution provider is configured for ${input.language}.`);
  }

  const testCases = await prisma.testCase.findMany({
    where: {
      problemId: problem.id,
      // RUN sees only the samples; SUBMIT sees everything.
      ...(input.mode === 'RUN' ? { isHidden: false } : {}),
    },
    orderBy: { index: 'asc' },
  });
  if (testCases.length === 0) throw unprocessable('This problem has no test cases yet.');

  const submission = await prisma.submission.create({
    data: {
      userId,
      problemId: problem.id,
      sessionId: input.sessionId ?? null,
      language: input.language,
      code: input.code,
      mode: input.mode,
      status: 'QUEUED',
      verdict: 'PENDING',
      totalTests: testCases.length,
    },
  });

  const cases: ExecutionCase[] = testCases.map((t) => ({
    id: t.id,
    index: t.index,
    input: t.input,
    expectedOutput: t.expectedOutput,
    isHidden: t.isHidden,
  }));

  void runInBackground(submission.id, userId, input, problem, cases, testCases);

  return {
    executionId: submission.id,
    totalTests: testCases.length,
    estimatedMs: 900 + testCases.length * 220,
  };
}

async function runInBackground(
  submissionId: string,
  userId: string,
  input: CreateExecutionInput,
  problem: { id: string; timeLimitMs: number; memoryLimitKb: number },
  cases: ExecutionCase[],
  testCases: { id: string; index: number; input: string; expectedOutput: string; isHidden: boolean }[],
): Promise<void> {
  const room = executionRoom(submissionId);
  emitTo(room, 'exec:queued', { executionId: submissionId, totalTests: cases.length });

  try {
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'RUNNING' },
    });

    const outcome = await executionRouter.execute(
      {
        language: input.language,
        code: input.code,
        cases,
        timeLimitMs: problem.timeLimitMs,
        memoryLimitKb: problem.memoryLimitKb,
      },
      (completed, total, lastVerdict) => {
        emitTo(room, 'exec:update', { executionId: submissionId, completed, total, lastVerdict });
      },
    );

    const byId = new Map(testCases.map((t) => [t.id, t]));
    const results: TestResult[] = outcome.cases
      .map((c) => {
        const tc = byId.get(c.caseId);
        return tc ? toTestResult(c, tc) : null;
      })
      .filter((r): r is TestResult => r !== null);

    await prisma.$transaction(async (tx) => {
      await tx.submission.update({
        where: { id: submissionId },
        data: {
          status: 'COMPLETED',
          verdict: outcome.verdict,
          passedTests: outcome.passed,
          totalTests: outcome.total,
          runtimeMs: outcome.runtimeMs,
          memoryKb: outcome.memoryKb,
          compileOutput: outcome.compileOutput?.slice(0, 8000) ?? null,
          errorMessage: outcome.errorMessage?.slice(0, 2000) ?? null,
          providerRef: outcome.providerRef,
          providerName: executionRouter.primaryName,
          completedAt: new Date(),
        },
      });

      await tx.submissionTestResult.createMany({
        data: outcome.cases.map((c) => ({
          submissionId,
          testCaseId: c.caseId,
          order: c.index,
          verdict: c.verdict,
          runtimeMs: c.runtimeMs,
          memoryKb: c.memoryKb,
          stdout: c.stdout?.slice(0, 2000) ?? null,
          stderr: c.stderr?.slice(0, 2000) ?? null,
        })),
      });

      // Only SUBMIT affects problem statistics — RUN is a scratchpad.
      if (input.mode === 'SUBMIT') {
        const p = await tx.problem.update({
          where: { id: problem.id },
          data: {
            totalSubmissions: { increment: 1 },
            ...(outcome.verdict === 'ACCEPTED' ? { totalAccepted: { increment: 1 } } : {}),
          },
          select: { totalSubmissions: true, totalAccepted: true },
        });
        await tx.problem.update({
          where: { id: problem.id },
          data: {
            acceptanceRate: p.totalSubmissions > 0 ? (p.totalAccepted / p.totalSubmissions) * 100 : 0,
          },
        });
      }
    });

    problemCache.invalidatePrefix('problem:');

    emitTo(room, 'exec:complete', {
      executionId: submissionId,
      verdict: outcome.verdict,
      passedTests: outcome.passed,
      totalTests: outcome.total,
      runtimeMs: outcome.runtimeMs,
      memoryKb: outcome.memoryKb,
      compileOutput: outcome.compileOutput,
      errorMessage: outcome.errorMessage,
      results,
    });
    if (input.sessionId) {
      emitTo(sessionRoom(input.sessionId), 'exec:complete', {
        executionId: submissionId,
        verdict: outcome.verdict,
        passedTests: outcome.passed,
        totalTests: outcome.total,
        runtimeMs: outcome.runtimeMs,
        memoryKb: outcome.memoryKb,
        compileOutput: outcome.compileOutput,
        errorMessage: outcome.errorMessage,
        results,
      });
    }

    // Stats, mastery and badges are applied OUTSIDE the transaction and are
    // idempotent on submissionId, so a failure here never rolls back a valid
    // submission (docs 04 §5).
    if (input.mode === 'SUBMIT') {
      const progress = await recordSolve(userId, problem.id, submissionId, outcome.verdict);
      if (progress) emitTo(userRoom(userId), 'progress:update', progress);

      // One code-strength reading per submission. This is what makes "is my
      // code quality actually improving?" answerable rather than a vibe.
      void captureQuality(userId, problem.id, submissionId, input);
    }
  } catch (err) {
    logger.error({ err, submissionId }, 'execution failed');
    await prisma.submission
      .update({
        where: { id: submissionId },
        data: {
          status: 'FAILED',
          verdict: 'INTERNAL_ERROR',
          errorMessage: 'The execution service could not complete this run.',
          completedAt: new Date(),
        },
      })
      .catch(() => undefined);

    emitTo(room, 'exec:complete', {
      executionId: submissionId,
      verdict: 'INTERNAL_ERROR',
      passedTests: 0,
      totalTests: cases.length,
      runtimeMs: null,
      memoryKb: null,
      compileOutput: null,
      errorMessage: 'The execution service is unavailable. Please try again shortly.',
      results: [],
    });
  }
}

/**
 * Runs the deterministic quality engine over the submitted code and stores the
 * reading. Best-effort: a failed snapshot must never affect the verdict the
 * learner sees.
 */
async function captureQuality(
  userId: string,
  problemId: string,
  submissionId: string,
  input: CreateExecutionInput,
): Promise<void> {
  try {
    const analysis = await analyze({
      userId,
      problemId,
      language: input.language,
      code: input.code,
      assistMode: 'MODERATE',
      behaviour: {
        idleMs: 0,
        editCount: 0,
        backspaces: 0,
        dwellLine: null,
        charsTyped: 0,
        elapsedMs: 0,
        sameErrorCount: 0,
        lastVerdict: null,
        stableForMs: 0,
        previousQuality: null,
      },
      cooldowns: {},
    });

    if (!analysis.quality.measurable) return;

    await Promise.all([
      recordQualitySnapshot(userId, problemId, submissionId, analysis.quality),
      prisma.submission.update({
        where: { id: submissionId },
        data: { inferredComplexity: analysis.signals.inferredTime },
      }),
    ]);
  } catch (err) {
    logger.debug({ err, submissionId }, 'quality snapshot skipped');
  }
}

export async function getExecution(userId: string, id: string): Promise<ExecutionResult> {
  const submission = await prisma.submission.findFirst({
    where: { id, userId },
    include: { results: { include: { testCase: true }, orderBy: { order: 'asc' } } },
  });
  if (!submission) throw notFound('Execution not found.');

  return {
    executionId: submission.id,
    problemId: submission.problemId,
    mode: submission.mode,
    language: submission.language,
    status: submission.status,
    verdict: submission.verdict,
    passedTests: submission.passedTests,
    totalTests: submission.totalTests,
    runtimeMs: submission.runtimeMs,
    memoryKb: submission.memoryKb,
    compileOutput: submission.compileOutput,
    errorMessage: submission.errorMessage,
    inferredComplexity: submission.inferredComplexity,
    results: submission.results.map((r) =>
      toTestResult(
        {
          index: r.order,
          verdict: r.verdict,
          runtimeMs: r.runtimeMs,
          memoryKb: r.memoryKb,
          stdout: r.stdout,
          stderr: r.stderr,
        },
        r.testCase,
      ),
    ),
    createdAt: submission.createdAt.toISOString(),
    completedAt: submission.completedAt?.toISOString() ?? null,
  };
}

export async function listSubmissions(userId: string, problemId?: string, limit = 20) {
  const rows = await prisma.submission.findMany({
    where: { userId, mode: 'SUBMIT', ...(problemId ? { problemId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      problemId: true,
      language: true,
      verdict: true,
      runtimeMs: true,
      memoryKb: true,
      passedTests: true,
      totalTests: true,
      createdAt: true,
      problem: { select: { slug: true, title: true, difficulty: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    problemId: r.problemId,
    problemSlug: r.problem.slug,
    problemTitle: r.problem.title,
    difficulty: r.problem.difficulty,
    language: r.language,
    verdict: r.verdict,
    runtimeMs: r.runtimeMs,
    memoryKb: r.memoryKb,
    passedTests: r.passedTests,
    totalTests: r.totalTests,
    createdAt: r.createdAt.toISOString(),
  }));
}

export function supportedLanguages(): Language[] {
  return ['PYTHON', 'JAVASCRIPT', 'CPP', 'JAVA'];
}
