import { createHmac, timingSafeEqual } from 'node:crypto';
import { request } from 'undici';
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  CompleteRequest,
  CompleteResponse,
  ConceptEnvelope,
  ContextEnvelope,
  MentorTurn,
  TeachResponse,
} from '@repo/contracts';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { aiWarming, providerError } from '../../lib/errors.js';

/**
 * Typed client for the Python AI service.
 *
 * Service-to-service auth is an HMAC over (timestamp, body) with a 60s replay
 * window — the AI service is never exposed to browsers, so there is no session
 * to carry and no reason to accept unsigned traffic.
 */
function sign(body: string, timestamp: string): string {
  return createHmac('sha256', env.AI_SERVICE_HMAC_SECRET)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}

export function verifySignature(body: string, timestamp: string, signature: string): boolean {
  const expected = Buffer.from(sign(body, timestamp));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

interface CallOptions {
  requestId: string;
  timeoutMs?: number;
}

class AiServiceClient {
  /**
   * Warm state tracking. The AI service sleeps on free tier; we remember
   * whether it has responded recently so callers can decide between waiting
   * and degrading to Stage-1-only behaviour (ADR-004).
   */
  private lastHealthyAt = 0;

  get warm(): boolean {
    return Date.now() - this.lastHealthyAt < 5 * 60_000;
  }

  private async call<T>(path: string, payload: unknown, opts: CallOptions): Promise<T> {
    const body = JSON.stringify(payload);
    const timestamp = Date.now().toString();

    try {
      const res = await request(`${env.AI_SERVICE_URL}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': opts.requestId,
          'x-timestamp': timestamp,
          'x-signature': sign(body, timestamp),
        },
        body,
        headersTimeout: opts.timeoutMs ?? 20_000,
        bodyTimeout: opts.timeoutMs ?? 20_000,
      });

      if (res.statusCode === 503) {
        throw aiWarming();
      }
      if (res.statusCode >= 400) {
        const text = await res.body.text();
        logger.warn({ path, status: res.statusCode, text: text.slice(0, 500) }, 'ai service error');
        throw providerError('AI_PROVIDER_ERROR', 'The mentor could not complete that request.');
      }

      this.lastHealthyAt = Date.now();
      return (await res.body.json()) as T;
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'AI_SERVICE_WARMING') {
        throw err;
      }
      // A connection error on a sleeping free-tier container is a warming
      // state, not a failure — the client renders it as a loading state.
      if (!this.warm) throw aiWarming();
      throw providerError('AI_PROVIDER_ERROR', 'The mentor is unavailable right now.', err);
    }
  }

  /** Stage 1 — deterministic. Fast timeout: this is on the 2-second tick path. */
  analyze(req: AnalyzeRequest, opts: CallOptions): Promise<AnalyzeResponse> {
    return this.call<AnalyzeResponse>('/v1/analyze', req, { ...opts, timeoutMs: opts.timeoutMs ?? 6000 });
  }

  /** Stage 2 — the LangGraph agent turn. */
  chat(envelope: ContextEnvelope, opts: CallOptions): Promise<MentorTurn> {
    return this.call<MentorTurn>('/v1/agent/chat', envelope, { ...opts, timeoutMs: 45_000 });
  }

  complete(req: CompleteRequest, opts: CallOptions): Promise<CompleteResponse> {
    return this.call<CompleteResponse>('/v1/complete', req, { ...opts, timeoutMs: 5000 });
  }

  /** AI Training — curriculum-scoped teaching turn. No policy/guard involved
   * (see apps/ai/app/agents/teach.py): there is no solution to protect. */
  teach(envelope: ConceptEnvelope, opts: CallOptions): Promise<TeachResponse> {
    return this.call<TeachResponse>('/v1/agent/teach', envelope, { ...opts, timeoutMs: 45_000 });
  }

  /**
   * Fire-and-forget warm ping.
   *
   * Called when a user opens a workspace. By the time they have read the
   * problem statement (20–40s) the container is up, so the cold start is
   * absorbed by reading time instead of by a spinner.
   */
  warmUp(): void {
    void request(`${env.AI_SERVICE_URL}/healthz`, { method: 'GET', headersTimeout: 30_000 })
      .then((res) => {
        if (res.statusCode < 400) this.lastHealthyAt = Date.now();
        return res.body.dump();
      })
      .catch(() => undefined);
  }

  async health(): Promise<boolean> {
    try {
      const res = await request(`${env.AI_SERVICE_URL}/readyz`, {
        method: 'GET',
        headersTimeout: 3000,
      });
      await res.body.dump();
      const ok = res.statusCode < 400;
      if (ok) this.lastHealthyAt = Date.now();
      return ok;
    } catch {
      return false;
    }
  }
}

export const aiService = new AiServiceClient();
