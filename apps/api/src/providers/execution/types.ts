import type { Language, Verdict } from '@repo/contracts';

export interface ExecutionCase {
  id: string;
  index: number;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface ExecutionRequest {
  language: Language;
  code: string;
  cases: ExecutionCase[];
  timeLimitMs: number;
  memoryLimitKb: number;
}

export interface CaseOutcome {
  caseId: string;
  index: number;
  verdict: Verdict;
  runtimeMs: number | null;
  memoryKb: number | null;
  stdout: string | null;
  stderr: string | null;
}

export interface ExecutionOutcome {
  verdict: Verdict;
  passed: number;
  total: number;
  runtimeMs: number | null;
  memoryKb: number | null;
  compileOutput: string | null;
  errorMessage: string | null;
  cases: CaseOutcome[];
  providerRef: string | null;
}

/**
 * Anti-corruption layer over code execution (ADR-007).
 *
 * Judge0's free quota is the tightest user-facing limit in the system, so the
 * concrete provider must be swappable at runtime and every provider must
 * normalise to the same verdict vocabulary.
 */
export interface ExecutionProvider {
  readonly name: string;
  readonly supportedLanguages: Language[];
  execute(req: ExecutionRequest, onProgress?: ProgressFn): Promise<ExecutionOutcome>;
  healthy(): Promise<boolean>;
}

export type ProgressFn = (completed: number, total: number, last: Verdict) => void;

/**
 * Output comparison.
 *
 * Trailing whitespace on each line and trailing blank lines are ignored —
 * every language's print/println differs there, and failing a correct solution
 * over a newline is the fastest way to destroy trust in a judge.
 */
export function outputsMatch(actual: string, expected: string): boolean {
  const norm = (s: string): string =>
    s
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.replace(/\s+$/, ''))
      .join('\n')
      .replace(/\n+$/, '');
  return norm(actual) === norm(expected);
}
