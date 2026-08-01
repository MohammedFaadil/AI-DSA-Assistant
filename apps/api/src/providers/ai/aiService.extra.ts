/**
 * The newer AI-service endpoints.
 *
 * Kept beside the main client rather than inside it so the original
 * request/response contract for analyze + chat stays small and obvious.
 */
import { createHmac } from 'node:crypto';
import { request } from 'undici';
import type { Language, LineReview } from '@repo/contracts';
import { env } from '../../config/env.js';
import { aiWarming, providerError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

export interface GeneratedParam {
  name: string;
  type: 'int' | 'int[]' | 'str' | 'str[]' | 'grid';
}

export interface GeneratedProblemSpec {
  title: string;
  slug: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  topics: string[];
  statement: string;
  statementDigest: string;
  constraints: string;
  constraintsDigest: string;
  expectedTime: string;
  expectedSpace: string;
  io: { fn: string; params: GeneratedParam[]; returns: 'int' | 'bool' | 'int[]' | 'str' };
  referenceSolution: string;
  testInputs: string[];
  sampleCount: number;
  hints: string[];
  editorial: string;
  source: 'model' | 'template';
}

function sign(body: string, timestamp: string): string {
  return createHmac('sha256', env.AI_SERVICE_HMAC_SECRET)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}

async function post<T>(path: string, payload: unknown, requestId: string, timeoutMs: number): Promise<T> {
  const body = JSON.stringify(payload);
  const timestamp = Date.now().toString();

  try {
    const res = await request(`${env.AI_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId,
        'x-timestamp': timestamp,
        'x-signature': sign(body, timestamp),
      },
      body,
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
    });

    if (res.statusCode === 503) throw aiWarming();
    if (res.statusCode >= 400) {
      const text = await res.body.text();
      logger.warn({ path, status: res.statusCode, text: text.slice(0, 400) }, 'ai service error');
      throw providerError('AI_PROVIDER_ERROR', 'The mentor service could not complete that.');
    }
    return (await res.body.json()) as T;
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err) throw err;
    throw providerError('AI_PROVIDER_ERROR', 'The mentor service is unavailable.', err);
  }
}

export const aiExtra = {
  lineReview(
    payload: { requestId: string; language: Language; code: string; expectedTime: string },
  ): Promise<{ requestId: string; review: LineReview; elapsedMs: number }> {
    return post('/v1/line-review', payload, payload.requestId, 8000);
  },

  /**
   * Generation is the slowest call in the system: a reasoning model writing a
   * full problem plus a reference solution. The timeout is generous because the
   * alternative — failing at 20s and falling back to a template — produces a
   * worse problem than simply waiting.
   */
  generateProblem(
    payload: { requestId: string; prompt: string; difficulty?: string; language: Language },
  ): Promise<GeneratedProblemSpec> {
    return post('/v1/practice/generate', payload, payload.requestId, 90_000);
  },
};
