import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@repo/contracts';
import { WORKSPACE_NS, NOTIFY_NS } from '@repo/contracts';
import { corsOrigins } from '../config/env.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { logger } from '../lib/logger.js';
import { registerEmitter } from './emitter.js';
import { registerWorkspaceHandlers } from './workspace.handlers.js';
import { sweepStale } from './session-registry.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, never, SocketData>;

/** Max concurrent sockets per user — a reconnect loop must not exhaust 512 MB. */
const MAX_SOCKETS_PER_USER = 5;
const userSockets = new Map<string, Set<string>>();

export function createSocketServer(httpServer: HttpServer): AppServer {
  const io: AppServer = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
    // WebSocket only: it skips the polling upgrade dance and removes the need
    // for sticky sessions when we later scale horizontally (docs 06 §9).
    transports: ['websocket'],
    pingInterval: 25_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 256 * 1024,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60_000,
      skipMiddlewares: false,
    },
  });

  registerEmitter((room, event, ...args) => {
    io.of(WORKSPACE_NS).to(room).emit(event, ...args);
    io.of(NOTIFY_NS).to(room).emit(event, ...args);
  });

  const workspace = io.of(WORKSPACE_NS);

  workspace.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string })?.token;
    if (!token) {
      next(new Error('AUTH_REQUIRED'));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      socket.data.tokenExp = payload.exp;
      socket.data.sessionIds = new Set();
      next();
    } catch {
      next(new Error('AUTH_FAILED'));
    }
  });

  workspace.use((socket, next) => {
    const set = userSockets.get(socket.data.userId) ?? new Set<string>();
    if (set.size >= MAX_SOCKETS_PER_USER) {
      const oldest = set.values().next().value;
      if (oldest) {
        workspace.sockets.get(oldest)?.disconnect(true);
        set.delete(oldest);
      }
    }
    set.add(socket.id);
    userSockets.set(socket.data.userId, set);
    next();
  });

  workspace.on('connection', (socket) => {
    logger.debug({ userId: socket.data.userId, socketId: socket.id }, 'workspace connected');

    void socket.join(`user:${socket.data.userId}`);
    registerWorkspaceHandlers(socket as unknown as Socket<ClientToServerEvents, ServerToClientEvents, never, SocketData>);

    /**
     * The access token lives 15 minutes; sockets live longer. Rather than
     * forcing a reconnect (which would drop live session state), we tell the
     * client to refresh over REST and hand the new token back in place.
     */
    const expiryTimer = setInterval(() => {
      if (socket.data.tokenExp * 1000 - Date.now() < 60_000) {
        socket.emit('auth:expired');
      }
    }, 30_000);

    socket.on('auth:renew', ({ token }, ack) => {
      try {
        const payload = verifyAccessToken(token);
        if (payload.sub !== socket.data.userId) throw new Error('subject mismatch');
        socket.data.tokenExp = payload.exp;
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
        socket.disconnect(true);
      }
    });

    socket.on('disconnect', (reason) => {
      clearInterval(expiryTimer);
      userSockets.get(socket.data.userId)?.delete(socket.id);
      logger.debug({ userId: socket.data.userId, reason }, 'workspace disconnected');
    });
  });

  const notify = io.of(NOTIFY_NS);
  notify.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string })?.token;
    if (!token) {
      next(new Error('AUTH_REQUIRED'));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.sessionIds = new Set();
      next();
    } catch {
      next(new Error('AUTH_FAILED'));
    }
  });
  notify.on('connection', (socket) => {
    void socket.join(`user:${socket.data.userId}`);
  });

  const sweeper = setInterval(() => {
    const swept = sweepStale();
    if (swept.length) logger.debug({ count: swept.length }, 'swept stale live sessions');
  }, 10 * 60_000);
  sweeper.unref();

  return io;
}
