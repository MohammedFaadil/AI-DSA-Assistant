'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { AssistMode, Language, ProblemDetail, WorkspaceSessionDto } from '@repo/contracts';
import { API_URL, api } from '@/lib/api-client';
import { connectSocket, type WorkspaceSocket } from '@/lib/socket';
import { useWorkspaceStore } from '@/stores/workspace.store';

/** The 2-second debounce from the design. Never per keystroke. */
const SYNC_DEBOUNCE_MS = 2000;
/** Behavioural heartbeat — this is what can fire IDLE_STUCK while nothing is typed. */
const BEHAVIOUR_TICK_MS = 5000;
const DRAFT_KEY = (problemId: string, language: string) => `adm:draft:${problemId}:${language}`;

interface Telemetry {
  editCount: number;
  backspaces: number;
  charsTyped: number;
  lastEditAt: number;
  startedAt: number;
  dwellLine: number | null;
}

export function useWorkspaceSession(problem: ProblemDetail | undefined) {
  const store = useWorkspaceStore();
  const socketRef = useRef<WorkspaceSocket | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const telemetry = useRef<Telemetry>({
    editCount: 0,
    backspaces: 0,
    charsTyped: 0,
    lastEditAt: Date.now(),
    startedAt: Date.now(),
    dwellLine: null,
  });

  /* ── Open the session (this is also the AI service warm-up trigger) ────*/
  useEffect(() => {
    if (!problem) return;
    let cancelled = false;

    (async () => {
      // ADR-004: waking the AI service the moment a workspace opens means the
      // free-tier cold start is absorbed by the time spent reading the problem.
      void fetch(`${API_URL}/healthz`, { method: 'GET' }).catch(() => undefined);

      const session = await api.post<WorkspaceSessionDto>('/v1/workspace/sessions', {
        problemId: problem.id,
        language: store.language,
        assistMode: store.assistMode,
      });
      if (cancelled) return;

      store.setSession({
        sessionId: session.id,
        problemId: problem.id,
        language: session.language,
        assistMode: session.assistMode,
      });

      // Local draft wins over the server copy when it is newer — the editor is
      // local-first and must never lose work to a slow round trip (ADR-011).
      const local = readLocalDraft(problem.id, session.language);
      const starter = await api
        .get<{ code: string }>(`/v1/problems/${problem.slug}/starter-code`, {
          query: { language: session.language },
        })
        .then((r) => r.code)
        .catch(() => '');

      if (!cancelled && local) store.setCode(local);
      else if (!cancelled) store.setCode(starter);

      const socket = connectSocket();
      socketRef.current = socket;
      wire(socket);

      socket.emit('session:join', { sessionId: session.id }, (res) => {
        if (!res.ok || !res.state) return;
        store.setConnected(true);
        // Server draft only replaces the buffer when we have nothing local.
        if (!local && res.state.code.trim()) store.setCode(res.state.code);
        if (res.state.hintsUsed.length) {
          res.state.hintsUsed.forEach((level) => store.unlockHint(level, ''));
        }
      });
    })().catch(() => undefined);

    return () => {
      cancelled = true;
      const socket = socketRef.current;
      const sessionId = useWorkspaceStore.getState().sessionId;
      if (socket && sessionId) socket.emit('session:leave', { sessionId });
      socket?.removeAllListeners();
      if (syncTimer.current) clearTimeout(syncTimer.current);
      store.reset();
    };
    // Intentionally keyed on the problem only: language/mode changes are
    // handled in place rather than by tearing the session down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem?.id]);

  /* ── Socket wiring ────────────────────────────────────────────────────*/
  const wire = useCallback((socket: WorkspaceSocket) => {
    const s = useWorkspaceStore.getState();

    socket.on('connect', () => s.setConnected(true));
    socket.on('disconnect', () => s.setConnected(false));

    socket.on('ai:signals', ({ signals, quality }) => {
      const store = useWorkspaceStore.getState();
      store.setSignals(signals);
      store.setQuality(quality);
    });
    socket.on('ai:line-review', ({ review }) => useWorkspaceStore.getState().setLineReview(review));
    socket.on('ai:suggestion', ({ suggestions }) =>
      useWorkspaceStore.getState().setSuggestions(suggestions),
    );
    socket.on('ai:typing', ({ agent }) => useWorkspaceStore.getState().setTyping(agent));

    socket.on('ai:message:start', ({ messageId, agent }) =>
      useWorkspaceStore.getState().startAssistantMessage(messageId, agent),
    );
    socket.on('ai:message:block', ({ messageId, block }) =>
      useWorkspaceStore.getState().appendBlock(messageId, block),
    );
    socket.on('ai:message:done', ({ messageId, fallbackUsed, cacheHit }) =>
      useWorkspaceStore.getState().completeMessage(messageId, { fallbackUsed, cacheHit }),
    );
    socket.on('ai:message:error', ({ messageId, message }) =>
      useWorkspaceStore.getState().failMessage(messageId, message),
    );
    socket.on('ai:hint:unlocked', ({ level, content }) =>
      useWorkspaceStore.getState().unlockHint(level, content),
    );
    socket.on('ai:ghost', ({ text }) => useWorkspaceStore.getState().setGhostText(text));

    socket.on('code:ack', ({ revision }) => useWorkspaceStore.getState().markSaved(revision));

    socket.on('exec:queued', ({ executionId, totalTests }) =>
      useWorkspaceStore.getState().startExecution(executionId, totalTests),
    );
    socket.on('exec:update', ({ completed, total, lastVerdict }) =>
      useWorkspaceStore.getState().updateExecution({
        status: 'running',
        completed,
        total,
        verdict: lastVerdict,
      }),
    );
    socket.on('exec:complete', (payload) =>
      useWorkspaceStore.getState().updateExecution({
        status: 'done',
        verdict: payload.verdict,
        passedTests: payload.passedTests,
        total: payload.totalTests,
        completed: payload.totalTests,
        runtimeMs: payload.runtimeMs,
        memoryKb: payload.memoryKb,
        compileOutput: payload.compileOutput,
        errorMessage: payload.errorMessage,
        results: payload.results,
      }),
    );

    socket.on('system:degraded', ({ subsystem, reason }) =>
      useWorkspaceStore.getState().setDegraded(`${subsystem}: ${reason}`),
    );
    socket.on('quota:warning', ({ resource, remaining }) =>
      useWorkspaceStore
        .getState()
        .setDegraded(`${remaining} ${resource} runs left today`),
    );
  }, []);

  /* ── Debounced sync: the 2-second tick ────────────────────────────────*/
  const scheduleSync = useCallback((code: string, previousLength: number) => {
    const t = telemetry.current;
    t.editCount += 1;
    t.lastEditAt = Date.now();
    const delta = code.length - previousLength;
    if (delta > 0) t.charsTyped += delta;
    else t.backspaces += Math.abs(delta);

    const state = useWorkspaceStore.getState();
    if (state.problemId) {
      // Mirror to localStorage on every edit — the socket may be down, the tab
      // may be closed; the learner's code survives either way.
      writeLocalDraft(state.problemId, state.language, code);
    }

    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const current = useWorkspaceStore.getState();
      const socket = socketRef.current;
      if (!socket?.connected || !current.sessionId) return;
      socket.emit('code:sync', {
        sessionId: current.sessionId,
        revision: current.revision,
        code: current.code,
        cursor: null,
        language: current.language,
      });
    }, SYNC_DEBOUNCE_MS);
  }, []);

  /* ── Behavioural heartbeat ────────────────────────────────────────────*/
  useEffect(() => {
    const interval = setInterval(() => {
      const socket = socketRef.current;
      const state = useWorkspaceStore.getState();
      if (!socket?.connected || !state.sessionId) return;
      const t = telemetry.current;
      socket.emit('behaviour:tick', {
        sessionId: state.sessionId,
        idleMs: Date.now() - t.lastEditAt,
        editCount: t.editCount,
        backspaces: t.backspaces,
        charsTyped: t.charsTyped,
        dwellLine: t.dwellLine,
        elapsedMs: Date.now() - t.startedAt,
      });
    }, BEHAVIOUR_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  /* ── Actions ──────────────────────────────────────────────────────────*/
  const onCodeChange = useCallback(
    (next: string) => {
      const previous = useWorkspaceStore.getState().code;
      useWorkspaceStore.getState().setCode(next);
      scheduleSync(next, previous.length);
    },
    [scheduleSync],
  );

  const onCursorChange = useCallback((line: number, column: number) => {
    telemetry.current.dwellLine = line;
    const socket = socketRef.current;
    const state = useWorkspaceStore.getState();
    if (socket?.connected && state.sessionId) {
      socket.emit('code:cursor', { sessionId: state.sessionId, line, column });
    }
  }, []);

  const sendMessage = useCallback((content: string) => {
    const state = useWorkspaceStore.getState();
    const socket = socketRef.current;
    if (!state.sessionId) return;
    state.pushUserMessage(content);
    state.setTyping('PLANNER');
    socket?.emit('ai:chat:send', { sessionId: state.sessionId, content }, (res) => {
      if (!res.ok) {
        useWorkspaceStore
          .getState()
          .setTyping(null);
      }
    });
  }, []);

  const requestHint = useCallback((level?: number) => {
    const state = useWorkspaceStore.getState();
    if (!state.sessionId) return;
    state.setTyping('HINT');
    socketRef.current?.emit('ai:hint:request', { sessionId: state.sessionId, level });
  }, []);

  const changeAssistMode = useCallback((mode: AssistMode) => {
    const state = useWorkspaceStore.getState();
    state.setAssistMode(mode);
    if (state.sessionId) {
      socketRef.current?.emit('ai:mode:set', { sessionId: state.sessionId, assistMode: mode });
    }
  }, []);

  const toggleLineReview = useCallback((enabled: boolean) => {
    const state = useWorkspaceStore.getState();
    state.toggleLineReview(enabled);
    if (enabled && state.sessionId) {
      socketRef.current?.emit('ai:line-review:request', { sessionId: state.sessionId });
    }
  }, []);

  const dismissSuggestion = useCallback((id: string) => {
    const state = useWorkspaceStore.getState();
    state.dismissSuggestion(id);
    if (state.sessionId) {
      socketRef.current?.emit('ai:dismiss', { sessionId: state.sessionId, suggestionId: id });
    }
  }, []);

  const changeLanguage = useCallback(
    async (language: Language) => {
      const state = useWorkspaceStore.getState();
      if (!problem || !state.sessionId) return;
      state.setLanguage(language);
      await api.patch(`/v1/workspace/sessions/${state.sessionId}`, { language }).catch(() => undefined);

      const local = readLocalDraft(problem.id, language);
      if (local) {
        state.setCode(local);
        return;
      }
      const starter = await api
        .get<{ code: string }>(`/v1/problems/${problem.slug}/starter-code`, { query: { language } })
        .then((r) => r.code)
        .catch(() => '');
      state.setCode(starter);
    },
    [problem],
  );

  const execute = useCallback(
    async (mode: 'RUN' | 'SUBMIT') => {
      const state = useWorkspaceStore.getState();
      if (!state.problemId) return;
      state.resetExecution();
      state.updateExecution({ status: 'queued' });

      const started = await api.post<{ executionId: string; totalTests: number }>(
        '/v1/executions',
        {
          problemId: state.problemId,
          sessionId: state.sessionId ?? undefined,
          language: state.language,
          code: state.code,
          mode,
        },
      );
      state.startExecution(started.executionId, started.totalTests);
      socketRef.current?.emit('exec:subscribe', { executionId: started.executionId });
    },
    [],
  );

  const saveToLibrary = useCallback(async (note?: string, tags?: string[]) => {
    const state = useWorkspaceStore.getState();
    if (!state.problemId) return;
    await api.post('/v1/library', {
      problemId: state.problemId,
      language: state.language,
      code: state.code,
      note,
      tags,
    });
  }, []);

  return {
    onCodeChange,
    onCursorChange,
    sendMessage,
    requestHint,
    changeAssistMode,
    changeLanguage,
    dismissSuggestion,
    toggleLineReview,
    execute,
    saveToLibrary,
  };
}

function readLocalDraft(problemId: string, language: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(DRAFT_KEY(problemId, language));
  } catch {
    return null;
  }
}

function writeLocalDraft(problemId: string, language: string, code: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DRAFT_KEY(problemId, language), code);
  } catch {
    /* quota or private mode — the socket sync still covers durability */
  }
}
