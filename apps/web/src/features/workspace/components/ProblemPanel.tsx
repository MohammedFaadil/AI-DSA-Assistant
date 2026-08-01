'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Building2, Clock, Lock, Tag } from 'lucide-react';
import type { ProblemDetail } from '@repo/contracts';
import { api, ApiClientError } from '@/lib/api-client';
import { DIFFICULTY_STYLES, cn, formatMs, relativeTime, renderMarkdown } from '@/lib/utils';

type Tab = 'description' | 'editorial' | 'submissions';

interface SubmissionRow {
  id: string;
  language: string;
  verdict: string;
  runtimeMs: number | null;
  passedTests: number;
  totalTests: number;
  createdAt: string;
}

export function ProblemPanel({ problem }: { problem: ProblemDetail }) {
  const [tab, setTab] = useState<Tab>('description');

  return (
    <div className="flex h-full flex-col bg-ink-900/40">
      <div className="flex shrink-0 gap-1 border-b border-ink-700/70 px-3 py-2">
        {(
          [
            ['description', 'Description'],
            ['editorial', 'Editorial'],
            ['submissions', 'Submissions'],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
              tab === value
                ? 'bg-ink-800 text-ink-100'
                : 'text-ink-400 hover:bg-ink-800/60 hover:text-ink-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {tab === 'description' ? <Description problem={problem} /> : null}
        {tab === 'editorial' ? <Editorial slug={problem.slug} /> : null}
        {tab === 'submissions' ? <Submissions problemId={problem.id} /> : null}
      </div>
    </div>
  );
}

function Description({ problem }: { problem: ProblemDetail }) {
  return (
    <article className="animate-fade-up">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold tracking-tight">{problem.title}</h1>
        <span
          className={cn(
            'rounded border px-2 py-0.5 text-[11px] font-medium uppercase',
            DIFFICULTY_STYLES[problem.difficulty],
          )}
        >
          {problem.difficulty}
        </span>
        {problem.userStatus === 'SOLVED' ? (
          <span className="chip border-easy/30 bg-easy/10 text-easy">Solved</span>
        ) : null}
      </div>

      <div className="mb-5 flex flex-wrap gap-3 text-xs text-ink-400">
        <span>{problem.acceptanceRate}% acceptance</span>
        <span>·</span>
        <span className="font-mono">{problem.expectedTimeComplexity} time</span>
        <span>·</span>
        <span className="font-mono">{problem.expectedSpaceComplexity} space</span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatMs(problem.timeLimitMs)} limit
        </span>
      </div>

      <div
        className="prose-mentor"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.statement) }}
      />

      {problem.examples.length > 0 ? (
        <section className="mt-6">
          <h3>Examples</h3>
          <div className="space-y-3">
            {problem.examples.map((example) => (
              <div
                key={example.order}
                className="overflow-hidden rounded-lg border border-ink-700 bg-ink-900"
              >
                <div className="grid divide-y divide-ink-800 text-xs sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  <div className="p-3">
                    <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-500">
                      Input
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-ink-200">{example.input}</pre>
                  </div>
                  <div className="p-3">
                    <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-500">
                      Output
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-ink-200">
                      {example.output}
                    </pre>
                  </div>
                </div>
                {example.explanation ? (
                  <div className="border-t border-ink-800 px-3 py-2 text-xs text-ink-400">
                    {example.explanation}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <h3>Constraints</h3>
        <div
          className="prose-mentor text-sm"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.constraints) }}
        />
      </section>

      <section className="mt-6 space-y-3">
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-500">
            <Tag className="h-3 w-3" />
            Topics
          </div>
          <div className="flex flex-wrap gap-1.5">
            {problem.topics.map((topic) => (
              <span key={topic.slug} className="chip">
                {topic.name}
              </span>
            ))}
          </div>
        </div>

        {problem.companies.length > 0 ? (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-500">
              <Building2 className="h-3 w-3" />
              Asked at
            </div>
            <div className="flex flex-wrap gap-1.5">
              {problem.companies.map((company) => (
                <span key={company.slug} className="chip">
                  {company.name}
                  {company.frequency ? (
                    <span className="text-ink-500">{company.frequency}</span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </article>
  );
}

function Editorial({ slug }: { slug: string }) {
  const editorial = useQuery({
    queryKey: ['problem', slug, 'editorial'],
    queryFn: () =>
      api.get<{
        approachSummary: string;
        content: string;
        timeComplexity: string;
        spaceComplexity: string;
      }>(`/v1/problems/${slug}/editorial`),
    retry: false,
  });

  if (editorial.isLoading) return <div className="skeleton h-64" />;

  if (editorial.error) {
    const locked =
      editorial.error instanceof ApiClientError && editorial.error.status === 403;
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Lock className="mb-3 h-6 w-6 text-ink-600" />
        <p className="text-sm text-ink-300">
          {locked ? 'Solve this problem to unlock the editorial.' : 'No editorial yet.'}
        </p>
        {locked ? (
          <p className="mt-1.5 max-w-xs text-xs text-ink-500">
            Reading the answer before you have wrestled with it is how solutions get memorised
            instead of understood.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <article className="animate-fade-up">
      <div className="mb-4 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-accent-soft" />
        <h2 className="text-base font-semibold">{editorial.data?.approachSummary}</h2>
      </div>
      <div className="mb-4 flex gap-3 font-mono text-xs text-ink-400">
        <span>{editorial.data?.timeComplexity} time</span>
        <span>·</span>
        <span>{editorial.data?.spaceComplexity} space</span>
      </div>
      <div
        className="prose-mentor"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(editorial.data?.content ?? '') }}
      />
    </article>
  );
}

function Submissions({ problemId }: { problemId: string }) {
  const submissions = useQuery({
    queryKey: ['submissions', problemId],
    queryFn: () =>
      api.get<{ items: SubmissionRow[] }>('/v1/submissions', { query: { problemId } }),
    refetchInterval: 15_000,
  });

  if (submissions.isLoading) return <div className="skeleton h-40" />;
  if (!submissions.data?.items.length) {
    return (
      <p className="py-16 text-center text-sm text-ink-500">
        No submissions yet for this problem.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-ink-800">
      {submissions.data.items.map((submission) => (
        <li key={submission.id} className="flex items-center gap-3 py-2.5 text-xs">
          <span
            className={cn(
              'w-32 shrink-0 font-medium',
              submission.verdict === 'ACCEPTED' ? 'text-easy' : 'text-hard',
            )}
          >
            {submission.verdict.replace(/_/g, ' ').toLowerCase()}
          </span>
          <span className="text-ink-400">
            {submission.passedTests}/{submission.totalTests}
          </span>
          <span className="font-mono text-ink-500">{formatMs(submission.runtimeMs)}</span>
          <span className="ml-auto text-ink-500">{relativeTime(submission.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
