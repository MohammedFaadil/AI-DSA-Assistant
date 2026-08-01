'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Award,
  Brain,
  CalendarCheck,
  CalendarHeart,
  Crosshair,
  Flame,
  Gauge,
  Languages,
  Lock,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import type { Achievement } from '@repo/contracts';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { SectionHeading, ProgressRing } from '@/components/ui/primitives';

const BADGE_ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Target,
  Trophy,
  Flame,
  Brain,
  Gauge,
  CalendarCheck,
  CalendarHeart,
  Languages,
  Crosshair,
};

function badgeIcon(name: string): LucideIcon {
  return BADGE_ICONS[name] ?? Award;
}

const TIER_STYLES: Record<string, { ring: string; badge: string; label: string }> = {
  BRONZE: { ring: 'text-amber-500', badge: 'border-amber-700/40 bg-amber-700/10 text-amber-500', label: 'Bronze' },
  SILVER: { ring: 'text-ink-200', badge: 'border-ink-400/40 bg-ink-400/10 text-ink-200', label: 'Silver' },
  GOLD: { ring: 'text-medium', badge: 'border-medium/40 bg-medium/10 text-medium', label: 'Gold' },
  PLATINUM: { ring: 'text-accent-soft', badge: 'border-accent/40 bg-accent/10 text-accent-soft', label: 'Platinum' },
};

const TIER_ORDER = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

export default function AchievementsPage() {
  const achievements = useQuery({
    queryKey: ['achievements'],
    queryFn: () => api.get<{ items: Achievement[] }>('/v1/achievements'),
  });

  const items = achievements.data?.items ?? [];
  const earned = items.filter((a) => a.earnedAt);
  const totalXpEarned = earned.reduce((sum, a) => sum + a.xpReward, 0);
  const totalXpAvailable = items.reduce((sum, a) => sum + a.xpReward, 0);

  const byTier = useMemo(() => {
    const groups: Record<string, Achievement[]> = {};
    for (const tier of TIER_ORDER) groups[tier] = [];
    for (const item of items) groups[item.tier]?.push(item);
    return groups;
  }, [items]);

  const overallCompletion = items.length ? earned.length / items.length : 0;

  return (
    <div className="page-container">
      <SectionHeading
        eyebrow="Milestones"
        title="Achievements"
        description="Several reward solving without hints, on the first try, or in more than one language — deliberately, so the badges track more than raw volume."
      />

      {achievements.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-32" />
          ))}
        </div>
      ) : (
        <>
          {/* Overview strip */}
          <div className="panel mb-6 flex flex-wrap items-center gap-6 p-5">
            <ProgressRing value={overallCompletion} size={72}>
              <span className="stat-value text-base font-semibold text-ink-100">
                {earned.length}/{items.length}
              </span>
            </ProgressRing>
            <div className="flex-1">
              <div className="text-sm font-medium text-ink-100">
                {earned.length === 0
                  ? 'None unlocked yet — solve your first problem to start.'
                  : `${earned.length} of ${items.length} unlocked`}
              </div>
              <p className="mt-1 text-[13px] text-ink-400">
                {totalXpEarned.toLocaleString()} of {totalXpAvailable.toLocaleString()} available XP earned from badges.
              </p>
            </div>
            <div className="flex gap-4">
              {TIER_ORDER.map((tier) => {
                const tierItems = byTier[tier] ?? [];
                const tierEarned = tierItems.filter((t) => t.earnedAt).length;
                const style = TIER_STYLES[tier]!;
                return (
                  <div key={tier} className="text-center">
                    <div className={cn('text-lg font-semibold', style.ring)}>
                      {tierEarned}/{tierItems.length}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-ink-500">{style.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tier groups */}
          <div className="space-y-8">
            {TIER_ORDER.map((tier) => {
              const tierItems = byTier[tier] ?? [];
              if (tierItems.length === 0) return null;
              const style = TIER_STYLES[tier]!;
              return (
                <section key={tier}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className={cn('chip border', style.badge)}>{style.label} tier</span>
                    <span className="text-[12px] text-ink-500">
                      {tierItems.filter((t) => t.earnedAt).length} of {tierItems.length} unlocked
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {tierItems.map((badge, index) => (
                      <BadgeCard key={badge.slug} badge={badge} index={index} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function BadgeCard({ badge, index }: { badge: Achievement; index: number }) {
  const unlocked = badge.earnedAt !== null;
  const style = TIER_STYLES[badge.tier]!;
  const Icon = badgeIcon(badge.icon);
  const progressPct = Math.round(badge.progress * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2), duration: 0.3 }}
      className={cn(
        'panel-interactive relative overflow-hidden p-4',
        unlocked && 'border-accent/20',
      )}
    >
      {unlocked ? (
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/10 blur-2xl" />
      ) : null}

      <div className="relative flex items-start gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
            unlocked ? style.badge : 'border-ink-700 bg-ink-800 text-ink-500',
          )}
        >
          {unlocked ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className={cn('truncate text-sm font-semibold', unlocked ? 'text-ink-100' : 'text-ink-300')}>
              {badge.name}
            </h3>
            <span className="shrink-0 text-[11px] font-medium text-ink-500">+{badge.xpReward} XP</span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-400">{badge.description}</p>

          {!unlocked ? (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                <motion.div
                  className="h-full rounded-full bg-accent/60"
                  initial={false}
                  animate={{ width: `${Math.max(2, progressPct)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="mt-1 text-[10.5px] tabular-nums text-ink-600">{progressPct}% there</div>
            </div>
          ) : (
            <div className="mt-2 text-[10.5px] text-easy">
              Unlocked {new Date(badge.earnedAt!).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
