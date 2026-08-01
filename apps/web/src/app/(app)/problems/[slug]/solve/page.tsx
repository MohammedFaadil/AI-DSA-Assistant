'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, Loader2, Play, RotateCcw, Send, Terminal } from 'lucide-react';
import type { Language, ProblemDetail } from '@repo/contracts';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useWorkspaceSession } from '@/features/workspace/useWorkspaceSession';
import { CodeEditor } from '@/features/workspace/components/CodeEditor';
import { ProblemPanel } from '@/features/workspace/components/ProblemPanel';
import { MentorPanel } from '@/features/workspace/components/MentorPanel';
import { ConsolePanel } from '@/features/workspace/components/ConsolePanel';
import { LineReviewPanel } from '@/features/workspace/components/LineReviewPanel';

const LANGUAGE_LABELS: Partial<Record<Language, string>> = {
  PYTHON: 'Python',
  JAVASCRIPT: 'JavaScript',
  CPP: 'C++',
  JAVA: 'Java',
};

export default function SolvePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [pendingMode, setPendingMode] = useState<'RUN' | 'SUBMIT' | null>(null);

  const problem = useQuery({
    queryKey: ['problem', slug],
    queryFn: () => api.get<ProblemDetail>(`/v1/problems/${slug}`),
  });

  const workspace = useWorkspaceSession(problem.data);
  const { code, language, execution, savedRevision, revision, lineReviewEnabled } =
    useWorkspaceStore();
  const [savedFlash, setSavedFlash] = useState(false);

  async function run(mode: 'RUN' | 'SUBMIT') {
    setPendingMode(mode);
    setConsoleOpen(true);
    try {
      await workspace.execute(mode);
    } finally {
      setPendingMode(null);
    }
  }

  async function handleSave() {
    try {
      await workspace.saveToLibrary();
      setSavedFlash(true);
    } catch {
      /* the composer button stays responsive either way */
    }
  }

  useEffect(() => {
    if (!savedFlash) return;
    const timer = setTimeout(() => setSavedFlash(false), 2200);
    return () => clearTimeout(timer);
  }, [savedFlash]);

  if (problem.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-ink-500" />
      </div>
    );
  }

  if (!problem.data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-ink-400">That problem does not exist.</p>
        <Link href="/problems" className="btn-outline">
          Back to problems
        </Link>
      </div>
    );
  }

  const busy = pendingMode !== null || execution.status === 'running' || execution.status === 'queued';

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Toolbar */}
      <header className="flex shrink-0 items-center gap-3 border-b border-ink-800 bg-ink-900/60 px-4 py-2">
        <Link
          href="/problems"
          className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-200"
          aria-label="Back to problems"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <span className="truncate text-sm font-medium">{problem.data.title}</span>

        <select
          value={language}
          onChange={(e) => void workspace.changeLanguage(e.target.value as Language)}
          className="ml-2 rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-200 focus:border-accent/60 focus:outline-none"
        >
          {problem.data.languages.map((lang) => (
            <option key={lang} value={lang}>
              {LANGUAGE_LABELS[lang] ?? lang}
            </option>
          ))}
        </select>

        <span className="text-[10px] text-ink-600">
          {savedRevision >= revision ? 'saved' : 'saving…'}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setFontSize((s) => Math.max(11, s - 1))}
            className="btn-ghost !px-2 !py-1 text-xs"
            aria-label="Decrease font size"
          >
            A−
          </button>
          <button
            onClick={() => setFontSize((s) => Math.min(22, s + 1))}
            className="btn-ghost !px-2 !py-1 text-xs"
            aria-label="Increase font size"
          >
            A+
          </button>

          <button
            onClick={() => {
              void api
                .get<{ code: string }>(`/v1/problems/${slug}/starter-code`, {
                  query: { language },
                })
                .then((r) => workspace.onCodeChange(r.code))
                .catch(() => undefined);
            }}
            className="btn-ghost !px-2 !py-1.5"
            title="Reset to starter code"
            aria-label="Reset to starter code"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => setConsoleOpen((v) => !v)}
            className={cn('btn-ghost !px-2 !py-1.5', consoleOpen && 'text-accent-soft')}
            title="Toggle console"
            aria-label="Toggle console"
          >
            <Terminal className="h-3.5 w-3.5" />
          </button>

          <button onClick={() => void run('RUN')} disabled={busy} className="btn-outline !py-1.5">
            {pendingMode === 'RUN' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Run
          </button>

          <button
            onClick={() => void run('SUBMIT')}
            disabled={busy}
            className="btn-success !py-1.5"
          >
            {pendingMode === 'SUBMIT' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Submit
          </button>
        </div>
      </header>

      {/* Three-pane workspace */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)_minmax(0,24rem)]">
        <section className="hidden min-h-0 border-r border-ink-800 lg:block">
          <ProblemPanel problem={problem.data} />
        </section>

        <section className="flex min-h-0 min-w-0 flex-col">
          <div className={cn('min-h-0', consoleOpen ? 'flex-1' : 'h-full')}>
            <CodeEditor
              language={language}
              value={code}
              fontSize={fontSize}
              onChange={workspace.onCodeChange}
              onCursorChange={workspace.onCursorChange}
            />
          </div>

          {consoleOpen ? (
            <div className="h-64 shrink-0 border-t border-ink-800 bg-ink-900/50">
              <ConsolePanel />
            </div>
          ) : null}
        </section>

        {lineReviewEnabled ? (
          <LineReviewPanel onClose={() => workspace.toggleLineReview(false)} />
        ) : null}

        <section className="hidden min-h-0 border-l border-ink-800 lg:block">
          <MentorPanel
            onSend={workspace.sendMessage}
            onHint={workspace.requestHint}
            onModeChange={workspace.changeAssistMode}
            onDismiss={workspace.dismissSuggestion}
            onToggleLineReview={workspace.toggleLineReview}
            onSaveToLibrary={() => void handleSave()}
          />
        </section>
      </div>

      {/* Save confirmation toast */}
      {savedFlash ? (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border border-easy/30 bg-ink-900 px-3.5 py-2.5 text-sm text-easy shadow-glow animate-fade-up">
          <Check className="h-4 w-4" />
          Saved to your Library
        </div>
      ) : null}
    </div>
  );
}
