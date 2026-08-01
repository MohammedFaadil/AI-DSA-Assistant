# 02 — Folder Structure

**Phase 1 deliverable 2 of 8**

Monorepo: **pnpm workspaces + Turborepo**. Chosen so the Zod contract package is a compile-time dependency of both the Next.js app and the Express API — a breaking API change fails `pnpm build` before it fails in production (ADR-009).

Every directory below has a stated purpose. Nothing is decorative.

---

## Top level

```
ai-dsa-mentor/
├── apps/
│   ├── web/                     # Next.js 15 — user-facing application
│   ├── api/                     # Express + Socket.IO — identity, data, orchestration
│   └── ai/                      # FastAPI + LangGraph — analysis & agents (Python)
├── packages/
│   ├── contracts/               # Zod schemas + inferred TS types — the single API truth
│   ├── db/                      # Prisma schema, migrations, seed, generated client
│   ├── ui/                      # ShadCN-based design system, shared React components
│   ├── config/                  # Shared eslint/tsconfig/tailwind/prettier presets
│   └── logger/                  # Pino instance + redaction rules, shared by node apps
├── infra/
│   ├── docker/                  # Dockerfiles + local compose (postgres, redis, judge0)
│   ├── github/                  # Reusable CI workflow fragments
│   └── scripts/                 # Ops scripts: keep-warm, seed, backup, quota report
├── docs/
│   ├── architecture/            # These eight documents
│   ├── adr/                     # One file per accepted decision
│   ├── prompts/                 # Versioned agent prompt sources (reviewed like code)
│   └── runbooks/                # On-call: quota exhausted, judge down, model down
├── .github/workflows/           # CI/CD pipelines
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## `apps/web` — Next.js 15 (App Router, React 19)

```
apps/web/
├── src/
│   ├── app/
│   │   ├── (marketing)/                  # Public, statically rendered, no auth cost
│   │   │   ├── page.tsx                  # Landing
│   │   │   ├── pricing/  about/  legal/
│   │   ├── (auth)/
│   │   │   ├── login/  register/  forgot-password/  reset-password/
│   │   │   └── callback/[provider]/      # OAuth return handler
│   │   ├── (app)/                        # Authenticated shell: sidebar + topbar
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   ├── problems/
│   │   │   │   ├── page.tsx              # Filterable problem list (server component)
│   │   │   │   └── [slug]/
│   │   │   │       ├── page.tsx          # Problem detail / description view
│   │   │   │       └── solve/page.tsx    # ← The Coding Workspace
│   │   │   ├── progress/                 # Heatmap, mastery, weak topics
│   │   │   ├── achievements/
│   │   │   ├── leaderboard/
│   │   │   ├── bookmarks/
│   │   │   ├── contests/
│   │   │   │   ├── page.tsx  [slug]/page.tsx  [slug]/standings/page.tsx
│   │   │   ├── profile/[username]/
│   │   │   └── settings/                 # account, editor, ai, appearance, danger
│   │   ├── (admin)/admin/                # Role-gated at layout level
│   │   │   ├── problems/  users/  topics/  companies/
│   │   │   ├── testcases/  editorials/  prompts/  analytics/
│   │   ├── api/                          # BFF only — never business logic
│   │   │   ├── auth/session/route.ts     # Cookie ↔ memory-token bridge
│   │   │   └── revalidate/route.ts       # ISR invalidation webhook
│   │   ├── layout.tsx  error.tsx  not-found.tsx  global-error.tsx
│   ├── features/                         # Vertical slices — the primary organizing unit
│   │   ├── auth/                         # components/ hooks/ api/ store.ts
│   │   ├── problems/
│   │   ├── workspace/                    # ← largest feature; see breakdown below
│   │   ├── ai-mentor/
│   │   ├── progress/
│   │   ├── contests/
│   │   ├── leaderboard/
│   │   └── admin/
│   ├── components/
│   │   ├── layout/                       # AppShell, Sidebar, Topbar, CommandPalette
│   │   ├── common/                       # EmptyState, ErrorBoundary, Skeletons
│   │   └── motion/                       # Framer Motion primitives & variants
│   ├── lib/
│   │   ├── api-client.ts                 # Typed fetch wrapper (uses @contracts)
│   │   ├── socket.ts                     # Socket.IO singleton + typed emitter
│   │   ├── query-client.ts               # React Query defaults, retry policy
│   │   ├── monaco/                       # Theme, language configs, worker setup
│   │   └── utils/                        # cn(), formatters, complexity pretty-print
│   ├── stores/                           # Zustand — client-only ephemeral state
│   │   ├── editor.store.ts               # buffer, revision, dirty flags
│   │   ├── session.store.ts              # timing/behaviour signals (client half)
│   │   ├── ai.store.ts                   # streaming message state, assist mode
│   │   └── ui.store.ts                   # panel sizes, theme, layout prefs
│   ├── hooks/                            # Cross-feature hooks
│   ├── styles/globals.css
│   └── types/
├── public/
├── next.config.ts   tailwind.config.ts   components.json   middleware.ts
```

### `features/workspace` — expanded

This is the product's centre of gravity, so it gets explicit structure.

```
features/workspace/
├── components/
│   ├── WorkspaceLayout.tsx           # 3-pane resizable shell, persists sizes
│   ├── panels/
│   │   ├── ProblemPanel/             # Description, Examples, Constraints,
│   │   │                             #   Hints, Editorial, Submissions, Solutions
│   │   ├── EditorPanel/
│   │   │   ├── CodeEditor.tsx        # Monaco mount + model lifecycle
│   │   │   ├── EditorToolbar.tsx     # language, theme, reset, format, fullscreen
│   │   │   └── ConsolePanel.tsx      # stdin, stdout, stderr, test results, diff
│   │   └── MentorPanel/
│   │       ├── ChatThread.tsx        # Streaming markdown + code blocks
│   │       ├── AssistModeSwitch.tsx  # Easy / Moderate / High
│   │       ├── SignalStrip.tsx       # live complexity, warnings, progress
│   │       └── HintLadder.tsx        # Progressive hint unlock UI
├── monaco/                           # Editor↔AI integration layer
│   ├── ghost-text.provider.ts        # InlineCompletionsProvider (High Assist)
│   ├── diagnostics.controller.ts     # Squiggles from Stage-1 signals
│   ├── hover.provider.ts             # Explain-this-line on hover
│   ├── codelens.provider.ts          # "Explain" / "Optimize" lenses
│   └── decorations.ts                # Complexity gutter, hot-line highlight
├── telemetry/
│   ├── edit-tracker.ts               # Semantic deltas, not keystrokes
│   ├── idle-detector.ts              # Drives IDLE_STUCK trigger
│   └── metrics-aggregator.ts         # Rolls up in memory; flushes on interval
├── hooks/
│   ├── useWorkspaceSession.ts        # Session lifecycle + AI service pre-warm
│   ├── useCodeSync.ts                # Debounced socket sync, revision numbers
│   ├── useExecution.ts               # Run/Submit + streamed per-test updates
│   └── useAiStream.ts                # Token streaming into ai.store
└── api/                              # React Query hooks bound to @contracts
```

**Why `features/` and not `components/` + `pages/`:** every change request in this product is vertical ("improve the hint ladder", "add contest mode"). Vertical slices mean one folder per change, minimal cross-tree edits, and a clear deletion boundary.

---

## `apps/api` — Express + TypeScript (clean architecture, 4 layers)

Dependencies point **inward only**: `routes → controllers → services → repositories`. A service never imports Express; a repository never imports a service. This is enforced by an `eslint-plugin-boundaries` rule, not by convention.

```
apps/api/
├── src/
│   ├── server.ts                     # HTTP + Socket.IO bootstrap, graceful shutdown
│   ├── app.ts                        # Express assembly: middleware order, routers
│   ├── config/
│   │   ├── env.ts                    # Zod-validated env — fails fast at boot
│   │   └── constants.ts
│   ├── modules/                      # One folder per bounded context
│   │   ├── auth/                     # *.routes | *.controller | *.service |
│   │   │                             #   *.repository | *.schema | *.types | *.test
│   │   ├── users/
│   │   ├── problems/
│   │   ├── testcases/
│   │   ├── execution/                # Run/Submit orchestration
│   │   ├── submissions/
│   │   ├── ai/                       # Proxy + context assembly for the AI service
│   │   ├── hints/
│   │   ├── progress/
│   │   ├── achievements/
│   │   ├── leaderboard/
│   │   ├── contests/
│   │   ├── bookmarks/
│   │   └── admin/
│   ├── providers/                    # Anti-corruption layer over externals
│   │   ├── execution/
│   │   │   ├── ExecutionProvider.ts  # interface
│   │   │   ├── judge0.adapter.ts
│   │   │   ├── piston.adapter.ts     # Fallback (ADR-007)
│   │   │   └── verdict.mapper.ts     # Normalizes provider verdicts → our enum
│   │   ├── ai/aiService.client.ts    # Typed HTTP/SSE client for apps/ai
│   │   ├── cache/                    # LRU (L1) + Redis (L2) two-tier interface
│   │   ├── oauth/                    # google.ts, github.ts
│   │   └── mail/
│   ├── realtime/
│   │   ├── io.ts                     # Socket.IO server, adapter selection
│   │   ├── middleware/auth.socket.ts
│   │   ├── namespaces/               # workspace.ns.ts, contest.ns.ts, notify.ns.ts
│   │   ├── handlers/                 # code-sync, execution, ai-chat, presence
│   │   └── session-registry.ts       # In-memory live session state
│   ├── middleware/
│   │   ├── authenticate.ts  authorize.ts  validate.ts  rateLimit.ts
│   │   ├── errorHandler.ts  requestContext.ts  notFound.ts
│   ├── jobs/                         # node-cron; single-instance-safe via Redis lock
│   │   ├── daily-problem.job.ts  streak-rollup.job.ts
│   │   ├── leaderboard-refresh.job.ts  contest-finalize.job.ts
│   │   └── quota-report.job.ts
│   ├── lib/
│   │   ├── prisma.ts  redis.ts  jwt.ts  password.ts
│   │   ├── errors/AppError.ts        # Typed error hierarchy → HTTP mapping
│   │   └── result.ts                 # Result<T,E> for expected failures
│   └── types/
├── prisma/                           # → re-exports packages/db
└── tests/                            # integration + e2e (supertest, testcontainers)
```

---

## `apps/ai` — FastAPI + LangGraph (Python 3.12)

```
apps/ai/
├── app/
│   ├── main.py                       # FastAPI app, lifespan (preload grammars)
│   ├── core/
│   │   ├── config.py                 # Pydantic Settings
│   │   ├── logging.py                # structlog → JSON, correlation IDs
│   │   ├── security.py               # Service-to-service HMAC auth
│   │   └── exceptions.py
│   ├── api/v1/
│   │   ├── analyze.py                # POST /v1/analyze     (Stage 1, no LLM)
│   │   ├── agent.py                  # POST /v1/agent/chat  (SSE streaming)
│   │   ├── complete.py               # POST /v1/complete    (ghost text, FIM)
│   │   ├── review.py                 # POST /v1/review
│   │   └── health.py                 # /healthz /readyz — warming target
│   ├── analysis/                     # ═══ STAGE 1 — deterministic, zero LLM ═══
│   │   ├── parser/
│   │   │   ├── registry.py           # Language → grammar, lazily loaded, cached
│   │   │   ├── tree_manager.py       # Incremental reparse w/ edit ranges
│   │   │   └── queries/              # .scm tree-sitter queries per language
│   │   ├── extractors/
│   │   │   ├── structure.py          # Functions, scopes, cursor context
│   │   │   ├── control_flow.py       # Loop nesting, recursion, branches
│   │   │   ├── data_structures.py    # Detected containers
│   │   │   └── diff.py               # Semantic AST diff between snapshots
│   │   ├── rules/
│   │   │   ├── unused_variables.py   missing_return.py  dead_code.py
│   │   │   ├── infinite_loop.py      null_deref.py      off_by_one.py
│   │   ├── complexity/
│   │   │   ├── estimator.py          # Loop-nest → complexity class
│   │   │   └── classes.py
│   │   ├── algorithms/
│   │   │   └── fingerprints.py       # Sliding window, two-pointer, BFS/DFS, DP…
│   │   ├── behaviour/
│   │   │   ├── stuck_detector.py  thrash_detector.py  progress_estimator.py
│   │   └── signals.py                # Assembles SessionSignals
│   ├── triggers/
│   │   ├── policy.py                 # The trigger table (01 §5.2), data-driven
│   │   └── cooldown.py
│   ├── agents/                       # ═══ STAGE 2 — LangGraph nodes ═══
│   │   ├── graph.py                  # Graph wiring, edges, checkpointer
│   │   ├── state.py                  # MentorState TypedDict
│   │   ├── nodes/
│   │   │   ├── guard.py              # Prompt-injection sanitation (entry node)
│   │   │   ├── context.py            # Envelope → working memory
│   │   │   ├── planner.py            # Routes to specialist(s)
│   │   │   ├── tutor.py  code_review.py  hint.py
│   │   │   ├── debug.py  complexity.py  progress.py
│   │   │   ├── validator.py          # Response Guard (01 §5.4)
│   │   │   ├── formatter.py          # → Monaco decorations / chat blocks
│   │   │   └── fallback.py           # Authored hints when all models fail
│   │   └── memory/
│   │       ├── working.py            # Turn-scoped
│   │       └── summarizer.py         # Rolling conversation compression
│   ├── prompts/
│   │   ├── base.py                   # Shared persona + safety preamble
│   │   ├── registry.py               # Versioned, admin-overridable at runtime
│   │   └── templates/                # one .md per agent × assist mode
│   ├── models/
│   │   ├── router.py                 # Task class → model tier → provider chain
│   │   ├── providers/                # openrouter.py groq.py together.py ollama.py
│   │   ├── fallback.py               # Retry, circuit breaker, error taxonomy
│   │   └── budget.py                 # Token accounting + daily caps
│   ├── cache/
│   │   ├── semantic.py               # AST-fingerprint keyed response cache
│   │   └── lru.py
│   └── schemas/                      # Pydantic: envelope, signals, responses
├── tests/
│   ├── fixtures/code_samples/        # Real buggy code per language
│   ├── test_analysis/  test_triggers/  test_agents/
│   └── test_guard/                   # Injection + solution-leak red-team suite
├── pyproject.toml   Dockerfile
```

**Note on `docs/prompts/` vs `app/prompts/templates/`:** prompts are versioned source, reviewed in PRs, and shipped with the image. The admin UI can *override* a template at runtime (stored in `PromptTemplate`), which the registry checks first. This gives fast iteration without redeploy, plus a durable, reviewable baseline.

---

## `packages/contracts` — the API single source of truth

```
packages/contracts/src/
├── common/          # pagination, errors, ids, enums
├── auth/  users/  problems/  execution/  submissions/
├── ai/              # envelope.schema.ts, signals.schema.ts, responses.schema.ts
├── progress/  contests/  admin/
├── socket/          # ClientToServerEvents, ServerToClientEvents (typed Socket.IO)
└── index.ts
```

One Zod schema per request/response; TS types are **inferred**, never hand-written. The API validates inbound with the same schema the web client uses to type its calls. The Python service mirrors these as Pydantic models, and a CI job (`contracts:check`) diffs the JSON Schema export of both sides to catch drift.

---

## `packages/db` — Prisma

```
packages/db/
├── prisma/
│   ├── schema.prisma        # See 04-database-design.md
│   ├── migrations/
│   └── seed/
│       ├── index.ts
│       ├── problems/        # Curated seed problems w/ tests, hints, editorials
│       ├── topics.ts  companies.ts  badges.ts  prompts.ts
├── src/
│   ├── client.ts            # Singleton, dev hot-reload safe
│   └── extensions/          # Soft delete, audit log, query timing
```

---

## `packages/ui` — design system

```
packages/ui/src/
├── primitives/      # ShadCN-generated: button, dialog, tooltip, tabs, …
├── composites/      # DataTable, CodeBlock, DifficultyBadge, ComplexityChip,
│                    #   HeatmapCalendar, StatCard, Timer, MarkdownRenderer
├── motion/          # Shared Framer Motion variants (page, panel, list, toast)
├── theme/           # Design tokens, dark/light, Monaco theme derived from tokens
└── lib/cn.ts
```

Living in a package (not `apps/web`) keeps the admin surface and any future marketing site visually identical, and forces components to be genuinely reusable — a component that reaches into app state simply won't compile here.
