"""Complexity estimation.

This is a structural analysis, not an LLM guess — which is why it can run every
two seconds for free, and why it is trustworthy enough to gate a trigger.

The estimator deliberately reports a CONFIDENCE alongside the class, and the
trigger policy refuses to speak below a threshold. Staying silent beats being
confidently wrong: a mentor that misreads your code once loses the room.
"""

from __future__ import annotations

import re

from app.analysis.model import CodeModel, LoopNode

# Ordered cheapest → most expensive. Used both to render and to compare.
COMPLEXITY_RANK: list[str] = [
    "O(1)",
    "O(log n)",
    "O(sqrt n)",
    "O(n)",
    "O(n log n)",
    "O(n^2)",
    "O(n^2 log n)",
    "O(n^3)",
    "O(2^n)",
    "O(n!)",
]

_HALVING = re.compile(
    r"//\s*2|/\s*2|>>\s*1|>>=\s*1|\bmid\b|\bmiddle\b|\*=\s*2|\*\s*2\b", re.IGNORECASE
)
_CONSTANT_RANGE = re.compile(r"range\s*\(\s*(\d+)\s*\)|<\s*(\d+)\s*;|\bin\s+\[[^\]]{0,40}\]")
_SORT_CALLS = {"sort", "sorted", "Arrays.sort", "Collections.sort", "std::sort", "sort_unstable"}
_LINEAR_MEMBERSHIP = re.compile(r"\bin\s+\w*(list|nums|arr|array|prices|words)\w*\b", re.IGNORECASE)


def classify_loop_bound(loop: LoopNode) -> str:
    """linear | log | constant.

    A halving update inside the loop is the signature of binary search and of
    every doubling/halving traversal; a literal small range is a constant-factor
    loop that should not inflate the reported class.
    """
    header = loop.text.split("\n")[0]
    if _HALVING.search(header) or (loop.kind == "while" and _HALVING.search(loop.text[:200])):
        return "log"
    match = _CONSTANT_RANGE.search(header)
    if match:
        for group in match.groups():
            if group and int(group) <= 64:
                return "constant"
    return "linear"


def _chains(loops: list[LoopNode]) -> list[list[LoopNode]]:
    """Reconstruct nesting chains from the pre-order depth sequence.

    Loops arrive in traversal order, so depth behaves exactly like a stack:
    a loop at depth d closes every open loop at depth >= d.
    """
    chains: list[list[LoopNode]] = []
    stack: list[LoopNode] = []
    for loop in loops:
        while stack and stack[-1].depth >= loop.depth:
            stack.pop()
        stack.append(loop)
        chains.append(list(stack))
    return chains


def _render(linear: int, log: int) -> str:
    if linear == 0 and log == 0:
        return "O(1)"
    if linear == 0:
        return "O(log n)" if log == 1 else f"O(log^{log} n)"
    base = "O(n)" if linear == 1 else f"O(n^{linear})"
    if log == 0:
        return base
    inner = "n" if linear == 1 else f"n^{linear}"
    log_part = "log n" if log == 1 else f"log^{log} n"
    return f"O({inner} {log_part})"


def rank_of(expression: str) -> int:
    """Position in COMPLEXITY_RANK; unknown shapes sort just above O(n)."""
    normalised = expression.replace(" ", "").lower()
    for index, candidate in enumerate(COMPLEXITY_RANK):
        if candidate.replace(" ", "").lower() == normalised:
            return index
    if "!" in normalised:
        return len(COMPLEXITY_RANK) - 1
    if "2^" in normalised or "^n" in normalised:
        return COMPLEXITY_RANK.index("O(2^n)")
    exponent = re.search(r"n\^(\d+)", normalised)
    if exponent:
        power = int(exponent.group(1))
        if power >= 3:
            return COMPLEXITY_RANK.index("O(n^3)")
        if power == 2:
            return COMPLEXITY_RANK.index("O(n^2)")
    if "logn" in normalised and "n" in normalised.replace("logn", ""):
        return COMPLEXITY_RANK.index("O(n log n)")
    if "logn" in normalised:
        return COMPLEXITY_RANK.index("O(log n)")
    return COMPLEXITY_RANK.index("O(n)")


def estimate(model: CodeModel) -> tuple[str, str, float]:
    """Returns (time, space, confidence)."""
    if not model.source.strip():
        return "O(1)", "O(1)", 0.0

    for loop in model.loops:
        loop.bound = classify_loop_bound(loop)

    worst_linear = 0
    worst_log = 0
    worst_rank = -1

    for chain in _chains(model.loops):
        linear = sum(1 for loop in chain if loop.bound == "linear")
        log = sum(1 for loop in chain if loop.bound == "log")
        rank = rank_of(_render(linear, log))
        if rank > worst_rank:
            worst_rank, worst_linear, worst_log = rank, linear, log

    time = _render(worst_linear, worst_log)

    # A sort anywhere puts a floor under the whole function.
    if any(call.split(".")[-1] in _SORT_CALLS for call in model.calls):
        if rank_of(time) < rank_of("O(n log n)"):
            time = "O(n log n)"

    # `x in list` inside a loop is the classic hidden quadratic — students
    # write it constantly and it never looks like a nested loop.
    if model.loops and _LINEAR_MEMBERSHIP.search(model.source):
        if rank_of(time) < rank_of("O(n^2)"):
            time = "O(n^2)"

    # Recursion.
    if model.has_recursion:
        branching = _branching_factor(model)
        if model.has_memoization:
            # Memoised recursion collapses to (states × work per state); with a
            # loop inside a memoised function that is typically O(n^2).
            if rank_of(time) < rank_of("O(n)"):
                time = "O(n)" if model.max_loop_depth == 0 else "O(n^2)"
        elif branching >= 2:
            time = "O(2^n)"
        elif _HALVING.search(model.source):
            if rank_of(time) < rank_of("O(log n)"):
                time = "O(log n)"
        elif rank_of(time) < rank_of("O(n)"):
            time = "O(n)"

    space = _estimate_space(model)
    confidence = _confidence(model)
    return time, space, confidence


def _branching_factor(model: CodeModel) -> int:
    """How many times a recursive function calls itself in its own body."""
    best = 0
    for fn in model.functions:
        if not fn.is_recursive or not fn.body:
            continue
        best = max(best, len(re.findall(rf"\b{re.escape(fn.name)}\s*\(", fn.body)) - 1)
    if best == 0 and model.has_recursion:
        return 1
    return best


def _estimate_space(model: CodeModel) -> str:
    if model.data_structures:
        return "O(n)"
    if model.has_recursion:
        return "O(n)" if not _HALVING.search(model.source) else "O(log n)"
    if re.search(r"\[\s*0\s*\]\s*\*|\bnew\s+\w+\[|\bvector<|\bdp\b", model.source):
        return "O(n)"
    return "O(1)"


def _confidence(model: CodeModel) -> float:
    """Confidence is what makes silence possible.

    A real parse of syntactically valid code with recognisable loop structure is
    trustworthy. A regex fallback on broken code is not, and the trigger policy
    is expected to stay quiet in that case.
    """
    base = 0.85 if model.backend == "tree-sitter" else 0.5
    if not model.parse_ok:
        base -= 0.3
    if not model.functions:
        base -= 0.15
    if model.has_recursion and not model.has_memoization:
        base -= 0.1
    if model.line_count < 4:
        base -= 0.2
    return round(max(0.0, min(1.0, base)), 2)


def within_expected(inferred: str, expected: str) -> bool:
    """True when the current approach is at least as good as what's expected."""
    return rank_of(inferred) <= rank_of(expected)
