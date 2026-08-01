"""The Trigger Policy — when the mentor is allowed to speak.

This is the gate between free deterministic analysis and rationed inference.
It is DATA, not a prompt: every rule below is a pure predicate over signals,
which makes the platform's pedagogy unit-testable. A change to when the mentor
interrupts is a code review, not a vibe.

Silence is the default. Every trigger must earn its LLM call.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from app.schemas import (
    AgentType,
    AnalyzeRequest,
    AssistMode,
    QualityReport,
    SessionSignals,
    TriggerDecision,
    TriggerType,
    FAILING_VERDICTS,
)

MODE_ORDER = {AssistMode.EASY: 0, AssistMode.MODERATE: 1, AssistMode.HIGH: 2}


@dataclass(frozen=True)
class Trigger:
    type: TriggerType
    route: AgentType
    cooldown_s: int
    min_mode: AssistMode
    reason: str
    predicate: Callable[[SessionSignals, AnalyzeRequest], bool]
    priority: int = 0


def _idle_stuck(signals: SessionSignals, request: AnalyzeRequest) -> bool:
    # Idling on a nearly-finished solution is thinking, not being stuck.
    return (
        signals.idleMs >= _idle_threshold(request)
        and signals.progressEstimate < 0.9
        and bool(request.code.strip())
    )


def _idle_threshold(request: AnalyzeRequest) -> int:
    """Assist mode and learner confidence both stretch the patience window.

    A High-Assist user already has ghost text and needs less prodding; a
    confident learner has earned more room before anyone interrupts them.
    """
    base = request.idleThresholdMs
    if request.assistMode is AssistMode.EASY:
        base = int(base * 0.7)
    elif request.assistMode is AssistMode.HIGH:
        base = int(base * 1.35)
    return int(base * (0.75 + request.confidence * 0.5))


def _thrashing(signals: SessionSignals, _request: AnalyzeRequest) -> bool:
    return signals.thrashScore >= 0.7


def _complexity_gap(signals: SessionSignals, request: AnalyzeRequest) -> bool:
    return (
        not signals.matchesExpectedBand
        # Below this confidence the estimator stays quiet rather than risk
        # being confidently wrong about someone's approach.
        and signals.complexityConfidence >= 0.75
        # Only comment once they've stopped changing the approach.
        and request.behaviour.stableForMs >= 15_000
        and signals.progressEstimate >= 0.45
    )


def _repeated_compile_error(_signals: SessionSignals, request: AnalyzeRequest) -> bool:
    return request.behaviour.sameErrorCount >= 2


def _runtime_failure(_signals: SessionSignals, request: AnalyzeRequest) -> bool:
    return (request.behaviour.lastVerdict or "") in FAILING_VERDICTS


def _milestone(signals: SessionSignals, _request: AnalyzeRequest) -> bool:
    return (
        signals.semanticDiff.addedCorrectStructure
        and signals.progressEstimate >= 0.6
        and signals.parseOk
    )


def _quality_trend_trigger(quality: QualityReport | None, request: AnalyzeRequest) -> Trigger | None:
    """Not a normal predicate — needs the quality report, which the other
    triggers don't, so it's evaluated separately in decide() rather than
    threaded through every Trigger.predicate signature."""
    if quality is None or quality.trend is None:
        return None
    # Only comment once the code has settled, so this doesn't fire mid-keystroke.
    if abs(quality.trend) < 15 or request.behaviour.stableForMs < 10_000:
        return None
    if quality.trend < 0:
        return Trigger(
            type=TriggerType.QUALITY_DROP,
            route=AgentType.CODE_REVIEW,
            cooldown_s=180,
            min_mode=AssistMode.EASY,
            reason="code quality dropped recently",
            predicate=lambda *_: True,
            priority=40,
        )
    return Trigger(
        type=TriggerType.QUALITY_IMPROVED,
        route=AgentType.CODE_REVIEW,
        cooldown_s=180,
        min_mode=AssistMode.EASY,
        reason="code quality improved recently",
        predicate=lambda *_: True,
        priority=15,
    )


TRIGGERS: list[Trigger] = [
    Trigger(
        type=TriggerType.RUNTIME_FAILURE,
        route=AgentType.DEBUG,
        cooldown_s=0,
        min_mode=AssistMode.EASY,
        reason="the last submission failed",
        predicate=_runtime_failure,
        priority=100,
    ),
    Trigger(
        type=TriggerType.REPEATED_COMPILE_ERROR,
        route=AgentType.DEBUG,
        cooldown_s=60,
        min_mode=AssistMode.EASY,
        reason="the same error has appeared repeatedly",
        predicate=_repeated_compile_error,
        priority=90,
    ),
    Trigger(
        type=TriggerType.IDLE_STUCK,
        route=AgentType.HINT,
        cooldown_s=120,
        min_mode=AssistMode.EASY,
        reason="no edits for a while on unfinished code",
        predicate=_idle_stuck,
        priority=70,
    ),
    Trigger(
        type=TriggerType.THRASHING,
        route=AgentType.TUTOR,
        cooldown_s=180,
        min_mode=AssistMode.MODERATE,
        reason="the same region is being rewritten without progress",
        predicate=_thrashing,
        priority=60,
    ),
    Trigger(
        type=TriggerType.COMPLEXITY_GAP,
        route=AgentType.COMPLEXITY,
        cooldown_s=300,
        min_mode=AssistMode.MODERATE,
        reason="the approach is slower than the constraints allow",
        predicate=_complexity_gap,
        priority=50,
    ),
    Trigger(
        type=TriggerType.MILESTONE,
        route=AgentType.TUTOR,
        cooldown_s=240,
        min_mode=AssistMode.EASY,
        reason="meaningful structure was just added",
        predicate=_milestone,
        priority=10,
    ),
]


def decide(
    signals: SessionSignals,
    request: AnalyzeRequest,
    quality: QualityReport | None = None,
) -> TriggerDecision:
    """Evaluate every trigger; the highest-priority eligible one wins.

    Cooldowns are supplied by the caller (the API holds per-session state), and
    dismissals lengthen them upstream — a mentor who is ignored learns to be
    quieter.
    """
    mode_rank = MODE_ORDER[request.assistMode]
    candidates: list[Trigger] = []

    for trigger in TRIGGERS:
        if MODE_ORDER[trigger.min_mode] > mode_rank:
            continue
        if request.cooldowns.get(trigger.type.value, 0) > 0:
            continue
        try:
            if trigger.predicate(signals, request):
                candidates.append(trigger)
        except Exception:  # noqa: BLE001 - a bad predicate must not break analysis
            continue

    quality_trigger = _quality_trend_trigger(quality, request)
    if quality_trigger and request.cooldowns.get(quality_trigger.type.value, 0) <= 0:
        candidates.append(quality_trigger)

    if not candidates:
        return TriggerDecision(fired=False, reason="silent: no trigger met its conditions")

    winner = max(candidates, key=lambda t: t.priority)
    return TriggerDecision(
        fired=True,
        trigger=winner.type,
        route=winner.route,
        reason=winner.reason,
        cooldownSec=winner.cooldown_s,
    )
