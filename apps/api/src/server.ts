import { createServer } from 'node:http';
import { prisma } from '@repo/db';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { createApp } from './app.js';
import { createSocketServer } from './realtime/io.js';
import { redis } from './lib/redis.js';

const app = createApp();
const httpServer = createServer(app);
const io = createSocketServer(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, execution: env.EXECUTION_PROVIDER },
    `API listening on http://localhost:${env.PORT}`,
  );
});

/**
 * Graceful shutdown.
 *
 * Order matters: stop accepting new work, let in-flight requests finish, then
 * release connections. On Render free the container is SIGTERM'd on every
 * deploy and on every sleep, so this runs constantly — a sloppy shutdown shows
 * up as dropped submissions.
 */
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');

  const force = setTimeout(() => {
    logger.warn('forced exit after 15s');
    process.exit(1);
  }, 15_000);
  force.unref();

  io.close();
  httpServer.close();
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
  clearTimeout(force);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandled rejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception');
  void shutdown('uncaughtException');
});
