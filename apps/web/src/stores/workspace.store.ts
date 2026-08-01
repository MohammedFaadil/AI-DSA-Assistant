'use client';

import { create } from 'zustand';
import type {
  AgentType,
  AiSuggestion,
  AssistMode,
  Language,
  LineReview,
  QualityReport,
  ResponseBlock,
  SessionSignals,
  TestResult,
  Verdict,
} from '@repo/contracts';

export interface MentorMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  agent: AgentType | null;
  blocks: ResponseBlock[];
  createdAt: string;
  pending?: boolean;
  fallbackUsed?: boolean;
  cacheHit?: boolean;
}

export interface ExecutionState {
  id: string | null;
  status: 'idle' | 'queued' | 'running' | 'done';
  completed: number;
  total: number;
  verdict: Verdict | null;
  passedTests: number;
  runtimeMs: number | null;
  memoryKb: number | null;
  compileOutput: string | null;
  errorMessage: string | null;
  results: TestResult[];
}

const emptyExecution: ExecutionState = {
  id: null,
  status: 'idle',
  completed: 0,
  total: 0,
  verdict: null,
  passedTests: 0,
  runtimeMs: null,
  memoryKb: null,
  compileOutput: null,
  errorMessage: null,
  results: [],
};

interface WorkspaceState {
  sessionId: string | null;
  problemId: string | null;
  language: Language;
  assistMode: AssistMode;

  /** Local-first: this is the source of truth, the socket is only a sync channel. */
  code: string;
  revision: number;
  savedRevision: number;

  connected: boolean;
  signals: SessionSignals | null;
  quality: QualityReport | null;
  lineReview: LineReview | null;
  lineReviewEnabled: boolean;
  suggestions: AiSuggestion[];
  messages: MentorMessage[];
  mentorTyping: AgentType | null;
  ghostText: string;
  hintsUnlocked: number[];
  execution: ExecutionState;
  degraded: string | null;

  setSession: (p: { sessionId: string; problemId: string; language: Language; assistMode: AssistMode }) => void;
  setCode: (code: string) => void;
  setLanguage: (language: Language) => void;
  setAssistMode: (mode: AssistMode) => void;
  setConnected: (connected: boolean) => void;
  setSignals: (signals: SessionSignals) => void;
  setQuality: (quality: QualityReport) => void;
  setLineReview: (review: LineReview) => void;
  toggleLineReview: (enabled: boolean) => void;
  setSuggestions: (suggestions: AiSuggestion[]) => void;
  dismissSuggestion: (id: string) => void;
  setTyping: (agent: AgentType | null) => void;
  setGhostText: (text: string) => void;
  markSaved: (revision: number) => void;

  pushUserMessage: (content: string) => string;
  startAssistantMessage: (id: string, agent: AgentType) => void;
  appendBlock: (id: string, block: ResponseBlock) => void;
  completeMessage: (id: string, meta: { fallbackUsed?: boolean; cacheHit?: boolean }) => void;
  failMessage: (id: string, message: string) => void;
  setMessages: (messages: MentorMessage[]) => void;
  unlockHint: (level: number, content: string) => void;

  startExecution: (id: string, total: number) => void;
  updateExecution: (patch: Partial<ExecutionState>) => void;
  resetExecution: () => void;
  setDegraded: (reason: string | null) => void;
  reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  sessionId: null,
  problemId: null,
  language: 'PYTHON',
  assistMode: 'MODERATE',
  code: '',
  revision: 0,
  savedRevision: 0,
  connected: false,
  signals: null,
  quality: null,
  lineReview: null,
  lineReviewEnabled: false,
  suggestions: [],
  messages: [],
  mentorTyping: null,
  ghostText: '',
  hintsUnlocked: [],
  execution: emptyExecution,
  degraded: null,

  setSession: (p) => set({ ...p }),
  setCode: (code) => set((s) => ({ code, revision: s.revision + 1 })),
  setLanguage: (language) => set({ language }),
  setAssistMode: (assistMode) => set({ assistMode }),
  setConnected: (connected) => set({ connected }),
  setSignals: (signals) => set({ signals }),
  setQuality: (quality) => set({ quality }),
  setLineReview: (lineReview) => set({ lineReview }),
  toggleLineReview: (lineReviewEnabled) => set({ lineReviewEnabled }),
  setSuggestions: (suggestions) => set({ suggestions }),
  dismissSuggestion: (id) =>
    set((s) => ({ suggestions: s.suggestions.filter((sg) => sg.id !== id) })),
  setTyping: (mentorTyping) => set({ mentorTyping }),
  setGhostText: (ghostText) => set({ ghostText }),
  markSaved: (savedRevision) => set({ savedRevision }),

  pushUserMessage: (content) => {
    const id = `local-${Date.now()}`;
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id,
          role: 'USER',
          agent: null,
          blocks: [{ type: 'text', content }],
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    return id;
  },

  startAssistantMessage: (id, agent) =>
    set((s) => {
      if (s.messages.some((m) => m.id === id)) return s;
      return {
        mentorTyping: null,
        messages: [
          ...s.messages,
          {
            id,
            role: 'ASSISTANT',
            agent,
            blocks: [],
            createdAt: new Date().toISOString(),
            pending: true,
          },
        ],
      };
    }),

  appendBlock: (id, block) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, blocks: [...m.blocks, block] } : m,
      ),
    })),

  completeMessage: (id, meta) =>
    set((s) => ({
      mentorTyping: null,
      messages: s.messages.map((m) => (m.id === id ? { ...m, pending: false, ...meta } : m)),
    })),

  failMessage: (id, message) =>
    set((s) => ({
      mentorTyping: null,
      messages: s.messages.map((m) =>
        m.id === id
          ? { ...m, pending: false, blocks: [{ type: 'text', content: message }] }
          : m,
      ),
    })),

  setMessages: (messages) => set({ messages }),

  unlockHint: (level, content) =>
    set((s) => ({
      hintsUnlocked: s.hintsUnlocked.includes(level)
        ? s.hintsUnlocked
        : [...s.hintsUnlocked, level].sort(),
      messages: [
        ...s.messages,
        {
          id: `hint-${level}-${Date.now()}`,
          role: 'ASSISTANT',
          agent: 'HINT',
          blocks: [{ type: 'hint', level, content }],
          createdAt: new Date().toISOString(),
        },
      ],
    })),

  startExecution: (id, total) =>
    set({ execution: { ...emptyExecution, id, status: 'queued', total } }),

  updateExecution: (patch) => set({ execution: { ...get().execution, ...patch } }),
  resetExecution: () => set({ execution: emptyExecution }),
  setDegraded: (degraded) => set({ degraded }),

  reset: () =>
    set({
      sessionId: null,
      problemId: null,
      code: '',
      revision: 0,
      savedRevision: 0,
      signals: null,
      quality: null,
      lineReview: null,
      lineReviewEnabled: false,
      suggestions: [],
      messages: [],
      mentorTyping: null,
      ghostText: '',
      hintsUnlocked: [],
      execution: emptyExecution,
      degraded: null,
    }),
}));
