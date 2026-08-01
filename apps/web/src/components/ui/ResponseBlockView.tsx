import { AlertTriangle, Lightbulb } from 'lucide-react';
import type { ResponseBlock } from '@repo/contracts';
import { cn, renderMarkdown } from '@/lib/utils';

/**
 * Renders one structured agent response block. Shared by the problem-solving
 * MentorPanel and the curriculum AI Training tutor panel so both surfaces
 * render identically without duplicating this switch.
 */
export function ResponseBlockView({ block }: { block: ResponseBlock }) {
  switch (block.type) {
    case 'text':
      return (
        <div
          className="prose-mentor text-sm"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(block.content) }}
        />
      );

    case 'question':
      return (
        <div className="rounded-lg border-l-2 border-accent bg-accent/8 px-3 py-2 text-sm text-ink-100">
          {block.content}
        </div>
      );

    case 'hint':
      return (
        <div className="rounded-lg border border-medium/25 bg-medium/8 px-3 py-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-medium">
            <Lightbulb className="h-3 w-3" />
            Hint {block.level}
          </div>
          <div
            className="prose-mentor text-sm"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(block.content) }}
          />
        </div>
      );

    case 'complexity':
      return (
        <div className="rounded-lg border border-ink-700 bg-ink-850 p-3">
          <div className="mb-2 flex items-center gap-3 font-mono text-xs">
            <span className="text-medium">{block.current}</span>
            <span className="text-ink-600">&rarr;</span>
            <span className="text-easy">{block.target}</span>
          </div>
          <div
            className="prose-mentor text-sm"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(block.explanation),
            }}
          />
        </div>
      );

    case 'diagnostic':
      return (
        <div
          className={cn(
            'flex items-start gap-2 rounded-lg px-3 py-2 text-sm',
            block.severity === 'ERROR'
              ? 'bg-hard/10 text-hard'
              : block.severity === 'WARNING'
                ? 'bg-medium/10 text-medium'
                : 'bg-ink-800 text-ink-300',
          )}
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{block.message}</span>
        </div>
      );

    case 'code':
      return (
        <div className="overflow-hidden rounded-lg border border-ink-700">
          {block.caption ? (
            <div className="border-b border-ink-700 bg-ink-900 px-3 py-1.5 text-[10px] text-ink-500">
              {block.caption}
            </div>
          ) : null}
          <pre className="overflow-x-auto bg-ink-900 p-3 font-mono text-xs leading-relaxed text-ink-200">
            <code>{block.content}</code>
          </pre>
        </div>
      );
  }
}
