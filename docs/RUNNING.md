# Running AI DSA Mentor

Everything below has been executed on a clean Windows machine with no Docker.

**Short answer on keys: you need none.** The platform is built so that Stage-1
mentoring, code execution, auth and progress all work with zero credentials.
Keys only unlock the LLM agents and remote sandboxed execution.

---

## 1. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node | ≥ 20 | `node --version` |
| pnpm | 9.x | `pnpm --version` (`npm i -g pnpm@9`) |
| Python | ≥ 3.11 | `python --version` |

Docker is **optional** — there is a no-Docker path below.

---

## 2. First-time setup

```bash
pnpm install
pnpm db:generate          # generate the Prisma client
cp .env.example .env      # already correct for local development
```

### Database — pick ONE

**A. Without Docker** (downloads real PostgreSQL binaries into `.pgdata/`, no
install, no admin rights):

```bash
pnpm db:local:init        # create a UTF8 cluster + database + citext/pg_trgm
pnpm db:local             # leave this running in its own terminal
pnpm db:push              # create the 40 tables
```

> The cluster **must** be UTF8. `initdb` inherits the Windows system locale,
> which is usually WIN1252, and the seeded editorials contain characters like
> `→` that WIN1252 cannot store. `db:local:init` forces UTF8 and refuses to
> continue against a non-UTF8 database. To start over: `pnpm db:local:recreate`.

**B. With Docker:**

```bash
pnpm infra:up             # postgres + redis
pnpm db:migrate
```

### Seed

```bash
pnpm db:seed
```

Creates 23 topics, 10 companies, 10 badges, 13 fully-authored problems (each
with starter code in 4 languages, 3-rung hints, an editorial, visible + hidden
tests and a fingerprinted reference solution), and two accounts:

```
demo@aidsamentor.dev   Demo123!     ← use this one
admin@aidsamentor.dev  Admin123!
```

### Python service

```bash
pnpm ai:install           # pip install -e apps/ai[dev]
```

---

## 3. Running

Three processes. `pnpm dev` covers web + api; the Python service is separate
because it is not a pnpm workspace package.

```bash
# terminal 1 — database (skip if using Docker)
pnpm db:local

# terminal 2 — AI service
pnpm ai:dev               # → http://localhost:8000

# terminal 3 — web + api
pnpm dev                  # → http://localhost:3000  and  :4000
```

Open **http://localhost:3000** and sign in as `demo@aidsamentor.dev / Demo123!`.

### Verify

```bash
pnpm smoke                # 25 assertions: auth → judge → mentor → progress
```

```bash
curl http://localhost:4000/readyz    # database, redis, aiService, execution
curl http://localhost:8000/readyz    # grammars, langgraph, models, cache
curl http://localhost:4000/v1/status # the public degradation banner
```

Expected healthy output:

```json
{"ready":true,"checks":{"database":true,"redis":false,"aiService":true,
 "execution":[{"provider":"local","healthy":true}]}}
```

`redis: false` is normal — Redis is optional and only holds durable
low-frequency state.

---

## 4. API keys

### Required: none

With an empty `.env` beyond the database URL you still get:

- Tree-sitter parsing across 12 languages
- complexity estimation, algorithm fingerprinting, static findings as live
  editor squiggles
- the trigger policy deciding when the mentor should speak
- the deterministic Stage-2 fallback (which produced *"Your code looks like
  O(n³), and the constraints point at O(n)…"* in testing)
- the problem's authored hints
- code execution for Python and JavaScript
- auth, submissions, progress, mastery, badges, leaderboard

### Optional: what each key actually unlocks

| Variable | Where to get it | Unlocks | Free tier |
|---|---|---|---|
| `OPENROUTER_API_KEY` | openrouter.ai → Keys | **Stage-2 LLM agents** — Tutor, Hint, Debug, Complexity, Code Review. The single key worth adding. | Yes — the routing table already targets `:free` models |
| `GROQ_API_KEY` | console.groq.com → API Keys | Same agents, much lower latency. Used first for Debug and ghost text. | Yes, generous |
| `TOGETHER_API_KEY` | api.together.xyz | Third provider in the failover chain | Trial credit |
| `JUDGE0_API_KEY` | rapidapi.com → Judge0 CE | **Real sandboxed execution** for all 12 languages. Set `EXECUTION_PROVIDER=judge0`. | ~50 requests/day |
| — | — | Piston needs no key; it is the automatic failover when Judge0 is exhausted | Public, rate-limited |
| `REDIS_URL` | upstash.com → Redis | Rate limits and sessions that survive restart | 10k commands/day |
| `DATABASE_URL` | neon.tech | Hosted Postgres instead of the local cluster | 0.5 GB |

Turning the agents on is one line plus a restart of the AI service:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

Nothing else changes. If the key is rate-limited or removed, the deterministic
fallback takes over automatically — the mentor never returns an error toast.

### Secrets you generate rather than obtain

Development values are already in `.env.example`. **Replace all three before
deploying anywhere:**

```bash
openssl rand -base64 48   # JWT_ACCESS_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET   (must differ — the API refuses to boot otherwise)
openssl rand -base64 32   # AI_SERVICE_HMAC_SECRET (identical in api and ai)
```

No OpenSSL on Windows:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))
```

### Keys that are NOT worth adding yet

These variables exist in `.env.example` but the code paths behind them are not
implemented, so setting them does nothing today:

- `GOOGLE_CLIENT_ID` / `GITHUB_CLIENT_ID` — OAuth callbacks are unimplemented; email auth only
- `CLOUDINARY_URL` — no avatar upload endpoint yet
- `SENTRY_DSN` — validated in the env schema, but no Sentry SDK is wired

### What each feature needs, specifically

| Feature | Works with zero keys? | What a key adds |
|---|---|---|
| Live complexity + algorithm detection + strength meter | ✅ fully | — (always deterministic) |
| Line-by-line review | ✅ fully | — (always deterministic) |
| Authored hints (3-rung ladder) | ✅ fully | — |
| Mentor chat / proactive nudges | ✅ deterministic fallback | With a key: the Tutor/Debug/Complexity/Code-Review LLM agents instead of the fallback text |
| **Practice Zone** (generate a problem from a prompt) | ✅ via 10 curated templates matched by keyword | With a key: a genuinely novel problem written for your exact prompt. Either way, test cases are derived by *executing* the reference solution — never hand-guessed, so generated problems are never broken |
| Code execution / judging | ✅ via the local dev runner (Python, JS) | `JUDGE0_API_KEY` adds real sandboxing and 10 more languages |

---

## 5. Deploying (free tier)

Three pieces, three platforms — matches [docs/architecture/08-deployment-architecture.md](architecture/08-deployment-architecture.md).

| Component | Platform | Config in this repo |
|---|---|---|
| Web | Vercel | `apps/web/vercel.json` |
| API | Render | `render.yaml` (repo root) |
| AI service | Hugging Face Spaces (Docker) *or* Render | `render.yaml` includes both API and AI as a convenience; delete the `ai` entry if you use HF Spaces |
| Database | Neon | — (just a connection string) |
| Redis | Upstash | — (optional) |

### Steps

1. **Neon** — create a project, copy the pooled connection string into `DATABASE_URL` and the direct one into `DIRECT_DATABASE_URL`.
2. **API on Render** — "New +" → "Blueprint", point at this repo. Render reads `render.yaml` and creates the `ai-dsa-mentor-api` service. Fill in the `sync: false` env vars in the dashboard (`DATABASE_URL`, `APP_URL`, `AI_SERVICE_URL`, `JUDGE0_API_KEY`, …). Secrets marked `generateValue: true` are created for you — copy `AI_SERVICE_HMAC_SECRET` from there into the AI service, it **must match exactly** on both sides.
3. **AI service** — prefer **Hugging Face Spaces**: create a Space with SDK "Docker", point it at `apps/ai/Dockerfile`, set `AI_SERVICE_HMAC_SECRET` (same value as the API) and `REQUIRE_SIGNATURE=true`. This keeps it off Render's 750-hour budget entirely (ADR-004). If you'd rather keep everything on Render, the blueprint already includes it.
4. **Web on Vercel** — import the repo, set **Root Directory to `apps/web`** (Project Settings → General). `apps/web/vercel.json` handles the monorepo build from there. Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` to the Render API URL.
5. **Keep the API warm** — Render free sleeps after ~15 min idle. Add a scheduled ping to `https://<your-api>.onrender.com/healthz` every 10 minutes (`.github/workflows/keep-warm.yml` is already set up — add the URL as the `API_HEALTH_URL` repo secret, or use cron-job.org).
6. **Execution provider** — the API **refuses to start in production** with `EXECUTION_PROVIDER=mock` (it runs code unsandboxed — fine for a laptop, not for the internet). Set `EXECUTION_PROVIDER=judge0` and add `JUDGE0_API_KEY` from RapidAPI's Judge0 CE.

None of this requires a paid tier. Cold starts on the AI service (HF Spaces or Render free) are absorbed by the time a learner spends reading the problem statement before their first keystroke — that's the whole point of the warm-up ping in `workspace.service.ts`.

---

## 6. Every command

| Command | What it does |
|---|---|
| `pnpm dev` | web (:3000) + api (:4000) with hot reload |
| `pnpm ai:dev` | AI service (:8000) with reload |
| `pnpm db:local` | local Postgres, stays running |
| `pnpm db:local:init` | create the cluster/database/extensions, then exit |
| `pnpm db:local:recreate` | **drops** and recreates the local database |
| `pnpm db:push` | sync schema without migration history |
| `pnpm db:migrate` | create and apply a migration (Docker path) |
| `pnpm db:seed` | load problems, topics, badges, demo users |
| `pnpm db:studio` | Prisma Studio, browse the data |
| `pnpm smoke` | 25-assertion end-to-end check against a running stack |
| `pnpm ai:test` | 50 Python tests: analysis, triggers, Response Guard |
| `pnpm typecheck` | all 5 TypeScript packages |
| `pnpm build` | production build |

---

## 7. Troubleshooting

**`Python was not found; run without arguments to install from the Microsoft Store`**
Windows App Execution Aliases. The judge now probes interpreters with
`--version` at startup and skips the alias stubs, so this is handled — but if
no real Python is on `PATH`, install it or switch to
`EXECUTION_PROVIDER=judge0`.

**`character with byte sequence 0xe2 0x86 0x92 ... has no equivalent in encoding "WIN1252"`**
The database was created with the Windows locale. Fix:
`pnpm db:local:recreate && pnpm db:push && pnpm db:seed`.

**`pre-existing shared memory block is still in use`**
An orphaned Postgres from a previous run:

```powershell
taskkill /F /IM postgres.exe
Remove-Item .pgdata\postmaster.pid -ErrorAction SilentlyContinue
pnpm db:local
```

**`only one usage of each socket address` on :8000 or :4000**
A previous instance is still up. Find and stop it:

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**Mentor replies with generic advice**
Expected with no LLM key — that is the deterministic fallback. It should still
name your actual complexity class. If it does not, check `curl
localhost:8000/readyz` reports `grammars: 12`.

**`Invalid environment configuration`**
The API validates `.env` at boot and prints exactly which variable failed. Most
common cause: the two JWT secrets are identical or shorter than 32 characters.

---

## 8. Security notes for anything beyond localhost

- `EXECUTION_PROVIDER=mock` runs submitted code **unsandboxed on the host**. It
  refuses to start when `NODE_ENV=production`. Use `judge0` for any real
  deployment.
- Rotate all three generated secrets.
- Set `CORS_ORIGINS` to your actual web origin.
- Redis is optional locally but required once you run more than one API
  instance, or rate limits reset on every restart.
