/**
 * Typed Socket.IO event maps.
 *
 * Importing these on both the server (`Server<ClientToServerEvents, ServerToClientEvents>`)
 * and the client (`Socket<ServerToClientEvents, ClientToServerEvents>`) makes
 * every emit and every handler compile-time checked across the wire.
 */
import type {
  AgentType,
  AssistMode,
  ErrorCode,
  Language,
  Position,
  Range,
  Severity,
  TriggerType,
  Verdict,
} from './index.js';
import type { ResponseBlock, SessionSignals } from './ai.js';
import type { LineReview, QualityReport } from './quality.js';
import type { TestResult } from './execution.js';

export const WORKSPACE_NS = '/workspace';
export const CONTEST_NS = '/contest';
export const NOTIFY_NS = '/notify';

export interface SessionStatePayload {
  sessionId: string;
  problemId: string;
  language: Language;
  assistMode: AssistMode;
  code: string;
  revision: number;
  hintsUsed: number[];
  lastVerdict: Verdict | null;
  attemptCount: number;
}

export interface AiSuggestion {
  id: string;
  kind: 'diagnostic' | 'complexity' | 'nudge';
  severity: Severity;
  message: string;
  range: Range | null;
  dismissible: boolean;
}

export interface ClientToServerEvents {
  'session:join': (
    p: { sessionId: string; lastRevision?: number; lastMessageId?: string },
    ack: (res: { ok: boolean; state?: SessionStatePayload; error?: string }) => void,
  ) => void;
  'session:leave': (p: { sessionId: string }) => void;

  'code:sync': (
    p: {
      sessionId: string;
      revision: number;
      code: string;
      cursor: Position | null;
      language: Language;
    },
    ack?: (res: { ok: boolean; revision: number; error?: string }) => void,
  ) => void;
  'code:cursor': (p: { sessionId: string; line: number; column: number }) => void;

  'behaviour:tick': (p: {
    sessionId: string;
    idleMs: number;
    editCount: number;
    backspaces: number;
    charsTyped: number;
    dwellLine: number | null;
    elapsedMs: number;
  }) => void;

  'ai:chat:send': (
    p: { sessionId: string; content: string; selection?: string },
    ack?: (res: { ok: boolean; messageId?: string; error?: ErrorCode }) => void,
  ) => void;
  'ai:chat:cancel': (p: { messageId: string }) => void;
  'ai:hint:request': (p: { sessionId: string; level?: number }) => void;
  'ai:mode:set': (p: { sessionId: string; assistMode: AssistMode }) => void;
  'ai:dismiss': (p: { sessionId: string; suggestionId: string; reason?: string }) => void;
  'ai:ghost:request': (
    p: { sessionId: string; requestId: string; prefix: string; suffix: string },
  ) => void;
  /** Toggling line review on requests an immediate pass rather than waiting
   *  for the next edit tick. */
  'ai:line-review:request': (p: { sessionId: string }) => void;

  'exec:subscribe': (p: { executionId: string }) => void;
  'auth:renew': (p: { token: string }, ack?: (res: { ok: boolean }) => void) => void;
}

export interface ServerToClientEvents {
  'session:state': (p: SessionStatePayload) => void;
  'code:ack': (p: { revision: number; savedAt: string }) => void;
  'code:conflict': (p: { serverRevision: number; serverCode: string }) => void;

  'ai:signals': (p: {
    sessionId: string;
    signals: SessionSignals;
    quality: QualityReport;
    elapsedMs: number;
  }) => void;
  'ai:suggestion': (p: { sessionId: string; suggestions: AiSuggestion[] }) => void;
  'ai:line-review': (p: { sessionId: string; review: LineReview }) => void;
  'ai:typing': (p: { agent: AgentType }) => void;

  'ai:message:start': (p: {
    messageId: string;
    agent: AgentType;
    trigger: TriggerType;
  }) => void;
  'ai:message:token': (p: { messageId: string; t: string }) => void;
  'ai:message:block': (p: { messageId: string; block: ResponseBlock }) => void;
  'ai:message:done': (p: {
    messageId: string;
    tokens: number;
    latencyMs: number;
    cacheHit: boolean;
    fallbackUsed: boolean;
  }) => void;
  'ai:message:error': (p: {
    messageId: string;
    code: ErrorCode;
    message: string;
    fallbackUsed: boolean;
  }) => void;

  'ai:ghost': (p: { requestId: string; text: string }) => void;
  'ai:hint:unlocked': (p: { level: number; content: string; remaining: number }) => void;

  'exec:queued': (p: { executionId: string; totalTests: number }) => void;
  'exec:update': (p: {
    executionId: string;
    completed: number;
    total: number;
    lastVerdict: Verdict;
  }) => void;
  'exec:complete': (p: {
    executionId: string;
    verdict: Verdict;
    passedTests: number;
    totalTests: number;
    runtimeMs: number | null;
    memoryKb: number | null;
    compileOutput: string | null;
    errorMessage: string | null;
    results: TestResult[];
  }) => void;

  'progress:update': (p: {
    xp: number;
    streak: number;
    solved: boolean;
    masteryDeltas: { topic: string; delta: number }[];
  }) => void;

  'quota:warning': (p: {
    resource: 'execution' | 'ai';
    remaining: number;
    resetAt: string;
  }) => void;
  'rate:limited': (p: { event: string; retryAfter: number }) => void;
  'system:degraded': (p: { subsystem: string; reason: string; until: string | null }) => void;
  'auth:expired': () => void;
}

export interface SocketData {
  userId: string;
  role: string;
  tokenExp: number;
  sessionIds: Set<string>;
}
