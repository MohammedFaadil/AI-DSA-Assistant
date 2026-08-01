"""Trigger policy tests.

The pedagogy is code, so it gets tested like code. These assertions are the
product promise: silence is the default, and each intervention has a reason
that can be stated and checked.
"""

from __future__ import annotations

from app.analysis.signals import build_signals
from app.schemas import AgentType, AnalyzeRequest, AssistMode, BehaviourInput, Language, TriggerType
from app.triggers.policy import decide

WORKING = """
def twoSum(nums, target):
    seen = {}
    for i, value in enumerate(nums):
        if target - value in seen:
            return [seen[target - value], i]
        seen[value] = i
    return []
"""

BRUTE_FORCE = """
def twoSum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
"""

PARTIAL = """
def twoSum(nums, target):
    for i in range(len(nums)):
        pass
"""


def _request(code: str, **behaviour) -> AnalyzeRequest:
    return AnalyzeRequest(
        requestId="t",
        language=Language.PYTHON,
        code=code,
        expectedTime=behaviour.pop("expected_time", "O(n)"),
        assistMode=behaviour.pop("assist_mode", AssistMode.MODERATE),
        cooldowns=behaviour.pop("cooldowns", {}),
        confidence=behaviour.pop("confidence", 0.5),
        behaviour=BehaviourInput(**behaviour),
    )


def _decide(request: AnalyzeRequest, *, complexity_confidence: float | None = None):
    signals, _model, _ms = build_signals(request)
    if complexity_confidence is not None:
        # Lets a policy test assert on the policy rather than on how much the
        # estimator happens to trust itself with the parser backend in use.
        signals.complexityConfidence = complexity_confidence
    return decide(signals, request)


class TestSilenceIsDefault:
    def test_active_typing_does_not_trigger(self) -> None:
        decision = _decide(_request(WORKING, idleMs=500, editCount=10, charsTyped=200))
        assert decision.fired is False

    def test_brief_pause_does_not_trigger(self) -> None:
        decision = _decide(_request(PARTIAL, idleMs=8_000, editCount=6, charsTyped=90))
        assert decision.fired is False

    def test_idle_on_finished_code_does_not_trigger(self) -> None:
        """Someone idling on a complete solution is thinking, not stuck."""
        decision = _decide(_request(WORKING, idleMs=90_000, editCount=20, charsTyped=400))
        assert decision.fired is False


class TestTriggers:
    def test_idle_on_unfinished_code_fires_hint(self) -> None:
        decision = _decide(_request(PARTIAL, idleMs=90_000, editCount=8, charsTyped=100))
        assert decision.fired is True
        assert decision.trigger is TriggerType.IDLE_STUCK
        assert decision.route is AgentType.HINT

    def test_failing_verdict_fires_debug_with_highest_priority(self) -> None:
        decision = _decide(
            _request(
                BRUTE_FORCE,
                idleMs=90_000,
                lastVerdict="WRONG_ANSWER",
                editCount=10,
                charsTyped=200,
            )
        )
        assert decision.trigger is TriggerType.RUNTIME_FAILURE
        assert decision.route is AgentType.DEBUG

    def test_repeated_compile_error_fires_debug(self) -> None:
        decision = _decide(_request(BRUTE_FORCE, sameErrorCount=3, editCount=5))
        assert decision.trigger is TriggerType.REPEATED_COMPILE_ERROR

    def test_complexity_gap_requires_stability(self) -> None:
        """We do not comment on an approach the learner is still changing."""
        churning = _decide(
            _request(BRUTE_FORCE, expected_time="O(n)", stableForMs=2_000, editCount=10),
            complexity_confidence=0.9,
        )
        assert churning.trigger is not TriggerType.COMPLEXITY_GAP

        settled = _decide(
            _request(BRUTE_FORCE, expected_time="O(n)", stableForMs=30_000, editCount=10),
            complexity_confidence=0.9,
        )
        assert settled.trigger is TriggerType.COMPLEXITY_GAP
        assert settled.route is AgentType.COMPLEXITY

    def test_low_confidence_estimates_stay_silent(self) -> None:
        """Staying silent beats being confidently wrong about someone's code."""
        decision = _decide(
            _request(BRUTE_FORCE, expected_time="O(n)", stableForMs=30_000, editCount=10),
            complexity_confidence=0.5,
        )
        assert decision.trigger is not TriggerType.COMPLEXITY_GAP


class TestModeratesAndCooldowns:
    def test_cooldown_suppresses_a_trigger(self) -> None:
        decision = _decide(
            _request(
                PARTIAL,
                idleMs=90_000,
                editCount=8,
                charsTyped=100,
                cooldowns={"IDLE_STUCK": 60},
            )
        )
        assert decision.trigger is not TriggerType.IDLE_STUCK

    def test_easy_mode_is_more_eager_than_high(self) -> None:
        easy = _decide(
            _request(PARTIAL, idleMs=36_000, editCount=8, charsTyped=100, assist_mode=AssistMode.EASY)
        )
        high = _decide(
            _request(PARTIAL, idleMs=36_000, editCount=8, charsTyped=100, assist_mode=AssistMode.HIGH)
        )
        assert easy.fired is True
        assert high.fired is False

    def test_confident_learners_get_more_room(self) -> None:
        timid = _decide(_request(PARTIAL, idleMs=45_000, editCount=8, charsTyped=100, confidence=0.1))
        assured = _decide(
            _request(PARTIAL, idleMs=45_000, editCount=8, charsTyped=100, confidence=0.95)
        )
        assert timid.fired is True
        assert assured.fired is False


class TestInterventionRate:
    def test_most_ticks_stay_silent(self) -> None:
        """The 95/5 split is the number the whole cost model rests on."""
        fired = 0
        total = 40
        for tick in range(total):
            decision = _decide(
                _request(
                    WORKING if tick % 2 else PARTIAL,
                    idleMs=tick * 400,
                    editCount=tick,
                    charsTyped=tick * 12,
                    cooldowns={"IDLE_STUCK": 60} if tick > 20 else {},
                )
            )
            fired += 1 if decision.fired else 0
        assert fired / total <= 0.25
