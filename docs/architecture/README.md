# AI DSA Mentor — Architecture (Phase 1)

An AI-first DSA learning platform where the compiler is a mentor, not a grader.

These eight documents are the complete Phase 1 design. Read them in order; each assumes the previous.

| # | Document | What it answers |
|---|---|---|
| 01 | [System Design](01-system-design.md) | What are we building, under what constraints, and why is it shaped this way? |
| 02 | [Folder Structure](02-folder-structure.md) | Where does every piece of code live, and why there? |
| 03 | [Architecture Diagrams](03-architecture-diagrams.md) | Context, containers, pipelines, sequences, topology, CI/CD |
| 04 | [Database Design](04-database-design.md) | Every table, index, retention rule — plus the canonical [schema.prisma](../../packages/db/prisma/schema.prisma) |
| 05 | [API Design](05-api-design.md) | Every endpoint, error code, rate-limit class, caching rule |
| 06 | [Socket Design](06-socket-design.md) | Namespaces, rooms, events, code-sync protocol, recovery |
| 07 | [AI Architecture](07-ai-architecture.md) | Signal engine, triggers, LangGraph agents, Response Guard, model routing |
| 08 | [Deployment Architecture](08-deployment-architecture.md) | Placement, warming, envs, CI/CD, monitoring, cost |

---

## The four ideas everything else follows from

**1. Deterministic analysis is unlimited; inference is rationed.**
Tree-sitter parsing, complexity estimation, algorithm fingerprinting, and behavioural signals run every 2 seconds at zero cost. An LLM is invoked only when a declarative trigger policy fires — roughly 5% of ticks. This is a 20–70× reduction in LLM calls with no loss of user-visible capability, and it is the reason the platform runs on free tiers. → `01 §5`

**2. Withholding the answer is enforced, not requested.**
The Response Guard validates every agent output against a line budget, hint-level fidelity, and token-similarity to the stored reference solution — which never enters a prompt. A rejected response re-routes through the Planner. A red-team suite gates every PR. → `07 §5`

**3. The mentor's memory is the product.**
Three horizons — working (this turn), conversational (this problem, rolling-summarized), and learner (permanent mastery, misconceptions, hint dependency). By problem #40 the mentor already knows how this person thinks. → `07 §8`

**4. Free tier is a design constraint, not a deployment note.**
The 750 instance-hour budget produced on-demand AI warming. The 0.5 GB storage ceiling produced session-level metric aggregation instead of an edit-event log. The 10k Redis commands/day made Redis a durability layer rather than a cache. Every one of these is a documented ADR with a paid-tier upgrade path that requires no rewrite. → `01 §2`, `01 §10`, `08 §7`

---

## Status

**Phase 1 (design) — complete.** Awaiting confirmation to begin Phase 2.

Proposed Phase 2 order, chosen so each module is independently runnable and testable:

1. Monorepo scaffold, `packages/contracts`, `packages/config`, CI skeleton
2. `packages/db` — migrations + seed (topics, companies, badges, curated problems)
3. `apps/api` — auth module end to end (register → verify → login → refresh → OAuth)
4. `packages/ui` + `apps/web` — design system, app shell, landing, auth pages
5. Problem list + problem detail (the first user-visible slice)
6. Execution module — Judge0 adapter, run/submit, socket progress
7. `apps/ai` Stage 1 — Tree-sitter, signals, complexity, triggers *(no LLM yet — fully testable)*
8. `apps/ai` Stage 2 — LangGraph, agents, Response Guard, model router
9. Coding workspace — Monaco, ghost text, decorations, mentor panel
10. Progress, achievements, leaderboard, contests, admin
