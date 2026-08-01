'use client';

import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@repo/contracts';
import { getAccessToken, refreshSession } from './api-client';

export type WorkspaceSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

let socket: WorkspaceSocket | null = null;

/**
 * Singleton workspace socket.
 *
 * `transports: ['websocket']` skips the polling upgrade dance and removes the
 * need for sticky sessions when the API later scales horizontally.
 */
export function getWorkspaceSocket(): WorkspaceSocket {
  if (socket) return socket;

  socket = io(`${SOCKET_URL}/workspace`, {
    auth: { token: getAccessToken() },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 10_000,
    randomizationFactor: 0.5,
    timeout: 10_000,
    autoConnect: false,
  }) as WorkspaceSocket;

  /**
   * The access token lives 15 minutes; the socket lives longer. Rather than
   * reconnecting (which would drop live session state), refresh over REST and
   * hand the new token back in place.
   */
  socket.on('auth:expired', () => {
    void refreshSession().then((ok) => {
      const token = getAccessToken();
      if (ok && token) socket?.emit('auth:renew', { token });
    });
  });

  socket.io.on('reconnect_attempt', () => {
    if (socket) socket.auth = { token: getAccessToken() };
  });

  return socket;
}

export function connectSocket(): WorkspaceSocket {
  const instance = getWorkspaceSocket();
  instance.auth = { token: getAccessToken() };
  if (!instance.connected) instance.connect();
  return instance;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
