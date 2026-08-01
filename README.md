# AI DSA Mentor

> A coding practice platform where the compiler is a mentor, not a grader.

LeetCode answers one question — *is your output correct?* AI DSA Mentor answers a
different one: *what is this person's current mental model, and what is the
smallest intervention that moves it forward?*

It watches a learner write code in real time, understands it deterministically
(parsing, complexity inference, algorithm fingerprinting) on every keystroke for
free, and only spends an LLM call when something genuinely salient happens —
they're stuck, thrashing, stuck in a loop of the same compile error, or about
to walk past a working milestone unacknowledged.

```
Private monorepo · pnpm workspaces + Turborepo · TypeScript + Python
Next.js 15 / React 19  ·  Express 4 + Prisma 6 + Socket.IO  ·  FastAPI + LangGraph + Tree-sitter
```

---

## Table of contents

1. [What this actually is](#1-what-this-actually-is)
2. [The core idea](#2-the-core-idea)
3. [Repository layout](#3-repository-layout)
4. [Tech stack](#4-tech-stack)
5. [How it works — a mechanism-level tour](#5-how-it-works--a-mechanism-level-tour)
6. [Data model](#6-data-model)
7. [API surface](#7-api-surface)
8. [Getting started](#8-getting-started)
9. [Testing & CI](#9-testing--ci)
10. [Deployment target](#10-deployment-target)
11. [What's built vs. what's still ahead](#11-whats-built-vs-whats-still-ahead)
12. [Design principles](#12-design-principles)
13. [Further reading](#13-further-reading)

---

## 1. What this actually is

A **five-service monorepo** built around one constraint taken seriously: *the
LLM is the scarcest resource in the system.* Every architectural decision —
the two-stage pipeline, the trigger policy, the Response Guard, the provider
failover chains, even the database retention policy — exists to make that
constraint survivable on **free-tier infrastructure**, without the product
ever feeling broken or cheap.

It is a real, working application today, not a mockup:

- Full email/password auth with rotating refresh tokens and reuse detection.
- 13 authored DSA problems (4 starter languages each, hidden + visible tests,
  3-level hints, editorials, fingerprinted reference solutions).
- A three-pane Monaco workspace with live static-analysis squiggles, a
  streaming AI mentor panel, and a per-test execution console.
- Real code execution (Python/JavaScript locally, or Judge0/Piston in
  production) with circuit-breaking failover between providers.
- A deterministic analysis engine that infers time/space complexity and
  recognizes ~12 algorithm shapes across 12 languages — with zero API keys.
- An optional LangGraph multi-agent mentor (7 specialists) gated behind a
  Response Guard that makes "never hand over the solution" a property of the
  system, not a hope about the prompt.
- Progress tracking: XP, topic mastery with time-decay, streaks, badges, and
  a leaderboard.

**It runs with zero API keys.** That is a design property, not a demo mode —
see [§11](#11-whats-built-vs-whats-still-ahead) and
[docs/RUNNING.md](docs/RUNNING.md) for exactly what each optional key unlocks.

---

## 2. The core idea

```
        every 2 seconds                        only on salient events (~5% of ticks)
  ┌────────────────────────────┐          ┌──────────────────────────────┐
  │  STAGE 1 — Signal Engine   │ trigger  │  STAGE 2 — Agent graph       │
  │  Tree-sitter · complexity  │ ───────► │  LangGraph · 7 specialists   │
  │  algorithm fingerprint     │          │  Response Guard · fallback   │
  │  static rules · behaviour  │          │                              │
  │  cost: $0 · 5–20 ms        │          │  cost: 1 LLM call            │
  └────────────────────────────┘          └──────────────────────────────┘
```

A 30-minute active session, naïvely built, is roughly **1,100 LLM calls**
(a poll every 2 seconds, plus ghost text, plus chat). This design brings that
down to **~15–55** — a 20–70× reduction — by inserting a free, deterministic
filter (the **Trigger Policy**, [§5.2](#52-the-trigger-policy)) between "code
changed" and "call the model." Silence is the default; every trigger has to
*earn* an LLM call by clearing a cooldown, a confidence threshold, and a
minimum assist-mode gate.

That single number is the reason a real-time AI mentor is viable on
infrastructure that costs $0/month at low scale — see
[§10](#10-deployment-target).

---

## 3. Repository layout

```
ai-dsa-mentor/
├── apps/
│   ├── web/                  Next.js 15 · React 19 · Monaco · Zustand · React Query
│   │       app/                     App Router — (app) authenticated shell, (auth) login/register
│   │       components/              AppShell (sidebar/auth-gate), Providers (React Query + auth bootstrap)
│   │       features/workspace/      The Monaco IDE feature module (see §5.8)
│   │       lib/                     api-client (in-memory token), socket singleton, cn()/markdown helpers
│   │       stores/                  Zustand: auth.store.ts, workspace.store.ts
│   │
│   ├── api/                  Express 4 · Prisma 6 · Socket.IO 4 · TypeScript
│   │       config/                  Zod-validated env — fails fast at boot
│   │       lib/                     jwt, password (argon2), redis, cache (in-process LRU), errors, logger
│   │       middleware/              authenticate, rateLimit (two-tier), validate, errorHandler
│   │       modules/                 auth · problems · execution · workspace · ai · progress (one per bounded context)
│   │       providers/               execution/{judge0,piston,local} adapters · ai/aiService.client (HMAC-signed)
│   │       realtime/                Socket.IO server, session registry, workspace event handlers
│   │
│   └── ai/                   FastAPI · Tree-sitter · LangGraph · Pydantic · Python ≥3.11
│           app/analysis/            Stage 1 — parser, complexity, algorithm fingerprints, static rules, signals
│           app/triggers/policy.py   The trigger table (data, not prompts — unit tested)
│           app/agents/              Stage 2 — LangGraph graph, 7 specialists, prompts, Response Guard, fingerprinting
│           app/models/              Provider router (OpenRouter/Groq/Together/Ollama), circuit breaker, usage ledger
│           tests/                   50 pytest tests: analysis, triggers, Response Guard red-team suite
│
├── packages/
│   ├── contracts/           Zod schemas — the single API source of truth (mirrored as Pydantic in apps/ai)
│   ├── db/                  Prisma schema (40+ tables), migrations config, seed script, fingerprint.ts (TS twin of the Python one)
│   └── config/              Shared tsconfig presets (base / node / next)
│
├── infra/
│   ├── docker/               docker-compose.yml (Postgres + Redis)
│   └── scripts/               dev.mjs, dev-db.mjs (embedded Postgres for no-Docker dev), smoke.mjs
│
├── docs/
│   ├── RUNNING.md            The full setup/run/troubleshooting reference
│   └── architecture/         8 design documents — system design, folder structure, diagrams, DB, API, sockets, AI, deployment
│
└── .github/workflows/        ci.yml (lint/typecheck/test/guard/build) · keep-warm.yml (anti-sleep cron)
```

---

## 4. Tech stack

### 4.1 Frontend — `apps/web` (`@repo/web`)

| Library | Version | Role |
|---|---|---|
| Next.js | 15.1.3 | App Router, the whole frontend shell |
| React / React DOM | 19.0.0 | UI runtime |
| `@monaco-editor/react` + `monaco-editor` | 4.6 / 0.52 | The code editor pane |
| `@tanstack/react-query` | 5.62 | All server-state / REST data fetching |
| `zustand` | 5.0 | Client state — `auth.store.ts`, `workspace.store.ts` |
| `socket.io-client` | 4.8 | Live workspace channel (code sync, streaming mentor, execution progress) |
| `framer-motion` | 11.15 | Animation (landing page, mentor message transitions) |
| `tailwindcss` | 3.4 | Styling — a single restrained dark palette (`ink` grays + one `accent` indigo) |
| `lucide-react` | 0.468 | Icon set |
| `clsx` + `tailwind-merge` | — | The `cn()` classname helper |

No UI kit, no form library, no CSS-in-JS — components are hand-built Tailwind
utility classes plus small `panel`/`chip`/`btn-*` helpers in `globals.css`.
**No test tooling exists in this package yet** (no Jest/Vitest/Playwright) —
see [§11](#11-whats-built-vs-whats-still-ahead).

### 4.2 Backend — `apps/api` (`@repo/api`)

| Library | Version | Role |
|---|---|---|
| Express | 4.21 | HTTP framework |
| `@prisma/client` | 6.1 | Postgres ORM client |
| `socket.io` | 4.8 | WebSocket server |
| `argon2` | 0.41 | Password hashing (Argon2id) |
| `jsonwebtoken` | 9.0 | Short-lived access-token JWTs |
| `ioredis` | 5.4 | Optional — durable rate-limit counters, refresh-token-family denylist, cron locks |
| `helmet` | 8.0 | Security headers / CSP |
| `zod` | 3.24 | Env validation + request validation (via `@repo/contracts`) |
| `pino` + `pino-http` | 9.5 / 10.3 | Structured JSON logging with redaction |
| `undici` | 7.2 | Outbound HTTP to Judge0 / Piston / the Python AI service |
| `tsx` (dev) | 4.19 | Watch-mode dev runner |
| `vitest` (dev) | 2.1 | Test runner — configured, no test files written yet |

### 4.3 AI service — `apps/ai` (`ai-dsa-mentor-ai`)

| Library | Version | Role |
|---|---|---|
| FastAPI | ≥0.115 | The service itself |
| `uvicorn[standard]` | ≥0.32 | ASGI server |
| Pydantic + `pydantic-settings` | ≥2.10 | Schema layer + typed env config |
| `tree-sitter` + `tree-sitter-language-pack` | ≥0.23 / ≥0.4 | Parsing across 12 languages, pre-built grammars |
| `langgraph` | ≥0.2.60 | Stage-2 agent graph state machine |
| `httpx` | ≥0.28 | Talks to every LLM provider as a raw OpenAI-compatible endpoint — **no provider SDK, no LangChain** |
| `structlog` | ≥24.4 | Structured logging |
| `pytest` + `pytest-asyncio` (dev) | ≥8.3 | 50 tests: analysis, triggers, Response Guard red-team |
| `ruff`, `mypy` (dev) | — | Lint + type check |

Both Tree-sitter and LangGraph are treated as **optional at runtime**: if
grammars fail to load, a regex/indentation fallback keeps Stage 1 alive; if
LangGraph is unavailable, a hand-rolled async executor (`_run_manual`) walks
the exact same node sequence.

### 4.4 Shared packages

| Package | Purpose |
|---|---|
| `packages/contracts` | Zod schemas for every domain (`common`, `auth`, `problems`, `execution`, `ai`, `progress`, `socket`) — inferred TS types, never hand-written. The `ai.ts` schemas are a field-for-field twin of `apps/ai/app/schemas.py`. |
| `packages/db` | The Prisma schema (single source of truth for the data model), a dev-hot-reload-safe `PrismaClient` singleton, and the seed script — including `fingerprint.ts`, a byte-for-byte TypeScript twin of the Python solution-fingerprinting algorithm used by the Response Guard. |
| `packages/config` | Shared `tsconfig` presets: `base.json` (strict ES2022), `node.json` (compiled packages), `next.json` (the web app). |

### 4.5 Infrastructure & tooling

- **pnpm workspaces + Turborepo** — chosen so `@repo/contracts` is a
  *compile-time* dependency of both `web` and `api`: a breaking API change
  fails `pnpm build` before it fails in production.
- **PostgreSQL** (via Docker, or an embedded no-install cluster in `.pgdata/`
  for Windows dev without admin rights) with `citext` + `pg_trgm`.
- **Redis** (optional) — durable counters only, never a read-through cache;
  see [§5.5](#55-auth--security) and [§10](#10-deployment-target).
- **Execution providers** — Judge0 CE (primary in production), Piston
  (public failover), a local unsandboxed child-process runner (dev only,
  refuses to start in production).
- **GitHub Actions** — `ci.yml` (Node + Python lint/typecheck/test, a
  required Response-Guard red-team gate, build) and `keep-warm.yml` (a
  10-minute cron hitting `/healthz` to stop the free-tier API from sleeping).

---

## 5. How it works — a mechanism-level tour

### 5.1 Stage 1 — the deterministic signal engine (`apps/ai/app/analysis/`)

Runs on every 2-second tick. No network call, no inference, 5–20ms typical.

- **Parsing** (`parser.py`) — Tree-sitter across **12 languages** (Python,
  JS, TS, Java, C++, C, C#, Go, Rust, PHP, Kotlin, Swift), chosen specifically
  because it parses *broken* code: a student mid-thought has unbalanced
  braces, and Tree-sitter returns a tree with `ERROR` nodes plus usable
  structure around them instead of failing outright. Falls back to a
  regex/indentation analyzer if grammars are unavailable.
- **Complexity estimation** (`complexity.py`) — purely structural, not an LLM
  guess. Classifies each loop's bound (linear/log/constant — a halving
  pattern like `>> 1` or `mid` signals log), multiplies nested bounds,
  special-cases `sort()` (floors at `O(n log n)`) and `x in list` inside a
  loop (floors at `O(n²)` — "the hidden quadratic"), and analyzes recursion
  via branching factor. Returns a **confidence score**, so the system can
  "stay silent rather than be confidently wrong."
- **Algorithm fingerprinting** (`algorithms.py`) — structural pattern
  matching for binary search, two pointers/sliding window, BFS, DFS,
  bottom-up DP, memoized recursion, union-find, heaps, prefix sums, hash-map
  lookups, and brute-force pair scans (the catch-all that's literally what
  routes to the Complexity agent).
- **Static rules** (`rules.py`) — unused variables, missing return, possible
  non-terminating loops, off-by-one/suspicious bounds, unfilled starter
  stubs, and the hidden-quadratic `x in list` pattern — capped at 14 findings
  so it never becomes "a wall of squiggles."
- **Behavioral signals** (`signals.py`) — a semantic diff (via
  `difflib.SequenceMatcher`) distinguishing real structural progress from
  cosmetic edits, a thrash score (rewriting the same region repeatedly), and
  a 0–1 progress estimate used to decide whether "idle" even means "stuck."

### 5.2 The trigger policy

Defined in `apps/ai/app/triggers/policy.py` as six triggers, each a frozen,
unit-tested predicate over signals — explicitly **data, not a prompt**:

| Trigger | Routes to | Cooldown | Fires when |
|---|---|---|---|
| `RUNTIME_FAILURE` | Debug | 0s | Last verdict is a failing one |
| `REPEATED_COMPILE_ERROR` | Debug | 60s | Same error ≥2 times |
| `IDLE_STUCK` | Hint | 120s | Idle past a (mode- and confidence-adjusted) threshold, progress <90% |
| `THRASHING` | Tutor | 180s | Thrash score ≥0.7 |
| `COMPLEXITY_GAP` | Complexity | 300s | Inferred complexity misses the expected band at ≥75% confidence, stable ≥15s |
| `MILESTONE` | Tutor | 240s | Real structure just got added, progress ≥60%, code parses |

Assist mode stretches thresholds (Easy is quicker to help, High needs less
prodding), `LearnerProfile.confidence` scales cooldowns further, and every
`ai:dismiss` lengthens that trigger's cooldown upstream — "a mentor who is
ignored learns to be quieter." If nothing fires, the response is
`fired: false` and the tick costs nothing beyond Stage 1 itself.

### 5.3 Stage 2 — the LangGraph mentor (`apps/ai/app/agents/`)

A small state machine: **`plan → generate → guard`**, with a conditional
edge out of `guard` — accept → `finalize`, reject → back to **`plan`** (not
`generate` — a guard rejection often means the wrong specialist was chosen),
or fallback after 2 attempts. When LangGraph isn't installed, a hand-rolled
loop (`_run_manual`) runs the identical four steps.

**Routing is rule-first.** A trigger-initiated turn is routed for free via a
static lookup table. An explicit question is matched against ordered regex
intent rules ("hint"/"stuck" → Hint, error language → Debug, "optimize"/"big
o" → Complexity, "review" → Code Review, "explain" → Tutor). Only genuinely
ambiguous questions spend a cheap, JSON-mode Planner call. The seven
user-facing specialists:

| Agent | Job |
|---|---|
| **Tutor** | Teaches the one blocking concept from what they've already written |
| **Hint** | Exactly one hint at the requested level (1: point at a property, 2: name the property + shape of the technique, 3: name the technique + first step — never the full solution) |
| **Debug** | Translates a compiler/runtime failure to plain language, points at the line, ends with a diagnostic question |
| **Complexity** | Explains current cost using the learner's actual loops, connects to the problem's constraints with real arithmetic |
| **Code Review** | Naming/structure/idioms/edge cases, at most 3 points, on already-working code |
| **Planner** | Routes ambiguous explicit questions (JSON-only output) |
| **Progress** | A session-end summary, under 120 words |

A **semantic cache**, keyed on structural fingerprint + problem + trigger +
assist mode, skips inference entirely on a hit — personalized turns
(anything referencing misconceptions or a free-text message) are excluded so
personalized answers never cross users. If no provider is configured or the
daily token budget is exhausted, the graph short-circuits straight to the
deterministic fallback rather than burning a retry loop on guaranteed
failure.

### 5.4 The Response Guard (`apps/ai/app/agents/validator.py`)

The mechanism that makes "never gives away the solution" a property of the
**system**, not a hope about the prompt. Every agent output is checked,
cheapest rule first, before it ever reaches a learner:

1. **Line budget** — counts non-blank code-block lines against
   `envelope.policy.maxCodeLines` (server-computed per assist mode); a
   complete function definition under the budget is *still* rejected if
   `mayWriteSolutionCode` is false.
2. **Hint-level fidelity** — checked against an explicit **algorithm
   lexicon** (hash map, two pointer, sliding window, binary search, BFS/DFS,
   DP, Kadane's, union-find, Dijkstra, backtracking, …). Naming the
   technique *is* the level-3 hint — "use a hash map" said at level 1 is a
   level-3 hint wearing a disguise.
3. **Solution similarity** — the reference solution's raw code **never
   enters a prompt**. Only its precomputed fingerprint travels in the
   context envelope; the guard fingerprints the proposed code the same way
   and rejects above a Dice-coefficient similarity threshold (default
   0.62) — so there is no context path by which a model could leak it, even
   compromised.
4. **Policy fidelity / safety** — a small blocklist for shell/exfiltration
   patterns.

The exact same fingerprinting algorithm exists twice — once in Python
(`apps/ai/app/agents/fingerprint.py`, used live by the guard) and once in
TypeScript (`packages/db/prisma/seed/fingerprint.ts`, used at seed time to
precompute `ReferenceSolution.normalizedTokens`) — with an explicit "if you
change one, change both" warning in both files and a parity test guarding
against drift. A dedicated red-team pytest suite
(`apps/ai/tests/test_guard/`) is a **required CI gate**: a prompt change
cannot merge if it makes the mentor more willing to hand over answers.

Prompt-injection defense is layered rather than a single filter: untrusted
code only ever sits in a fenced user-role block (never templated into the
system prompt), a detective regex pass flags "ignore previous
instructions"/fake `SYSTEM:` lines/fence-closing attempts, agents have no
tools or DB access, and — as above — the output guard runs regardless of
what happened upstream. *"Injection cannot be prevented, only made
worthless."*

### 5.5 Auth & security

Implemented in `apps/api/src/modules/auth/`:

- Access tokens are 15-minute JWTs; refresh tokens are **not** JWTs — 48
  random bytes, only their SHA-256 hash persisted, so a database leak alone
  yields nothing usable.
- Every refresh token belongs to a `familyId`. Rotation issues a new pair
  under the same family and revokes the old row. If an already-revoked
  token is presented again (a replay), the **entire family is revoked** and
  denylisted in Redis for 30 days — turning a stolen refresh token into a
  single-use anomaly that logs out attacker and victim together.
- Login/register return the same generic error for "no such user" and
  "wrong password" to prevent account enumeration; changing a password
  revokes every other session.
- The env loader hard-fails at boot if the access and refresh JWT secrets
  are identical or too short — no silent misconfiguration in production.

### 5.6 Code execution (`apps/api/src/providers/execution/`)

An `ExecutionRouter` builds an ordered provider chain from
`EXECUTION_PROVIDER` (`judge0 → piston` failover, or `piston → judge0`, or
`mock` → a local-only dev adapter). Each provider has an independent
in-memory circuit breaker (5 consecutive failures opens it for 60s); the
router walks the chain in order, skipping open circuits, and only fails if
every provider in the chain fails. Judge0 submits test cases as **one batch
request** (quota-metered) and polls on an increasing backoff schedule;
Piston runs sequentially with rate-limit pacing; the local adapter spawns a
real, unsandboxed child process and refuses to construct at all in
production. All three normalize output through a shared whitespace-tolerant
comparator so no judge fails a correct solution over a trailing newline.
Hidden-test payloads are redacted in a single centralized serializer
function so no future endpoint can leak them by forgetting to strip.

### 5.7 The realtime layer (`apps/api/src/realtime/`)

Socket.IO, websocket-transport only, two namespaces (`/workspace`,
`/notify`), JWT-authenticated on handshake with a 5-sockets-per-user cap
(oldest evicted). The governing rule: *"the socket carries state that
changes without a user action; everything a user explicitly requests stays
on REST"* — meaning the app is fully usable with the socket down. Every
`code:sync` (and idle `behaviour:tick`) runs a cheap Stage-1 analysis via
the AI service; only when the trigger policy fires does it escalate to a
real Stage-2 mentor turn — this is where the ~5% gate is actually enforced
at the transport layer. In-flight analyses are cancelled and replaced on
newer input, so at most one analysis is ever in flight per session.

### 5.8 The workspace frontend (`apps/web/src/features/workspace/`)

A three-pane page (`problems/[slug]/solve`): **ProblemPanel** (statement /
editorial / submissions) · **CodeEditor** + collapsible **ConsolePanel**
(Monaco + execution results) · **MentorPanel** (streaming chat). The
`useWorkspaceSession` hook wires it together: it pre-warms the AI service on
mount, prefers a **local draft from `localStorage`** over server state
("local-first, must never lose work to a slow round trip"), debounces code
sync at 2s while mirroring every keystroke to `localStorage` immediately,
and reports a 5-second behavioral heartbeat (idle time, backspaces, edit
count) that feeds the stuck-detection triggers. `CodeEditor` translates
Stage-1 findings into live Monaco squiggles via `setModelMarkers` — "the
visible half of 'the AI is watching' that never spends an LLM call."
`ConsolePanel` shows full input/expected/actual for visible tests but only
verdict + timing for hidden ones — the redaction holds all the way to the
client.

### 5.9 Progress, mastery & gamification (`apps/api/src/modules/progress/`)

XP is awarded only on a problem's first-ever acceptance (tiered by
difficulty). Topic mastery moves by an exponential formula weighted by each
topic's relevance to the problem — up on success, down (more gently) on
failure — and is treated as time-decaying if unpracticed, so recommendations
behave like spaced repetition rather than a static list. Badges are
declarative JSON criteria (`solve_count`, `streak`, `languages_used`,
`no_hint_solves`) evaluated live against current counters rather than
event-triggered, so a criteria change applies retroactively for free.

---

## 6. Data model

PostgreSQL via Prisma (`packages/db/prisma/schema.prisma`, 40+ tables),
organized by bounded context:

| Area | Key tables |
|---|---|
| Identity & access | `User`, `UserSettings`, `OAuthAccount`, `RefreshToken` (rotation + reuse detection), `VerificationToken` |
| Content | `Problem`, `ProblemExample`, `Topic`, `Company`, `Hint`, `Editorial`, `TestCase` (hidden/visible), `StarterCode`, `ReferenceSolution` (highest-sensitivity table — stores the precomputed fingerprint used by the Response Guard) |
| Workspace & execution | `WorkspaceSession`, `SessionMetrics` (one row per session — raw ticks are never persisted), `CodeDraft` (revisioned, last-write-wins), `Submission`, `SubmissionTestResult` |
| AI | `AiConversation` (one permanent thread per user × problem), `AiMessage` (with token/latency/cacheHit/guardRejection telemetry), `HintUnlock`, `AiFeedback`, `PromptTemplate`, `AiUsageDaily` |
| Learner model | `LearnerProfile`, `TopicMastery` (decays if unpracticed), `MisconceptionFlag`, `DailyActivity`, `Streak`, `UserStats` |
| Gamification | `Badge`, `UserBadge`, `LeaderboardSnapshot` |
| Scaffolded, not yet wired up | `Contest`, `ContestProblem`, `ContestParticipant`, `Bookmark`, `ProblemList`, `Note`, `Notification`, `AuditLog` — modeled in the schema, not yet exposed by any API route or page (see [§11](#11-whats-built-vs-whats-still-ahead)) |

Notable decisions: raw keystrokes and per-tick analysis results are **never
persisted** — only aggregated once at session end — a direct consequence of
targeting a free 0.5 GB Postgres tier; `ReferenceSolution.normalizedTokens`
is precomputed at seed/publish time so the live Response Guard never needs
the raw solution text.

The project currently ships schema **sync** (`pnpm db:push`), not a migration
history — see [§11](#11-whats-built-vs-whats-still-ahead).

---

## 7. API surface

Base path `/v1`, JSON over REST + Socket.IO for anything that changes without
a user action. Representative endpoints:

| Area | Endpoints |
|---|---|
| Auth | `POST /v1/auth/register`, `/login`, `/refresh`, `/logout`, `/logout-all`, `GET /me` |
| Problems | `GET /v1/problems`, `/:slug`, `/:slug/starter-code`, `/:slug/hints/:level/unlock`, `/:slug/editorial`, `/daily`, `/recommended` |
| Execution | `POST /v1/executions` (202 + id, progress over socket), `GET /:id`, `GET /quota`, `GET /languages` |
| Submissions | `GET /v1/submissions`, `/:id` |
| Workspace | `POST /v1/workspace/sessions`, `GET/PUT /v1/workspace/drafts` |
| AI | `POST /v1/ai/chat`, `/hint`, `/explain`, `/complete`, `GET /v1/ai/conversations/:problemId`, `/quota` |
| Progress | `GET /v1/progress`, `/v1/achievements`, `/v1/leaderboard` |
| System | `GET /healthz` (liveness, no DB call — the keep-alive cron target), `GET /readyz` (DB/Redis/AI/execution), `GET /v1/status` (public degradation banner) |

Every request is Zod-validated before the controller runs. Errors always have
the shape `{ "error": { "code", "message", "details"?, "requestId" } }` with a
stable, never-localized `code`.

---

## 8. Getting started

```bash
pnpm install
cp .env.example .env          # works as-is for local development
pnpm db:generate
```

**Database — pick one.**

Without Docker (downloads real Postgres binaries into `.pgdata/`, no install
or admin rights needed):

```bash
pnpm db:local:init            # creates a UTF8 cluster in .pgdata/
pnpm db:local &                # leave running
pnpm db:push
```

With Docker:

```bash
pnpm infra:up                  # postgres + redis
pnpm db:migrate
```

Then seed and run:

```bash
pnpm db:seed                   # 13 problems, topics, companies, badges, 2 users
pnpm dev                       # web :3000 · api :4000
```

The Python AI service runs separately:

```bash
cd apps/ai
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

Verify the whole stack end to end at any point:

```bash
pnpm smoke                     # auth → judge → mentor → progress, 25 assertions
```

Sign in with the seeded account:

```
demo@aidsamentor.dev   /   Demo123!
admin@aidsamentor.dev  /   Admin123!
```

**Requirements:** Node ≥20, pnpm 9.x (`npm i -g pnpm@9`), Python ≥3.11.
Docker is optional.

Add `OPENROUTER_API_KEY` (or `GROQ_API_KEY`) to a running `apps/ai` and
restart it to turn on the Stage-2 LLM agents — everything else already
works without it. For the full command reference, every environment
variable and what it unlocks, and Windows-specific troubleshooting (locale
issues, orphaned Postgres processes, port conflicts), see
**[docs/RUNNING.md](docs/RUNNING.md)**.

---

## 9. Testing & CI

| Command | What it runs |
|---|---|
| `pnpm typecheck` | All TypeScript packages |
| `pnpm --filter @repo/db exec prisma validate` | Schema validity |
| `cd apps/ai && pytest -q` | 50 tests — analysis, trigger policy, Response Guard red-team |
| `pnpm smoke` | 25-assertion end-to-end check against a running stack |

CI (`.github/workflows/ci.yml`) runs Node lint/typecheck/test against a real
`postgres:16-alpine` service container, a separate Python job (ruff + pytest),
a **required** `guard` job (the Response Guard red-team suite — a prompt
change cannot merge if it weakens these tests), and a build job. A second
workflow, `keep-warm.yml`, pings the deployed `/healthz` every 10 minutes to
stop the free-tier API from sleeping.

Two known test-coverage gaps, tracked in [§11](#11-whats-built-vs-whats-still-ahead):
`apps/web` has no test tooling installed, and `apps/api` has Vitest wired up
but no test files written yet.

---

## 10. Deployment target

| Component | Free tier | Why |
|---|---|---|
| Web | Vercel Hobby | First-party Next.js, edge CDN, PR previews |
| API + Socket.IO | Render Free | Needs a persistent process for WebSockets — rules out serverless |
| AI service | Hugging Face Spaces (Docker) | Doesn't consume Render's instance-hour budget; generous CPU for Tree-sitter |
| Database | Neon Postgres | Serverless, autosuspend, branch-per-PR |
| Redis | Upstash | Durability only, never a cache |
| Execution | Judge0 CE, Piston as failover | Battle-tested sandbox; adapter allows failover |

**Asymmetric warming** is the arithmetic behind the whole deployment shape:
Render's free tier grants 750 instance-hours against a ~730-hour month, so
exactly one service can stay always-warm. The **API** stays warm via a
10-minute keep-alive cron hitting `/healthz` (which makes no DB call). The
**AI service** is instead warmed on demand — the moment a user opens a
problem, the API fires a fire-and-forget warm-up ping, and the ~15–30s cold
start is absorbed while the learner is still reading the problem statement.

Redis is deliberately *not* used as a cache — at ~10k commands/day on the
free tier, a read-through cache would exhaust quota faster than it saves
work. It's reserved for durable, low-frequency state only: refresh-token
denylists, rate-limit counters for the two expensive endpoint classes
(execution, AI chat), and cron locks. Everything "hot" (problem cache,
leaderboard cache, live session state) lives in in-process memory instead.

---

## 11. What's built vs. what's still ahead

**Implemented and exercised by the smoke test today:** auth (register,
login, rotating refresh tokens), problem browsing/filtering, hidden-test
redaction, code submission through the execution provider chain, the
deterministic Stage-1 mentor fallback (works with zero API keys), 3-level
hints, editorials, XP/mastery/streaks/badges, and the leaderboard. The full
LLM-backed Stage-2 mentor works the moment an `OPENROUTER_API_KEY` or
`GROQ_API_KEY` is set.

**Confirmed gaps, in rough priority order:**

- **No frontend test suite.** `apps/web` has no Jest/Vitest/Playwright
  configured at all — UI regressions currently rely entirely on manual
  testing and TypeScript's type checker.
- **No backend test files yet.** `apps/api` has Vitest wired up
  (`pnpm --filter @repo/api test` runs) but there isn't a single `*.test.ts`
  file in the package yet — Stage-1/trigger/guard logic is well tested in
  Python, but the Express layer (auth, execution routing, redaction,
  rate-limiting) has none of its own.
- **No Prisma migration history.** The project currently syncs schema via
  `pnpm db:push`; there's no `prisma/migrations/` directory, which is fine
  for solo/dev use but should change before any real production deploy
  (`pnpm db:migrate` exists and is Docker-path-ready, just not exercised yet).
- **Contests, bookmarks, notes, notifications, and an audit log are modeled
  in the database schema but have zero API routes or frontend pages** —
  pure schema scaffolding today.
- **No admin panel.** There's no `/admin` route or `admin` API module for
  managing problems/prompts/users, even though the schema (`PromptTemplate`,
  `AuditLog`) anticipates one.
- **OAuth (Google/GitHub), avatar upload, and Sentry are unimplemented** —
  present as env vars in `.env.example` and validated by the config schema,
  but the code paths behind them don't exist yet. Email/password is the
  only auth method.
- **`contracts:check` doesn't exist yet.** The intent (documented in
  [docs/architecture/05-api-design.md](docs/architecture/05-api-design.md))
  is a CI job that exports the Zod (`packages/contracts`) and Pydantic
  (`apps/ai/app/schemas.py`) schemas to JSON Schema and diffs them so
  cross-language drift fails at PR time. Today the two sides are kept in
  sync by hand — a real, if narrow, source of future bugs.
- **No fine-tuning**, by design for v1 — but the data is already being
  collected in the right shape for it. `AiMessage` + `AiFeedback` +
  `SessionMetrics` form (context, response, outcome) triples with a real
  reward signal (did the learner solve it / need fewer hints afterward).
  The documented plan is a LoRA fine-tune of Qwen2.5-Coder specifically for
  the Hint and Debug agents, served via vLLM behind an OpenAI-compatible
  endpoint — a new provider file and a routing-table row, no agent or graph
  changes required.
- **Horizontal scaling is a documented, not-yet-needed upgrade path.** At
  more than one API instance, the in-process session registry and rate
  limiters would need to move behind Redis (a `@socket.io/redis-adapter` for
  Socket.IO fan-out), and self-hosting Judge0 becomes worthwhile once its
  hosted quota is the actual bottleneck. None of this is built, because
  nothing today is running at a scale that needs it.

If you're picking up this project next, the highest-leverage next steps are
probably: write the `apps/api` test suite (the riskiest untested surface),
generate an initial Prisma migration before any real deploy, and decide
whether contests/bookmarks/admin are worth building out or should be pruned
from the schema.

---

## 12. Design principles

1. **Deterministic analysis is unlimited; inference is rationed.** Every LLM
   call is treated like a paid call to a rate-limited vendor — because on
   free tier, it literally is.
2. **Withholding the answer is a mechanism, not a prompt.** If a guarantee
   matters (never leak the solution, never exceed a hint level), it's made
   structural and tested, not just requested of the model.
3. **Degrade by pruning, never by breaking.** Every external dependency —
   Tree-sitter grammars, LangGraph, the LLM provider chain, Judge0, Redis —
   has a defined fallback, and none of them is a blank screen or an error
   toast.
4. **The learner model is the product.** By problem #40, the mentor already
   knows this person's weak topics, recurring misconceptions, and how much
   they lean on hints — and that shapes every subsequent response.

---

## 13. Further reading

The eight design documents in [`docs/architecture/`](docs/architecture/README.md)
go substantially deeper than this README on rationale and future-state
design (some of it — contests, an admin UI, an owned/fine-tuned model — is
intentionally aspirational; see [§11](#11-whats-built-vs-whats-still-ahead)
for what's real today):

- [01 — System design](docs/architecture/01-system-design.md) — the product thesis, the two-stage pipeline, the ADR index
- [02 — Folder structure](docs/architecture/02-folder-structure.md)
- [03 — Architecture diagrams](docs/architecture/03-architecture-diagrams.md) — C4 context/container views, sequence diagrams
- [04 — Database design](docs/architecture/04-database-design.md) — full table catalogue, indexing, storage budget
- [05 — API design](docs/architecture/05-api-design.md) — REST conventions, error taxonomy, endpoint catalogue
- [06 — Socket design](docs/architecture/06-socket-design.md) — namespaces, rooms, the code-sync protocol
- [07 — AI architecture](docs/architecture/07-ai-architecture.md) — the Signal Engine, Trigger Policy, agent graph, Response Guard, model routing, memory
- [08 — Deployment architecture](docs/architecture/08-deployment-architecture.md) — placement, warming strategy, scaling runbook, cost projection

For setup, every command, every environment variable, and troubleshooting:
**[docs/RUNNING.md](docs/RUNNING.md)**.

---

*This is a private, unlicensed project — no `LICENSE` file is present in the
repository yet.*
