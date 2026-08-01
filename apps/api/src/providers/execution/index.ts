import type { Language } from '@repo/contracts';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { Judge0Adapter } from './judge0.adapter.js';
import { PistonAdapter } from './piston.adapter.js';
import { LocalAdapter } from './local.adapter.js';
import type { ExecutionOutcome, ExecutionProvider, ExecutionRequest, ProgressFn } from './types.js';

export * from './types.js';

/**
 * Provider selection with automatic failover.
 *
 * Execution quota is the tightest user-facing limit on free tier, so a
 * provider outage or exhausted quota must degrade to the next adapter rather
 * than fail the submission (ADR-007).
 */
class ExecutionRouter {
  private readonly chain: ExecutionProvider[] = [];
  private readonly failures = new Map<string, { count: number; openUntil: number }>();

  constructor() {
    const primary = env.EXECUTION_PROVIDER;
    if (primary === 'judge0') this.chain.push(new Judge0Adapter(), new PistonAdapter());
    else if (primary === 'piston') this.chain.push(new PistonAdapter(), new Judge0Adapter());
    else this.chain.push(new LocalAdapter());

    logger.info(
      { chain: this.chain.map((p) => p.name) },
      'execution provider chain configured',
    );
  }

  get primaryName(): string {
    return this.chain[0]?.name ?? 'none';
  }

  supports(language: Language): boolean {
    return this.chain.some((p) => p.supportedLanguages.includes(language));
  }

  private isOpen(name: string): boolean {
    const state = this.failures.get(name);
    return state !== undefined && state.openUntil > Date.now();
  }

  private recordFailure(name: string): void {
    const state = this.failures.get(name) ?? { count: 0, openUntil: 0 };
    state.count += 1;
    // Five consecutive failures opens the breaker for a minute. Without this a
    // dead provider burns the whole retry budget on every request.
    if (state.count >= 5) {
      state.openUntil = Date.now() + 60_000;
      state.count = 0;
      logger.warn({ provider: name }, 'execution provider circuit opened');
    }
    this.failures.set(name, state);
  }

  private recordSuccess(name: string): void {
    this.failures.delete(name);
  }

  async execute(req: ExecutionRequest, onProgress?: ProgressFn): Promise<ExecutionOutcome> {
    let lastError: unknown;

    for (const provider of this.chain) {
      if (this.isOpen(provider.name)) continue;
      if (!provider.supportedLanguages.includes(req.language)) continue;
      try {
        const outcome = await provider.execute(req, onProgress);
        this.recordSuccess(provider.name);
        return outcome;
      } catch (err) {
        lastError = err;
        this.recordFailure(provider.name);
        logger.warn({ provider: provider.name, err }, 'execution provider failed, trying next');
      }
    }
    throw lastError ?? new Error('No execution provider available for this language.');
  }

  async health(): Promise<{ provider: string; healthy: boolean }[]> {
    return Promise.all(
      this.chain.map(async (p) => ({ provider: p.name, healthy: await p.healthy() })),
    );
  }
}

export const executionRouter = new ExecutionRouter();

/** Monaco + display metadata, kept next to the provider so they can't drift. */
export const LANGUAGE_INFO: Record<
  Language,
  { label: string; version: string; monacoId: string; ext: string }
> = {
  PYTHON: { label: 'Python 3', version: '3.10', monacoId: 'python', ext: 'py' },
  JAVASCRIPT: { label: 'JavaScript', version: 'Node 18', monacoId: 'javascript', ext: 'js' },
  TYPESCRIPT: { label: 'TypeScript', version: '5.0', monacoId: 'typescript', ext: 'ts' },
  CPP: { label: 'C++', version: 'GCC 10', monacoId: 'cpp', ext: 'cpp' },
  C: { label: 'C', version: 'GCC 10', monacoId: 'c', ext: 'c' },
  JAVA: { label: 'Java', version: 'OpenJDK 15', monacoId: 'java', ext: 'java' },
  CSHARP: { label: 'C#', version: 'Mono 6', monacoId: 'csharp', ext: 'cs' },
  GO: { label: 'Go', version: '1.16', monacoId: 'go', ext: 'go' },
  RUST: { label: 'Rust', version: '1.68', monacoId: 'rust', ext: 'rs' },
  PHP: { label: 'PHP', version: '8.2', monacoId: 'php', ext: 'php' },
  KOTLIN: { label: 'Kotlin', version: '1.8', monacoId: 'kotlin', ext: 'kt' },
  SWIFT: { label: 'Swift', version: '5.3', monacoId: 'swift', ext: 'swift' },
};
