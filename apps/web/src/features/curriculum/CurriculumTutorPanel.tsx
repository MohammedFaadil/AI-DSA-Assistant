'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, GraduationCap, Send, Sparkles, X } from 'lucide-react';
import type { TeachMessageDto } from '@repo/contracts';
import { cn } from '@/lib/utils';
import { ResponseBlockView } from '@/components/ui/ResponseBlockView';
import { useCurriculumTutor } from './useCurriculumTutor';

interface Props {
  sectionSlug: string;
  sectionTitle: string;
  open: boolean;
  onClose: () => void;
}

/**
 * AI Training — a persistent tutor thread scoped to one curriculum section.
 * Mounted once at the Curriculum page level (not per-section-card) so
 * opening a different section's tutor doesn't leave N chat panels mounted.
 */
export function CurriculumTutorPanel({ sectionSlug, sectionTitle, open, onClose }: Props) {
  const router = useRouter();
  const { conversation, send, handoff } = useCurriculumTutor(sectionSlug);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = conversation.data?.messages ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages.length, send.isPending]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || send.isPending) return;
    setDraft('');
    send.mutate(content);
  }

  async function practiceNow() {
    const result = await handoff.mutateAsync();
    onClose();
    if (result.problemSlug) {
      router.push(`/problems/${result.problemSlug}/solve`);
    } else {
      router.push(
        `/practice?topic=${encodeURIComponent(result.practiceGenerateHint ?? sectionTitle)}`,
      );
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-ink-700 bg-ink-900 shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-700/70 px-4 py-3.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent-soft">
                  <GraduationCap className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink-100">AI Training</div>
                  <div className="truncate text-[11.5px] text-ink-500">{sectionTitle}</div>
                </div>
              </div>
              <button onClick={onClose} className="btn-ghost !p-2" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {messages.length === 0 && !send.isPending ? (
                <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                  <Sparkles className="mb-3 h-7 w-7 text-ink-600" />
                  <p className="text-sm text-ink-400">Ask anything about this concept.</p>
                  <p className="mt-1.5 text-xs text-ink-500">
                    Full explanations, worked examples and code are all fair game here — there is no
                    problem to protect, just a concept to learn.
                  </p>
                </div>
              ) : null}

              {messages.map((message) => (
                <TeachBubble key={message.id} message={message} />
              ))}

              {send.isPending ? (
                <div className="flex items-center gap-2 px-1 text-xs text-ink-400">
                  <Bot className="h-3.5 w-3.5" />
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent-soft"
                        style={{ animationDelay: `${i * 120}ms` }}
                      />
                    ))}
                  </span>
                  thinking&hellip;
                </div>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-ink-700/70 p-3">
              <button
                onClick={practiceNow}
                disabled={handoff.isPending}
                className="btn-outline mb-2 w-full !py-2 text-[13px]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Practise this now
              </button>
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
                  placeholder="Ask about this concept…"
                  className="input min-h-[2.75rem] resize-none py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || send.isPending}
                  className="btn-primary !px-2.5 !py-2.5"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function TeachBubble({ message }: { message: TeachMessageDto }) {
  if (message.role === 'USER') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-br-sm bg-accent/15 px-3 py-2 text-sm text-ink-100">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('space-y-2')}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-500">
        <GraduationCap className="h-3 w-3" />
        tutor
      </div>
      {message.blocks && message.blocks.length > 0 ? (
        message.blocks.map((block, i) => <ResponseBlockView key={i} block={block} />)
      ) : (
        <div className="text-sm text-ink-200">{message.content}</div>
      )}
    </motion.div>
  );
}
