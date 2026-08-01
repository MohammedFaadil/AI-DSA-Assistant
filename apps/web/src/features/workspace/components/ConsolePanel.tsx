'use client';

import { CheckCircle2, Loader2, Lock, XCircle } from 'lucide-react';
import type { TestResult } from '@repo/contracts';
import { VERDICT_LABELS, cn, formatMemory, formatMs, verdictTone } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/workspace.store';

export function ConsolePanel() {
  const execution = useWorkspaceStore((s) => s.execution);

  if (execution.status === 'idle') {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-xs text-ink-500">
          Run against the sample tests, or submit to run every test including the hidden ones.
        </p>
      </div>
    );
  }

  if (execution.status === 'queued' || execution.status === 'running') {
    const pct = execution.total ? (execution.completed / execution.total) * 100 : 0;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
        <div className="flex items-center gap-2 text-sm text-ink-300">
          <Loader2 className="h-4 w-4 animate-spin text-accent-soft" />
          {execution.status === 'queued'
            ? 'Queued…'
            : `Running test ${execution.completed} of ${execution.total}`}
        </div>
        <div className="h-1 w-56 overflow-hidden rounded-full bg-ink-800">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${Math.max(6, pct)}%` }}
          />
        </div>
      </div>
    );
  }

  const accepted = execution.verdict === 'ACCEPTED';

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className={cn('text-sm font-semibold', verdictTone(execution.verdict ?? 'PENDING'))}>
          {accepted ? (
            <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
          ) : (
            <XCircle className="mr-1.5 inline h-4 w-4" />
          )}
          {VERDICT_LABELS[execution.verdict ?? 'PENDING']}
        </span>
        <span className="text-xs text-ink-400">
          {execution.passedTests}/{execution.total} passed
        </span>
        {execution.runtimeMs !== null ? (
          <span className="font-mono text-xs text-ink-500">{formatMs(execution.runtimeMs)}</span>
        ) : null}
        {execution.memoryKb !== null ? (
          <span className="font-mono text-xs text-ink-500">
            {formatMemory(execution.memoryKb)}
          </span>
        ) : null}
      </div>

      {execution.compileOutput ? (
        <pre className="mb-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-hard/25 bg-hard/5 p-3 font-mono text-[11px] leading-relaxed text-hard">
          {execution.compileOutput}
        </pre>
      ) : null}

      {execution.errorMessage && !execution.compileOutput ? (
        <div className="mb-3 rounded-lg border border-hard/25 bg-hard/5 px-3 py-2 text-xs text-hard">
          {execution.errorMessage}
        </div>
      ) : null}

      <div className="space-y-1.5">
        {execution.results.map((result) => (
          <TestRow key={result.order} result={result} />
        ))}
      </div>

      {accepted ? (
        <div className="mt-4 rounded-lg border border-easy/25 bg-easy/8 px-3 py-2.5 text-xs text-easy">
          Accepted. Ask the mentor for a review — working and good are different things.
        </div>
      ) : null}
    </div>
  );
}

function TestRow({ result }: { result: TestResult }) {
  const passed = result.verdict === 'ACCEPTED';

  return (
    <details
      className={cn(
        'group rounded-lg border',
        passed ? 'border-ink-700 bg-ink-900/60' : 'border-hard/25 bg-hard/5',
      )}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs">
        {passed ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-easy" />
        ) : (
          <XCircle className="h-3.5 w-3.5 shrink-0 text-hard" />
        )}
        <span className="text-ink-300">Test {result.order + 1}</span>
        {result.hidden ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-ink-500">
            <Lock className="h-2.5 w-2.5" />
            hidden
          </span>
        ) : null}
        <span className={cn('ml-auto font-mono text-[10px]', verdictTone(result.verdict))}>
          {result.verdict.replace(/_/g, ' ').toLowerCase()}
        </span>
        {result.runtimeMs !== null ? (
          <span className="font-mono text-[10px] text-ink-500">{formatMs(result.runtimeMs)}</span>
        ) : null}
      </summary>

      {/* Hidden-test payloads never reach the client — the API strips them in
          the serializer, so there is nothing here to reveal. */}
      {result.hidden ? (
        <p className="px-3 pb-2.5 text-[11px] text-ink-500">
          This test&rsquo;s input is hidden. Its verdict and timing are shown so you can still
          reason about what failed.
        </p>
      ) : (
        <div className="grid gap-2 px-3 pb-2.5 text-[11px] sm:grid-cols-3">
          <Field label="Input" value={result.input} />
          <Field label="Expected" value={result.expectedOutput} />
          <Field label="Got" value={result.stdout} tone={passed ? undefined : 'bad'} />
          {result.stderr ? (
            <div className="sm:col-span-3">
              <Field label="stderr" value={result.stderr} tone="bad" />
            </div>
          ) : null}
        </div>
      )}
    </details>
  );
}

function Field({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | null;
  tone?: 'bad';
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-500">{label}</div>
      <pre
        className={cn(
          'max-h-24 overflow-auto whitespace-pre-wrap rounded border border-ink-800 bg-ink-950 p-2 font-mono',
          tone === 'bad' ? 'text-hard' : 'text-ink-200',
        )}
      >
        {value ?? '—'}
      </pre>
    </div>
  );
}
