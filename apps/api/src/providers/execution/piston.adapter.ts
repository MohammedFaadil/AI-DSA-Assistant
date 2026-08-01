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

/**
 * Piston (emkc.org) fallback.
 *
 * Piston has no batch endpoint and rate-limits to roughly 5 requests/second,
 * so tests run sequentially with pacing. It exists as the failover for when
 * Judge0's daily quota is exhausted — slower, but "slow" beats "submissions
 * are broken today".
 */
const PISTON_LANGS: Record<Language, { language: string; version: string; file: string }> = {
  PYTHON: { language: 'python', version: '3.10.0', file: 'main.py' },
  JAVASCRIPT: { language: 'javascript', version: '18.15.0', file: 'main.js' },
  TYPESCRIPT: { language: 'typescript', version: '5.0.3', file: 'main.ts' },
  C: { language: 'c', version: '10.2.0', file: 'main.c' },
  CPP: { language: 'c++', version: '10.2.0', file: 'main.cpp' },
  JAVA: { language: 'java', version: '15.0.2', file: 'Main.java' },
  CSHARP: { language: 'csharp', version: '6.12.0', file: 'main.cs' },
  GO: { language: 'go', version: '1.16.2', file: 'main.go' },
  RUST: { language: 'rust', version: '1.68.2', file: 'main.rs' },
  PHP: { language: 'php', version: '8.2.3', file: 'main.php' },
  KOTLIN: { language: 'kotlin', version: '1.8.20', file: 'Main.kt' },
  SWIFT: { language: 'swift', version: '5.3.3', file: 'main.swift' },
};

interface PistonResponse {
  compile?: { stdout: string; stderr: string; code: number };
  run?: { stdout: string; stderr: string; code: number; signal: string | null };
}

export class PistonAdapter implements ExecutionProvider {
  readonly name = 'piston';
  readonly supportedLanguages = Object.keys(PISTON_LANGS) as Language[];

  async healthy(): Promise<boolean> {
    try {
      const res = await request(`${env.PISTON_URL}/runtimes`, { method: 'GET', headersTimeout: 5000 });
      return res.statusCode < 400;
    } catch {
      return false;
    }
  }

  async execute(req: ExecutionRequest, onProgress?: ProgressFn): Promise<ExecutionOutcome> {
    const spec = PISTON_LANGS[req.language];
    const cases: CaseOutcome[] = [];
    let passed = 0;
    let maxRuntime = 0;
    let compileOutput: string | null = null;
    let firstFailure: Verdict | null = null;

    for (const [i, testCase] of req.cases.entries()) {
      // ~4 req/s to stay inside the public instance's limit.
      if (i > 0) await new Promise((r) => setTimeout(r, 250));

      const started = Date.now();
      let body: PistonResponse;
      try {
        const res = await request(`${env.PISTON_URL}/execute`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            language: spec.language,
            version: spec.version,
            files: [{ name: spec.file, content: req.code }],
            stdin: testCase.input,
            run_timeout: Math.min(10_000, req.timeLimitMs * 3),
            compile_timeout: 10_000,
          }),
          headersTimeout: 20_000,
        });
        if (res.statusCode >= 400) {
          throw providerError('EXECUTION_PROVIDER_ERROR', `Piston returned ${res.statusCode}.`);
        }
        body = (await res.body.json()) as PistonResponse;
      } catch (err) {
        logger.error({ err }, 'piston execute failed');
        throw providerError('EXECUTION_PROVIDER_ERROR', 'Could not reach the code execution service.', err);
      }

      const runtimeMs = Date.now() - started;
      maxRuntime = Math.max(maxRuntime, runtimeMs);

      let verdict: Verdict;
      if (body.compile && body.compile.code !== 0) {
        verdict = 'COMPILATION_ERROR';
        compileOutput ??= body.compile.stderr || body.compile.stdout;
      } else if (body.run?.signal === 'SIGKILL') {
        verdict = 'TIME_LIMIT_EXCEEDED';
      } else if ((body.run?.code ?? 1) !== 0) {
        verdict = 'RUNTIME_ERROR';
      } else if (outputsMatch(body.run?.stdout ?? '', testCase.expectedOutput)) {
        verdict = 'ACCEPTED';
      } else {
        verdict = 'WRONG_ANSWER';
      }

      if (verdict === 'ACCEPTED') passed += 1;
      else if (!firstFailure) firstFailure = verdict;

      cases.push({
        caseId: testCase.id,
        index: testCase.index,
        verdict,
        runtimeMs,
        memoryKb: null,
        stdout: body.run?.stdout ?? null,
        stderr: body.run?.stderr ?? null,
      });

      onProgress?.(i + 1, req.cases.length, verdict);
      if (verdict === 'COMPILATION_ERROR') break; // no point running the rest
    }

    return {
      verdict: firstFailure ?? 'ACCEPTED',
      passed,
      total: req.cases.length,
      runtimeMs: maxRuntime || null,
      memoryKb: null,
      compileOutput,
      errorMessage: firstFailure === 'COMPILATION_ERROR' ? compileOutput : null,
      cases,
      providerRef: null,
    };
  }
}
