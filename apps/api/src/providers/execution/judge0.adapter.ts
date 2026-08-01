import { request } from 'undici';
import type { Language, Verdict } from '@repo/contracts';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { providerError } from '../../lib/errors.js';
import {
  outputsMatch,
  type CaseOutcome,
  type ExecutionOutcome,
  type ExecutionProvider,
  type ExecutionRequest,
  type ProgressFn,
} from './types.js';

/** Judge0 CE language ids. Verify against GET /languages on your instance. */
const LANGUAGE_IDS: Record<Language, number> = {
  C: 50,
  CPP: 54,
  JAVA: 62,
  PYTHON: 71,
  CSHARP: 51,
  JAVASCRIPT: 63,
  TYPESCRIPT: 74,
  GO: 60,
  RUST: 73,
  PHP: 68,
  KOTLIN: 78,
  SWIFT: 83,
};

/** Judge0 status.id → our verdict vocabulary. */
function mapStatus(id: number): Verdict {
  switch (id) {
    case 1:
    case 2:
      return 'PENDING';
    case 3:
      return 'ACCEPTED';
    case 4:
      return 'WRONG_ANSWER';
    case 5:
      return 'TIME_LIMIT_EXCEEDED';
    case 6:
      return 'COMPILATION_ERROR';
    case 13:
      return 'INTERNAL_ERROR';
    case 14:
      return 'OUTPUT_LIMIT_EXCEEDED';
    default:
      // 7–12 are the various runtime signals (SIGSEGV, SIGXFSZ, SIGFPE, …).
      return id >= 7 && id <= 12 ? 'RUNTIME_ERROR' : 'INTERNAL_ERROR';
  }
}

const b64 = (s: string): string => Buffer.from(s, 'utf8').toString('base64');
const unb64 = (s: string | null | undefined): string | null =>
  s ? Buffer.from(s, 'base64').toString('utf8') : null;

interface Judge0Submission {
  token: string;
  status?: { id: number; description: string };
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  time?: string | null;
  memory?: number | null;
}

export class Judge0Adapter implements ExecutionProvider {
  readonly name = 'judge0';
  readonly supportedLanguages = Object.keys(LANGUAGE_IDS) as Language[];

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    if (env.JUDGE0_API_KEY) {
      h['X-RapidAPI-Key'] = env.JUDGE0_API_KEY;
      h['X-RapidAPI-Host'] = env.JUDGE0_HOST;
    }
    return h;
  }

  async healthy(): Promise<boolean> {
    try {
      const res = await request(`${env.JUDGE0_URL}/about`, {
        method: 'GET',
        headers: this.headers(),
        headersTimeout: 5000,
      });
      return res.statusCode < 400;
    } catch {
      return false;
    }
  }

  async execute(req: ExecutionRequest, onProgress?: ProgressFn): Promise<ExecutionOutcome> {
    const languageId = LANGUAGE_IDS[req.language];

    // Batch submission — one round trip for N tests instead of N. This matters
    // enormously when the free tier meters *requests*, not CPU time.
    const submissions = req.cases.map((c) => ({
      language_id: languageId,
      source_code: b64(req.code),
      stdin: b64(c.input),
      expected_output: b64(c.expectedOutput),
      cpu_time_limit: Math.min(15, req.timeLimitMs / 1000),
      memory_limit: Math.min(512_000, req.memoryLimitKb),
      redirect_stderr_to_stdout: false,
    }));

    let tokens: string[];
    try {
      const res = await request(
        `${env.JUDGE0_URL}/submissions/batch?base64_encoded=true&wait=false`,
        {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ submissions }),
          headersTimeout: 15_000,
        },
      );
      if (res.statusCode >= 400) {
        const text = await res.body.text();
        throw providerError('EXECUTION_PROVIDER_ERROR', `Judge0 rejected the batch (${res.statusCode}).`, text);
      }
      const body = (await res.body.json()) as { token: string }[];
      tokens = body.map((t) => t.token);
    } catch (err) {
      logger.error({ err }, 'judge0 submit failed');
      throw providerError('EXECUTION_PROVIDER_ERROR', 'Could not reach the code execution service.', err);
    }

    const results = await this.pollBatch(tokens, req.cases.length, onProgress);
    return this.assemble(req, results);
  }

  private async pollBatch(
    tokens: string[],
    total: number,
    onProgress?: ProgressFn,
  ): Promise<Judge0Submission[]> {
    const fields = 'token,status,stdout,stderr,compile_output,time,memory';
    const url = `${env.JUDGE0_URL}/submissions/batch?tokens=${tokens.join(',')}&base64_encoded=true&fields=${fields}`;

    // Backoff rather than a tight loop: on free tiers request count is the
    // metered resource, so polling cheaply matters more than polling fast.
    const delays = [400, 400, 600, 800, 1000, 1200, 1500, 2000, 2500, 3000, 3000, 3000];
    let lastReported = 0;

    for (const delay of delays) {
      await new Promise((r) => setTimeout(r, delay));
      const res = await request(url, { method: 'GET', headers: this.headers(), headersTimeout: 10_000 });
      if (res.statusCode >= 400) continue;
      const body = (await res.body.json()) as { submissions: Judge0Submission[] };
      const subs = body.submissions ?? [];
      const done = subs.filter((s) => (s.status?.id ?? 1) > 2);

      if (onProgress && done.length > lastReported) {
        lastReported = done.length;
        const last = done[done.length - 1];
        onProgress(done.length, total, mapStatus(last?.status?.id ?? 13));
      }
      if (done.length === subs.length && subs.length > 0) return subs;
    }

    throw providerError('EXECUTION_PROVIDER_ERROR', 'The execution service timed out.');
  }

  private assemble(req: ExecutionRequest, subs: Judge0Submission[]): ExecutionOutcome {
    const cases: CaseOutcome[] = [];
    let passed = 0;
    let maxRuntime = 0;
    let maxMemory = 0;
    let compileOutput: string | null = null;
    let firstFailure: Verdict | null = null;

    subs.forEach((sub, i) => {
      const testCase = req.cases[i];
      if (!testCase) return;

      let verdict = mapStatus(sub.status?.id ?? 13);
      const stdout = unb64(sub.stdout);
      const stderr = unb64(sub.stderr);
      const compile = unb64(sub.compile_output);

      if (compile && !compileOutput) compileOutput = compile;

      // Judge0's own expected_output comparison is strict about trailing
      // whitespace; re-check with our normalising comparison so a correct
      // solution isn't failed over a newline.
      if (verdict === 'WRONG_ANSWER' && stdout !== null && outputsMatch(stdout, testCase.expectedOutput)) {
        verdict = 'ACCEPTED';
      }

      if (verdict === 'ACCEPTED') passed += 1;
      else if (!firstFailure) firstFailure = verdict;

      const runtimeMs = sub.time ? Math.round(parseFloat(sub.time) * 1000) : null;
      if (runtimeMs) maxRuntime = Math.max(maxRuntime, runtimeMs);
      if (sub.memory) maxMemory = Math.max(maxMemory, sub.memory);

      cases.push({
        caseId: testCase.id,
        index: testCase.index,
        verdict,
        runtimeMs,
        memoryKb: sub.memory ?? null,
        stdout,
        stderr,
      });
    });

    return {
      verdict: firstFailure ?? 'ACCEPTED',
      passed,
      total: req.cases.length,
      runtimeMs: maxRuntime || null,
      memoryKb: maxMemory || null,
      compileOutput,
      errorMessage: firstFailure === 'COMPILATION_ERROR' ? compileOutput : null,
      cases,
      providerRef: subs[0]?.token ?? null,
    };
  }
}
