'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shared visual primitives used across the dashboard, progress, curriculum and
 * library pages so the whole app reads as one system rather than a page-by-page
 * assembly of one-off markup.
 */

export function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'neutral',
  trend,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent';
  trend?: { value: number; label: string } | null;
}) {
  const toneClass: Record<string, string> = {
    neutral: 'text-ink-100',
    good: 'text-easy',
    warn: 'text-medium',
    bad: 'text-hard',
    accent: 'text-accent-soft',
  };
  const iconToneClass: Record<string, string> = {
    neutral: 'bg-ink-800 text-ink-300',
    good: 'bg-easy/10 text-easy',
    warn: 'bg-medium/10 text-medium',
    bad: 'bg-hard/10 text-hard',
    accent: 'bg-accent/10 text-accent-soft',
  };

  return (
    <div className="panel-interactive p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', iconToneClass[tone])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        {trend ? (
          <span
            className={cn(
              'flex items-center gap-0.5 rounded-full px-2 py-1 text-[11px] font-medium',
              trend.value > 0 ? 'bg-easy/10 text-easy' : trend.value < 0 ? 'bg-hard/10 text-hard' : 'bg-ink-800 text-ink-500',
            )}
          >
            {trend.value > 0 ? '+' : ''}
            {trend.value} {trend.label}
          </span>
        ) : null}
      </div>
      <div className={cn('stat-value text-[1.75rem] font-semibold leading-none', toneClass[tone])}>
        {value}
      </div>
      <div className="mt-2 text-[13px] font-medium text-ink-300">{label}</div>
      {sub ? <div className="mt-0.5 text-[11.5px] text-ink-500">{sub}</div> : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div>
        {eyebrow ? (
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-accent-soft">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2.5 max-w-2xl text-[13.5px] leading-relaxed text-ink-400">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-700 px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ink-800">
        <Icon className="h-5 w-5 text-ink-500" />
      </div>
      <h3 className="text-sm font-medium text-ink-200">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs text-ink-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function SkeletonRows({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton h-14" />
      ))}
    </div>
  );
}

export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('stat-value', className)}
    >
      {value}
    </motion.span>
  );
}

/** A pill-group tab switcher — used for track selectors, sort toggles, etc. */
export function TabSwitcher<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-ink-700 bg-ink-900 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors',
            value === option.value
              ? 'bg-accent/20 text-accent-soft'
              : 'text-ink-400 hover:text-ink-200',
          )}
        >
          {option.label}
          {option.count !== undefined ? (
            <span
              className={cn(
                'rounded-full px-1.5 text-[10.5px] tabular-nums',
                value === option.value ? 'bg-accent/25 text-accent-soft' : 'bg-ink-800 text-ink-500',
              )}
            >
              {option.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** A circular completion ring — used on Achievements for tier/overall progress. */
export function ProgressRing({
  value,
  size = 56,
  strokeWidth = 5,
  className,
  children,
}: {
  value: number; // 0..1
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(1, value)));

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} className="stroke-ink-800" strokeWidth={strokeWidth} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-accent-soft"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const config = {
    high: { label: 'High priority', cls: 'badge-tone-bad' },
    medium: { label: 'Medium priority', cls: 'badge-tone-warn' },
    low: { label: 'Low priority', cls: 'badge-tone-muted' },
  }[severity];
  return <span className={cn('chip border', config.cls)}>{config.label}</span>;
}

/** A small inline gauge — used for mastery %, completion %, etc. where a full
 * StrengthMeter would be too heavy. */
export function MiniGauge({
  value,
  label,
  toneOverride,
}: {
  value: number; // 0..1
  label?: string;
  toneOverride?: 'good' | 'warn' | 'bad';
}) {
  const pct = Math.round(value * 100);
  const t =
    toneOverride ??
    (value >= 0.7 ? 'good' : value >= 0.4 ? 'warn' : 'bad');
  const barClass = { good: 'bg-easy', warn: 'bg-medium', bad: 'bg-hard' }[t];

  return (
    <div>
      {label ? (
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-ink-300">{label}</span>
          <span className="stat-value text-ink-400">{pct}%</span>
        </div>
      ) : null}
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
        <motion.div
          className={cn('h-full rounded-full', barClass)}
          initial={false}
          animate={{ width: `${Math.max(2, pct)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
