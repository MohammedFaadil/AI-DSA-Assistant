'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HeatmapDay {
  date: string;
  solvedCount: number;
  submissionCount: number;
  activeMinutes: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function tone(count: number): string {
  if (count === 0) return 'bg-ink-800';
  if (count === 1) return 'bg-accent/30';
  if (count <= 3) return 'bg-accent/55';
  return 'bg-accent';
}

/**
 * Month-by-month GitHub-style activity grid — slices the existing
 * year-scoped /v1/progress/heatmap payload client-side (no backend contract
 * change) and only triggers a refetch when navigation crosses a Dec<->Jan
 * year boundary, via onYearChange.
 */
export function MonthHeatmap({
  days,
  year,
  month,
  onNavigate,
}: {
  days: HeatmapDay[];
  year: number;
  month: number; // 0-indexed
  onNavigate: (year: number, month: number) => void;
}) {
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  const { weeks, monthTotal } = useMemo(() => {
    const firstOfMonth = new Date(Date.UTC(year, month, 1));
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const startWeekday = firstOfMonth.getUTCDay();

    const cells: ({ date: string; count: number } | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    let total = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(Date.UTC(year, month, d)).toISOString().slice(0, 10);
      const count = byDate.get(date)?.solvedCount ?? 0;
      total += count;
      cells.push({ date, count });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const rows: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return { weeks: rows, monthTotal: total };
  }, [byDate, year, month]);

  function prevMonth() {
    if (month === 0) onNavigate(year - 1, 11);
    else onNavigate(year, month - 1);
  }
  function nextMonth() {
    if (month === 11) onNavigate(year + 1, 0);
    else onNavigate(year, month + 1);
  }

  const now = new Date();
  const isCurrentMonth = now.getUTCFullYear() === year && now.getUTCMonth() === month;
  const hovered = hoverDate ? byDate.get(hoverDate) : null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={prevMonth} className="btn-ghost !p-1.5" aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <div className="text-[13px] font-medium text-ink-100">
            {MONTH_NAMES[month]} {year}
          </div>
          <div className="text-[11px] text-ink-500">{monthTotal} solved</div>
        </div>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="btn-ghost !p-1.5 disabled:opacity-30"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mx-auto grid w-fit grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[9px] uppercase tracking-wide text-ink-600">
            {label[0]}
          </div>
        ))}
        {weeks.flatMap((week, wi) =>
          week.map((cell, di) =>
            cell ? (
              <div
                key={cell.date}
                onMouseEnter={() => setHoverDate(cell.date)}
                onMouseLeave={() => setHoverDate((d) => (d === cell.date ? null : d))}
                title={`${cell.date}: ${cell.count} solved`}
                className={cn('h-5 w-5 rounded-[3px] transition-colors', tone(cell.count))}
              />
            ) : (
              <div key={`${wi}-${di}`} className="h-5 w-5" />
            ),
          ),
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-[10.5px] text-ink-500">
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          {[0, 1, 2, 4].map((c) => (
            <div key={c} className={cn('h-2.5 w-2.5 rounded-[2px]', tone(c))} />
          ))}
          <span>More</span>
        </div>
        <span className="tabular-nums">
          {hovered ? `${hoverDate}: ${hovered.solvedCount} solved` : ''}
        </span>
      </div>
    </div>
  );
}
