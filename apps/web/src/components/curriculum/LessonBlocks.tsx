'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Lightbulb,
  ListChecks,
  AlertTriangle,
  Gauge,
  FlaskConical,
  type LucideIcon,
} from 'lucide-react';
import type { CurriculumBlock } from '@repo/contracts';
import { cn, renderMarkdown } from '@/lib/utils';

const KIND_ICON: Record<CurriculumBlock['kind'], LucideIcon> = {
  INTRO: BookOpen,
  INTUITION: Lightbulb,
  WALKTHROUGH: FlaskConical,
  EXAMPLE: FlaskConical,
  PITFALL: AlertTriangle,
  COMPLEXITY: Gauge,
  SUMMARY: ListChecks,
};

/**
 * Textbook-depth content below the short lesson overview — an in-panel table
 * of contents (one pill per block) switching a single active block, rather
 * than dumping 1500+ words at once into an already-busy card.
 */
export function LessonBlocks({ blocks }: { blocks: CurriculumBlock[] }) {
  const [active, setActive] = useState(0);
  if (blocks.length === 0) return null;

  const current = blocks[active] ?? blocks[0]!;

  return (
    <div className="mt-6 border-t border-ink-800 pt-5">
      <div className="card-eyebrow mb-2.5">Go deeper</div>
      <div className="flex flex-wrap gap-1.5">
        {blocks.map((block, i) => {
          const Icon = KIND_ICON[block.kind] ?? BookOpen;
          return (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn(
                'chip transition-colors',
                active === i
                  ? 'border-accent/50 bg-accent/12 text-accent-soft'
                  : 'hover:border-ink-600 hover:text-ink-200',
              )}
            >
              <Icon className="h-2.5 w-2.5" />
              {block.heading}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="prose-mentor mt-4 text-[13.5px]"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(current.body) }}
        />
      </AnimatePresence>
    </div>
  );
}
