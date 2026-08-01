import type { ServerToClientEvents } from '@repo/contracts';

/**
 * Indirection so services can push socket events without importing the
 * Socket.IO server (which would create a cycle: io → handlers → services → io)
 * and so services stay testable without a socket layer at all.
 *
 * The realtime layer registers the real implementation at boot; until then
 * every emit is a silent no-op, which is exactly what you want in unit tests.
 */
type EmitFn = <E extends keyof ServerToClientEvents>(
  room: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
) => void;

let emitImpl: EmitFn | null = null;

export function registerEmitter(fn: EmitFn): void {
  emitImpl = fn;
}

export const emitTo: EmitFn = (room, event, ...args) => {
  emitImpl?.(room, event, ...args);
};

export const sessionRoom = (sessionId: string): string => `session:${sessionId}`;
export const executionRoom = (executionId: string): string => `exec:${executionId}`;
export const userRoom = (userId: string): string => `user:${userId}`;
