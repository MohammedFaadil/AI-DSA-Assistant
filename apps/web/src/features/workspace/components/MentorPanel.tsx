'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Bot,
  Gauge,
  Lightbulb,
  ListTree,
  Save,
  Send,
  Sparkles,
  WifiOff,
  Zap,
} from 'lucide-react';
import type { AssistMode } from '@repo/contracts';
import { cn } from '@/lib/utils';
import { useWorkspaceStore, type MentorMessage } from '@/stores/workspace.store';
import { StrengthMeter } from '@/components/ui/StrengthMeter';
import { ResponseBlockView } from '@/components/ui/ResponseBlockView';

const MODES: { value: AssistMode; label: string; hint: string }[] = [
  { value: 'EASY', label: 'Easy', hint: 'Explains everything. Interrupts sooner.' },
  { value: 'MODERATE', label: 'Moderate', hint: 'Logic, edge cases and complexity only.' },
  { value: 'HIGH', label: 'High', hint: 'Direct, deeper, plus inline completion.' },
];

interface Props {
  onSend: (content: string) => void;
  onHint: (level?: number) => void;
  onModeChange: (mode: AssistMode) => void;
  onDismiss: (id: string) => void;
  onToggleLineReview: (enabled: boolean) => void;
  onSaveToLibrary: () => void;
}

export function MentorPanel({
  onSend,
  onHint,
  onModeChange,
  onDismiss,
  onToggleLineReview,
  onSaveToLibrary,
}: Props) {
  const {
    messages,
    mentorTyping,
    signals,
    quality,
    lineReviewEnabled,
    suggestions,
    assistMode,
    connected,
    hintsUnlocked,
    degraded,
  } = useWorkspaceStore();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, mentorTyping]);

  const nextHint = Math.min(3, (hintsUnlocked.at(-1) ?? 0) + 1);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    onSend(content);
    setDraft('');
  }

  return (
    <div className="flex h-full flex-col bg-ink-900/40">
      {/* Live signal strip — deterministic, updated every 2s, costs nothing */}
      <div className="shrink-0 border-b border-ink-700/70 px-4 py-3">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-ink-300">
            <Bot className="h-3.5 w-3.5 text-accent-soft" />
            Mentor
            {connected ? (
              <span className="h-1.5 w-1.5 rounded-full bg-easy" title="Connected" />
            ) : (
              <WifiOff className="h-3 w-3 text-medium" aria-label="Reconnecting" />
            )}
          </div>
          <div className="flex rounded-lg border border-ink-700 bg-ink-900 p-0.5">
            {MODES.map((mode) => (
              <button
                key={mode.value}
                onClick={() => onModeChange(mode.value)}
                title={mode.hint}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                  assistMode === mode.value
                    ? 'bg-accent/20 text-accent-soft'
                    : 'text-ink-400 hover:text-ink-200',
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <SignalTile
            icon={Gauge}
            label="Complexity"
            value={signals?.inferredTime ?? '—'}
            tone={
              !signals
                ? 'muted'
                : signals.matchesExpectedBand
                  ? 'good'
                  : signals.complexityConfidence >= 0.6
                    ? 'warn'
                    : 'muted'
            }
          />
          <SignalTile
            icon={Sparkles}
            label="Approach"
            value={signals?.algorithmFingerprint?.replace(/_/g, ' ') ?? 'not yet clear'}
            tone="muted"
          />
        </div>

        {signals ? (
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-ink-500">
            <span className="chip !py-0.5 text-[10px]">
              loop depth {signals.maxLoopDepth}
            </span>
            <span className="chip !py-0.5 text-[10px]">
              {signals.findings.length} finding{signals.findings.length === 1 ? '' : 's'}
            </span>
            <span className="chip !py-0.5 text-[10px]">
              {Math.round(signals.progressEstimate * 100)}% complete
            </span>
          </div>
        ) : null}

        {/* The strength meter — a byproduct of the same 2s parse as the signals
            above, so it costs nothing extra and updates in lockstep. */}
        <div className="mt-2.5">
          <StrengthMeter report={quality} compact />
        </div>

        <button
          onClick={() => onToggleLineReview(!lineReviewEnabled)}
          className={cn(
            'mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors',
            lineReviewEnabled
              ? 'border-accent/40 bg-accent/12 text-accent-soft'
              : 'border-ink-700 text-ink-400 hover:border-ink-600 hover:text-ink-200',
          )}
        >
          <ListTree className="h-3.5 w-3.5" />
          {lineReviewEnabled ? 'Line-by-line review is on' : 'Turn on line-by-line review'}
        </button>
      </div>

      {degraded ? (
        <div className="flex items-center gap-2 border-b border-medium/25 bg-medium/10 px-4 py-2 text-[11px] text-medium">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {degraded}
        </div>
      ) : null}

      {/* Inline suggestions from the deterministic pass */}
      <AnimatePresence initial={false}>
        {suggestions.length > 0 ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 overflow-hidden border-b border-ink-700/70"
          >
            <ul className="max-h-32 space-y-1 overflow-y-auto p-2">
              {suggestions.slice(0, 4).map((suggestion) => (
                <li
                  key={suggestion.id}
                  className={cn(
                    'flex items-start gap-2 rounded-md px-2.5 py-1.5 text-[11px] leading-snug',
                    suggestion.severity === 'ERROR'
                      ? 'bg-hard/10 text-hard'
                      : suggestion.severity === 'WARNING'
                        ? 'bg-medium/10 text-medium'
                        : 'bg-ink-800/60 text-ink-300',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    {suggestion.range ? (
                      <span className="mr-1 font-mono opacity-70">
                        L{suggestion.range.startLine + 1}
                      </span>
                    ) : null}
                    {suggestion.message}
                  </span>
                  {suggestion.dismissible ? (
                    <button
                      onClick={() => onDismiss(suggestion.id)}
                      className="shrink-0 opacity-50 transition-opacity hover:opacity-100"
                      aria-label="Dismiss"
                    >
                      ×
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Conversation */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !mentorTyping ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <Bot className="mb-3 h-7 w-7 text-ink-600" />
            <p className="text-sm text-ink-400">
              I&rsquo;m reading your code as you type.
            </p>
            <p className="mt-1.5 text-xs text-ink-500">
              I&rsquo;ll stay quiet unless something is worth saying — ask me anything, or take a
              hint when you want one.
            </p>
          </div>
        ) : null}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {mentorTyping ? (
          <div className="flex items-center gap-2 px-1 text-xs text-ink-400">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent-soft"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </span>
            {mentorTyping.toLowerCase().replace('_', ' ')} is thinking…
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-ink-700/70 p-3">
        <div className="mb-2 flex gap-1.5">
          <button
            onClick={() => onHint(nextHint)}
            disabled={hintsUnlocked.length >= 3}
            className="btn-outline flex-1 !py-1.5 text-xs"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            {hintsUnlocked.length >= 3 ? 'All hints used' : `Hint ${nextHint} of 3`}
          </button>
          <button
            onClick={() => onSend('Is my approach going to be fast enough for these constraints?')}
            className="btn-outline !py-1.5 text-xs"
            title="Ask about complexity"
          >
            <Zap className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onSaveToLibrary}
            className="btn-outline !py-1.5 text-xs"
            title="Save this code to your Library"
          >
            <Save className="h-3.5 w-3.5" />
          </button>
        </div>

        <form onSubmit={submit} className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
            rows={2}
            placeholder="Ask about your code…"
            className="input min-h-[2.75rem] resize-none py-2 text-sm"
          />
          <button type="submit" disabled={!draft.trim()} className="btn-primary !px-2.5 !py-2.5">
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-1.5 text-[10px] text-ink-600">
          It already knows the problem, your code and your last run.
        </p>
      </div>
    </div>
  );
}

function SignalTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'muted';
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-2.5 py-2',
        tone === 'good'
          ? 'border-easy/25 bg-easy/8'
          : tone === 'warn'
            ? 'border-medium/25 bg-medium/8'
            : 'border-ink-700 bg-ink-850',
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div
        className={cn(
          'mt-0.5 truncate font-mono text-xs',
          tone === 'good' ? 'text-easy' : tone === 'warn' ? 'text-medium' : 'text-ink-200',
        )}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: MentorMessage }) {
  if (message.role === 'USER') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-br-sm bg-accent/15 px-3 py-2 text-sm text-ink-100">
          {message.blocks.map((block, i) => (
            <span key={i}>{'content' in block ? block.content : null}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-2"
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-500">
        <Bot className="h-3 w-3" />
        {(message.agent ?? 'mentor').toLowerCase().replace('_', ' ')}
        {message.cacheHit ? <span className="text-ink-600">· cached</span> : null}
        {message.fallbackUsed ? <span className="text-medium">· offline hint</span> : null}
      </div>
      {message.blocks.map((block, index) => (
        <ResponseBlockView key={index} block={block} />
      ))}
      {message.pending && message.blocks.length === 0 ? (
        <div className="skeleton h-12" />
      ) : null}
    </motion.div>
  );
}
