/**
 * Local Postgres without Docker.
 *
 * Downloads and runs real PostgreSQL binaries in-process. This exists because
 * not every machine has Docker, and the alternative — forking the schema to
 * SQLite — would drop citext, pg_trgm, enums and Json, i.e. most of what the
 * schema relies on. Production still uses Neon; this is a local convenience
 * with identical semantics.
 *
 *   node infra/scripts/dev-db.mjs start     # start and stay running
 *   node infra/scripts/dev-db.mjs init      # start, create db + extensions, exit
 *   node infra/scripts/dev-db.mjs recreate  # DROP and recreate the database
 *   node infra/scripts/dev-db.mjs stop
 */
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', '..', '.pgdata');

const PORT = Number(process.env.PGPORT ?? 5432);
const USER = 'postgres';
const PASSWORD = 'postgres';
const DATABASE = 'aidsamentor';

const command = process.argv[2] ?? 'start';

const server = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
  onLog: (message) => {
    // The startup chatter is noisy; only surface things that matter.
    if (/FATAL|ERROR|ready to accept/i.test(String(message))) {
      console.log(`[pg] ${String(message).trim()}`);
    }
  },
});

async function ensureDatabase() {
  const admin = new pg.Client({
    host: 'localhost',
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: 'postgres',
  });
  await admin.connect();

  if (command === 'recreate') {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [DATABASE],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${DATABASE}`);
    console.log(`[pg] dropped database ${DATABASE}`);
  }

  const existing = await admin.query(
    'SELECT pg_encoding_to_char(encoding) AS encoding FROM pg_database WHERE datname = $1',
    [DATABASE],
  );

  if (existing.rowCount === 0) {
    // MUST be UTF8. initdb inherits the Windows system locale, which is
    // typically WIN1252 — and WIN1252 cannot store characters like "→" that
    // appear throughout the seeded editorials. Neon is UTF8, so anything else
    // locally is a difference that only shows up as a seed failure.
    await admin.query(
      `CREATE DATABASE ${DATABASE} WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'`,
    );
    console.log(`[pg] created database ${DATABASE} (UTF8)`);
  } else if (existing.rows[0].encoding !== 'UTF8') {
    throw new Error(
      `Database ${DATABASE} exists with encoding ${existing.rows[0].encoding}, but UTF8 is required.\n` +
        `Drop it and re-run:  node infra/scripts/dev-db.mjs recreate`,
    );
  }
  await admin.end();

  // Extensions must exist BEFORE Prisma pushes the schema — `citext` is a
  // column type here, not an optimisation.
  const db = new pg.Client({
    host: 'localhost',
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: DATABASE,
  });
  await db.connect();
  await db.query('CREATE EXTENSION IF NOT EXISTS citext');
  await db.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  await db.end();
  console.log('[pg] extensions ready: citext, pg_trgm');
}

async function main() {
  if (command === 'stop') {
    await server.stop();
    console.log('[pg] stopped');
    return;
  }

  const firstRun = !existsSync(dataDir);
  if (firstRun) {
    mkdirSync(dataDir, { recursive: true });
    console.log('[pg] initialising cluster (first run, takes a moment)…');
    await server.initialise();
  }

  await server.start();
  await ensureDatabase();

  console.log(
    `[pg] ready → postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}`,
  );

  if (command === 'init' || command === 'recreate') {
    await server.stop();
    return;
  }

  const shutdown = async () => {
    console.log('\n[pg] shutting down…');
    await server.stop().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep the process alive.
  setInterval(() => undefined, 1 << 30);
}

main().catch((err) => {
  console.error('[pg] failed:', err);
  process.exit(1);
});
