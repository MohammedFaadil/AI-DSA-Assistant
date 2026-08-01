'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Award,
  Bot,
  Compass,
  Flame,
  Gauge,
  ListChecks,
  Sparkles,
  Target,
  TrendingDown,
  Zap,
} from 'lucide-react';
import type {
  AiPerformance,
  ImprovementArea,
  ProblemDetail,
  ProblemSummary,
  ProgressOverview,
} from '@repo/contracts';
import { api } from '@/lib/api-client';
import { DIFFICULTY_STYLES, cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { StatTile, SectionHeading, SeverityBadge, MiniGauge, EmptyState } from '@/components/ui/primitives';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const overview = useQuery({
    queryKey: ['progress', 'overview'],
    queryFn: () => api.get<ProgressOverview>('/v1/progress/overview'),
  });

  const daily = useQuery({
    queryKey: ['problems', 'daily'],
    queryFn: () => api.get<ProblemDetail | null>('/v1/problems/daily'),
  });

  const recommended = useQuery({
    queryKey: ['problems', 'recommended'],
    queryFn: () => api.get<{ items: ProblemSummary[] }>('/v1/problems/recommended'),
  });

  const improve = useQuery({
    queryKey: ['curriculum', 'improve'],
    queryFn: () => api.get<{ areas: ImprovementArea[] }>('/v1/curriculum/improve'),
  });

  const aiPerf = useQuery({
    queryKey: ['ai-insights', 'performance', 14],
    queryFn: () => api.get<AiPerformance>('/v1/ai-insights/performance', { query: { days: 14 } }),
  });

  const stats = overview.data;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <SectionHeading
        eyebrow="Overview"
        title={`${greeting()}, ${user?.name ?? user?.username}`}
        description={
          stats?.totalSolved
            ? `${stats.totalSolved} solved. The mentor is tuned to how you work.`
            : 'Solve your first problem and the mentor starts calibrating to you.'
        }
        action={
          <Link href="/practice" className="btn-outline">
            <Sparkles className="h-4 w-4" />
            Practice Zone
          </Link>
        }
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Target} label="Solved" value={stats ? `${stats.totalSolved}` : '—'}
          sub={stats ? `of ${stats.totalProblems} problems` : undefined} />
        <StatTile icon={Zap} label="Acceptance" tone="accent" value={stats ? `${stats.acceptanceRate}%` : '—'}
          sub={stats ? `${stats.totalSubmissions} submissions` : undefined} />
        <StatTile icon={Flame} label="Streak" tone={stats && stats.streak.current > 0 ? 'warn' : 'neutral'}
          value={stats ? `${stats.streak.current}` : '—'} sub={stats ? `best ${stats.streak.longest}` : undefined} />
        <StatTile icon={Gauge} label="Hint reliance" value={stats ? `${Math.round(stats.hintDependency * 100)}%` : '—'}
          tone={stats && stats.hintDependency > 0.5 ? 'warn' : 'good'} sub="lower is stronger" />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {daily.data ? (
            <section className="panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink-700/70 px-5 py-3">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-400">
                  Today&rsquo;s problem
                </span>
                <span className={cn('chip border', DIFFICULTY_STYLES[daily.data.difficulty])}>
                  {daily.data.difficulty.toLowerCase()}
                </span>
              </div>
              <div className="p-5">
                <h2 className="text-lg font-semibold">{daily.data.title}</h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {daily.data.topics.map((topic) => (
                    <span key={topic.slug} className="chip">
                      {topic.name}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-sm text-ink-400">
                  Expected {daily.data.expectedTimeComplexity} time ·{' '}
                  {daily.data.expectedSpaceComplexity} space · {daily.data.acceptanceRate}% acceptance
                </p>
                <Link href={`/problems/${daily.data.slug}/solve`} className="btn-primary mt-5">
                  Solve it
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>
          ) : (
            <div className="skeleton h-56" />
          )}

          <section className="panel p-5">
            <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
              <Compass className="h-4 w-4 text-accent-soft" />
              Picked for you
            </h2>
            <p className="mb-4 text-xs text-ink-400">
              Chosen from your weakest topics, weighted by how long since you practised them.
            </p>
            <div className="space-y-1.5">
              {recommended.data?.items.length ? (
                recommended.data.items.slice(0, 5).map((problem) => (
                  <Link
                    key={problem.id}
                    href={`/problems/${problem.slug}/solve`}
                    className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-ink-700 hover:bg-ink-800/60"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">{problem.title}</span>
                    <span className="hidden gap-1 sm:flex">
                      {problem.topics.slice(0, 2).map((t) => (
                        <span key={t.slug} className="chip text-[10px]">
                          {t.name}
                        </span>
                      ))}
                    </span>
                    <span
                      className={cn(
                        'rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase',
                        DIFFICULTY_STYLES[problem.difficulty],
                      )}
                    >
                      {problem.difficulty}
                    </span>
                  </Link>
                ))
              ) : (
                <EmptyState
                  icon={ListChecks}
                  title="No recommendations yet"
                  description="Solve a few problems and recommendations will appear here."
                />
              )}
            </div>
          </section>

          {/* AI performance strip — honest about whether the LLM agents are on */}
          <section className="panel p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Bot className="h-4 w-4 text-accent-soft" />
                Mentor activity
              </h2>
              <Link href="/ai-insights" className="text-xs text-accent-soft hover:underline">
                Full report →
              </Link>
            </div>
            {aiPerf.data ? (
              <>
                {aiPerf.data.deterministicOnly ? (
                  <div className="mb-3 rounded-md border border-medium/25 bg-medium/8 px-3 py-2 text-xs text-medium">
                    Running on the deterministic engine only — no LLM key is configured, so the
                    mentor uses complexity analysis and authored hints rather than the full agent
                    graph.
                  </div>
                ) : null}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="stat-value text-xl font-semibold">{aiPerf.data.interactions}</div>
                    <div className="text-[11px] text-ink-500">interactions (14d)</div>
                  </div>
                  <div>
                    <div className="stat-value text-xl font-semibold text-accent-soft">
                      {aiPerf.data.hintsUnlocked}
                    </div>
                    <div className="text-[11px] text-ink-500">hints unlocked</div>
                  </div>
                  <div>
                    <div className="stat-value text-xl font-semibold">
                      {aiPerf.data.avgQuality ?? '—'}
                    </div>
                    <div className="text-[11px] text-ink-500">avg code strength</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="skeleton h-16" />
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="panel p-5">
            <div className="mb-1 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-medium" />
              <h2 className="text-sm font-semibold">Things to improve</h2>
            </div>
            <p className="mb-4 text-xs text-ink-400">
              Ranked and actionable — not just a weak-spot list.
            </p>

            {improve.data?.areas.length ? (
              <ul className="space-y-3">
                {improve.data.areas.slice(0, 4).map((area, i) => (
                  <li key={i} className="rounded-lg border border-ink-800 bg-ink-900/40 p-3">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-ink-100">{area.title}</span>
                      <SeverityBadge severity={area.severity} />
                    </div>
                    <p className="text-[11px] text-ink-400">{area.detail}</p>
                    <p className="mt-1.5 text-[11px] font-medium text-accent-soft">{area.action}</p>
                    {area.problemSlug ? (
                      <Link
                        href={`/problems/${area.problemSlug}/solve`}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] text-ink-300 hover:text-accent-soft"
                      >
                        Practice now <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="skeleton h-40" />
            )}

            <Link
              href="/curriculum"
              className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-ink-700 py-2 text-xs text-ink-300 transition-colors hover:border-accent/40 hover:text-accent-soft"
            >
              <Award className="h-3.5 w-3.5" />
              View full curriculum
            </Link>
          </section>

          {stats ? (
            <section className="panel p-5">
              <h2 className="mb-3 text-sm font-semibold">Skill snapshot</h2>
              <div className="space-y-3">
                <MiniGauge value={stats.confidence} label="Confidence" />
                <MiniGauge value={1 - stats.hintDependency} label="Independence" />
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-ink-800 pt-3 text-xs">
                <span className="text-ink-400">Skill level</span>
                <span className="chip border-accent/30 bg-accent/10 capitalize text-accent-soft">
                  {stats.skillLevel.toLowerCase()}
                </span>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
