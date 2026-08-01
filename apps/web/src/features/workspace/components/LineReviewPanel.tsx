'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Minus, X } from 'lucide-react';
import type { LineNote } from '@repo/contracts';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/workspace.store';

const ROLE_CONFIG: Record<
  LineNote['role'],
  { icon: typeof CheckCircle2; dot: string; text: string; bg: string }
> = {
  GOOD: { icon: CheckCircle2, dot: 'bg-easy', text: 'text-easy', bg: 'bg-easy/5' },
  NEUTRAL: { icon: Minus, dot: 'bg-ink-500', text: 'text-ink-400', bg: '' },
  IMPROVE: { icon: ArrowUpRight, dot: 'bg-medium', text: 'text-medium', bg: 'bg-medium/5' },
  RISK: { icon: AlertTriangle, dot: 'bg-hard', text: 'text-hard', bg: 'bg-hard/5' },
};

/**
 * Line-by-line recommendation mode.
 *
 * Deterministic annotations from the same Stage-1 analysis, rendered as a
 * gutter-aligned rail beside the editor rather than inline decorations — dense
 * per-line prose inside Monaco itself would crowd the code. Every note is
 * skippable by design: only lines with something worth saying are annotated.
 */
export function LineReviewPanel({ onClose }: { onClose: () => void }) {
  const review = useWorkspaceStore((s) => s.lineReview);

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l border-ink-700/70 bg-ink-900/60">
      <div className="flex items-center justify-between border-b border-ink-700/70 px-3 py-2.5">
        <span className="text-xs font-medium text-ink-200">Line-by-line review</span>
        <button
          onClick={onClose}
          className="rounded p-1 text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
          aria-label="Close line review"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {review ? (
        <div className="border-b border-ink-700/70 px-3 py-2 text-[11px] text-ink-400">
          {review.summary}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!review || review.notes.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-ink-500">
            Write some code and each meaningful line gets a note here.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            <ul className="space-y-1.5">
              {review.notes.map((note) => {
                const config = ROLE_CONFIG[note.role];
                const Icon = config.icon;
                return (
                  <motion.li
                    key={`${note.line}-${note.what.slice(0, 20)}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn('rounded-md border border-ink-800 px-2.5 py-2', config.bg)}
                  >
                    <div className="flex items-start gap-1.5">
                      <span className="mt-0.5 font-mono text-[10px] text-ink-600">
                        L{note.line + 1}
                      </span>
                      <Icon className={cn('mt-0.5 h-3 w-3 shrink-0', config.text)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] leading-snug text-ink-200">{note.what}</p>
                        {note.why ? (
                          <p className="mt-0.5 text-[10px] leading-snug text-ink-500">{note.why}</p>
                        ) : null}
                        {note.fix ? (
                          <p className={cn('mt-1 text-[10px] font-medium leading-snug', config.text)}>
                            → {note.fix}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </AnimatePresence>
        )}
      </div>

      {review && review.notes.length > 0 ? (
        <div className="flex items-center gap-3 border-t border-ink-700/70 px-3 py-2 text-[10px] text-ink-500">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-hard" />
            risk
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-medium" />
            improve
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-easy" />
            good
          </span>
        </div>
      ) : null}
    </div>
  );
}
