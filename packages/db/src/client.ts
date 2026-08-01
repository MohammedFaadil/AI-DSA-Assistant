import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma client.
 *
 * Cached on globalThis in development so Next.js / tsx hot reloads don't open a
 * new connection pool on every reload — which on Neon's free tier will exhaust
 * the connection limit within a few minutes of editing.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [{ level: 'warn', emit: 'stdout' }, { level: 'error', emit: 'stdout' }]
        : [{ level: 'error', emit: 'stdout' }],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
