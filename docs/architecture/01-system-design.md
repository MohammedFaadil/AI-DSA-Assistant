# 01 — System Design

**Project:** AI DSA Mentor
**Document status:** Phase 1 deliverable 1 of 8
**Audience:** engineering, infra, product

---

## 1. Product thesis (what actually makes this different)

LeetCode is a **verifier**: it answers one question — *is your output correct?*

AI DSA Mentor is a **cognitive tutor**: it answers a different question — *what is this person's current mental model, and what is the smallest intervention that moves it forward?*

That single sentence dictates the entire architecture. A verifier only needs `code → judge → verdict`. A tutor needs a **persistent model of the learner**, a **continuous read of the coding session**, and a **policy** that decides when to speak, what to say, and how much to withhold.

Three architectural consequences follow, and everything in these documents is downstream of them:

| Consequence | Why | Where it lives |
|---|---|---|
| **The AI must be event-driven, not poll-driven** | An LLM invoked every 2s per user is financially and operationally impossible, and pedagogically wrong (a mentor who talks every 2 seconds is a distraction, not a mentor). | Two-stage pipeline, §5 |
| **Understanding must be mostly free** | 95% of "understanding what the user is doing" is deterministic program analysis, not inference. Tree-sitter + static rules cost ~2ms and $0. | Signal Engine, §5.1 |
| **Withholding is a first-class feature** | The product's value is *not* giving the answer. This must be enforced mechanically, not hoped for in a prompt. | Response Guard, §5.4 & `07-ai-architecture.md` |

> **Design rule adopted throughout:** *The LLM is the scarcest resource in the system.* Treat every LLM call like a paid API call to a rate-limited external vendor — because on free tier, it literally is. Deterministic analysis is unlimited; inference is rationed.

---

## 2. Constraints that shape the design

These are hard constraints from the brief, not preferences.

### 2.1 Free-tier budget (verify current limits before build — providers change these)

| Resource | Provider | Free allowance | Binding constraint |
|---|---|---|---|
| Web frontend | Vercel Hobby | ~100 GB bandwidth/mo, edge CDN | No long-lived WebSocket server |
| Node API + Socket.IO | Render Free | 512 MB RAM, 0.1 CPU, **750 instance-hours/mo per account**, sleeps after ~15 min idle | 750 h ≈ **one** service running 24/7 |
| Python AI service | Hugging Face Spaces (Docker) / Render Free | 2 vCPU / 16 GB (HF CPU-basic), pauses on long inactivity | Cannot keep *two* Render services warm 24/7 |
| PostgreSQL | Neon Free | ~0.5 GB storage, autosuspend, branch limit | **Storage is the hard wall** — no raw telemetry |
| Redis | Upstash Free | **~10,000 commands/day**, 256 MB | ~7 commands/minute account-wide. Redis is *not* a hot cache here |
| Code execution | Judge0 CE (RapidAPI free ≈ 50 req/day) / self-host / Piston | Execution quota is the **user-facing** bottleneck | Needs a provider abstraction + fallback |
| LLM inference | OpenRouter (`:free` models), Groq free | Requests/day + requests/min caps | Needs routing, caching, degradation |
| Media | Cloudinary Free | 25 credits/mo | Avatars + problem figures only |

### 2.2 The 750-hour arithmetic (a real constraint most designs miss)

Render's free tier grants **750 instance-hours per month per account**, and a month is ~730 hours. Therefore:

- Keeping **one** service warm 24/7 = 730 h ✅
- Keeping **two** services warm 24/7 = 1460 h ❌ (**2× over budget**)

**Resolution — asymmetric warmth:**

- The **Node API** is the always-warm service. It is on the critical path of every page load, auth check, and socket handshake. It gets the external keep-alive cron (`cron-job.org` or GitHub Actions hitting `/healthz` every 10 min).
- The **Python AI service** is **warmed on demand**. The moment a user opens a coding workspace, the client (and the API, redundantly) fires a non-blocking `GET /healthz` at the AI service. By the time the user has read the problem statement and typed their first line (~20–40 s), the container is warm. Cold start is absorbed by human reading time instead of by a spinner.
- Preferred placement for the AI service is **Hugging Face Spaces (Docker SDK)**, which is a natural fit for a FastAPI container and does not consume the Render hour budget at all. Render Free is the documented alternate.

This is recorded as **ADR-004**.

### 2.3 Non-goals for v1

Explicitly out of scope so they don't leak into the design:

- Training or fine-tuning any model (architecture is *prepared* for it — see `07-ai-architecture.md` §9 — but v1 ships zero training).
- Building a compiler, sandbox, or container runtime. Judge0 owns that boundary.
- Video content, mobile native apps, payments/billing.
- Multi-region or multi-tenant isolation.

---

## 3. System decomposition

Five deployable units, chosen so that each has one reason to change and one scaling axis.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  1. WEB          Next.js 15 / React 19 — SSR shell, RSC data, Monaco     │
│                  Owns: rendering, editor UX, optimistic state            │
├──────────────────────────────────────────────────────────────────────────┤
│  2. API          Express + TypeScript + Prisma + Socket.IO               │
│                  Owns: identity, authorization, persistence, orchestration│
│                  of execution, socket fan-out, rate limiting, billing of │
│                  scarce quotas                                           │
├──────────────────────────────────────────────────────────────────────────┤
│  3. AI           FastAPI + LangGraph + Tree-sitter + Pydantic            │
│                  Owns: program analysis, agent graph, prompt assembly,   │
│                  model routing, response validation                      │
├──────────────────────────────────────────────────────────────────────────┤
│  4. EXECUTION    Judge0 CE (external) behind an adapter interface        │
│                  Owns: compilation, sandboxed run, limits, verdicts      │
├──────────────────────────────────────────────────────────────────────────┤
│  5. DATA         Neon Postgres (truth) · Upstash Redis (ephemeral)       │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Why a separate Python service (ADR-001)

The alternative — running the agent orchestration inside Node — was rejected for three reasons:

1. **Tree-sitter grammar coverage.** `py-tree-sitter` with the official grammar bundles is the most complete, best-maintained binding set. Node's `web-tree-sitter` (WASM) works but grammar packaging for 12 languages is materially more painful.
2. **LangGraph is the reference implementation in Python.** LangGraph.js lags on checkpointers, interrupts, and streaming semantics.
3. **Blast radius.** AST parsing of arbitrary user code is a CPU-bound, potentially pathological workload (deeply nested input, huge files). Isolating it means a parser hang degrades hints, not authentication.

**Cost of this decision:** a network hop and a second deployment. Mitigated by the on-demand warming above and by the fact that the AI service is *off the critical path* for every non-mentoring action.

### 3.2 Why the API owns execution, not the client (ADR-002)

Judge0 credentials must never reach the browser, and execution quota is a scarce, per-user, abuse-prone resource. The API is therefore the sole holder of the Judge0 key and the sole enforcer of:

- per-user execution rate limits (token bucket),
- payload size and language allow-listing,
- test-case confidentiality (hidden tests are never serialized to the client),
- verdict normalization across execution providers.

### 3.3 Why the AI service never touches the database (ADR-003)

The Python service is **stateless**. It receives a fully-hydrated context envelope from the API and returns a structured response. It has no Prisma client, no DB URL, no user table access.

Benefits: it can be scaled, restarted, or replaced independently; its cold start doesn't wait on a DB connection pool; a prompt-injection payload that somehow achieves tool misuse still has no data reach; and the API remains the single writer, which keeps the learner model consistent.

The one exception is the **LangGraph checkpointer**, which needs durable state for multi-turn graphs. This uses a *separate, narrow* Postgres role scoped to the `langgraph_*` tables only — no access to `users`, `submissions`, or problem solutions.

---

## 4. Core runtime flows

### 4.1 Flow A — User types (the hot path, runs continuously)

```
Monaco onChange
  └─ local debounce 2000 ms (idle-triggered, cancels in flight)
      └─ compute edit delta + cursor + visible range
          └─ socket emit  workspace:code:sync   (compressed, delta only)
              └─ API: validate → rate-limit → attach session context
                  └─ HTTP POST  /v1/analyze  (AI service)
                      ├─ Tree-sitter parse (~2–10 ms)      ← NO LLM
                      ├─ Static rule pass (~1 ms)          ← NO LLM
                      ├─ Signal extraction                 ← NO LLM
                      └─ Trigger policy → decision
                          ├─ "stay silent"  → return signals only  (≈95% of ticks)
                          └─ "intervene"    → LangGraph → LLM  (≈5% of ticks)
                              └─ socket emit  ai:suggestion / ai:message
```

**The 95/5 split is the single most important number in this system.** It is what makes a 2-second analysis cadence compatible with free-tier LLM quotas. See §5.

### 4.2 Flow B — Run / Submit

```
Client "Run"
  └─ POST /v1/executions            (code, language, mode=RUN|SUBMIT)
      ├─ authz + token-bucket check
      ├─ resolve test cases         (RUN → visible only; SUBMIT → visible + hidden)
      ├─ ExecutionProvider.submitBatch()   → Judge0 (adapter)
      ├─ poll/callback until terminal
      ├─ normalize verdicts, redact hidden-test payloads
      ├─ persist Submission + SubmissionTestResult
      ├─ emit  execution:update  over socket (streamed per test case)
      └─ if failure → enqueue Debug Agent trigger (async, non-blocking)
```

### 4.3 Flow C — User asks the mentor a question

```
Client "Why isn't this working?"
  └─ socket  ai:chat:send
      └─ API builds Context Envelope (§6) from DB + live session state
          └─ POST /v1/agent/chat (streaming)
              └─ LangGraph:  Guard → Context → Planner → Agent(s) → Validator → Formatter
                  └─ token stream → socket  ai:chat:token* → ai:chat:done
                      └─ API persists AiMessage + updates LearnerModel
```

Note that the user never supplies context. The envelope always carries the problem, the current buffer, the last compiler output, prior hints, and the assist mode — so *"why isn't this working?"* is unambiguous.

---

## 5. The two-stage mentoring pipeline (the heart of the system)

This is the mechanism that satisfies "AI analyses code every 2 seconds" without an LLM call every 2 seconds.

```
        every 2s                            only on salient events
  ┌───────────────────────┐            ┌──────────────────────────────┐
  │  STAGE 1 — SIGNALS    │  trigger   │  STAGE 2 — REASONING         │
  │  deterministic, local │ ─────────► │  LangGraph multi-agent + LLM │
  │  cost: ~0             │  ~5% of    │  cost: 1 LLM call            │
  │  latency: 5–20 ms     │  ticks     │  latency: 400–2500 ms        │
  └───────────────────────┘            └──────────────────────────────┘
```

### 5.1 Stage 1 — the Signal Engine (zero-cost understanding)

Runs on every 2-second tick. Pure computation, no network, no inference. It produces a `SessionSignals` object:

**Structural signals (Tree-sitter AST):**
- current enclosing function / scope chain / cursor node kind
- loop nest depth, recursion presence, data structures instantiated
- syntactic validity + error node locations (works on *incomplete* code — this is why Tree-sitter, not a parser generator)
- unused variables, unreachable code, missing return on a non-void path
- AST diff vs. previous snapshot → *what did they actually change?*

**Algorithmic signals (rule pass over the AST):**
- inferred complexity class from loop-nest × input-size, e.g. `O(n²)` from a doubly-nested loop over the same collection
- algorithm fingerprint match (two-pointer, sliding window, memoized recursion, BFS queue, DFS stack/recursion, union-find, binary search on answer, …)
- distance from the problem's expected complexity band (stored on `Problem`)

**Behavioural signals (session telemetry, aggregated in memory):**
- idle duration, edit velocity, backspace ratio, cursor dwell per line
- churn: same lines rewritten N times → thrashing
- compile-attempt count and error-repeat rate
- hint level already consumed, time since last AI message

### 5.2 The Trigger Policy (when the mentor speaks)

A deterministic, tunable, **testable** policy — not a prompt. Each trigger has a cooldown and a minimum assist mode.

| Trigger | Fires when | Cooldown | Routes to |
|---|---|---|---|
| `IDLE_STUCK` | no edit ≥ 45 s **and** code is incomplete | 120 s | Hint Agent (level 1) |
| `THRASHING` | same line region rewritten ≥ 4× in 90 s | 180 s | Tutor Agent |
| `COMPLEXITY_GAP` | inferred class worse than expected band **and** structure is stable ≥ 15 s | 300 s | Complexity Agent |
| `REPEATED_COMPILE_ERROR` | same error signature ≥ 2× | 60 s | Debug Agent |
| `RUNTIME_FAILURE` | submission verdict ∈ {WA, TLE, RTE} | none | Debug / Complexity Agent |
| `MILESTONE` | a correct sub-structure appears (e.g. valid base case) | 240 s | Tutor Agent (encouragement) |
| `EXPLICIT_ASK` | user typed in chat / clicked hint | none | Planner |
| `GHOST_TEXT` | High Assist only, on pause ≥ 350 ms at a completable position | token-bucket | Completion model (FIM) |

Silence is the default. Every trigger must *earn* an LLM call.

### 5.3 Stage 2 — the agent graph

Full treatment in `07-ai-architecture.md`. Summary: a LangGraph state machine whose nodes are the seven specified agents (Planner, Tutor, Code Review, Hint, Debug, Complexity, Progress), fronted by a security guard node and backed by a validator node.

### 5.4 The Response Guard (mechanically enforced withholding)

Before any agent output reaches the user, it passes a validator that **rejects and regenerates** if:

1. The output contains a code block exceeding the mode's line budget (Easy: ≤ 3 illustrative lines; Moderate: ≤ 6; High: unrestricted in ghost-text channel only).
2. Token-level similarity between the output and the stored **reference solution** exceeds a threshold (normalized identifier-insensitive comparison) while the user has not solved the problem.
3. The output violates the requested hint level (a level-1 hint that names the exact algorithm is a level-3 hint wearing a disguise).
4. The output fails Pydantic schema validation.

This is the difference between "we told the model not to give solutions" and "the model cannot give solutions."

### 5.5 Quota arithmetic — why this fits free tier

Assume an active user in a 30-minute session:

| Path | Naive design | This design |
|---|---|---|
| 2 s analysis ticks | 900 LLM calls | **0** (deterministic) |
| Triggered interventions | — | ~8–12 LLM calls |
| Explicit chat turns | ~6 | ~6 |
| Ghost text (High Assist only) | ~200 | ~40 (bucketed + cached + cancelled) |
| **Total per session** | **~1100** | **~15–55** |

A ~20–70× reduction, achieved without removing a single user-visible capability.

Layered on top: **semantic caching** (identical problem + near-identical AST fingerprint + same trigger → cached response), **prompt caching** where the provider supports it, and **model tiering** (cheap fast model for completion, reasoning model only for Tutor/Complexity).

---

## 6. The Context Envelope

Every AI invocation carries exactly one contract object, versioned and Zod/Pydantic-validated on both sides. This is the API↔AI seam.

```jsonc
{
  "v": 1,
  "requestId": "uuid",
  "trigger": "IDLE_STUCK",
  "assistMode": "MODERATE",
  "problem": {
    "id", "slug", "title", "difficulty",
    "statementDigest",           // compressed statement, not raw markdown
    "topics": ["array","hashing"],
    "expectedTime": "O(n)", "expectedSpace": "O(n)",
    "constraintsDigest"
  },
  "code": {
    "language": "python",
    "buffer": "...",             // truncated to a window around the cursor if large
    "cursor": { "line": 12, "col": 8 },
    "selection": null,
    "recentEdits": [ /* last N semantic deltas, not keystrokes */ ]
  },
  "signals": { /* SessionSignals from Stage 1 */ },
  "execution": {
    "lastVerdict": "WRONG_ANSWER",
    "compilerStderr": "...",     // truncated + sanitized
    "failingVisibleTest": { "input": "...", "expected": "...", "actual": "..." }
  },
  "history": {
    "hintsUsed": [1],
    "attemptCount": 3,
    "recentAiMessages": [ /* rolling window, summarized beyond N */ ]
  },
  "learner": {
    "skillLevel": "INTERMEDIATE",
    "weakTopics": ["dynamic-programming"],
    "strongTopics": ["two-pointers"],
    "misconceptionFlags": ["off-by-one-in-binary-search"]
  },
  "policy": {
    "maxCodeLines": 3,
    "mayRevealAlgorithmName": false,
    "language": "en"
  }
}
```

**Design notes:** `policy` is computed server-side from assist mode + hint history and is *not* something the model can talk itself out of — the Response Guard re-checks against it. `statementDigest` and `constraintsDigest` are precomputed at problem-ingest time so we never pay to tokenize a full markdown statement on every call.

---

## 7. Degradation matrix (what happens when free tier bites)

A production system is defined by its failure behaviour. Every dependency here has a defined fallback, and none of them is a blank screen.

| Failing dependency | Detection | Behaviour |
|---|---|---|
| AI service cold/unreachable | health probe + 3 s timeout | Stage-1 signals still render (complexity badge, unused-var squiggles, structural warnings). Chat shows "Mentor is waking up…" with a retry. **The editor never blocks.** |
| LLM provider 429 / down | provider error taxonomy | Model router falls through the chain (primary → secondary → fast). If all exhausted: serve the problem's **authored** hints from the DB — a real, useful fallback that costs nothing. |
| Judge0 quota exhausted | provider quota counter | Switch to secondary execution adapter; if none, run *visible* tests only and surface a clear, honest banner with quota reset time. Never silently pass. |
| Redis quota exhausted | command counter + error | Rate limiting degrades to in-process token buckets; sessions degrade to DB-backed. Non-fatal by design (see §8). |
| Neon suspended | first-query latency | Connection retry with backoff; UI shows skeletons. Sub-second, invisible in practice. |
| Socket disconnected | heartbeat | Client falls back to HTTP polling for execution status; editor state is local-first and re-syncs on reconnect with a monotonic revision number. |

---

## 8. Redis: deliberately not a cache

At ~10,000 commands/day, Redis cannot be a request-path cache — a single active user could exhaust it. This inverts the usual design.

**Redis is used only for things that must survive a process restart and are low-frequency:**
- refresh-token revocation list (write on logout/rotate, read on refresh)
- distributed lock for the daily-problem and contest-finalize jobs
- cross-instance rate-limit counters — **only for expensive endpoints** (execution, AI chat), never for reads

**Everything hot uses in-process memory instead:**
- an LRU for problem metadata, prompt templates, and semantic AI cache
- token buckets for per-socket throttling
- live session signal state

This is correct at current scale (single API instance) *and* has a clean upgrade path: when we scale to N instances, the in-process LRU becomes a two-tier cache with Redis as L2, and Socket.IO gains the Redis adapter. Documented in `08-deployment-architecture.md` §7.

---

## 9. Security posture (summary; full detail in the security module)

| Surface | Threat | Control |
|---|---|---|
| Code execution | Sandbox escape, resource exhaustion | Judge0 isolate; hard CPU/memory/wall limits; no network in sandbox; API-side payload caps |
| LLM prompts | **Prompt injection via user code** — the primary novel threat here | User code is always fenced in an untrusted-content delimiter block, never concatenated into instructions; system prompt states code is data; structured output enforced; Response Guard post-check; agents have no tools that touch data |
| Solution leakage | Users extracting reference solutions via chat | Reference solutions are never placed in any prompt except the Guard's similarity check (which runs locally in the AI service, not in-context); similarity rejection; hidden tests never leave the API |
| Auth | Token theft, replay | Short-lived access JWT (15 m) in memory, refresh token in httpOnly+Secure+SameSite cookie with rotation and reuse detection |
| Abuse | Quota drain | Layered token buckets: per-IP, per-user, per-endpoint class; execution and AI have separate, stricter budgets |
| Input | Injection, oversized payloads | Zod at every boundary, body size limits, language allow-list, Helmet, strict CORS |

---

## 10. Architecture Decision Record (index)

| ID | Decision | Rationale | Rejected alternative |
|---|---|---|---|
| ADR-001 | Separate Python AI service | Tree-sitter grammar coverage, LangGraph maturity, CPU isolation | LangGraph.js inside Express |
| ADR-002 | API is sole execution broker | Credential secrecy, quota enforcement, hidden-test confidentiality | Direct client→Judge0 |
| ADR-003 | AI service is stateless, no DB | Independent scaling, smaller blast radius, single-writer consistency | Shared Prisma/DB access |
| ADR-004 | Asymmetric warming (API always, AI on-demand) | 750 h/mo Render budget arithmetic (§2.2) | Keep-alive cron on both |
| ADR-005 | Two-stage pipeline; deterministic signals gate inference | 20–70× LLM reduction; better pedagogy (silence by default) | LLM call every 2 s |
| ADR-006 | Redis for durability, not caching | 10k cmd/day makes it a liability as a hot cache | Redis-first cache layer |
| ADR-007 | Execution behind a provider adapter | Judge0 free quota is the tightest user-facing limit; needs failover | Hard-coded Judge0 client |
| ADR-008 | Response Guard validates against reference solution | Pedagogical guarantee must be mechanical, not prompt-based | Prompt instruction only |
| ADR-009 | Monorepo, pnpm + Turborepo | Shared Zod contracts between web/api; single-PR cross-cutting changes | Polyrepo |
| ADR-010 | No raw keystroke telemetry in Postgres | Neon 0.5 GB is the hard wall; aggregate in memory, persist rollups | Event-sourced edit log |
| ADR-011 | Local-first editor state with revision numbers | Socket loss must never lose user code | Server-authoritative buffer |

---

## 11. Scaling path (free tier → real load)

The design is deliberately *scale-ready*, not *scale-now*. Each step is additive and requires no rewrite:

| Stage | Users | Change |
|---|---|---|
| **0 — Free tier** | 0–500 | As documented. Single API instance, on-demand AI, external Judge0. |
| **1 — Paid floor (~$25/mo)** | 500–5k | Render Starter (no sleep) for API + AI; Neon paid; drop keep-alive crons. |
| **2 — Horizontal** | 5k–50k | N API instances + Socket.IO Redis adapter + sticky sessions; Redis becomes L2 cache; BullMQ for async agent work. |
| **3 — Execution owned** | 50k+ | Self-hosted Judge0 cluster (privileged Docker on a VM/K8s); execution queue with priority lanes for contests. |
| **4 — Model owned** | — | Fine-tuned Qwen2.5-Coder for hint generation, served on vLLM; the model router already abstracts this — it becomes one more provider entry. |

Nothing above requires touching the agent graph, the schema, or the API contracts.
