'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  Bot,
  Brain,
  Database,
  Flame,
  Gauge,
  Key,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { AiPerformance, Achievement, ProgressOverview, TopicMasteryDto } from '@repo/contracts';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  SectionHeading,
  StatTile,
  MiniGauge,
  EmptyState,
  TabSwitcher,
} from '@/components/ui/primitives';
import { MonthHeatmap, type HeatmapDay } from '@/components/progress/MonthHeatmap';

interface Heatmap {
  year: number;
  days: HeatmapDay[];
  totalActiveDays: number;
}

const DIFFICULTY_TONE: Record<string, { bar: string; text: string }> = {
  EASY: { bar: 'bg-easy', text: 'text-easy' },
  MEDIUM: { bar: 'bg-medium', text: 'text-medium' },
  HARD: { bar: 'bg-hard', text: 'text-hard' },
};

const TIER_STYLES: Record<string, { text: string }> = {
  BRONZE: { text: 'text-amber-500' },
  SILVER: { text: 'text-ink-200' },
  GOLD: { text: 'text-medium' },
  PLATINUM: { text: 'text-accent-soft' },
};

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'ai-performance', label: 'AI Performance' },
] as const;
type Tab = (typeof TABS)[number]['value'];

const WINDOW_OPTIONS = [
  { value: '7', label: '7d' },
  { value: '14', label: '14d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
];

export default function ProgressPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(
    searchParams.get('tab') === 'ai-performance' ? 'ai-performance' : 'overview',
  );

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(now.getUTCMonth());
  const [days, setDays] = useState('30');

  const overview = useQuery({
    queryKey: ['progress', 'overview'],
    queryFn: () => api.get<ProgressOverview>('/v1/progress/overview'),
  });
  const heatmap = useQuery({
    queryKey: ['progress', 'heatmap', viewYear],
    queryFn: () => api.get<Heatmap>('/v1/progress/heatmap', { query: { year: viewYear } }),
  });
  const topics = useQuery({
    queryKey: ['progress', 'topics'],
    queryFn: () => api.get<{ items: TopicMasteryDto[] }>('/v1/progress/topics'),
  });
  const achievements = useQuery({
    queryKey: ['achievements'],
    queryFn: () => api.get<{ items: Achievement[] }>('/v1/achievements'),
  });
  const aiPerf = useQuery({
    queryKey: ['ai-insights', 'performance', days],
    queryFn: () => api.get<AiPerformance>('/v1/ai-insights/performance', { query: { days } }),
    enabled: tab === 'ai-performance',
  });

  const stats = overview.data;
  const sortedTopics = [...(topics.data?.items ?? [])].sort((a, b) => b.mastery - a.mastery);
  const earnedBadges = (achievements.data?.items ?? []).filter((a) => a.earnedAt);
  const nearestBadges = (achievements.data?.items ?? [])
    .filter((a) => !a.earnedAt)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 2);
  const spotlightBadges = [...earnedBadges.slice(-2).reverse(), ...nearestBadges].slice(0, 4);

  return (
    <div className="page-container">
      <SectionHeading
        eyebrow="Where you stand"
        title="Progress"
        description="Mastery decays when a topic goes unpractised, and the AI performance tab shows exactly what the mentor did on your behalf — both are a picture of now, not a score you can never lose."
        action={<TabSwitcher value={tab} onChange={setTab} options={[...TABS]} />}
      />

      {tab === 'overview' ? (
        <OverviewTab
          stats={stats}
          heatmap={heatmap.data}
          heatmapLoading={heatmap.isLoading}
          viewYear={viewYear}
          viewMonth={viewMonth}
          onNavigate={(y, m) => {
            setViewYear(y);
            setViewMonth(m);
          }}
          sortedTopics={sortedTopics}
          topicsLoading={topics.isLoading}
          spotlightBadges={spotlightBadges}
          badgesLoading={achievements.isLoading}
        />
      ) : (
        <AiPerformanceTab data={aiPerf.data} isLoading={aiPerf.isLoading} days={days} setDays={setDays} />
      )}
    </div>
  );
}

function OverviewTab({
  stats,
  heatmap,
  heatmapLoading,
  viewYear,
  viewMonth,
  onNavigate,
  sortedTopics,
  topicsLoading,
  spotlightBadges,
  badgesLoading,
}: {
  stats: ProgressOverview | undefined;
  heatmap: Heatmap | undefined;
  heatmapLoading: boolean;
  viewYear: number;
  viewMonth: number;
  onNavigate: (year: number, month: number) => void;
  sortedTopics: TopicMasteryDto[];
  topicsLoading: boolean;
  spotlightBadges: Achievement[];
  badgesLoading: boolean;
}) {
  return (
    <>
      {stats ? (
        <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={Zap} label="XP earned" value={stats.xp.toLocaleString()} tone="accent" />
          <StatTile icon={TrendingUp} label="Acceptance rate" value={`${stats.acceptanceRate}%`} />
          <StatTile
            icon={Flame}
            label="Current streak"
            value={`${stats.streak.current}d`}
            tone={stats.streak.current > 0 ? 'warn' : 'neutral'}
            sub={`best: ${stats.streak.longest}d`}
          />
          <StatTile
            icon={Brain}
            label="Skill level"
            value={stats.skillLevel.charAt(0) + stats.skillLevel.slice(1).toLowerCase()}
          />
        </section>
      ) : (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-28" />
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          {stats ? (
            <section className="panel p-5">
              <h2 className="card-title mb-4">Solved by difficulty</h2>
              <div className="grid gap-5 sm:grid-cols-3">
                {(['EASY', 'MEDIUM', 'HARD'] as const).map((difficulty) => {
                  const bucket = stats.byDifficulty[difficulty] ?? { solved: 0, total: 0 };
                  const pct = bucket.total ? (bucket.solved / bucket.total) * 100 : 0;
                  const toneStyle = DIFFICULTY_TONE[difficulty]!;
                  return (
                    <div key={difficulty}>
                      <div className="mb-2 flex items-baseline justify-between">
                        <span className={cn('text-xs font-semibold uppercase', toneStyle.text)}>
                          {difficulty.toLowerCase()}
                        </span>
                        <span className="stat-value text-sm text-ink-300">
                          {bucket.solved}
                          <span className="text-ink-600">/{bucket.total}</span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-ink-800">
                        <motion.div
                          className={cn('h-full rounded-full', toneStyle.bar)}
                          initial={false}
                          animate={{ width: `${Math.max(2, pct)}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-ink-800 pt-5">
                <MiniGauge value={stats.confidence} label="Confidence" />
                <MiniGauge
                  value={1 - stats.hintDependency}
                  label="Independence"
                  toneOverride={stats.hintDependency > 0.5 ? 'warn' : 'good'}
                />
              </div>
            </section>
          ) : null}

          <section className="panel p-5">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="card-title">Activity</h2>
              <span className="text-[12px] text-ink-500">
                {heatmap?.totalActiveDays ?? 0} active days this year
              </span>
            </div>
            {heatmapLoading ? (
              <div className="skeleton h-48" />
            ) : (
              <MonthHeatmap
                days={heatmap?.days ?? []}
                year={viewYear}
                month={viewMonth}
                onNavigate={onNavigate}
              />
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="panel p-5">
            <div className="mb-1 flex items-center gap-2">
              <Gauge className="h-4 w-4 text-accent-soft" />
              <h2 className="card-title">Topic mastery</h2>
            </div>
            <p className="card-meta mb-4">Every topic you have touched, strongest first.</p>

            {topicsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton h-8" />
                ))}
              </div>
            ) : sortedTopics.length ? (
              <ul className="max-h-[22rem] space-y-4 overflow-y-auto pr-1">
                {sortedTopics.map((topic) => (
                  <li key={topic.slug}>
                    <div className="mb-1.5 flex items-center justify-between text-[13px]">
                      <span className="flex items-center gap-1.5 text-ink-200">
                        {topic.name}
                        {topic.decaying ? (
                          <span className="chip badge-tone-warn border !py-0 text-[9px]">decaying</span>
                        ) : null}
                      </span>
                      <span className="stat-value text-ink-400">{Math.round(topic.mastery * 100)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                      <motion.div
                        className={cn(
                          'h-full rounded-full',
                          topic.mastery < 0.3 ? 'bg-hard' : topic.mastery < 0.6 ? 'bg-medium' : 'bg-easy',
                        )}
                        initial={false}
                        animate={{ width: `${Math.max(3, topic.mastery * 100)}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <div className="mt-1 text-[11px] text-ink-600">
                      {topic.solved} solved of {topic.attempts} attempts
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Award}
                title="No topics tracked yet"
                description="Solve a problem and its topics start appearing here."
                action={
                  <Link href="/problems" className="btn-outline text-xs">
                    Browse problems
                  </Link>
                }
              />
            )}
          </section>

          <section className="panel p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="card-title">Achievements</h2>
              <Link href="/achievements" className="text-[11.5px] font-medium text-accent-soft hover:text-accent">
                View all &rarr;
              </Link>
            </div>
            {badgesLoading ? (
              <div className="skeleton h-16" />
            ) : spotlightBadges.length === 0 ? (
              <p className="text-[12.5px] text-ink-500">Solve your first problem to start earning badges.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {spotlightBadges.map((badge) => {
                  const style = TIER_STYLES[badge.tier] ?? TIER_STYLES.BRONZE!;
                  const unlocked = badge.earnedAt !== null;
                  return (
                    <div
                      key={badge.slug}
                      className={cn(
                        'rounded-lg border p-2.5',
                        unlocked ? 'border-accent/25 bg-accent/5' : 'border-ink-700 bg-ink-900/40',
                      )}
                    >
                      <div
                        className={cn(
                          'truncate text-[12px] font-medium',
                          unlocked ? 'text-ink-100' : 'text-ink-400',
                        )}
                      >
                        {badge.name}
                      </div>
                      {unlocked ? (
                        <div className={cn('mt-0.5 text-[10.5px]', style.text)}>unlocked</div>
                      ) : (
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink-800">
                          <div
                            className="h-full rounded-full bg-accent/60"
                            style={{ width: `${Math.max(2, Math.round(badge.progress * 100))}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function AiPerformanceTab({
  data,
  isLoading,
  days,
  setDays,
}: {
  data: AiPerformance | undefined;
  isLoading: boolean;
  days: string;
  setDays: (v: string) => void;
}) {
  const tokenPct = data ? Math.min(100, Math.round((data.tokensToday / Math.max(1, data.tokenBudget)) * 100)) : 0;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <TabSwitcher value={days} onChange={setDays} options={WINDOW_OPTIONS} />
      </div>

      {data?.deterministicOnly ? (
        <div className="panel mb-6 flex items-start gap-3.5 border-medium/30 bg-medium/5 p-5">
          <Key className="mt-0.5 h-5 w-5 shrink-0 text-medium" />
          <div>
            <h3 className="text-sm font-semibold text-medium">Running on the deterministic engine only</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-300">
              No LLM provider is configured, so the mentor is using Tree-sitter analysis, complexity
              estimation and authored hints instead of the full multi-agent graph. Everything below
              still reflects real activity — it just describes that mode.
            </p>
            <p className="mt-2.5 text-[12px] text-ink-500">
              Add{' '}
              <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-accent-soft">
                OPENROUTER_API_KEY
              </code>{' '}
              (or{' '}
              <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-accent-soft">
                GROQ_API_KEY
              </code>
              ) to the AI service&rsquo;s environment and restart it to enable the Tutor, Hint,
              Debug, Complexity and Code Review agents.
            </p>
          </div>
        </div>
      ) : null}

      {isLoading || !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-28" />
          ))}
        </div>
      ) : (
        <>
          <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              icon={Bot}
              label="Mentor interactions"
              value={String(data.interactions)}
              sub={`last ${days} days`}
              tone="accent"
            />
            <StatTile icon={Lightbulb} label="Hints unlocked" value={String(data.hintsUnlocked)} />
            <StatTile
              icon={ShieldCheck}
              label="Guard rejections"
              value={String(data.guardRejections)}
              tone={data.guardRejections > 0 ? 'warn' : 'good'}
              sub="responses that tried to reveal too much"
            />
            <StatTile
              icon={Zap}
              label="Cache hit rate"
              value={`${Math.round(data.cacheHitRate * 100)}%`}
              sub="free, instant responses"
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-[1fr_19rem]">
            <div className="space-y-4">
              <section className="panel p-5">
                <h2 className="card-title mb-4">Activity by specialist agent</h2>
                {data.byAgent.length === 0 ? (
                  <p className="py-10 text-center text-[13px] text-ink-500">
                    No mentor turns in this window yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {data.byAgent.map((agent) => {
                      const max = Math.max(...data.byAgent.map((a) => a.count), 1);
                      return (
                        <div key={agent.agent}>
                          <div className="mb-1.5 flex items-center justify-between text-[13px]">
                            <span className="font-medium capitalize text-ink-200">
                              {agent.agent.toLowerCase().replace('_', ' ')}
                            </span>
                            <span className="flex items-center gap-2.5 text-[12px] text-ink-500">
                              {agent.avgLatencyMs !== null ? <span>{agent.avgLatencyMs}ms avg</span> : null}
                              {agent.helpfulRate !== null ? (
                                <span className={agent.helpfulRate >= 0.7 ? 'text-easy' : 'text-medium'}>
                                  {Math.round(agent.helpfulRate * 100)}% helpful
                                </span>
                              ) : null}
                              <span className="stat-value text-ink-300">{agent.count}</span>
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                            <motion.div
                              className="h-full rounded-full bg-accent"
                              initial={false}
                              animate={{ width: `${Math.max(3, (agent.count / max) * 100)}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="panel p-5">
                <h2 className="card-title mb-1">Code strength trend</h2>
                <p className="card-meta mb-4">Mean strength score across your submissions in this window.</p>
                {data.qualitySeries.length >= 2 ? (
                  <QualitySparkline series={data.qualitySeries} trend={data.qualityTrend} />
                ) : (
                  <p className="py-10 text-center text-[13px] text-ink-500">
                    Submit a few more solutions to see a trend line.
                  </p>
                )}
              </section>

              <section className="panel p-5">
                <h2 className="card-title mb-4">What triggered the mentor</h2>
                {data.byTrigger.length === 0 ? (
                  <p className="text-[13px] text-ink-500">Nothing yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.byTrigger.map((t) => (
                      <span key={t.trigger} className="chip-lg border">
                        {t.trigger.toLowerCase().replace(/_/g, ' ')}
                        <span className="stat-value text-ink-500">{t.count}</span>
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-3.5 text-[11.5px] leading-relaxed text-ink-500">
                  Most ticks stay silent by design — the mentor speaks only when a deterministic
                  trigger fires, not on a timer.
                </p>
              </section>
            </div>

            <div className="space-y-4">
              <section className="panel p-5">
                <h2 className="mb-3.5 flex items-center gap-1.5 card-title">
                  <Database className="h-4 w-4 text-accent-soft" />
                  Token budget today
                </h2>
                <MiniGauge value={tokenPct / 100} toneOverride={tokenPct > 85 ? 'bad' : tokenPct > 60 ? 'warn' : 'good'} />
                <div className="mt-2.5 flex justify-between text-[11.5px] text-ink-500">
                  <span>{data.tokensToday.toLocaleString()} used</span>
                  <span>{data.tokenBudget.toLocaleString()} budget</span>
                </div>
              </section>

              <section className="panel p-5">
                <h2 className="mb-3.5 flex items-center gap-1.5 card-title">
                  <Gauge className="h-4 w-4 text-accent-soft" />
                  Reliance on AI
                </h2>
                <div className="space-y-3.5">
                  <MiniGauge
                    value={data.hintDependency}
                    label="Hint dependency"
                    toneOverride={data.hintDependency > 0.5 ? 'warn' : 'good'}
                  />
                  <MiniGauge
                    value={data.fallbackRate}
                    label="Deterministic fallback rate"
                    toneOverride={data.fallbackRate > 0.3 ? 'warn' : 'good'}
                  />
                </div>
              </section>

              {data.guardRejections > 0 ? (
                <div className="panel flex items-start gap-2.5 border-medium/25 bg-medium/5 p-4">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-medium" />
                  <p className="text-[12.5px] leading-relaxed text-ink-300">
                    The Response Guard rejected {data.guardRejections} response
                    {data.guardRejections === 1 ? '' : 's'} for being too close to a full solution
                    and asked the mentor to try again — this is the mechanism that keeps hints from
                    turning into answers.
                  </p>
                </div>
              ) : (
                <div className="panel flex items-start gap-2.5 p-4">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-easy" />
                  <p className="text-[12.5px] leading-relaxed text-ink-300">
                    Every mentor response in this window respected your assist mode on the first try.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function QualitySparkline({
  series,
  trend,
}: {
  series: { date: string; score: number }[];
  trend: number | null;
}) {
  const width = 100;
  const height = 32;
  const max = Math.max(...series.map((s) => s.score), 100);
  const min = Math.min(...series.map((s) => s.score), 0);
  const range = Math.max(1, max - min);

  const points = series
    .map((point, i) => {
      const x = (i / (series.length - 1)) * width;
      const y = height - ((point.score - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke="url(#quality-gradient)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        <defs>
          <linearGradient id="quality-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mt-2 flex items-center justify-between text-[11.5px] text-ink-500">
        <span>{series[0]?.date}</span>
        {trend !== null ? (
          <span className={cn('font-medium', trend >= 0 ? 'text-easy' : 'text-hard')}>
            {trend >= 0 ? '+' : ''}
            {trend} pts
          </span>
        ) : null}
        <span>{series[series.length - 1]?.date}</span>
      </div>
    </div>
  );
}
