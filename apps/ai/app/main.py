"""FastAPI application.

Two endpoints matter:

  POST /v1/analyze   Stage 1 — deterministic, ~5–20 ms, no LLM. This runs on
                     every 2-second tick and is what makes continuous
                     mentoring affordable.
  POST /v1/agent/chat Stage 2 — the LangGraph agent turn. Runs on roughly 5% of
                     ticks plus explicit questions.

/healthz is the warm-up target: opening a workspace pings it so the free-tier
cold start is absorbed by the learner's reading time (ADR-004).
"""

from __future__ import annotations

import json
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.agents import teach as teach_agent
from app.agents.graph import LANGGRAPH_AVAILABLE, run_turn
from app.analysis import linereview, quality
from app.analysis.parser import GRAMMAR_BY_LANGUAGE, TREE_SITTER_AVAILABLE, parse, warm_grammars
from app.analysis.signals import build_signals
from app.cache import completion_cache, semantic_cache
from app.core.config import settings
from app.core.logging import configure_logging, log, request_id_var
from app.core.security import verify_request
from app.models.providers import ProviderError
from app.models.router import TaskClass, router
from app.practice import generator as practice_generator
from app.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    CompleteRequest,
    CompleteResponse,
    ConceptEnvelope,
    ContextEnvelope,
    GeneratedProblem,
    LineReviewRequest,
    LineReviewResponse,
    PracticeRequest,
    TeachResponse,
)
from app.triggers.policy import decide

READY = {"grammars": 0}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    configure_logging(settings.ai_log_level)
    # Grammars load here, not on the first request — /readyz only returns 200
    # once parsing actually works, so the API never routes analysis to a
    # container that would fail on it.
    READY["grammars"] = warm_grammars(list(GRAMMAR_BY_LANGUAGE.keys()))
    log.info(
        "ai_service_started",
        tree_sitter=TREE_SITTER_AVAILABLE,
        grammars=READY["grammars"],
        langgraph=LANGGRAPH_AVAILABLE,
        providers=[name for name, p in router.providers.items() if p.available],
    )
    yield
    log.info("ai_service_stopping")


app = FastAPI(
    title="AI DSA Mentor — AI Service",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
)


@app.middleware("http")
async def correlate(request: Request, call_next):
    token = request_id_var.set(request.headers.get("x-request-id", "-"))
    started = time.perf_counter()
    try:
        response = await call_next(request)
    finally:
        request_id_var.reset(token)
    response.headers["x-elapsed-ms"] = f"{(time.perf_counter() - started) * 1000:.1f}"
    return response


@app.get("/healthz")
async def healthz() -> dict:
    return {"ok": True, "service": "ai"}


@app.get("/readyz")
async def readyz() -> JSONResponse:
    ready = (READY["grammars"] > 0) or not TREE_SITTER_AVAILABLE
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "ready": ready,
            "treeSitter": TREE_SITTER_AVAILABLE,
            "grammars": READY["grammars"],
            "langgraph": LANGGRAPH_AVAILABLE,
            "models": router.status(),
            "cache": {"semantic": semantic_cache.stats(), "completion": completion_cache.stats()},
        },
    )


@app.post("/v1/analyze", response_model=AnalyzeResponse)
async def analyze(request: Request) -> AnalyzeResponse:
    """Stage 1. Deterministic, no network, no inference.

    Returns signals, the trigger decision, AND the code-quality report that
    drives the live strength meter — all from one parse.
    """
    body = await verify_request(request)
    payload = AnalyzeRequest.model_validate(json.loads(body))

    signals, model, elapsed = build_signals(payload)
    report = quality.score(model, signals.findings, payload.expectedTime)
    if payload.behaviour.previousQuality is not None:
        report.trend = report.overall - payload.behaviour.previousQuality
    decision = decide(signals, payload, report)

    return AnalyzeResponse(
        requestId=payload.requestId,
        signals=signals,
        decision=decision,
        quality=report,
        elapsedMs=round(elapsed, 2),
    )


@app.post("/v1/line-review", response_model=LineReviewResponse)
async def line_review(request: Request) -> LineReviewResponse:
    """Per-line annotations. Deterministic, so it can stay on while typing."""
    body = await verify_request(request)
    payload = LineReviewRequest.model_validate(json.loads(body))

    started = time.perf_counter()
    model = parse(payload.language.value, payload.code)
    review = linereview.review(model, payload.expectedTime)

    return LineReviewResponse(
        requestId=payload.requestId,
        review=review,
        elapsedMs=round((time.perf_counter() - started) * 1000, 2),
    )


@app.post("/v1/practice/generate", response_model=GeneratedProblem)
async def practice_generate(request: Request) -> GeneratedProblem:
    """Turn a learner's request into a judgeable problem.

    Note what is NOT returned: expected outputs. The API derives them by running
    the reference solution, so generated tests are correct by construction.
    """
    body = await verify_request(request)
    payload = PracticeRequest.model_validate(json.loads(body))
    # Seeded from the request id so a retry of the same request is stable while
    # two different requests get different input sets.
    seed = abs(hash(payload.requestId)) % 1_000_000
    return await practice_generator.generate(payload, seed)


@app.post("/v1/agent/chat")
async def agent_chat(request: Request) -> JSONResponse:
    """Stage 2. The full guarded agent turn."""
    body = await verify_request(request)
    envelope = ContextEnvelope.model_validate(json.loads(body))
    turn = await run_turn(envelope)
    return JSONResponse(content=turn.model_dump(mode="json"))


@app.post("/v1/agent/teach", response_model=TeachResponse)
async def agent_teach(request: Request) -> TeachResponse:
    """AI Training — a curriculum-section-scoped teaching turn.

    Deliberately not routed through run_turn()/the Response Guard: there is no
    Problem, no solutionFingerprint and no policy to validate against here —
    see agents/teach.py and prompts.build_teaching_system_prompt for why.
    """
    body = await verify_request(request)
    envelope = ConceptEnvelope.model_validate(json.loads(body))
    return await teach_agent.run(envelope)


@app.post("/v1/complete", response_model=CompleteResponse)
async def complete(request: Request) -> CompleteResponse:
    """Ghost text via fill-in-the-middle.

    Best-effort by design: a failure returns empty text, never an error. A
    broken suggestion channel must never surface as a broken editor.
    """
    body = await verify_request(request)
    payload = CompleteRequest.model_validate(json.loads(body))

    if not settings.enable_ghost_text or not router.any_available:
        return CompleteResponse(requestId=payload.requestId, text="", model=None)

    key = completion_cache.key(
        problem_id=payload.problemTitle,
        code=payload.prefix[-600:],
        trigger="GHOST",
        assist_mode="HIGH",
        hint_level=None,
    )
    cached = completion_cache.get(key)
    if cached is not None:
        return CompleteResponse(requestId=payload.requestId, text=cached, cacheHit=True, model=None)

    system = (
        "You complete code. Output ONLY the code that belongs at the cursor — no prose, no "
        "backticks, no repetition of the surrounding code. Complete at most one statement or "
        "one line. If nothing obvious belongs there, output nothing."
    )
    user = (
        f"Language: {payload.language.value}\n"
        f"Problem: {payload.problemTitle}\n\n"
        f"<prefix>\n{payload.prefix[-3000:]}\n</prefix>\n"
        f"<suffix>\n{payload.suffix[:1000]}\n</suffix>\n\n"
        "Code at the cursor:"
    )

    try:
        completion = await router.generate(
            task=TaskClass.CODE,
            system=system,
            user=user,
            max_tokens=payload.maxTokens,
            temperature=0.15,
            stop=["\n\n", "```"],
        )
    except ProviderError:
        return CompleteResponse(requestId=payload.requestId, text="", model=None)

    text = completion.text.strip("`").rstrip()
    # Models love to restate the prefix; drop the suggestion rather than
    # inserting a duplicate line into someone's buffer.
    if text and payload.prefix.rstrip().endswith(text.strip()):
        text = ""

    completion_cache.set(key, text)
    return CompleteResponse(
        requestId=payload.requestId, text=text, cacheHit=False, model=completion.model
    )


@app.get("/v1/debug/status")
async def status() -> dict:
    """Operational snapshot. Not a public endpoint — the AI service is only
    reachable from the API."""
    return {
        "treeSitter": TREE_SITTER_AVAILABLE,
        "grammars": READY["grammars"],
        "langgraph": LANGGRAPH_AVAILABLE,
        "models": router.status(),
        "cache": {"semantic": semantic_cache.stats(), "completion": completion_cache.stats()},
    }
