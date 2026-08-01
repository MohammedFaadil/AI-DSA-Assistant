import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@repo/db';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { isProd } from '../config/env.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `No route matches ${req.method} ${req.path}.`,
      requestId: req.requestId,
    },
  });
};

/**
 * The single place an error becomes a response.
 *
 * Provider messages and stack traces never reach the client — they go to the
 * log with the requestId, which the client is told to quote.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.requestId;

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ requestId, code: err.code, err: err.message, cause: err.cause }, 'app error');
    } else {
      logger.debug({ requestId, code: err.code, msg: err.message }, 'handled error');
    }
    if (err.retryAfter) res.setHeader('Retry-After', err.retryAfter);
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
        ...(err.retryAfter ? { retryAfter: err.retryAfter } : {}),
        requestId,
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'That value is already taken.', requestId },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.', requestId } });
      return;
    }
  }

  logger.error({ requestId, err }, 'unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProd
        ? 'Something went wrong. Quote the request id if you contact support.'
        : String(err instanceof Error ? err.stack : err),
      requestId,
    },
  });
};

/** Wraps an async handler so a rejected promise reaches the error handler. */
export function asyncHandler<T extends RequestHandler>(fn: T): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}
