"""Algorithm fingerprinting.

Structural pattern matching over the code model. This is what lets the mentor
say *"you're building a sliding window but your window never shrinks"* — a
statement about the learner's actual intent, produced without a single token of
inference.

Each matcher returns a score; the highest scorer above a floor wins, so partial
patterns (a half-built window) do not get mislabelled as something else.
"""

from __future__ import annotations

import re

from app.analysis.model import CodeModel

_TWO_POINTER = re.compile(r"\b(left|right|lo|hi|start|end|i|j)\b.*\b(left|right|lo|hi|start|end|i|j)\b")
_WINDOW = re.compile(r"\b(window|left|start)\b", re.IGNORECASE)
_BINARY = re.compile(r"\bmid\b|\bmiddle\b|//\s*2|>>\s*1|\(\s*lo\s*\+\s*hi\s*\)")
_QUEUE = re.compile(r"\bdeque\b|\bQueue\b|popleft|\bqueue\b|\bshift\(\)|poll\(\)")
_STACK = re.compile(r"\bstack\b|\.pop\(\)|\bpush\b|push_back|\bappend\b")
_DP_TABLE = re.compile(r"\bdp\b|\btable\b|\bmemo\b|\bcache\b", re.IGNORECASE)
_UNION_FIND = re.compile(r"\bparent\b|\brank\b|\bfind\s*\(|\bunion\s*\(", re.IGNORECASE)
_HEAP = re.compile(r"heapq|heappush|heappop|PriorityQueue|priority_queue")
_PREFIX = re.compile(r"\bprefix\b|\brunning\b|\bcum\w*\b|\bacc\w*\b", re.IGNORECASE)
_GREEDY_MINMAX = re.compile(r"\b(min|max)\s*\(", re.IGNORECASE)
_FREQ = re.compile(r"\bcount\w*\b|\bfreq\w*\b|Counter|defaultdict", re.IGNORECASE)
_GRID_DIRS = re.compile(r"\(1,\s*0\)|\(-1,\s*0\)|\(0,\s*1\)|dx|dy|dirs|directions", re.IGNORECASE)

FINGERPRINT_LABELS: dict[str, str] = {
    "two_pointers": "two pointers",
    "sliding_window": "sliding window",
    "binary_search": "binary search",
    "bfs": "breadth-first search",
    "dfs": "depth-first search",
    "dp_bottom_up": "bottom-up dynamic programming",
    "dp_memoised": "memoised recursion",
    "union_find": "union find",
    "heap": "heap / priority queue",
    "prefix_aggregate": "prefix aggregate",
    "hash_lookup": "hash map lookup",
    "frequency_count": "frequency counting",
    "brute_force_pairs": "brute-force pair scan",
    "linear_scan": "single linear scan",
}


def fingerprint(model: CodeModel) -> str | None:
    source = model.source
    if not source.strip() or not model.loops and not model.has_recursion:
        return None

    scores: dict[str, float] = {}

    def bump(key: str, amount: float) -> None:
        scores[key] = scores.get(key, 0.0) + amount

    has_hash = any(ds in {"hash map", "hash set", "counter"} for ds in model.data_structures)
    single_loop = model.max_loop_depth == 1
    nested_loops = model.max_loop_depth >= 2

    # Binary search: halving plus a converging pair of bounds.
    if _BINARY.search(source):
        bump("binary_search", 3.0)
        if re.search(r"while\s+lo\s*<=?\s*hi|while\s+left\s*<=?\s*right", source):
            bump("binary_search", 2.0)

    # Sliding window vs. plain two pointers: a window maintains an aggregate.
    if single_loop and _TWO_POINTER.search(source):
        bump("two_pointers", 1.5)
        if _WINDOW.search(source) and re.search(r"max\s*\(|min\s*\(|\bbest\b|\blength\b", source):
            bump("sliding_window", 2.5)

    if _QUEUE.search(source):
        bump("bfs", 2.5)
        if _GRID_DIRS.search(source):
            bump("bfs", 1.5)

    if model.has_recursion:
        if model.has_memoization:
            bump("dp_memoised", 3.0)
        else:
            bump("dfs", 2.0)
        if _GRID_DIRS.search(source):
            bump("dfs", 1.5)

    if _DP_TABLE.search(source) and model.loops and not model.has_recursion:
        bump("dp_bottom_up", 3.0)

    if _UNION_FIND.search(source) and re.search(r"\bparent\b", source):
        bump("union_find", 2.5)

    if _HEAP.search(source):
        bump("heap", 3.0)

    if _PREFIX.search(source) and single_loop:
        bump("prefix_aggregate", 1.8)

    if _FREQ.search(source) and has_hash:
        bump("frequency_count", 2.0)

    if has_hash and single_loop:
        bump("hash_lookup", 1.8)

    if _STACK.search(source) and re.search(r"\bpop\(\)", source) and not _QUEUE.search(source):
        bump("dfs", 1.0)

    # Nested loops with no recognisable structure is the brute force we most
    # want to detect — it is the trigger for the Complexity Agent.
    if nested_loops and not scores:
        bump("brute_force_pairs", 2.0)
    elif nested_loops:
        bump("brute_force_pairs", 0.5)

    if single_loop and not scores:
        bump("linear_scan", 1.2)

    if not scores:
        return None

    best = max(scores.items(), key=lambda kv: kv[1])
    return best[0] if best[1] >= 1.5 else None


def label_for(key: str | None) -> str | None:
    return FINGERPRINT_LABELS.get(key) if key else None
