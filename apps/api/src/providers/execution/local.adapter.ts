import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Language, Verdict } from '@repo/contracts';
import { isProd } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import {
  outputsMatch,
  type CaseOutcome,
  type ExecutionOutcome,
  type ExecutionProvider,
  type ExecutionRequest,
  type ProgressFn,
} from './types.js';

/**
 * LOCAL DEVELOPMENT EXECUTION PROVIDER — NOT A SANDBOX.
 *
 * This runs submitted code as a normal child process on the host with only a
 * wall-clock timeout. It exists so the whole platform is runnable end to end
 * with zero API keys and zero Judge0 quota while you build.
 *
 * It refuses to start when NODE_ENV=production. Do not remove that check: in a
 * multi-user deployment this would be arbitrary remote code execution. Real
 * isolation is Judge0's job (isolate + cgroups), which is why production uses
 * the Judge0 adapter.
 */
const RUNNERS: Partial<Record<Language, { file: string; cmd: string[][] }>> = {
  PYTHON: { file: 'main.py', cmd: [['python'], ['py', '-3'], ['python3']] },
  JAVASCRIPT: { file: 'main.js', cmd: [['node']] },
};

/**
 * Windows ships App Execution Alias stubs for `python`/`python3` that spawn
 * successfully, print this to stderr and exit non-zero. Without recognising it
 * we would report every submission as a runtime error instead of moving on to
 * a real interpreter.
 */
const STORE_ALIAS = /Python was not found|Microsoft Store|App execution aliases/i;

/** Resolved once per language at first use, then cached. */
const resolved = new Map<Language, string[] | null>();

function probe(candidate: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const [cmd, ...pre] = candidate;
    const child = spawn(cmd!, [...pre, '--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve(false);
    }, 5000);

    child.stdout.on('data', (d: Buffer) => (output += d.toString()));
    child.stderr.on('data', (d: Buffer) => (output += d.toString()));
    child.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(code === 0 && !STORE_ALIAS.test(output));
    });
  });
}

async function resolveInterpreter(language: Language, candidates: string[][]): Promise<string[] | null> {
  if (resolved.has(language)) return resolved.get(language) ?? null;
  for (const candidate of candidates) {
    if (await probe(candidate)) {
      resolved.set(language, candidate);
      logger.info({ language, interpreter: candidate.join(' ') }, 'local runner resolved');
      return candidate;
    }
  }
  resolved.set(language, null);
  logger.warn({ language }, 'no local interpreter found for this language');
  return null;
}

export class LocalAdapter implements ExecutionProvider {
  readonly name = 'local';
  readonly supportedLanguages = Object.keys(RUNNERS) as Language[];

  constructor() {
    if (isProd) {
      throw new Error(
        'The local execution provider cannot run in production. Set EXECUTION_PROVIDER=judge0.',
      );
    }
    logger.warn(
      'Using the LOCAL execution provider: submitted code runs unsandboxed on this machine. Development only.',
    );
  }

  async healthy(): Promise<boolean> {
    return !isProd;
  }

  async execute(req: ExecutionRequest, onProgress?: ProgressFn): Promise<ExecutionOutcome> {
    const runner = RUNNERS[req.language];
    if (!runner) {
      return {
        verdict: 'INTERNAL_ERROR',
        passed: 0,
        total: req.cases.length,
        runtimeMs: null,
        memoryKb: null,
        compileOutput: null,
        errorMessage: `The local development runner only supports ${this.supportedLanguages.join(
          ', ',
        )}. Set EXECUTION_PROVIDER=judge0 or piston to run ${req.language}.`,
        cases: [],
        providerRef: null,
      };
    }

    const interpreter = await resolveInterpreter(req.language, runner.cmd);
    if (!interpreter) {
      return {
        verdict: 'INTERNAL_ERROR',
        passed: 0,
        total: req.cases.length,
        runtimeMs: null,
        memoryKb: null,
        compileOutput: null,
        errorMessage:
          `No working ${req.language} interpreter was found on PATH. Install it, or set ` +
          `EXECUTION_PROVIDER=judge0 to run code remotely.`,
        cases: [],
        providerRef: null,
      };
    }

    const dir = await mkdtemp(join(tmpdir(), 'adm-exec-'));
    const file = join(dir, runner.file);
    await writeFile(file, req.code, 'utf8');

    const cases: CaseOutcome[] = [];
    let passed = 0;
    let maxRuntime = 0;
    let firstFailure: Verdict | null = null;

    try {
      for (const [i, testCase] of req.cases.entries()) {
        const started = Date.now();
        const result = await this.runOnce(interpreter, file, testCase.input, req.timeLimitMs);
        const runtimeMs = Date.now() - started;
        maxRuntime = Math.max(maxRuntime, runtimeMs);

        let verdict: Verdict;
        if (result.timedOut) verdict = 'TIME_LIMIT_EXCEEDED';
        else if (result.spawnFailed) verdict = 'INTERNAL_ERROR';
        else if (result.code !== 0) verdict = 'RUNTIME_ERROR';
        else if (outputsMatch(result.stdout, testCase.expectedOutput)) verdict = 'ACCEPTED';
        else verdict = 'WRONG_ANSWER';

        if (verdict === 'ACCEPTED') passed += 1;
        else if (!firstFailure) firstFailure = verdict;

        cases.push({
          caseId: testCase.id,
          index: testCase.index,
          verdict,
          runtimeMs,
          memoryKb: null,
          stdout: result.stdout.slice(0, 2048),
          stderr: result.stderr.slice(0, 2048) || null,
        });
        onProgress?.(i + 1, req.cases.length, verdict);
      }
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }

    return {
      verdict: firstFailure ?? 'ACCEPTED',
      passed,
      total: req.cases.length,
      runtimeMs: maxRuntime || null,
      memoryKb: null,
      compileOutput: null,
      errorMessage:
        firstFailure === 'RUNTIME_ERROR' ? (cases.find((c) => c.stderr)?.stderr ?? null) : null,
      cases,
      providerRef: null,
    };
  }

  private runOnce(
    interpreter: string[],
    file: string,
    stdin: string,
    timeLimitMs: number,
  ): Promise<{ stdout: string; stderr: string; code: number; timedOut: boolean; spawnFailed: boolean }> {
    return new Promise((resolve) => {
      const [cmd, ...preArgs] = interpreter;
      const child = spawn(cmd!, [...preArgs, file], { stdio: ['pipe', 'pipe', 'pipe'] });

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let settled = false;

      const settle = (result: {
        stdout: string;
        stderr: string;
        code: number;
        timedOut: boolean;
        spawnFailed: boolean;
      }): void => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, Math.max(1000, timeLimitMs * 3));

      child.stdout.on('data', (d: Buffer) => {
        if (stdout.length < 1_000_000) stdout += d.toString();
      });
      child.stderr.on('data', (d: Buffer) => {
        if (stderr.length < 100_000) stderr += d.toString();
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        settle({ stdout: '', stderr: err.message, code: 1, timedOut: false, spawnFailed: true });
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        settle({ stdout, stderr, code: code ?? 1, timedOut, spawnFailed: false });
      });

      // Submitted programs may not read stdin at all; an EPIPE here is normal
      // and must not surface as a judge error.
      child.stdin.on('error', () => undefined);
      child.stdin.write(stdin);
      child.stdin.end();
    });
  }
}
