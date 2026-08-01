import type { ErrorCode } from '@repo/contracts';

export interface ErrorDetail {
  path: string;
  message: string;
}

/**
 * The only error type that may cross the controller boundary. Anything else
 * that escapes is treated as INTERNAL_ERROR and never surfaces its message —
 * provider errors and stack traces go to the log with the requestId, not to
 * the client.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: ErrorDetail[];
  readonly retryAfter?: number;
  override readonly cause?: unknown;

  constructor(opts: {
    status: number;
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
    retryAfter?: number;
    cause?: unknown;
  }) {
    super(opts.message);
    this.name = 'AppError';
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
    this.retryAfter = opts.retryAfter;
    this.cause = opts.cause;
  }
}

export const badRequest = (message: string, details?: ErrorDetail[]) =>
  new AppError({ status: 400, code: 'VALIDATION_ERROR', message, details });

export const unauthenticated = (message = 'Authentication required.') =>
  new AppError({ status: 401, code: 'UNAUTHENTICATED', message });

export const tokenExpired = () =>
  new AppError({ status: 401, code: 'TOKEN_EXPIRED', message: 'Your session has expired.' });

export const tokenReused = () =>
  new AppError({
    status: 401,
    code: 'TOKEN_REUSED',
    message: 'This session was revoked for security reasons. Please sign in again.',
  });

export const forbidden = (message = 'You do not have access to this resource.') =>
  new AppError({ status: 403, code: 'FORBIDDEN', message });

export const notFound = (message = 'Not found.', code: ErrorCode = 'NOT_FOUND') =>
  new AppError({ status: 404, code, message });

export const conflict = (message: string, code: ErrorCode = 'CONFLICT') =>
  new AppError({ status: 409, code, message });

export const unprocessable = (message: string) =>
  new AppError({ status: 422, code: 'UNPROCESSABLE', message });

export const rateLimited = (retryAfter: number, code: ErrorCode = 'RATE_LIMITED') =>
  new AppError({
    status: 429,
    code,
    message: 'Too many requests. Please slow down.',
    retryAfter,
  });

export const providerError = (code: ErrorCode, message: string, cause?: unknown) =>
  new AppError({ status: 502, code, message, cause });

export const aiWarming = () =>
  new AppError({
    status: 503,
    code: 'AI_SERVICE_WARMING',
    message: 'The mentor is waking up. This takes a few seconds on the free tier.',
    retryAfter: 5,
  });

export const internal = (message = 'Something went wrong.', cause?: unknown) =>
  new AppError({ status: 500, code: 'INTERNAL_ERROR', message, cause });
