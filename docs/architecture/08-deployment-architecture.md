# 08 — Deployment Architecture

**Phase 1 deliverable 8 of 8**

---

## 1. Placement matrix

| Component | Primary (free) | Alternate | Why |
|---|---|---|---|
| Web (Next.js 15) | **Vercel Hobby** | Netlify / Cloudflare Pages | First-party Next.js support, ISR, edge CDN, preview deploys per PR |
| API (Express + Socket.IO) | **Render Free** | Fly.io, Railway | Persistent process required for WebSockets — rules out serverless |
| AI service (FastAPI) | **HF Spaces (Docker SDK)** | Render Free, Fly.io | Doesn't consume the Render 750 h budget; generous CPU for Tree-sitter |
| PostgreSQL | **Neon Free** | Supabase Free | Serverless Postgres, branch-per-PR, HTTP driver option |
| Redis | **Upstash Free** | Redis Cloud Free | Per-command pricing suits our low, bursty usage |
| Execution | **Judge0 CE** (RapidAPI free / self-host) | Piston (public) | Battle-tested isolate sandbox; adapter allows failover (ADR-007) |
| LLM | **OpenRouter** | Groq, Together | One key, many models, trivial provider switching |
| Media | **Cloudinary Free** | Vercel Blob | Transformations, signed uploads |
| Cron | **cron-job.org** / GitHub Actions | Upstash QStash | Free scheduled HTTP calls |
| Errors | **Sentry Free** | — | 5k events/mo is ample at this scale |
| Uptime | **UptimeRobot Free** | — | Doubles as a keep-alive pinger |

---

## 2. The warming strategy (ADR-004 in practice)

Render Free grants **750 instance-hours/month per account** against a ~730-hour month. Two always-on services is 2× over budget. So:

```
API service        →  ALWAYS WARM
                      cron-job.org GET /healthz every 10 min
                      /healthz makes no DB call — it must stay cheap enough
                      that 4,320 pings/month cost nothing

AI service         →  WARMED ON DEMAND
                      trigger 1: POST /v1/workspace/sessions fires a
                                 fire-and-forget GET /healthz (API side)
                      trigger 2: the web client pings on workspace mount
                                 (redundant, covers API-side failure)
                      window:    user reads the problem for 20–40 s
                      result:    container is warm before the first keystroke
```

Two independent warm triggers because a cold AI service on the first keystroke is the single worst first impression this product can make.

**Measured expectation:** HF Spaces Docker cold start for this image (FastAPI + 12 Tree-sitter grammars) is roughly 15–30 s. Grammar loading happens in the FastAPI `lifespan` hook, so `/readyz` returns 200 only once parsing actually works — the API never routes analysis to a container that would fail on it.

---

## 3. Environments

| Env | Web | API | AI | DB |
|---|---|---|---|---|
| **local** | `localhost:3000` | `localhost:4000` | `localhost:8000` | Docker Postgres + Redis + optional self-hosted Judge0 |
| **preview** | Vercel preview per PR | Render preview | HF Space branch | **Neon branch per PR** (instant, copy-on-write) |
| **production** | `aidsamentor.app` | `api.aidsamentor.app` | private URL, HMAC-only | Neon primary |

Neon's database branching is what makes per-PR preview environments viable on a free tier: a branch is a copy-on-write snapshot created in seconds, so every PR gets real, isolated, seeded data instead of a shared staging database that everyone corrupts.

---

## 4. Local development

```yaml
# infra/docker/docker-compose.yml (abridged)
services:
  postgres:  { image: postgres:16-alpine, ports: ["5432:5432"] }
  redis:     { image: redis:7-alpine,     ports: ["6379:6379"] }

  # Judge0 requires privileged mode for isolate/cgroups.
  # This is why Judge0 cannot be self-hosted on Render/Vercel/HF —
  # none of them permit privileged containers. It runs locally, and in
  # production we use hosted Judge0 until a dedicated VM is justified (01 §11).
  judge0-server:
    image: judge0/judge0:1.13.1
    privileged: true
    ports: ["2358:2358"]
  judge0-workers:
    image: judge0/judge0:1.13.1
    command: ["./scripts/workers"]
    privileged: true
```

```bash
pnpm install
pnpm db:up          # compose up postgres + redis + judge0
pnpm db:migrate
pnpm db:seed        # topics, companies, badges, ~50 curated problems
pnpm dev            # turbo: web + api + ai in parallel, all hot-reloading
```

Ports: web `3000`, api `4000`, ai `8000`, judge0 `2358`.

---

## 5. Configuration & secrets

All configuration is environment variables, validated by a Zod schema (`apps/api/src/config/env.ts`) and Pydantic Settings (`apps/ai/app/core/config.py`). **Both fail fast at boot on a missing or malformed variable** — a service that starts successfully is a service that is fully configured.

```bash
# ── apps/api ────────────────────────────────────────────────
NODE_ENV  PORT  APP_URL  API_URL
DATABASE_URL  DIRECT_DATABASE_URL          # Neon pooled + direct (migrations)
REDIS_URL
JWT_ACCESS_SECRET  JWT_REFRESH_SECRET      # ≥ 32 bytes, distinct
ACCESS_TOKEN_TTL=15m  REFRESH_TOKEN_TTL=30d
GOOGLE_CLIENT_ID  GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID  GITHUB_CLIENT_SECRET
JUDGE0_URL  JUDGE0_API_KEY  JUDGE0_PROVIDER=rapidapi|self|piston
AI_SERVICE_URL  AI_SERVICE_HMAC_SECRET
CLOUDINARY_URL  SENTRY_DSN
CORS_ORIGINS  LOG_LEVEL=info

# ── apps/ai ─────────────────────────────────────────────────
OPENROUTER_API_KEY  GROQ_API_KEY  TOGETHER_API_KEY
MODEL_TIER_REASON  MODEL_TIER_FAST  MODEL_TIER_TINY   # model ids, hot-swappable
LANGGRAPH_DATABASE_URL                                # scoped role, langgraph schema only
AI_SERVICE_HMAC_SECRET
DAILY_TOKEN_BUDGET  PER_USER_DAILY_TOKENS
ENABLE_GHOST_TEXT=true  SEMANTIC_CACHE_TTL=1800

# ── apps/web ────────────────────────────────────────────────
NEXT_PUBLIC_API_URL  NEXT_PUBLIC_SOCKET_URL  NEXT_PUBLIC_SENTRY_DSN
```

Secrets live in each platform's secret store, never in the repo. `.env.example` is committed with every key present and every value blank, so a missing variable is a diff, not a discovery at 2 a.m.

Model IDs are configuration, not code (`MODEL_TIER_*`), so switching from Nemotron to DeepSeek when a provider rate-limits is an env change and a restart — no deploy.

---

## 6. CI/CD

```yaml
# .github/workflows/ci.yml — gates (see 03 §10 for the flow diagram)
jobs:
  quality:      # eslint · tsc --noEmit · ruff · mypy · prettier --check
  contracts:    # export Zod + Pydantic to JSON Schema, diff them — fails on drift
  test-node:    # vitest unit + supertest integration (testcontainers: pg, redis)
  test-python:  # pytest, incl. Tree-sitter fixtures for all 12 languages
  guard:        # RED-TEAM SUITE — prompt injection + solution-leak attempts
  build:        # turbo build (remote cache)
```

**Two gates are non-negotiable:**

- `contracts` catches API drift across three languages at PR time rather than in production. This is the entire reason the monorepo exists (ADR-009).
- `guard` prevents a prompt edit from quietly turning the mentor into an answer key. A prompt change is a behaviour change and is tested like one.

Deploy on merge to `main`: `prisma migrate deploy` → Vercel production → Render deploy hook → HF Space rebuild → smoke test `/healthz` + `/readyz` on both services → auto-rollback on failure.

**Migration safety.** Migrations are expand-contract: add nullable column → backfill → start writing → switch reads → drop old in a *later* release. No migration in a single deploy both adds a constraint and depends on it, so a rollback never strands the database ahead of the code.

---

## 7. Scaling runbook

Each step is additive; none requires touching the agent graph, the schema, or the API contracts.

| Trigger | Action | Est. cost |
|---|---|---|
| Cold starts visible to users | Render Starter for API ($7/mo) — removes sleep, removes the keep-alive cron | $7 |
| AI latency dominated by cold start | Render/Fly Starter for AI | $7 |
| Neon 0.5 GB reached | Neon Launch, relax retention policies (`04 §6`) | $19 |
| Redis 10k cmd/day reached | Upstash pay-as-you-go; promote Redis to L2 cache (`01 §8`) | ~$5 |
| Judge0 quota is the top complaint | Self-host Judge0 on a VM with privileged Docker (Oracle Cloud Free ARM is the genuine zero-cost option here) | $0–12 |
| One API instance saturated | Scale to N + `@socket.io/redis-adapter` + sticky sessions (`06 §9`) | ×N |
| LLM spend is the top line item | Fine-tuned Qwen2.5-Coder on vLLM for Hint/Debug (`07 §11`) | GPU-dependent |

---

## 8. Monitoring & operations

**Logging.** Pino (Node) and structlog (Python), both JSON, both carrying `requestId`, `userId`, `sessionId`. A single `X-Request-Id` traces a user action across web → API → AI service → provider. Redaction is configured at the logger, not the call site: tokens, passwords, and code payloads never reach a log line.

**Health.** `/healthz` (liveness, no dependencies, cheap enough to ping every 10 minutes) and `/readyz` (DB, Redis, AI service, execution provider — used by deploy smoke tests and the status banner).

**Alerts** — each one exists because it maps to a specific user-visible failure:

| Alert | Threshold | User-visible symptom it predicts |
|---|---|---|
| Execution quota | < 20% remaining | Submissions start failing |
| AI token budget | < 20% remaining | Mentor degrades to Stage-1 only |
| Guard rejection rate | > 15% over 1 h | A prompt regression is leaking solutions |
| Neon storage | > 80% | Writes begin failing |
| Redis commands | > 80% of daily | Rate limiting degrades |
| API p95 latency | > 1.5 s | Everything feels slow |
| Socket disconnect rate | > 10% | Editor sync feels broken |
| 5xx rate | > 1% | Outage |

**Backups.** Neon PITR on the free tier covers recent history; a nightly `pg_dump` of content tables (problems, tests, hints, editorials, prompts) to Cloudinary/R2 covers the irreplaceable data. User progress is recoverable from backups; **authored content is the thing that cannot be regenerated**, so it gets its own backup path.

**Runbooks** live in `docs/runbooks/` — one per alert above, each stating detection, immediate mitigation, root-cause checklist, and the user-facing message to display.

---

## 9. Cost projection

| Stage | Users | Monthly |
|---|---|---|
| MVP, all free tiers | 0–500 | **$0** |
| No cold starts | 500–5k | ~$33 |
| Horizontal + owned execution | 5k–50k | ~$150–300 |
| Owned inference | 50k+ | GPU-dependent |

The $0 tier is a real, working product — not a demo. Every degradation path in `01 §7` exists so that "free" means "limited but honest," never "broken."
