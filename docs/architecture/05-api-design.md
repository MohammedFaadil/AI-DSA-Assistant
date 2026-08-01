# 05 — API Design

**Phase 1 deliverable 5 of 8**
Base URL: `https://api.aidsamentor.app/v1` · Transport: REST/JSON + SSE · Contracts: `packages/contracts`

---

## 1. Conventions

**Versioning.** Path-versioned (`/v1`). Additive changes are in-place; breaking changes mint `/v2` and the old version is supported for one release cycle.

**Envelope.** Success responses return the resource directly; failures always return the same shape. No `{ success: true, data: … }` wrapper on success — it adds a nesting level to every client type for no information.

```jsonc
// Error — always this shape, every endpoint, no exceptions
{
  "error": {
    "code": "PROBLEM_NOT_FOUND",       // stable, machine-readable, never localized
    "message": "Problem not found.",   // human-readable, safe to display
    "details": [                        // present only for VALIDATION_ERROR
      { "path": "language", "message": "Unsupported language" }
    ],
    "requestId": "req_01J..."           // echoes X-Request-Id; quote in support
  }
}
```

**Pagination.** Cursor-based everywhere that can grow unbounded. Offset pagination is used only for the problem list, where deterministic page numbers are a UX requirement and the set is small and static.

```jsonc
{ "items": [...], "nextCursor": "eyJpZCI6...", "hasMore": true }
```

**Idempotency.** `POST /v1/executions` accepts `Idempotency-Key`. A repeated key within 10 minutes returns the original execution instead of burning another Judge0 credit — this matters when the tightest quota in the system is execution.

**Auth.** `Authorization: Bearer <accessToken>`. Refresh happens only on `POST /v1/auth/refresh` using the httpOnly cookie; the access token is never persisted client-side.

**Standard headers.** `X-Request-Id` (generated if absent, echoed on every response and in every log line), `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

**Validation.** Every request body, query, and param is parsed by a Zod schema from `packages/contracts` in a `validate()` middleware before the controller runs. A controller never sees unvalidated input, so controllers contain no defensive checks.

---

## 2. Error code taxonomy

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod parse failure; `details` populated |
| 401 | `UNAUTHENTICATED` / `TOKEN_EXPIRED` / `TOKEN_REUSED` | `TOKEN_REUSED` means the family was revoked — force full re-login |
| 403 | `FORBIDDEN` / `EMAIL_NOT_VERIFIED` / `PREMIUM_REQUIRED` | Authorization failure |
| 404 | `NOT_FOUND` / `PROBLEM_NOT_FOUND` | |
| 409 | `CONFLICT` / `EMAIL_TAKEN` / `USERNAME_TAKEN` / `STALE_REVISION` | `STALE_REVISION` on draft save conflicts |
| 422 | `UNPROCESSABLE` | Semantically invalid (e.g. language not offered for this problem) |
| 429 | `RATE_LIMITED` / `EXECUTION_QUOTA_EXCEEDED` / `AI_QUOTA_EXCEEDED` | Includes `Retry-After` |
| 502 | `EXECUTION_PROVIDER_ERROR` / `AI_PROVIDER_ERROR` | Upstream failed after retries |
| 503 | `AI_SERVICE_WARMING` | AI container is cold — client shows "waking up", retries with backoff |
| 500 | `INTERNAL_ERROR` | Never leaks a stack trace or provider message |

`AI_SERVICE_WARMING` is a distinct status because it is a **normal, expected condition** on free tier (ADR-004), not an error — the client treats it as a loading state, never a failure toast.

---

## 3. Rate limit classes

Applied by a `rateLimit(class)` middleware. Counters for the two expensive classes live in Redis (survive restart); the rest are in-process token buckets (ADR-006).

| Class | Limit | Applies to |
|---|---|---|
| `auth` | 10 / 15 min / IP | login, register, forgot-password |
| `read` | 300 / min / user | problem list, detail, profile |
| `write` | 60 / min / user | drafts, bookmarks, notes, settings |
| `execution` | 20 / hour / user, 5 / min burst | `POST /v1/executions` |
| `ai-chat` | 40 / hour / user | `POST /v1/ai/chat` |
| `ai-inline` | token bucket, 30 / min | ghost text, hover explain |
| `admin` | 120 / min / user | admin surface |

---

## 4. Endpoint catalogue

### 4.1 Auth — `/v1/auth`

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/register` | Email signup → sends verification | — |
| POST | `/login` | Credentials → access token + refresh cookie | — |
| POST | `/refresh` | Rotate refresh, mint access. Reuse ⇒ family revoke | cookie |
| POST | `/logout` | Revoke current token | ✔ |
| POST | `/logout-all` | Revoke every family for the user | ✔ |
| GET | `/me` | Current user + settings + stats | ✔ |
| POST | `/verify-email` | Consume verification token | — |
| POST | `/resend-verification` | | ✔ |
| POST | `/forgot-password` | Always 202, never reveals account existence | — |
| POST | `/reset-password` | Consume reset token, revoke all sessions | — |
| POST | `/change-password` | Requires current password | ✔ |
| GET | `/oauth/:provider` | Begin OAuth (state + PKCE) | — |
| GET | `/oauth/:provider/callback` | Exchange, link or create, issue tokens | — |
| GET | `/sessions` | Active devices | ✔ |
| DELETE | `/sessions/:id` | Revoke one device | ✔ |

### 4.2 Problems — `/v1/problems`

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Filterable list (see query contract below) |
| GET | `/:slug` | Detail: statement, examples, constraints, topics, companies, sample tests, user status |
| GET | `/:slug/starter-code?language=` | Stub for a language |
| GET | `/:slug/hints` | Hint **metadata** only — levels, unlock state, never content |
| POST | `/:slug/hints/:level/unlock` | Unlock a level; records `HintUnlock`; returns content |
| GET | `/:slug/editorial` | 403 `EDITORIAL_LOCKED` if unsolved and locking enabled |
| GET | `/:slug/submissions` | Current user's submissions for this problem (cursor) |
| GET | `/:slug/solutions` | Community solutions (post-MVP; contract reserved) |
| GET | `/:slug/stats` | Acceptance rate, difficulty distribution, runtime percentiles |
| GET | `/daily` | Today's featured problem |
| GET | `/recommended` | From `TopicMastery` — weak topics first, spaced-repetition ordered |
| GET | `/search?q=` | Trigram type-ahead |
| GET | `/meta/topics` \| `/meta/companies` | Filter facets (heavily cached) |

**List query contract** (`GET /v1/problems`):

```ts
{
  page?: number; pageSize?: number;              // ≤ 100
  difficulty?: ('EASY'|'MEDIUM'|'HARD')[];
  topics?: string[];        // topic slugs, AND semantics
  companies?: string[];     // company slugs, OR semantics
  status?: 'SOLVED' | 'ATTEMPTED' | 'TODO';      // requires auth
  search?: string;
  sort?: 'default'|'difficulty'|'acceptance'|'frequency'|'newest';
  order?: 'asc'|'desc';
}
```

`status` is a per-user filter computed by a lateral join against `Submission`, so an anonymous request never pays for it.

### 4.3 Execution — `/v1/executions`

| Method | Path | Purpose |
|---|---|---|
| POST | `/` | Run or Submit. Returns **202** + `executionId`; progress streams over the socket |
| GET | `/:id` | Poll fallback when the socket is unavailable |
| DELETE | `/:id` | Cancel a queued execution (frees quota) |
| GET | `/quota` | Remaining executions + reset time — the UI shows this *before* the user hits the wall |
| GET | `/languages` | Enabled languages + versions + limits |

```jsonc
// POST /v1/executions
{
  "problemId": "clx…",
  "sessionId": "clx…",          // optional; links execution to the mentor session
  "language": "PYTHON",
  "code": "...",                 // ≤ 64 KB, enforced before any provider call
  "mode": "SUBMIT",              // RUN → sample tests only; SUBMIT → all tests
  "stdin": null                  // RUN with custom input
}
// → 202
{ "executionId": "clx…", "status": "QUEUED", "totalTests": 24, "estimatedMs": 3500 }
```

**Hidden-test guarantee:** for `SUBMIT`, the response and every socket event include per-test verdicts and timings but **never** the input, expected output, or stdout of a hidden test. The redaction happens in the serializer, not the controller, so no future endpoint can accidentally bypass it.

### 4.4 Submissions — `/v1/submissions`

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Current user's submissions (cursor; filter by verdict, language, problem) |
| GET | `/:id` | Full detail incl. per-test results (redacted) |
| GET | `/:id/analysis` | Post-submit complexity + review from the AI service (cached per submission) |

### 4.5 Workspace — `/v1/workspace`

| Method | Path | Purpose |
|---|---|---|
| POST | `/sessions` | Open a session. **Side effect: fires the AI-service warm ping** (ADR-004) |
| PATCH | `/sessions/:id` | Change language or assist mode mid-session |
| POST | `/sessions/:id/end` | Close; flushes `SessionMetrics` |
| GET | `/drafts?problemId=&language=` | Load persisted draft |
| PUT | `/drafts` | Save draft; `409 STALE_REVISION` if `revision` is behind |

### 4.6 AI — `/v1/ai`

The API is a **broker**, not a passthrough. It assembles the Context Envelope from DB + live session state, enforces quota, calls the AI service, persists the turn, and updates the learner model. The client never constructs AI context.

| Method | Path | Purpose |
|---|---|---|
| GET | `/conversations/:problemId` | The permanent thread for this problem (cursor over messages) |
| POST | `/chat` | Ask the mentor. **SSE stream** when `Accept: text/event-stream`; socket otherwise |
| POST | `/analyze` | On-demand Stage-1 analysis (the 2 s tick normally arrives over the socket) |
| POST | `/complete` | Ghost text (FIM). High Assist only. Cancellable, bucketed |
| POST | `/explain` | Explain a selection or line — the hover/CodeLens backend |
| POST | `/review` | Explicit code review pass |
| POST | `/hint` | Next hint on the ladder; AI-generated, guarded, falls back to authored hints |
| POST | `/messages/:id/feedback` | 👍/👎 → `AiFeedback` |
| GET | `/quota` | Remaining AI budget + reset |

```jsonc
// POST /v1/ai/chat  (SSE)
event: start   data: {"messageId":"clx…","agent":"DEBUG"}
event: token   data: {"t":"Your loop "}
event: token   data: {"t":"never terminates because…"}
event: block   data: {"type":"code","language":"python","content":"while lo < hi:"}
event: done    data: {"messageId":"clx…","tokens":412,"latencyMs":1840,"cacheHit":false}
event: error   data: {"code":"AI_PROVIDER_ERROR","fallbackUsed":true}
```

Emitting a terminal `error` event with `fallbackUsed` — rather than dropping the stream — is what lets the client show the authored hint seamlessly when every model is rate-limited.

### 4.7 Progress — `/v1/progress`

| Method | Path | Purpose |
|---|---|---|
| GET | `/overview` | Solved counts by difficulty, acceptance, rank, streak |
| GET | `/heatmap?year=` | 365 `DailyActivity` rows |
| GET | `/topics` | Mastery per topic + decay state |
| GET | `/weak-topics` | Lowest mastery, weighted by recency |
| GET | `/timeline?cursor=` | Activity feed |
| GET | `/insights` | Progress Agent narrative summary (cached 24 h) |

### 4.8 Achievements, leaderboard, bookmarks, contests, profile, settings

| Method | Path | |
|---|---|---|
| GET | `/v1/achievements` | Earned + in-progress badges |
| GET | `/v1/leaderboard?scope=&period=&cursor=` | From `LeaderboardSnapshot` |
| GET | `/v1/leaderboard/me` | Current user's rank + neighbours |
| GET/POST/DELETE | `/v1/bookmarks[/:problemId]` | |
| GET/POST/PATCH/DELETE | `/v1/lists[/:id]` | Custom problem lists |
| GET/PUT/DELETE | `/v1/notes/:problemId` | Per-problem notes |
| GET | `/v1/contests`, `/v1/contests/:slug` | |
| POST | `/v1/contests/:slug/register` | |
| GET | `/v1/contests/:slug/standings?cursor=` | |
| GET | `/v1/contests/:slug/problems` | 403 before `startAt` |
| GET | `/v1/users/:username` | Public profile (honours `publicProfile`) |
| GET/PATCH | `/v1/me/settings` | |
| POST | `/v1/me/avatar` | Signed Cloudinary upload |
| DELETE | `/v1/me` | Account deletion (soft delete + 30-day purge job) |
| GET | `/v1/notifications`, POST `/:id/read`, POST `/read-all` | |

### 4.9 Admin — `/v1/admin` (role `ADMIN`/`MODERATOR`, every mutation audited)

| Method | Path | |
|---|---|---|
| CRUD | `/problems`, `/problems/:id/testcases`, `/hints`, `/editorials`, `/solutions` | Full content management |
| POST | `/problems/:id/publish` \| `/unpublish` | Publish computes `statementDigest` + solution `normalizedTokens` |
| POST | `/problems/import` | Bulk JSON import with dry-run validation |
| CRUD | `/topics`, `/companies`, `/badges`, `/contests` | |
| GET/PATCH | `/users`, `/users/:id` | Role changes, suspension |
| CRUD | `/prompts` | AI prompt templates; `POST /prompts/:id/activate` version-switches live |
| GET | `/analytics/usage` \| `/analytics/ai` \| `/analytics/quota` | Token spend, model mix, cache hit rate, quota burn-down |
| GET | `/audit-log` | |

### 4.10 System

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Liveness. **Keep-alive cron target.** No DB call — must stay cheap |
| GET | `/readyz` | Readiness: DB, Redis, AI service, execution provider |
| GET | `/v1/status` | Public degradation banner state (which subsystems are limited) |

`/v1/status` is a product feature, not just ops: when Judge0's daily quota is spent, the UI says so honestly with a reset time rather than failing submissions mysteriously.

---

## 5. Internal API — API ↔ AI service

Not public. Authenticated with an HMAC-SHA256 signature over `(timestamp, body)` using a shared secret, with a 60-second replay window. The AI service also enforces an IP/host allow-list.

| Method | Path | Purpose | Latency target |
|---|---|---|---|
| POST | `/v1/analyze` | Stage 1 only. Envelope → `SessionSignals` + trigger decision | p95 < 80 ms |
| POST | `/v1/agent/chat` | Stage 2 graph, SSE stream | p95 < 2.5 s to first token |
| POST | `/v1/complete` | FIM completion for ghost text | p95 < 600 ms |
| POST | `/v1/review` | Full review pass | p95 < 4 s |
| GET | `/healthz` \| `/readyz` | Warm target; `/readyz` confirms grammars are loaded |

Every call carries `X-Request-Id` for cross-service log correlation, and every response reports `modelUsed`, `cacheHit`, `guardRejections`, and token counts so the API can write `AiUsageDaily` without a second round trip.

---

## 6. Caching

| Resource | Layer | TTL | Invalidation |
|---|---|---|---|
| Problem list facets (topics, companies) | L1 LRU | 1 h | On admin mutation |
| Problem detail | L1 LRU + Next.js ISR | 10 min | Tag-based revalidate on publish |
| Starter code | L1 LRU | 1 h | On mutation |
| Leaderboard page | L1 LRU | 5 min | Job-driven |
| AI response (semantic) | L1 LRU, in AI service | 30 min | Keyed on problem + AST fingerprint + trigger + mode |
| User stats | none | — | Read-through; already denormalized |

Note the absence of Redis in this table. At ~10k commands/day, a Redis-backed read cache would exhaust the quota faster than it would save work (ADR-006). The two-tier upgrade path is documented in `08 §7`.

---

## 7. Security controls at the API boundary

- **Helmet** with a strict CSP; `frame-ancestors 'none'`.
- **CORS** allow-list from env; credentials enabled only for the web origin.
- **Body limits:** 64 KB for code payloads, 1 MB globally; multipart only on the avatar route.
- **Language allow-list** validated against the problem's configured languages, not a global list.
- **Authorization is resource-scoped:** `authorize('submission:read', ownerOf(params.id))` — never a bare role check on a resource route.
- **No provider errors reach clients.** Judge0 and LLM errors are mapped to our taxonomy; the raw message goes to the log with the `requestId` only.
- **Audit log** on every admin mutation, capturing before/after and actor.
- **Prompt-injection defence** is applied in the AI service (`07 §6`), but the API contributes by never letting client-supplied text into a system-prompt position — the envelope has fixed, typed fields and no free-form "instructions" slot.
