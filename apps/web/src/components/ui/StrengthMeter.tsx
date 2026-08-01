'use client';

import { motion } from 'framer-motion';
import { Info, TrendingDown, TrendingUp } from 'lucide-react';
import type { QualityReport } from '@repo/contracts';
import { cn } from '@/lib/utils';

const DIMENSION_ORDER = ['correctness', 'efficiency', 'readability', 'robustness', 'structure'];

function tone(score: number): { bar: string; text: string } {
  if (score >= 85) return { bar: 'bg-easy', text: 'text-easy' };
  if (score >= 70) return { bar: 'bg-accent', text: 'text-accent-soft' };
  if (score >= 50) return { bar: 'bg-medium', text: 'text-medium' };
  return { bar: 'bg-hard', text: 'text-hard' };
}

/**
 * The live code-strength bar.
 *
 * Rides the same 2-second analysis tick as everything else in the workspace —
 * it is a byproduct of the deterministic Stage-1 parse, so it moves for free
 * and never waits on an LLM. `measurable: false` (empty buffer / unfilled
 * stub) renders a calm neutral state instead of a red one that would read as
 * failure before the learner has typed anything.
 */
export function StrengthMeter({
  report,
  compact = false,
}: {
  report: QualityReport | null;
  compact?: boolean;
}) {
  if (!report || !report.measurable) {
    return (
      <div className={cn('rounded-lg border border-ink-700 bg-ink-850/60 px-3 py-2.5', compact && 'px-2.5 py-2')}>
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-ink-400">Code strength</span>
          <span className="text-ink-600">—</span>
        </div>
        <div className="meter-track mt-2">
          <div className="h-full w-0 rounded-full bg-ink-700" />
        </div>
        <p className="mt-1.5 text-[11px] text-ink-500">
          {report ? report.headline : 'Start writing and this tracks live.'}
        </p>
      </div>
    );
  }

  const t = tone(report.overall);

  return (
    <div className={cn('rounded-lg border border-ink-700 bg-ink-850/60 px-3 py-2.5', compact && 'px-2.5 py-2')}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-300">Code strength</span>
        <div className="flex items-baseline gap-1.5">
          {report.trend !== null && Math.abs(report.trend) >= 3 ? (
            <span
              className={cn(
                'flex items-center gap-0.5 text-[10px] font-medium',
                report.trend > 0 ? 'text-easy' : 'text-hard',
              )}
              title={`${report.trend > 0 ? 'Up' : 'Down'} ${Math.abs(Math.round(report.trend))} pts recently`}
            >
              {report.trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            </span>
          ) : null}
          <span className={cn('stat-value text-sm font-semibold', t.text)}>{report.overall}</span>
          <span className="text-[10px] text-ink-500">/100</span>
          <span
            className={cn(
              'ml-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold',
              t.text,
              'bg-current/10',
            )}
          >
            {report.grade}
          </span>
        </div>
      </div>

      <div className="meter-track mt-2">
        <motion.div
          className={cn('meter-fill', t.bar)}
          initial={false}
          animate={{ width: `${Math.max(3, report.overall)}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>

      <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-ink-400">{report.headline}</p>

      {!compact && report.dimensions.length > 0 ? (
        <div className="mt-2.5 grid grid-cols-5 gap-1">
          {DIMENSION_ORDER.map((key) => {
            const dim = report.dimensions.find((d) => d.key === key);
            if (!dim) return null;
            const dimTone = tone(dim.score);
            return (
              <div key={key} className="group relative" title={`${dim.label}: ${dim.score}/100`}>
                <div className="h-1 overflow-hidden rounded-full bg-ink-800">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', dimTone.bar)}
                    style={{ width: `${Math.max(4, dim.score)}%` }}
                  />
                </div>
                <div className="mt-1 truncate text-center text-[9px] uppercase tracking-wide text-ink-600">
                  {dim.label.slice(0, 4)}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {report.topFix ? (
        <div className="mt-2.5 flex items-start gap-1.5 rounded-md bg-ink-900/60 px-2 py-1.5 text-[11px] text-ink-300">
          <Info className="mt-0.5 h-3 w-3 shrink-0 text-accent-soft" />
          <span>{report.topFix}</span>
        </div>
      ) : null}
    </div>
  );
}
