'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Sparkles,
  Trash2,
  Wand2,
  Zap,
} from 'lucide-react';
import type { GeneratedProblemSummary, PracticeResult } from '@repo/contracts';
import { api, ApiClientError } from '@/lib/api-client';
import { DIFFICULTY_STYLES, cn, relativeTime } from '@/lib/utils';
import { SectionHeading, EmptyState } from '@/components/ui/primitives';

const DIFFICULTIES = [
  { value: undefined, label: 'Let AI decide' },
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
] as const;

const EXAMPLE_PROMPTS = [
  'Something with sliding windows on strings',
  'A binary search problem on a rotated array',
  'Practice detecting cycles in a graph',
  'A DP problem about coin combinations',
  'Two pointers on a sorted array',
];

const HOW_IT_WORKS = [
  { icon: Wand2, text: 'Describe what you want to practise, in your own words' },
  { icon: Sparkles, text: 'The AI writes a statement, an I/O spec, and a reference solution' },
  { icon: CheckCircle2, text: 'Every test case is verified by actually EXECUTING that solution' },
  { icon: Zap, text: 'You get the same editor, judge and mentor as every other problem' },
];

export default function PracticeZonePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD' | undefined>();
  const [error, setError] = useState<string | null>(null);

  const generated = useQuery({
    queryKey: ['practice', 'list'],
    queryFn: () => api.get<{ items: GeneratedProblemSummary[] }>('/v1/practice'),
  });

  const generate = useMutation({
    mutationFn: () => api.post<PracticeResult>('/v1/practice/generate', { prompt, difficulty }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['practice', 'list'] });
      router.push(`/problems/${result.slug}/solve`);
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : 'Could not generate that problem.');
    },
  });

  const remove = useMutation({
    mutationFn: (problemId: string) => api.delete(`/v1/practice/${problemId}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['practice', 'list'] }),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (prompt.trim().length < 8) {
      setError('Describe what you want to practise in a bit more detail.');
      return;
    }
    setError(null);
    generate.mutate();
  }

  return (
    <div className="page-container">
      <SectionHeading
        eyebrow="Generate on demand"
        title="Practice Zone"
        description="Describe what you want to work on, and get a real, judgeable problem back — statement, test cases and all."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="panel relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />

          <form onSubmit={submit} className="relative space-y-5">
            <div>
              <label htmlFor="prompt" className="mb-2 block text-[13px] font-medium text-ink-200">
                What do you want to practise?
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                maxLength={600}
                placeholder="e.g. A medium-difficulty problem using a hash map to find pairs in an array"
                className="input resize-none"
              />
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {EXAMPLE_PROMPTS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setPrompt(example)}
                    className="chip transition-colors hover:border-accent/40 hover:text-accent-soft"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12.5px] text-ink-400">Difficulty:</span>
              {DIFFICULTIES.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setDifficulty(option.value)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[12.5px] transition-colors',
                    difficulty === option.value
                      ? 'border-accent/50 bg-accent/12 text-accent-soft'
                      : 'border-ink-700 text-ink-400 hover:border-ink-600 hover:text-ink-200',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {error ? (
              <div className="rounded-lg border border-hard/30 bg-hard/10 px-3.5 py-2.5 text-sm text-hard">
                {error}
              </div>
            ) : null}

            <button type="submit" disabled={generate.isPending} className="btn-primary h-11 w-full">
              {generate.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Writing your problem — this can take up to a minute…
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate problem
                </>
              )}
            </button>
          </form>
        </div>

        {/* How it works — makes the guarantee visible, not just a caption */}
        <div className="panel p-5">
          <h2 className="card-eyebrow mb-4">How it works</h2>
          <ol className="space-y-4">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent-soft">
                  <step.icon className="h-3.5 w-3.5" />
                </div>
                <p className="text-[12.5px] leading-relaxed text-ink-300">{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-5 rounded-lg border border-easy/20 bg-easy/5 px-3.5 py-3 text-[11.5px] leading-relaxed text-ink-400">
            <span className="font-medium text-easy">Never a hand-guessed answer.</span> If a test
            input can&rsquo;t be verified against the reference solution, it&rsquo;s dropped rather
            than shipped.
          </div>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="card-title mb-4">Your generated problems</h2>

        {generated.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-16" />
            ))}
          </div>
        ) : generated.data?.items.length ? (
          <ul className="space-y-2">
            {generated.data.items.map((item, index) => (
              <motion.li
                key={item.problemId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.2) }}
                className="panel-interactive flex items-center gap-3 p-3.5"
              >
                <Link href={`/problems/${item.slug}/solve`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      item.solved ? 'bg-easy/10 text-easy' : 'bg-accent/10 text-accent-soft',
                    )}
                  >
                    {item.solved ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink-100">{item.title}</span>
                    <span className="block truncate text-[12px] text-ink-500">
                      {item.prompt ?? 'Generated problem'}
                    </span>
                  </span>
                  <span className="hidden gap-1 sm:flex">
                    {item.topics.slice(0, 2).map((t) => (
                      <span key={t} className="chip text-[10px]">
                        {t}
                      </span>
                    ))}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase',
                      DIFFICULTY_STYLES[item.difficulty],
                    )}
                  >
                    {item.difficulty}
                  </span>
                  <span className="hidden shrink-0 text-[11px] text-ink-600 sm:inline">
                    {relativeTime(item.createdAt)}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-600" />
                </Link>
                <button
                  onClick={() => remove.mutate(item.problemId)}
                  className="shrink-0 rounded-md p-2 text-ink-500 transition-colors hover:bg-hard/10 hover:text-hard"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </motion.li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="Nothing generated yet"
            description="Describe a topic above and your first custom problem will appear here."
          />
        )}
      </section>
    </div>
  );
}
