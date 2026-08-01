import pino from 'pino';
import { env, isDev } from '../config/env.js';

/**
 * Redaction is configured here, not at the call site — so no future logging
 * statement can leak a token, a password, or a user's code by forgetting.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.code',
      '*.buffer',
      'body.password',
      'body.code',
    ],
    censor: '[redacted]',
  },
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
  base: { service: 'api' },
});

export type Logger = typeof logger;
