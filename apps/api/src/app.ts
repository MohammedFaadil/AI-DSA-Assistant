import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { prisma } from '@repo/db';
import { corsOrigins, isDev } from './config/env.js';
import { logger } from './lib/logger.js';
import { requestContext } from './middleware/requestContext.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { problemsRouter } from './modules/problems/problems.routes.js';
import { executionRouter_ } from './modules/execution/execution.routes.js';
import { workspaceRouter } from './modules/workspace/workspace.routes.js';
import { aiRouter } from './modules/ai/ai.routes.js';
import {
  achievementsRouter,
  leaderboardRouter,
  progressRouter,
} from './modules/progress/progress.routes.js';
import { submissionsRouter } from './modules/execution/submissions.routes.js';
import { practiceRouter } from './modules/practice/practice.routes.js';
import {
  bookmarksRouter,
  libraryRouter,
  notesRouter,
} from './modules/library/library.routes.js';
import {
  aiInsightsRouter,
  curriculumRouter,
} from './modules/curriculum/curriculum.routes.js';
import { companiesRouter } from './modules/companies/companies.routes.js';
import { aiService } from './providers/ai/aiService.client.js';
import { executionRouter } from './providers/execution/index.js';
import { redis } from './lib/redis.js';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestContext);
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { 'frame-ancestors': ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
      exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  // 1 MB global cap; code payloads are separately capped at 64 KB by the
  // contract schema, so an oversized submission is rejected before it reaches
  // any provider.
  app.use(express.json({ limit: '1mb' }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/healthz' },
      customProps: (req) => ({ requestId: (req as { requestId?: string }).requestId }),
    }),
  );

  /* ── System ─────────────────────────────────────────────────────────── */

  // Liveness. Deliberately does NOT touch the database: this is the
  // keep-alive cron target and it is hit every 10 minutes forever (ADR-004).
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, service: 'api', uptime: Math.round(process.uptime()) });
  });

  app.get('/readyz', async (_req, res) => {
    const [db, ai, exec] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      aiService.health(),
      executionRouter.health(),
    ]);
    const ready = db;
    res.status(ready ? 200 : 503).json({
      ready,
      checks: {
        database: db,
        redis: redis.available,
        aiService: ai,
        execution: exec,
      },
    });
  });

  /**
   * Public degradation state. This is a product feature, not just ops: when a
   * subsystem is limited the UI says so honestly with a reset time instead of
   * failing mysteriously (docs 05 §4.10).
   */
  app.get('/v1/status', async (_req, res) => {
    const aiWarm = await aiService.health();
    const exec = await executionRouter.health();
    res.json({
      subsystems: {
        mentor: aiWarm ? 'ok' : 'warming',
        execution: exec.some((e) => e.healthy) ? 'ok' : 'degraded',
        realtime: 'ok',
      },
      executionProvider: executionRouter.primaryName,
    });
  });

  /* ── API ────────────────────────────────────────────────────────────── */

  app.use('/v1/auth', authRouter);
  app.use('/v1/problems', problemsRouter);
  app.use('/v1/executions', executionRouter_);
  app.use('/v1/submissions', submissionsRouter);
  app.use('/v1/workspace', workspaceRouter);
  app.use('/v1/ai', aiRouter);
  app.use('/v1/progress', progressRouter);
  app.use('/v1/achievements', achievementsRouter);
  app.use('/v1/leaderboard', leaderboardRouter);
  app.use('/v1/practice', practiceRouter);
  app.use('/v1/library', libraryRouter);
  app.use('/v1/bookmarks', bookmarksRouter);
  app.use('/v1/notes', notesRouter);
  app.use('/v1/curriculum', curriculumRouter);
  app.use('/v1/ai-insights', aiInsightsRouter);
  app.use('/v1/companies', companiesRouter);

  if (isDev) {
    app.get('/v1/__routes', (_req, res) => {
      res.json({
        note: 'Development only.',
        routes: [
          'POST   /v1/auth/register',
          'POST   /v1/auth/login',
          'POST   /v1/auth/refresh',
          'GET    /v1/auth/me',
          'GET    /v1/problems',
          'GET    /v1/problems/:slug',
          'POST   /v1/executions',
          'GET    /v1/executions/:id',
          'POST   /v1/workspace/sessions',
          'PUT    /v1/workspace/drafts',
          'POST   /v1/ai/chat',
          'GET    /v1/progress/overview',
          'GET    /v1/leaderboard',
        ],
      });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
