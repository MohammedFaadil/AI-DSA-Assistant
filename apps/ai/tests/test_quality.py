"""Code-quality scoring and line-review tests.

The strength meter is a live, always-visible number, so its behaviour has to be
pinned down: it must rise when code genuinely improves, refuse to score an empty
buffer, and never let elegant-but-broken code outrank working code.
"""

from __future__ import annotations

from app.analysis import linereview, quality
from app.analysis.parser import parse
from app.analysis.rules import run_rules
from app.schemas import LineRole

STUB = """import sys


def twoSum(nums, target):
    # Write your code here
    pass
"""

BRUTE_FORCE = """def twoSum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
"""

OPTIMAL = """def twoSum(nums, target):
    if not nums:
        return []
    seen = {}
    for index, value in enumerate(nums):
        complement = target - value
        if complement in seen:
            return [seen[complement], index]
        seen[value] = index
    return []
"""

BROKEN = """def twoSum(nums, target):
    seen = {}
    for i, v in enumerate(nums:
        return []
"""

NO_RETURN = """def solve(nums):
    total = 0
    for value in nums:
        total += value
"""

INFINITE = """def solve(n):
    total = 0
    while n > 0:
        total = total + 1
    return total
"""

MESSY = """def solve(nums):
    x = 0
    tmp = 0
    for i in range(len(nums)):
        for j in range(len(nums)):
            if nums[i] in nums:
                x = x + 1728394
    return x
"""


def _score(code: str, expected: str = "O(n)"):
    model = parse("PYTHON", code)
    findings = run_rules(model)
    return quality.score(model, findings, expected)


class TestMeasurability:
    def test_stub_is_not_measurable(self) -> None:
        """A red bar before you have written anything reads as failure."""
        report = _score(STUB)
        assert report.measurable is False
        assert report.overall == 0
        assert report.dimensions == []

    def test_real_code_is_measurable(self) -> None:
        report = _score(OPTIMAL)
        assert report.measurable is True
        assert len(report.dimensions) == 5
        assert report.grade in {"A", "B", "C", "D", "E"}


class TestOrdering:
    def test_optimal_outranks_brute_force(self) -> None:
        assert _score(OPTIMAL).overall > _score(BRUTE_FORCE).overall

    def test_brute_force_outranks_messy(self) -> None:
        assert _score(BRUTE_FORCE).overall > _score(MESSY).overall

    def test_broken_code_is_capped(self) -> None:
        """No amount of elegance compensates for code that cannot run."""
        assert _score(BROKEN).overall <= 48

    def test_non_terminating_loop_is_capped(self) -> None:
        assert _score(INFINITE).overall <= 55

    def test_optimal_scores_well(self) -> None:
        report = _score(OPTIMAL)
        assert report.overall >= 80, f"expected a strong score, got {report.overall}"


class TestDimensions:
    def test_efficiency_penalises_the_complexity_gap(self) -> None:
        efficiency = next(d for d in _score(BRUTE_FORCE, "O(n)").dimensions if d.key == "efficiency")
        assert efficiency.score < 85
        assert any("O(n" in note for note in efficiency.notes)

    def test_efficiency_is_full_when_expectation_is_met(self) -> None:
        efficiency = next(d for d in _score(BRUTE_FORCE, "O(n^2)").dimensions if d.key == "efficiency")
        assert efficiency.score >= 90

    def test_correctness_flags_a_missing_return(self) -> None:
        correctness = next(d for d in _score(NO_RETURN).dimensions if d.key == "correctness")
        assert correctness.score < 85

    def test_readability_flags_vague_names(self) -> None:
        readability = next(d for d in _score(MESSY).dimensions if d.key == "readability")
        assert readability.score < 90
        assert any("tmp" in note or "`x`" in note for note in readability.notes)

    def test_robustness_rewards_an_empty_guard(self) -> None:
        guarded = next(d for d in _score(OPTIMAL).dimensions if d.key == "robustness")
        unguarded = next(d for d in _score(BRUTE_FORCE).dimensions if d.key == "robustness")
        assert guarded.score > unguarded.score

    def test_weights_sum_to_one(self) -> None:
        total = sum(d.weight for d in _score(OPTIMAL).dimensions)
        assert abs(total - 1.0) < 1e-6

    def test_top_fix_is_actionable_when_weak(self) -> None:
        report = _score(MESSY)
        assert report.topFix is not None and len(report.topFix) > 12


class TestLineReview:
    def test_flags_linear_membership_inside_a_loop(self) -> None:
        review = linereview.review(parse("PYTHON", MESSY), "O(n)")
        risks = [n for n in review.notes if n.role is LineRole.RISK]
        assert any("Searches" in n.what for n in risks)
        assert any(n.fix and "set" in n.fix for n in risks)

    def test_marks_the_inner_loop_of_a_nested_pair(self) -> None:
        review = linereview.review(parse("PYTHON", BRUTE_FORCE), "O(n)")
        assert any(n.role is LineRole.IMPROVE and "second nesting" in n.what for n in review.notes)

    def test_credits_a_hash_structure(self) -> None:
        review = linereview.review(parse("PYTHON", OPTIMAL), "O(n)")
        assert any(n.role is LineRole.GOOD and "hash" in n.what.lower() for n in review.notes)

    def test_optimal_code_has_no_risks(self) -> None:
        review = linereview.review(parse("PYTHON", OPTIMAL), "O(n)")
        assert not [n for n in review.notes if n.role is LineRole.RISK]
        assert review.improvableLines == 0

    def test_annotates_without_spamming(self) -> None:
        """Filler on every line trains people to ignore the gutter."""
        review = linereview.review(parse("PYTHON", OPTIMAL), "O(n)")
        real_lines = len([line for line in OPTIMAL.split("\n") if line.strip()])
        assert 0 < review.annotatedLines <= real_lines

    def test_summary_is_written_for_a_human(self) -> None:
        assert len(linereview.review(parse("PYTHON", MESSY), "O(n)").summary) > 12
