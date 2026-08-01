import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { badRequest } from '../lib/errors.js';

type Source = 'body' | 'query' | 'params';

/**
 * Parses a request segment with a Zod schema and REPLACES it with the parsed
 * result, so downstream handlers receive coerced, defaulted, typed data.
 *
 * Because this runs before every controller, controllers contain no defensive
 * input checks at all.
 */
export function validate<S extends ZodTypeAny>(schema: S, source: Source = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      // req.query/params are getter-only in Express 5; assign defensively.
      Object.defineProperty(req, source, { value: parsed, writable: true, configurable: true });
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          badRequest(
            'Request validation failed.',
            err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          ),
        );
        return;
      }
      next(err);
    }
  };
}

/** Typed accessor so handlers don't need casts after validation. */
export function parsed<S extends ZodTypeAny>(req: Request, source: Source = 'body'): z.infer<S> {
  return req[source] as z.infer<S>;
}
