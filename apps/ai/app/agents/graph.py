"""LangGraph wiring.

The nodes in `nodes.py` hold all the logic; this module is only the graph. When
LangGraph is importable we build a real StateGraph with the documented edges
(plan → generate → guard → {accept | retry | fallback} → finalize). When it is
not, the same coroutines run through an equivalent hand-rolled executor.

Keeping the logic out of the graph is what makes that fallback safe: there is
one implementation of the behaviour, two ways of scheduling it.
"""

from __future__ import annotations

import time

from app.agents import nodes
from app.agents.nodes import MentorState
from app.cache import semantic_cache
from app.core.logging import log
from app.models.router import router
from app.schemas import AgentResponse, AgentTelemetry, ContextEnvelope, MentorTurn

try:  # pragma: no cover - optional dependency
    from langgraph.graph import END, StateGraph

    LANGGRAPH_AVAILABLE = True
except Exception:  # noqa: BLE001
    StateGraph = None  # type: ignore[assignment]
    END = "__end__"  # type: ignore[assignment]
    LANGGRAPH_AVAILABLE = False


def _build_graph():  # pragma: no cover - requires langgraph
    graph = StateGraph(MentorState)

    graph.add_node("plan", nodes.plan)
    graph.add_node("generate", nodes.generate)
    graph.add_node("guard", nodes.guard)
    graph.add_node("fallback", nodes.fallback)
    graph.add_node("finalize", nodes.finalize)

    graph.set_entry_point("plan")
    graph.add_edge("plan", "generate")
    graph.add_edge("generate", "guard")
    graph.add_conditional_edges(
        "guard",
        nodes.should_retry,
        {
            "accept": "finalize",
            # A rejection returns to the PLANNER, not to the same agent: a
            # guard failure often means the wrong specialist was chosen.
            "retry": "plan",
            "fallback": "fallback",
        },
    )
    graph.add_edge("fallback", END)
    graph.add_edge("finalize", END)
    return graph.compile()


_compiled = _build_graph() if LANGGRAPH_AVAILABLE else None


async def _run_manual(state: MentorState) -> MentorState:
    """Equivalent executor for environments without LangGraph."""
    while True:
        state = await nodes.plan(state)
        state = await nodes.generate(state)
        state = await nodes.guard(state)
        decision = nodes.should_retry(state)
        if decision == "accept":
            return await nodes.finalize(state)
        if decision == "fallback":
            return await nodes.fallback(state)


async def run_turn(envelope: ContextEnvelope) -> MentorTurn:
    started = time.perf_counter()

    # Personalised answers must never cross users, so anything that leaned on
    # the learner model is excluded from the cache.
    cacheable = not (
        envelope.learner.misconceptions
        or envelope.learner.weakTopics
        or envelope.userMessage
    )
    cache_key = semantic_cache.key(
        problem_id=envelope.problem.id,
        code=envelope.code.buffer,
        trigger=envelope.trigger.value,
        assist_mode=envelope.assistMode.value,
        hint_level=envelope.policy.hintLevel,
    )

    if cacheable:
        cached = semantic_cache.get(cache_key)
        if cached is not None:
            return MentorTurn(
                requestId=envelope.requestId,
                response=AgentResponse.model_validate(cached),
                telemetry=AgentTelemetry(
                    model=None,
                    latencyMs=nodes.elapsed_ms(started),
                    cacheHit=True,
                    routeReason="semantic cache hit",
                ),
            )

    state = nodes.start_state(envelope)

    # Short-circuit: with no provider configured at all there is nothing to
    # try, so go straight to Stage-1-only mentoring instead of burning the
    # retry loop on guaranteed failures.
    if not router.any_available or router.usage.exhausted:
        state = await nodes.fallback(state)
    elif _compiled is not None:
        state = await _compiled.ainvoke(state)  # type: ignore[assignment]
    else:
        state = await _run_manual(state)

    response = state.get("final") or nodes.deterministic_response(envelope)
    telemetry = state.get("telemetry") or AgentTelemetry()
    telemetry.latencyMs = nodes.elapsed_ms(started)

    if cacheable and not telemetry.fallbackUsed:
        semantic_cache.set(cache_key, response.model_dump())

    log.info(
        "mentor_turn",
        agent=response.agent.value,
        trigger=envelope.trigger.value,
        model=telemetry.model,
        guard_rejections=telemetry.guardRejections,
        fallback=telemetry.fallbackUsed,
        latency_ms=telemetry.latencyMs,
    )

    return MentorTurn(requestId=envelope.requestId, response=response, telemetry=telemetry)
