import type { Role } from '@repo/contracts';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      auth?: { userId: string; role: Role; username: string };
    }
  }
}

export {};
