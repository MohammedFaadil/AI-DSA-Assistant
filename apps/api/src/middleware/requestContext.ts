import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Assigns (or adopts) an X-Request-Id and echoes it on the response.
 *
 * The same id is threaded through to the AI service and every log line, so a
 * single user action can be traced across web → api → ai → provider.
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && incoming.length <= 64 ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
