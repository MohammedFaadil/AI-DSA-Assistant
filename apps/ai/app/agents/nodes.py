"""Agent graph nodes.

Six of the nodes below make no inference call at all — routing, guarding,
validating, formatting and the fallback are all deterministic. That ratio is
the design, not an accident: it is why a mentor turn costs one LLM call rather
than five.
"""

from __future__ import annotations

import re
import time
from typing import Any, TypedDict

from app.agents import prompts
from app.agents.validator import GuardVerdict, validate
from app.analysis.algorithms import label_for
from app.core.logging import log
from app.models.providers import ProviderError, parse_json_object
from app.models.router import TaskClass, router
from app.schemas import (
    AgentResponse,
    AgentTelemetry,
    AgentType,
    AssistMode,
    ComplexityBlock,
    ContextEnvelope,
    DiagnosticBlock,
    HintBlock,
    QuestionBlock,
    Severity,
    TextBlock,
    TriggerType,
)

MAX_ATTEMPTS = 2


class MentorState(TypedDict, total=False):
    envelope: ContextEnvelope
    route: AgentType
    route_reason: str
    hardened: bool
    draft: AgentResponse | None
    verdict: GuardVerdict | None
    attempts: int
    telemetry: AgentTelemetry
    final: AgentResponse | None


# ── Routing ──────────────────────────────────────────────────────────────

TRIGGER_ROUTES: dict[TriggerType, AgentType] = {
    TriggerType.RUNTIME_FAILURE: AgentType.DEBUG,
    TriggerType.REPEATED_COMPILE_ERROR: AgentType.DEBUG,
    TriggerType.IDLE_STUCK: AgentType.HINT,
    TriggerType.THRASHING: AgentType.TUTOR,
    TriggerType.COMPLEXITY_GAP: AgentType.COMPLEXITY,
    TriggerType.MILESTONE: AgentType.TUTOR,
    TriggerType.SESSION_SUMMARY: AgentType.PROGRESS,
}

_INTENT_RULES: list[tuple[re.Pattern[str], AgentType]] = [
    (re.compile(r"\bhint\b|\bstuck\b|\bnudge\b|where do i start", re.IGNORECASE), AgentType.HINT),
    (
        re.compile(
            r"why (is|isn'?t|does|doesn'?t).*(work|fail|wrong)|\berror\b|\bcrash|\bexception\b|"
            r"\bsegfault\b|failing test",
            re.IGNORECASE,
        ),
        AgentType.DEBUG,
    ),
    (
        re.compile(
            r"\bcomplexity\b|\bfaster\b|\boptimi[sz]e\b|time limit|\btoo slow\b|\bbig o\b|\btle\b",
            re.IGNORECASE,
        ),
        AgentType.COMPLEXITY,
    ),
    (
        re.compile(r"\breview\b|\bimprove\b|\bcleaner\b|\bbetter (style|naming)\b", re.IGNORECASE),
        AgentType.CODE_REVIEW,
    ),
    (
        re.compile(r"what (is|are)\b|\bexplain\b|\bhow does\b|\bdifference between\b", re.IGNORECASE),
        AgentType.TUTOR,
    ),
]


async def plan(state: MentorState) -> MentorState:
    """Rule-first routing.

    A trigger-initiated turn already carries its route, and most explicit
    questions match an intent rule — so the Planner costs nothing on the large
    majority of turns and only spends a tiny-model call on genuine ambiguity.
    """
    envelope = state["envelope"]

    if envelope.trigger is not TriggerType.EXPLICIT_ASK:
        route = TRIGGER_ROUTES.get(envelope.trigger, AgentType.TUTOR)
        return {**state, "route": route, "route_reason": f"trigger:{envelope.trigger.value}"}

    if envelope.policy.hintLevel is not None and not envelope.userMessage:
        return {**state, "route": AgentType.HINT, "route_reason": "explicit hint request"}

    message = envelope.userMessage or ""
    for pattern, agent in _INTENT_RULES:
        if pattern.search(message):
            return {**state, "route": agent, "route_reason": "intent rule"}

    # Signal-based defaults before spending anything on the ambiguous tail.
    signals = envelope.signals
    if envelope.execution.lastVerdict in {"COMPILATION_ERROR", "RUNTIME_ERROR", "WRONG_ANSWER"}:
        return {**state, "route": AgentType.DEBUG, "route_reason": "recent failing verdict"}
    if signals and not signals.matchesExpectedBand and signals.complexityConfidence > 0.7:
        return {**state, "route": AgentType.COMPLEXITY, "route_reason": "complexity gap in signals"}

    try:
        completion = await router.generate(
            task=TaskClass.TINY,
            system=prompts.AGENT_ROLES[AgentType.PLANNER],
            user=f"Learner asked: {message[:500]}\nTheir code parses: "
            f"{signals.parseOk if signals else 'unknown'}",
            max_tokens=80,
            temperature=0.0,
            json_mode=True,
        )
        parsed = parse_json_object(completion.text)
        route = AgentType(parsed.get("route", "TUTOR"))
        return {**state, "route": route, "route_reason": str(parsed.get("reason", "planner"))[:80]}
    except (ProviderError, ValueError, KeyError):
        return {**state, "route": AgentType.TUTOR, "route_reason": "planner default"}


# ── Generation ───────────────────────────────────────────────────────────


async def generate(state: MentorState) -> MentorState:
    envelope = state["envelope"]
    agent = state.get("route", AgentType.TUTOR)
    attempts = state.get("attempts", 0)

    user_prompt, flagged = prompts.build_user_prompt(envelope)
    system_prompt = prompts.build_system_prompt(agent, envelope, hardened=flagged)

    if flagged:
        log.warning(
            "injection_pattern_flagged",
            user_id=envelope.userId,
            problem=envelope.problem.slug,
        )

    verdict = state.get("verdict")
    if verdict and not verdict.passed:
        user_prompt += prompts.retry_suffix(verdict.reason)

    task = TaskClass.FAST if agent is AgentType.DEBUG else TaskClass.REASON
    telemetry = state.get("telemetry") or AgentTelemetry()

    try:
        completion = await router.generate(
            task=task,
            system=system_prompt,
            user=user_prompt,
            max_tokens=900,
            # Retries get lower temperature: the first answer broke a hard
            # limit, so we want a more conservative second attempt.
            temperature=0.35 if attempts == 0 else 0.15,
            json_mode=True,
        )
    except ProviderError as exc:
        log.info("generation_failed", error=str(exc), agent=agent.value)
        return {**state, "draft": None, "attempts": attempts + 1}

    telemetry.model = completion.model
    telemetry.promptTokens += completion.prompt_tokens
    telemetry.completionTokens += completion.completion_tokens
    telemetry.latencyMs += completion.latency_ms
    telemetry.routeReason = state.get("route_reason", "")

    try:
        payload = parse_json_object(completion.text)
        draft = AgentResponse(
            agent=agent,
            blocks=payload.get("blocks") or [{"type": "text", "content": completion.text[:1200]}],
            followUp=payload.get("followUp"),
            conceptTags=[str(t) for t in (payload.get("conceptTags") or [])][:5],
        )
    except Exception as exc:  # noqa: BLE001 — malformed output is a Guard concern
        log.info("response_parse_failed", error=str(exc))
        return {**state, "draft": None, "attempts": attempts + 1, "telemetry": telemetry}

    return {**state, "draft": draft, "attempts": attempts + 1, "telemetry": telemetry}


async def guard(state: MentorState) -> MentorState:
    """The Response Guard. A rejection re-routes through the Planner, because a
    rejected answer frequently means the wrong specialist was chosen, not
    merely the wrong wording."""
    draft = state.get("draft")
    telemetry = state.get("telemetry") or AgentTelemetry()

    if draft is None:
        return {**state, "verdict": None}

    verdict = validate(draft, state["envelope"])
    if not verdict.passed:
        telemetry.guardRejections += 1
        log.info("guard_rejected", reason=verdict.reason, agent=draft.agent.value)
    return {**state, "verdict": verdict, "telemetry": telemetry}


def should_retry(state: MentorState) -> str:
    verdict = state.get("verdict")
    attempts = state.get("attempts", 0)
    if state.get("draft") is not None and verdict is not None and verdict.passed:
        return "accept"
    if attempts < MAX_ATTEMPTS:
        return "retry"
    return "fallback"


# ── Deterministic fallback ───────────────────────────────────────────────


#: Closing question per assist mode. Easy gets a concrete prompt it can answer
#: from the screen; High gets something that assumes fluency.
_CLOSING_QUESTION = {
    AssistMode.EASY: "Walk me through what your code does with the very first example — line by line.",
    AssistMode.MODERATE: "What is the one piece of information you wish you already had at each step?",
    AssistMode.HIGH: "What is the theoretical lower bound here, and what structure gets you to it?",
}

#: Escalating idle nudges. Being stuck for 45s and stuck for four minutes are
#: different states and deserve different pressure.
_IDLE_NUDGES = [
    "Still with it? Try describing the problem out loud in one sentence — the shape of the "
    "solution usually falls out of the restatement.",
    "You've been on this a while. Pick the smallest example from the statement and solve it by "
    "hand on paper. Whatever you do by hand *is* the algorithm.",
    "This one is fighting you. Take the hint below — using a hint is not losing.",
]


def deterministic_response(envelope: ContextEnvelope) -> AgentResponse:
    """Stage-1-only mentoring.

    Runs when no model provider is configured, when every provider is
    rate-limited, or when two guarded attempts both failed. Built purely from
    the deterministic signal engine — always available, always free, and shaped
    by the learner's assist mode so it does not read like a canned string.

    This is the reason "free tier" means limited rather than broken.
    """
    signals = envelope.signals
    mode = envelope.assistMode
    blocks: list[Any] = []
    verdict = envelope.execution.lastVerdict

    # ── verdict-driven opening ───────────────────────────────────────────
    if verdict in {"COMPILATION_ERROR", "RUNTIME_ERROR"}:
        detail = (
            "A crash or compile failure means the program never got far enough to produce output, "
            "so this is not a wrong-answer problem. Read only the FIRST error line — the rest are "
            "usually knock-on effects of it."
            if mode is AssistMode.EASY
            else "That never produced output — read the first error line only; the rest cascade."
        )
        blocks.append(TextBlock(content=detail))

    elif verdict == "WRONG_ANSWER" and envelope.execution.failingTest:
        failing = envelope.execution.failingTest
        blocks.append(
            TextBlock(
                content=(
                    f"On input `{failing.get('input', '')[:120]}` the expected answer is "
                    f"`{failing.get('expected', '')[:80]}` but you produced "
                    f"`{failing.get('actual', '')[:80]}`."
                )
            )
        )
        blocks.append(
            QuestionBlock(
                content=(
                    "Trace just that one input by hand. At which line does your value first differ "
                    "from what you expected?"
                )
            )
        )

    elif verdict == "TIME_LIMIT_EXCEEDED":
        blocks.append(
            TextBlock(
                content=(
                    "Your logic is producing correct answers, just not fast enough — a different "
                    "problem from a bug. Look at the work you *repeat*, not the work you get wrong."
                )
            )
        )

    # ── idle: escalate with how long they have been stuck ────────────────
    if envelope.trigger is TriggerType.IDLE_STUCK:
        attempts = envelope.history.attemptCount
        hints_used = len(envelope.history.hintsUsed)
        stage = min(2, hints_used if hints_used else (1 if attempts >= 2 else 0))
        blocks.append(TextBlock(content=_IDLE_NUDGES[stage]))

    elif envelope.trigger is TriggerType.THRASHING:
        blocks.append(
            TextBlock(
                content=(
                    "You've rewritten the same region a few times now. That usually means the "
                    "approach is unclear rather than the syntax — worth stepping back and settling "
                    "the plan before the code."
                )
            )
        )

    elif envelope.trigger is TriggerType.MILESTONE and signals:
        approach = label_for(signals.algorithmFingerprint)
        blocks.append(
            TextBlock(
                content=(
                    f"That's the right shape — you're building a {approach}. Keep going."
                    if approach
                    else "Good — that structure is real progress. Keep going."
                )
            )
        )

    # ── signal-driven detail ─────────────────────────────────────────────
    if signals:
        errors = [f for f in signals.findings if f.severity is Severity.ERROR]
        warnings = [f for f in signals.findings if f.severity is Severity.WARNING]

        if errors:
            blocks.append(
                DiagnosticBlock(
                    severity=Severity.ERROR,
                    message=f"Line {errors[0].range.startLine + 1}: {errors[0].message}",
                    range=errors[0].range,
                )
            )
        elif warnings:
            blocks.append(
                DiagnosticBlock(
                    severity=Severity.WARNING,
                    message=f"Line {warnings[0].range.startLine + 1}: {warnings[0].message}",
                    range=warnings[0].range,
                )
            )

        if not signals.matchesExpectedBand and signals.complexityConfidence >= 0.6:
            # High Assist is allowed to be told the technique; the lower modes
            # get the same fact framed as a question they can act on.
            if mode is AssistMode.HIGH:
                explanation = (
                    f"You're at {signals.inferredTime} against an expected "
                    f"{envelope.problem.expectedTime}. The repeated inner scan is the cost — "
                    "replace the search with a precomputed lookup and it collapses one class."
                )
            else:
                explanation = (
                    f"Your code looks like {signals.inferredTime}, and the constraints point at "
                    f"{envelope.problem.expectedTime}. Find the work you are repeating: for every "
                    "element, what are you searching for — and could you already know the answer "
                    "instead of looking for it?"
                )
            blocks.append(
                ComplexityBlock(
                    current=signals.inferredTime,
                    target=envelope.problem.expectedTime,
                    explanation=explanation,
                )
            )

        if mode is AssistMode.EASY and signals.dataStructures:
            blocks.append(
                TextBlock(
                    content=(
                        f"You're using: {', '.join(signals.dataStructures)}. "
                        "Each of those has a different cost per operation, and that cost is what "
                        "decides your overall complexity."
                    )
                )
            )

    if not blocks:
        blocks.append(
            TextBlock(
                content=(
                    "Start from the constraints. They tell you which complexity class is expected, "
                    "and that usually rules out every approach but one or two."
                )
            )
        )

    # Avoid stacking two questions — the verdict branch may already have asked one.
    if not any(getattr(b, "type", None) == "question" for b in blocks):
        blocks.append(QuestionBlock(content=_CLOSING_QUESTION[mode]))

    return AgentResponse(
        agent=AgentType.FALLBACK,
        blocks=blocks,
        followUp=None,
        conceptTags=envelope.problem.topics[:3],
    )


def authored_hint_response(envelope: ContextEnvelope, hint_text: str, level: int) -> AgentResponse:
    return AgentResponse(
        agent=AgentType.FALLBACK,
        blocks=[HintBlock(level=level, content=hint_text)],
        followUp=None,
        conceptTags=envelope.problem.topics[:3],
    )


async def fallback(state: MentorState) -> MentorState:
    envelope = state["envelope"]
    telemetry = state.get("telemetry") or AgentTelemetry()
    telemetry.fallbackUsed = True
    if not telemetry.routeReason:
        telemetry.routeReason = "fallback: no acceptable model response"
    return {**state, "final": deterministic_response(envelope), "telemetry": telemetry}


async def finalize(state: MentorState) -> MentorState:
    telemetry = state.get("telemetry") or AgentTelemetry()
    return {**state, "final": state.get("draft"), "telemetry": telemetry}


def start_state(envelope: ContextEnvelope) -> MentorState:
    return {
        "envelope": envelope,
        "attempts": 0,
        "telemetry": AgentTelemetry(latencyMs=0),
        "hardened": False,
    }


def elapsed_ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)
