"""Stage-1 tests.

These run with no API key and no network — which is the point: the signal
engine is the part of the mentor that always works.
"""

from __future__ import annotations

from app.analysis import algorithms, complexity
from app.analysis.parser import parse
from app.analysis.signals import build_signals
from app.schemas import AnalyzeRequest, AssistMode, BehaviourInput, Language, Severity

BRUTE_FORCE_TWO_SUM = """
def twoSum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
"""

HASH_TWO_SUM = """
def twoSum(nums, target):
    seen = {}
    for i, value in enumerate(nums):
        if target - value in seen:
            return [seen[target - value], i]
        seen[value] = i
    return []
"""

BINARY_SEARCH = """
def search(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = lo + (hi - lo) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
"""

INFINITE_LOOP = """
def solve(n):
    total = 0
    while n > 0:
        total = total + 1
    return total
"""

UNUSED_VARIABLE = """
def solve(nums):
    unused_total = 0
    best = 0
    for value in nums:
        best = max(best, value)
    return best
"""

NESTED_JS = """
function maxPair(nums) {
  let best = 0;
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      best = Math.max(best, nums[i] + nums[j]);
    }
  }
  return best;
}
"""


def _request(code: str, language: Language = Language.PYTHON, **kwargs) -> AnalyzeRequest:
    return AnalyzeRequest(
        requestId="test",
        language=language,
        code=code,
        expectedTime=kwargs.pop("expected_time", "O(n)"),
        behaviour=BehaviourInput(**kwargs.pop("behaviour", {})),
        assistMode=kwargs.pop("assist_mode", AssistMode.MODERATE),
        **kwargs,
    )


class TestComplexity:
    def test_nested_loops_are_quadratic(self) -> None:
        model = parse("PYTHON", BRUTE_FORCE_TWO_SUM)
        time_class, _space, confidence = complexity.estimate(model)
        assert time_class == "O(n^2)"
        assert confidence > 0.4

    def test_single_loop_is_linear(self) -> None:
        model = parse("PYTHON", HASH_TWO_SUM)
        time_class, _space, _confidence = complexity.estimate(model)
        assert time_class == "O(n)"

    def test_halving_loop_is_logarithmic(self) -> None:
        model = parse("PYTHON", BINARY_SEARCH)
        time_class, _space, _confidence = complexity.estimate(model)
        assert time_class == "O(log n)"

    def test_nested_loops_detected_across_languages(self) -> None:
        model = parse("JAVASCRIPT", NESTED_JS)
        time_class, _space, _confidence = complexity.estimate(model)
        assert time_class == "O(n^2)"

    def test_rank_ordering(self) -> None:
        assert complexity.rank_of("O(1)") < complexity.rank_of("O(log n)")
        assert complexity.rank_of("O(n)") < complexity.rank_of("O(n log n)")
        assert complexity.rank_of("O(n log n)") < complexity.rank_of("O(n^2)")
        assert complexity.within_expected("O(n)", "O(n)")
        assert complexity.within_expected("O(log n)", "O(n)")
        assert not complexity.within_expected("O(n^2)", "O(n)")


class TestFingerprints:
    def test_recognises_binary_search(self) -> None:
        assert algorithms.fingerprint(parse("PYTHON", BINARY_SEARCH)) == "binary_search"

    def test_recognises_hash_lookup(self) -> None:
        assert algorithms.fingerprint(parse("PYTHON", HASH_TWO_SUM)) in {
            "hash_lookup",
            "frequency_count",
        }

    def test_recognises_brute_force(self) -> None:
        assert algorithms.fingerprint(parse("PYTHON", BRUTE_FORCE_TWO_SUM)) == "brute_force_pairs"


class TestRules:
    def test_flags_possible_infinite_loop(self) -> None:
        signals, _model, _ms = build_signals(_request(INFINITE_LOOP))
        assert any(f.rule == "possible_infinite_loop" for f in signals.findings)

    def test_flags_unused_variable(self) -> None:
        signals, _model, _ms = build_signals(_request(UNUSED_VARIABLE))
        findings = [f for f in signals.findings if f.rule == "unused_variable"]
        assert any(f.symbol == "unused_total" for f in findings)

    def test_clean_code_has_no_errors(self) -> None:
        signals, _model, _ms = build_signals(_request(HASH_TWO_SUM))
        assert not [f for f in signals.findings if f.severity is Severity.ERROR]


class TestSignals:
    def test_broken_code_still_analyses(self) -> None:
        """Tree-sitter's whole reason for being here: mid-thought code.

        The structure around the broken line must still be recovered, and the
        breakage must be visible rather than silently treated as complete.
        """
        signals, _model, _ms = build_signals(_request("def solve(nums):\n    for i in range("))
        assert signals.lineCount >= 2
        assert signals.functions and signals.functions[0].name == "solve"
        assert signals.parseOk is False
        assert signals.errorRanges
        assert signals.progressEstimate < 0.6

    def test_complexity_gap_detected_against_expectation(self) -> None:
        signals, _model, _ms = build_signals(
            _request(BRUTE_FORCE_TWO_SUM, expected_time="O(n)")
        )
        assert signals.inferredTime == "O(n^2)"
        assert signals.matchesExpectedBand is False

    def test_semantic_diff_detects_new_structure(self) -> None:
        request = _request(HASH_TWO_SUM)
        request.previousCode = "def twoSum(nums, target):\n    pass"
        signals, _model, _ms = build_signals(request)
        assert signals.semanticDiff.addedCorrectStructure is True

    def test_analysis_is_fast(self) -> None:
        """Stage 1 runs every 2 seconds per active learner — budget is ~20ms."""
        _signals, _model, elapsed = build_signals(_request(BRUTE_FORCE_TWO_SUM))
        assert elapsed < 250  # generous for CI; typical is single-digit ms
