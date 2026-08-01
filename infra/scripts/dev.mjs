#!/usr/bin/env node
/**
 * One-command setup and launch.
 *
 *   pnpm go
 *
 * Idempotent: every step checks whether it is already done, so re-running is
 * cheap and safe. Anything already listening on its port is reused rather than
 * fought with.
 *
 * Steps: preflight → deps → env → database → schema → seed → python deps →
 * ai service → api → web.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { existsSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const IS_WINDOWS = process.platform === 'win32';

const PORTS = { db: 5432, ai: 8000, api: 4000, web: 3000 };
const DB = { user: 'postgres', password: 'postgres', database: 'aidsamentor' };

const c = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', grey: '\x1b[90m',
};

let stepNo = 0;
const step = (msg) => console.log(`\n${c.bold}${c.cyan}[${++stepNo}/9]${c.reset} ${c.bold}${msg}${c.reset}`);
const info = (msg) => console.log(`      ${c.grey}${msg}${c.reset}`);
const good = (msg) => console.log(`      ${c.green}✓${c.reset} ${msg}`);
const warn = (msg) => console.log(`      ${c.yellow}!${c.reset} ${msg}`);
const fail = (msg) => console.log(`      ${c.red}✗${c.reset} ${msg}`);

const children = [];
let postgres = null;
let shuttingDown = false;

/* ── helpers ───────────────────────────────────────────────────────────── */

function run(command, args, { cwd = ROOT, env = process.env, quiet = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    shell: IS_WINDOWS,
    stdio: quiet ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
  return { code: result.status ?? 1, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function portOpen(port, timeout = 800) {
  return new Promise((res) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const done = (value) => {
      socket.destroy();
      res(value);
    };
    socket.setTimeout(timeout);
    socket.on('connect', () => done(true));
    socket.on('timeout', () => done(false));
    socket.on('error', () => done(false));
  });
}

async function httpOk(url, timeoutMs = 2000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitFor(label, check, { attempts = 90, delay = 1000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, delay));
  }
  fail(`${label} did not come up in ${Math.round((attempts * delay) / 1000)}s`);
  return false;
}

/** Streams a child's output with a coloured prefix so three logs stay readable. */
function launch(name, colour, command, args, { cwd = ROOT, env = process.env } = {}) {
  const child = spawn(command, args, { cwd, env, shell: IS_WINDOWS });
  children.push({ name, child });

  const pipe = (stream) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) console.log(`${colour}${name.padEnd(3)}${c.reset} ${c.grey}│${c.reset} ${line}`);
      }
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);

  child.on('exit', (code) => {
    if (!shuttingDown && code !== 0) {
      console.log(`${colour}${name}${c.reset} ${c.red}exited with code ${code}${c.reset}`);
    }
  });
  return child;
}

function pythonCommand() {
  for (const candidate of [['python'], ['py', '-3'], ['python3']]) {
    const { code, out } = run(candidate[0], [...candidate.slice(1), '--version'], { quiet: true });
    // Windows ships App Execution Alias stubs that exit non-zero with this text.
    if (code === 0 && !/Microsoft Store|was not found/i.test(out)) return candidate;
  }
  return null;
}

/* ── steps ─────────────────────────────────────────────────────────────── */

function preflight() {
  step('Preflight');
  const node = Number(process.versions.node.split('.')[0]);
  if (node < 20) {
    fail(`Node ${process.versions.node} — this project needs Node 20 or newer.`);
    process.exit(1);
  }
  good(`Node ${process.versions.node}`);

  const python = pythonCommand();
  if (!python) {
    fail('No usable Python found on PATH. Install Python 3.11+ and re-run.');
    if (IS_WINDOWS) {
      info('If `python` opens the Microsoft Store, turn off the alias:');
      info('Settings → Apps → Advanced app settings → App execution aliases');
    }
    process.exit(1);
  }
  const { out } = run(python[0], [...python.slice(1), '--version'], { quiet: true });
  good(`${out.trim()} (${python.join(' ')})`);
  return python;
}

function installNodeDeps() {
  step('Node dependencies');
  if (existsSync(join(ROOT, 'node_modules', '.modules.yaml'))) {
    good('already installed');
  } else {
    info('running pnpm install (first run, this takes a minute)…');
    if (run('pnpm', ['install']).code !== 0) {
      fail('pnpm install failed');
      process.exit(1);
    }
    good('installed');
  }

  // The Prisma client is generated into node_modules, so it disappears on a
  // fresh install and must be regenerated rather than assumed.
  try {
    require.resolve('@prisma/client');
    const generated = join(ROOT, 'node_modules', '.prisma', 'client', 'index.js');
    if (!existsSync(generated)) throw new Error('not generated');
    good('Prisma client ready');
  } catch {
    info('generating Prisma client…');
    run('pnpm', ['--filter', '@repo/db', 'generate'], { quiet: true });
    good('Prisma client generated');
  }
}

function ensureEnv() {
  step('Environment');
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) {
    copyFileSync(join(ROOT, '.env.example'), envPath);
    good('.env created from .env.example');
  } else {
    good('.env present');
  }

  // Next.js only reads .env files inside its own directory.
  const webEnv = join(ROOT, 'apps', 'web', '.env.local');
  if (!existsSync(webEnv)) {
    const { writeFileSync } = require('node:fs');
    writeFileSync(
      webEnv,
      'NEXT_PUBLIC_API_URL=http://localhost:4000\nNEXT_PUBLIC_SOCKET_URL=http://localhost:4000\n',
    );
    good('apps/web/.env.local created');
  }

  const dotenv = require('dotenv');
  dotenv.config({ path: envPath });

  const url = process.env.DATABASE_URL ?? '';
  const isLocal = /(?:localhost|127\.0\.0\.1)/.test(url);
  info(isLocal ? 'using a local database' : 'using an external DATABASE_URL — skipping local Postgres');
  return isLocal;
}

async function startDatabase() {
  step('Database');

  if (await pgHandshake()) {
    good('Postgres already running and accepting connections');
    return;
  }

  const dataDir = join(ROOT, '.pgdata');
  const pidFile = join(dataDir, 'postmaster.pid');

  // A pid file with nothing listening means a previous run was killed. Left in
  // place it produces "pre-existing shared memory block is still in use".
  if (existsSync(pidFile) && !(await portOpen(PORTS.db))) {
    rmSync(pidFile, { force: true });
    warn('removed a stale postmaster.pid from a previous run');
  }

  if (await portOpen(PORTS.db)) {
    fail(`Something is listening on ${PORTS.db} but is not answering as Postgres.`);
    info('Stop it, or point DATABASE_URL at another database, then re-run.');
    process.exit(1);
  }

  const EmbeddedPostgres = (await import('embedded-postgres')).default;
  postgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: DB.user,
    password: DB.password,
    port: PORTS.db,
    persistent: true,
    onLog: () => undefined,
  });

  if (!existsSync(dataDir)) {
    info('initialising a Postgres cluster in .pgdata (first run, ~30s)…');
    await postgres.initialise();
  }
  info('starting Postgres…');
  await postgres.start();

  if (!(await waitFor('Postgres', pgHandshake, { attempts: 45, delay: 1000 }))) process.exit(1);
  good(`Postgres listening on ${PORTS.db}`);
  await ensureDatabase();
}

async function pgHandshake() {
  const pg = require('pg');
  const client = new pg.Client({
    host: '127.0.0.1',
    port: PORTS.db,
    user: DB.user,
    password: DB.password,
    database: 'postgres',
    connectionTimeoutMillis: 3000,
  });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    await client.end().catch(() => undefined);
    return false;
  }
}

async function ensureDatabase() {
  const pg = require('pg');
  const admin = new pg.Client({
    host: '127.0.0.1',
    port: PORTS.db,
    user: DB.user,
    password: DB.password,
    database: 'postgres',
    connectionTimeoutMillis: 5000,
  });
  await admin.connect();

  const found = await admin.query(
    'SELECT pg_encoding_to_char(encoding) AS encoding FROM pg_database WHERE datname = $1',
    [DB.database],
  );

  if (found.rowCount === 0) {
    // MUST be UTF8. initdb inherits the Windows system locale, typically
    // WIN1252, which cannot store characters like "→" used in the editorials.
    await admin.query(
      `CREATE DATABASE ${DB.database} WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'`,
    );
    good(`created database ${DB.database} (UTF8)`);
  } else if (found.rows[0].encoding !== 'UTF8') {
    await admin.end();
    fail(`Database ${DB.database} has encoding ${found.rows[0].encoding}; UTF8 is required.`);
    info('Run: pnpm db:local:recreate   (this drops the local database)');
    process.exit(1);
  } else {
    good(`database ${DB.database} ready (UTF8)`);
  }
  await admin.end();

  const db = new pg.Client({
    host: '127.0.0.1',
    port: PORTS.db,
    user: DB.user,
    password: DB.password,
    database: DB.database,
    connectionTimeoutMillis: 5000,
  });
  await db.connect();
  await db.query('CREATE EXTENSION IF NOT EXISTS citext');
  await db.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  await db.end();
  good('extensions ready: citext, pg_trgm');
}

function pushSchema() {
  step('Schema');
  const result = run('pnpm', ['--filter', '@repo/db', 'exec', 'prisma', 'db', 'push', '--skip-generate'], {
    quiet: true,
  });
  if (result.code !== 0) {
    fail('prisma db push failed');
    console.log(result.out);
    process.exit(1);
  }
  good(/already in sync/i.test(result.out) ? 'already in sync' : 'tables created');
}

async function seedIfEmpty() {
  step('Seed data');
  const pg = require('pg');
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  let count = 0;
  try {
    await client.connect();
    const res = await client.query('SELECT COUNT(*)::int AS n FROM "Problem"');
    count = res.rows[0].n;
    await client.end();
  } catch {
    await client.end().catch(() => undefined);
  }

  if (count > 0) {
    good(`${count} problems already seeded`);
    return;
  }

  info('seeding problems, topics, badges and demo users…');
  const result = run('pnpm', ['--filter', '@repo/db', 'seed'], { quiet: true });
  if (result.code !== 0) {
    fail('seed failed');
    console.log(result.out);
    process.exit(1);
  }
  good('seeded');
}

function installPythonDeps(python) {
  step('Python dependencies');
  const check = run(
    python[0],
    [...python.slice(1), '-c', 'import fastapi, uvicorn, pydantic_settings, structlog'],
    { quiet: true },
  );
  if (check.code === 0) {
    good('already installed');
  } else {
    info('installing the AI service (first run, this takes a minute)…');
    const result = run(python[0], [...python.slice(1), '-m', 'pip', 'install', '-e', 'apps/ai'], {
      quiet: true,
    });
    if (result.code !== 0) {
      fail('pip install failed');
      console.log(result.out.slice(-1500));
      process.exit(1);
    }
    good('installed');
  }

  // Capability reporting deliberately happens later, against the running
  // service's /readyz. Probing imports here raced pip's own bookkeeping and
  // produced false "Tree-sitter unavailable" warnings.
}

async function startServices(python) {
  step('Services');
  const env = { ...process.env, PYTHONPATH: join(ROOT, 'apps', 'ai') };

  if (await httpOk(`http://127.0.0.1:${PORTS.ai}/healthz`)) {
    good(`AI service already running on ${PORTS.ai}`);
  } else if (await portOpen(PORTS.ai)) {
    fail(`Port ${PORTS.ai} is occupied by something that is not the AI service.`);
    process.exit(1);
  } else {
    launch('ai ', c.magenta, python[0], [
      ...python.slice(1), '-m', 'uvicorn', 'app.main:app',
      '--host', '127.0.0.1', '--port', String(PORTS.ai), '--app-dir', 'apps/ai',
    ], { env });
  }

  if (await httpOk(`http://127.0.0.1:${PORTS.api}/healthz`)) {
    good(`API already running on ${PORTS.api}`);
  } else {
    launch('api', c.blue, 'pnpm', ['--filter', '@repo/api', 'dev'], { env });
  }

  if (await httpOk(`http://127.0.0.1:${PORTS.web}`)) {
    good(`Web already running on ${PORTS.web}`);
  } else {
    launch('web', c.green, 'pnpm', ['--filter', '@repo/web', 'dev'], { env });
  }

  console.log();
  await waitFor('AI service', () => httpOk(`http://127.0.0.1:${PORTS.ai}/healthz`));
  good('AI service ready');
  await reportAiCapabilities();
  await waitFor('API', () => httpOk(`http://127.0.0.1:${PORTS.api}/healthz`));
  good('API ready');
  await waitFor('Web', () => httpOk(`http://127.0.0.1:${PORTS.web}`), { attempts: 120 });
  good('Web ready');
}

/** The AI service is the only thing that truly knows what it loaded. */
async function reportAiCapabilities() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORTS.ai}/readyz`);
    const body = await res.json();

    if (body.treeSitter && body.grammars > 0) good(`Tree-sitter: ${body.grammars} grammars loaded`);
    else warn('Tree-sitter unavailable — the analyser is using its regex fallback');

    good(body.langgraph ? 'LangGraph agent graph active' : 'LangGraph absent — linear executor in use');

    const providers = Object.entries(body.models?.providers ?? {})
      .filter(([, v]) => v.configured)
      .map(([k]) => k);
    if (providers.length) good(`LLM providers: ${providers.join(', ')}`);
    else info('no LLM provider configured — Stage 2 will use the deterministic fallback');
  } catch {
    warn('could not read AI service capabilities');
  }
}

function banner() {
  const line = '─'.repeat(58);
  console.log(`
${c.green}${line}${c.reset}
  ${c.bold}AI DSA Mentor is running${c.reset}

  ${c.bold}Open  ${c.cyan}http://localhost:${PORTS.web}${c.reset}

  Sign in    ${c.bold}demo@aidsamentor.dev${c.reset} / ${c.bold}Demo123!${c.reset}
  Admin      admin@aidsamentor.dev / Admin123!

  API        http://localhost:${PORTS.api}      ${c.grey}/readyz for health${c.reset}
  AI         http://localhost:${PORTS.ai}      ${c.grey}/docs for the OpenAPI UI${c.reset}
  Database   postgres://localhost:${PORTS.db}/${DB.database}

  ${c.grey}No API keys are set, so the mentor runs on its deterministic
  engine: complexity, algorithm detection, warnings and authored
  hints. Add OPENROUTER_API_KEY to .env to enable the LLM agents.${c.reset}

  ${c.grey}Verify anytime:  pnpm smoke        Stop everything:  Ctrl+C${c.reset}
${c.green}${line}${c.reset}
`);
}

/* ── shutdown ──────────────────────────────────────────────────────────── */

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${c.yellow}Shutting down…${c.reset}`);

  for (const { name, child } of children) {
    try {
      if (IS_WINDOWS) spawnSync('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore' });
      else child.kill('SIGTERM');
      console.log(`  stopped ${name.trim()}`);
    } catch {
      /* already gone */
    }
  }

  if (postgres) {
    await postgres.stop().catch(() => undefined);
    console.log('  stopped postgres');
  }
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

/* ── main ──────────────────────────────────────────────────────────────── */

console.log(`\n${c.bold}${c.cyan}AI DSA Mentor${c.reset} ${c.grey}· setup and launch${c.reset}`);

const python = preflight();
installNodeDeps();
const localDatabase = ensureEnv();
if (localDatabase) await startDatabase();
else step('Database') || good('external database configured');
pushSchema();
await seedIfEmpty();
installPythonDeps(python);
await startServices(python);
banner();

// Hold the process open so the child services keep running.
setInterval(() => undefined, 1 << 30);
