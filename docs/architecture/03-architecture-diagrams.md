# 03 — Architecture Diagrams

**Phase 1 deliverable 3 of 8**
All diagrams are Mermaid — they render in GitHub, VS Code, and published artifacts.

---

## 1. System context (C4 Level 1)

```mermaid
graph TB
    subgraph People
        LEARNER["Learner<br/>solves problems, gets mentored"]
        ADMIN["Admin / Content Author<br/>curates problems, prompts"]
    end

    SYS["<b>AI DSA Mentor</b><br/>AI-first DSA learning platform"]

    subgraph External Systems
        OAUTH["Google / GitHub OAuth"]
        JUDGE["Judge0 CE<br/>sandboxed execution"]
        LLM["LLM Providers<br/>OpenRouter · Groq · Together"]
        MEDIA["Cloudinary<br/>avatars, figures"]
        MAIL["Email provider<br/>verification, resets"]
    end

    LEARNER --> SYS
    ADMIN --> SYS
    SYS --> OAUTH
    SYS --> JUDGE
    SYS --> LLM
    SYS --> MEDIA
    SYS --> MAIL

    classDef sys fill:#4f46e5,stroke:#312e81,color:#fff
    classDef ext fill:#1f2937,stroke:#374151,color:#e5e7eb
    class SYS sys
    class OAUTH,JUDGE,LLM,MEDIA,MAIL ext
```

---

## 2. Container view (C4 Level 2)

```mermaid
graph TB
    subgraph Client["Browser"]
        WEB["Next.js 15 / React 19<br/>Monaco · Zustand · React Query"]
    end

    subgraph Vercel
        EDGE["Edge / CDN<br/>SSR · RSC · ISR"]
    end

    subgraph Render["Render Free — always warm"]
        API["Express API + Socket.IO<br/>TypeScript · Prisma"]
    end

    subgraph HF["HF Spaces / Render — warmed on demand"]
        AI["FastAPI AI Service<br/>LangGraph · Tree-sitter"]
    end

    subgraph Data
        PG[("Neon PostgreSQL<br/>system of record")]
        RD[("Upstash Redis<br/>tokens · locks · counters")]
    end

    subgraph Ext["External"]
        J0["Judge0 CE"]
        OR["OpenRouter / Groq"]
    end

    WEB -->|HTTPS| EDGE
    EDGE -->|REST /v1| API
    WEB <-->|WebSocket| API
    API -->|Prisma| PG
    API --> RD
    API -->|HTTP + SSE<br/>HMAC signed| AI
    API -->|REST| J0
    AI -->|checkpointer only<br/>scoped role| PG
    AI -->|inference| OR

    classDef app fill:#4f46e5,stroke:#312e81,color:#fff
    classDef data fill:#065f46,stroke:#064e3b,color:#fff
    classDef ext fill:#1f2937,stroke:#374151,color:#e5e7eb
    class WEB,API,AI,EDGE app
    class PG,RD data
    class J0,OR ext
```

**Read the arrows carefully — they encode the security model.** The browser never reaches the AI service, Judge0, or the database. The AI service never reaches application data. Only the API sits on more than one trust boundary, which is exactly where authorization belongs.

---

## 3. The two-stage AI pipeline (the core mechanism)

```mermaid
flowchart TD
    A["User types in Monaco"] --> B{"Idle 2s?"}
    B -->|no| A
    B -->|yes| C["Compute semantic delta<br/>+ cursor + revision"]
    C --> D["socket: workspace:code:sync"]
    D --> E["API: authz · rate limit ·<br/>attach session context"]
    E --> F["POST /v1/analyze"]

    subgraph S1["STAGE 1 — deterministic · ~5-20ms · $0"]
        F --> G["Tree-sitter incremental parse"]
        G --> H["Structure · control flow ·<br/>data structures · AST diff"]
        H --> I["Static rules<br/>unused · dead code · off-by-one"]
        I --> J["Complexity estimator"]
        J --> K["Algorithm fingerprint"]
        K --> L["Behaviour signals<br/>idle · thrash · velocity"]
        L --> M["SessionSignals"]
    end

    M --> N{"Trigger Policy<br/>+ cooldowns"}
    N -->|"~95% — stay silent"| O["Return signals only"]
    O --> P["Monaco decorations<br/>complexity chip · squiggles"]

    N -->|"~5% — intervene"| Q["Semantic cache lookup"]
    Q -->|hit| Y
    Q -->|miss| S2

    subgraph S2["STAGE 2 — LangGraph · 400-2500ms · 1 LLM call"]
        R["Guard → Context → Planner"] --> S["Specialist agent"]
        S --> T["Response Guard<br/>schema · leak · line budget"]
        T -->|reject| S
        T -->|pass| U["Formatter"]
    end

    U --> Y["Emit ai:message / ai:suggestion"]
    Y --> Z["Mentor panel + inline UI"]

    classDef s1 fill:#065f46,stroke:#064e3b,color:#fff
    classDef s2 fill:#7c2d12,stroke:#431407,color:#fff
    class G,H,I,J,K,L,M s1
    class R,S,T,U s2
```

---

## 4. LangGraph agent graph

```mermaid
stateDiagram-v2
    [*] --> Guard
    Guard --> Reject: injection / abuse detected
    Guard --> ContextBuilder: clean
    ContextBuilder --> Planner

    Planner --> Tutor: concept gap
    Planner --> Hint: stuck / asked for hint
    Planner --> Debug: compile or runtime error
    Planner --> Complexity: inefficient approach
    Planner --> CodeReview: working but improvable
    Planner --> Progress: session boundary

    Tutor --> Validator
    Hint --> Validator
    Debug --> Validator
    Complexity --> Validator
    CodeReview --> Validator
    Progress --> MemoryWrite

    Validator --> Retry: schema fail / leak / over budget
    Retry --> Planner: max 2 attempts
    Retry --> Fallback: attempts exhausted
    Validator --> Formatter: pass
    Fallback --> Formatter: authored DB hint

    Formatter --> MemoryWrite
    MemoryWrite --> [*]
    Reject --> [*]
```

**Why `Validator → Retry → Planner` and not `Validator → Agent`:** a rejected response often means the *wrong specialist* was chosen (e.g. Hint Agent asked to explain a segfault). Routing the retry back through the Planner with the rejection reason attached lets the system self-correct its routing, not just its wording.

---

## 5. Execution flow (Run / Submit)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant W as Web
    participant A as API
    participant J as Judge0
    participant D as Postgres
    participant AI as AI Service

    U->>W: Click "Submit"
    W->>A: POST /v1/executions {code, lang, SUBMIT}
    A->>A: authz · token bucket · size & language checks
    A->>D: load visible + hidden test cases
    A->>J: submit batch (base64, cpu/mem limits)
    A-->>W: 202 {executionId} — returns immediately
    W->>W: subscribe to execution room

    loop until terminal
        A->>J: poll batch status
        J-->>A: per-token results
        A-->>W: socket execution:update {passed, total, currentTest}
    end

    A->>A: normalize verdicts · redact hidden inputs
    A->>D: persist Submission + per-test results
    A-->>W: socket execution:complete {verdict, runtime, memory}

    alt verdict != ACCEPTED
        A-)AI: async trigger RUNTIME_FAILURE
        AI-->>A: Debug Agent explanation
        A-->>W: socket ai:message
    else ACCEPTED
        A->>D: update mastery · streak · badges
        A-->>W: socket progress:update
    end
```

Note step 5: the API returns `202` immediately and streams progress over the socket. On free tier this matters — a synchronous request that waits for Judge0 would sit open long enough to be killed by an idle proxy timeout.

---

## 6. Authentication flow

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant W as Next.js
    participant A as API
    participant R as Redis
    participant D as Postgres

    B->>W: submit credentials / OAuth callback
    W->>A: POST /v1/auth/login
    A->>D: verify (argon2id) or upsert OAuth account
    A->>A: mint access JWT (15m) + refresh token (30d, rotating)
    A->>D: store refresh token hash + family id + device
    A-->>W: Set-Cookie refresh (httpOnly·Secure·SameSite=Lax·/v1/auth)
    A-->>W: body { accessToken, user }
    W-->>B: access token held in memory only (never localStorage)

    Note over B,A: ── 15 minutes later ──
    B->>A: POST /v1/auth/refresh (cookie only)
    A->>D: look up token hash
    alt token already used → reuse detection
        A->>D: revoke entire token family
        A->>R: add family to denylist
        A-->>B: 401 — force re-login
    else valid
        A->>D: rotate (invalidate old, issue new)
        A-->>B: new access token + new refresh cookie
    end
```

Refresh-token **reuse detection with family revocation** is the control that turns a stolen refresh token from a persistent compromise into a single-use anomaly that logs the attacker *and the victim* out.

---

## 7. Real-time channel topology

```mermaid
graph LR
    subgraph Namespaces
        WS["/workspace"]
        CT["/contest"]
        NT["/notify"]
    end

    subgraph "Rooms in /workspace"
        R1["session:{sessionId}<br/>one user, one problem"]
        R2["exec:{executionId}<br/>execution progress"]
    end

    subgraph "Rooms in /contest"
        R3["contest:{id}<br/>standings, announcements"]
    end

    subgraph "Rooms in /notify"
        R4["user:{userId}<br/>all devices of one user"]
    end

    WS --> R1 --> R2
    CT --> R3
    NT --> R4

    R1 -.->|"code:sync ▸ ai:signals<br/>ai:message ▸ ai:suggestion"| C1["Workspace tab"]
    R2 -.->|"execution:update ▸ complete"| C1
    R3 -.->|"standings:update"| C2["Contest tab"]
    R4 -.->|"badge · streak · system"| C3["Any tab"]
```

Rooms are scoped to a **session**, not a user, so the same person solving two problems in two tabs gets two independent mentor contexts — which is correct, since the mentor's state is per-problem.

---

## 8. Data flow & ownership

```mermaid
graph TB
    subgraph "Write path — API is the only writer"
        W1["Auth events"] --> PG
        W2["Submissions + test results"] --> PG
        W3["AI messages + hint unlocks"] --> PG
        W4["Aggregated session metrics"] --> PG
        W5["Mastery / streak rollups"] --> PG
    end

    PG[("Neon Postgres")]

    subgraph "Never persisted"
        N1["Raw keystrokes"]
        N2["2s analysis ticks"]
        N3["Ghost-text candidates"]
    end
    N1 -.->|in-memory only,<br/>aggregated then dropped| X["✕"]
    N2 -.-> X
    N3 -.-> X

    PG --> C1["L1 in-process LRU<br/>problems · prompts · AI cache"]
    RD[("Upstash Redis")] --> C2["Durable only:<br/>token denylist · job locks ·<br/>expensive-endpoint counters"]

    classDef drop fill:#7f1d1d,stroke:#450a0a,color:#fff
    class X drop
```

Neon Free's ~0.5 GB ceiling is the reason the "never persisted" box exists (ADR-010). A naive edit-event log at 2-second granularity would write roughly 1,800 rows per user-hour and exhaust free storage within days.

---

## 9. Deployment topology

```mermaid
graph TB
    subgraph Internet
        USER["Users"]
    end

    subgraph "Vercel (Hobby)"
        V["Next.js — global edge<br/>auto-deploy on main"]
    end

    subgraph "Render (Free) — 750 h/mo budget"
        RA["api-service<br/>ALWAYS WARM ← keep-alive cron"]
    end

    subgraph "HF Spaces (Free Docker)"
        HA["ai-service<br/>WARMED ON DEMAND"]
    end

    subgraph Managed Data
        NE[("Neon Postgres<br/>autosuspend")]
        UP[("Upstash Redis<br/>10k cmd/day")]
    end

    subgraph "Third party"
        J0["Judge0 CE"]
        ORT["OpenRouter / Groq"]
        CL["Cloudinary"]
    end

    subgraph Ops
        CRON["cron-job.org / GH Actions<br/>▸ /healthz every 10 min<br/>▸ nightly quota report"]
    end

    USER --> V
    V --> RA
    USER -.->|WebSocket| RA
    RA --> NE
    RA --> UP
    RA --> HA
    RA --> J0
    RA --> CL
    HA --> ORT
    CRON --> RA
    V -.->|"pre-warm on<br/>workspace open"| HA

    classDef warm fill:#065f46,stroke:#064e3b,color:#fff
    classDef cold fill:#78350f,stroke:#451a03,color:#fff
    class RA warm
    class HA cold
```

The dotted `V → HA` edge is ADR-004 in one line: **the user opening a problem is what wakes the AI service**, so cold start hides behind reading time instead of behind a spinner.

---

## 10. CI/CD pipeline

```mermaid
flowchart LR
    PR["Pull Request"] --> L["Lint + typecheck<br/>eslint · tsc · ruff · mypy"]
    L --> C["contracts:check<br/>Zod ↔ Pydantic JSON-Schema diff"]
    C --> T["Unit tests<br/>vitest · pytest"]
    T --> I["Integration<br/>testcontainers: pg + redis"]
    I --> G["Guard red-team suite<br/>injection · solution leak"]
    G --> B["Turbo build (cached)"]
    B --> PV["Vercel preview deploy"]
    PV --> RV["Review"]

    RV --> M["merge → main"]
    M --> MG["prisma migrate deploy"]
    MG --> DW["Vercel production"]
    M --> DA["Render deploy hook (api)"]
    M --> DI["HF Space rebuild (ai)"]
    DA --> SM["Smoke: /healthz + /readyz"]
    DI --> SM
    SM -->|fail| RB["Auto-rollback to last good"]
```

`contracts:check` and the Guard red-team suite are non-negotiable gates: the first prevents silent API drift across three languages, the second prevents a prompt edit from quietly turning the mentor into an answer key.
