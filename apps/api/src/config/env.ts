import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load the monorepo-root .env before anything reads process.env. A local
// apps/api/.env wins if present, so a developer can override one service
// without editing shared configuration.
const here = dirname(fileURLToPath(import.meta.url));
for (const candidate of [
  resolve(here, '../../.env'),
  resolve(here, '../../../../.env'),
]) {
  if (existsSync(candidate)) dotenv.config({ path: candidate, override: false });
}

/**
 * Environment contract.
 *
 * Parsed once at import time. A service that starts successfully is a service
 * that is fully configured — there are no `process.env.X ?? fallback` reads
 * anywhere else in the codebase.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  API_URL: z.string().url().default('http://localhost:4000'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().default(30),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  EXECUTION_PROVIDER: z.enum(['judge0', 'piston', 'mock']).default('mock'),
  JUDGE0_URL: z.string().default('https://judge0-ce.p.rapidapi.com'),
  JUDGE0_API_KEY: z.string().optional(),
  JUDGE0_HOST: z.string().default('judge0-ce.p.rapidapi.com'),
  PISTON_URL: z.string().default('https://emkc.org/api/v2/piston'),
  EXECUTION_DAILY_QUOTA: z.coerce.number().int().default(200),

  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  AI_SERVICE_HMAC_SECRET: z.string().min(16),

  // Read-only here: the AI service owns these. The API only needs to know
  // WHETHER a provider exists so it can tell the UI honestly that the mentor is
  // running on its deterministic engine rather than the full agent graph.
  OPENROUTER_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  PER_USER_DAILY_TOKENS: z.coerce.number().int().default(60_000),

  SENTRY_DSN: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  // Deliberately not the logger — the logger needs env to exist.
  console.error(`\nInvalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** JWT secrets must differ — reusing one lets an access token be replayed as a refresh token. */
if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
  console.error('\nJWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.\n');
  process.exit(1);
}

/**
 * The "mock" execution provider runs submitted code UNSANDBOXED on the host
 * (docs 08 §9) — it exists purely so the platform runs with zero setup in
 * development. Refusing it here, at env-parse time, means a misconfigured
 * production deploy fails loudly at boot instead of quietly executing
 * arbitrary user code on the server.
 */
if (isProd && env.EXECUTION_PROVIDER === 'mock') {
  console.error(
    '\nEXECUTION_PROVIDER=mock is not permitted in production — it runs submitted code ' +
      'unsandboxed on this host. Set EXECUTION_PROVIDER=judge0 (or piston) and provide the ' +
      'matching credentials.\n',
  );
  process.exit(1);
}
