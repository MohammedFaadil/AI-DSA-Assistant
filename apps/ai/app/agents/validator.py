"""The Response Guard.

This is what makes "never gives away the solution" a property of the SYSTEM
rather than a hope about the prompt. Every agent output passes through here
before it can reach a learner, and a rejection re-routes through the Planner
with the violation attached.

Checks run cheapest-first so a malformed response costs almost nothing.
"""

from __future__ import annotations

import re

from app.agents.fingerprint import fingerprint, similarity
from app.core.config import settings
from app.schemas import (
    AgentResponse,
    CodeBlock,
    ContextEnvelope,
    GuardViolation,
    HintBlock,
)

# Naming the technique IS the level-3 hint. A level-1 hint that says "use a hash
# map" is a level-3 hint wearing a disguise, so the lexicon is checked directly.
ALGORITHM_LEXICON = [
    "hash map", "hashmap", "hash table", "hashtable", "dictionary",
    "two pointer", "two-pointer", "sliding window",
    "binary search", "breadth-first", "depth-first", "bfs", "dfs",
    "dynamic programming", "memoi", "memoiz", "kadane", "union find", "union-find",
    "disjoint set", "topological sort", "dijkstra", "prefix sum", "monotonic stack",
    "priority queue", "min heap", "max heap", "backtracking", "greedy",
]

_UNSAFE = [
    re.compile(r"\b(rm\s+-rf|curl\s+http|wget\s+http|os\.system|subprocess\.)", re.IGNORECASE),
    re.compile(r"\b(exfiltrat|reverse shell|nc\s+-e)\b", re.IGNORECASE),
]


class GuardVerdict:
    def __init__(self, passed: bool, violations: list[GuardViolation]) -> None:
        self.passed = passed
        self.violations = violations

    @property
    def reason(self) -> str:
        return "; ".join(f"{v.rule}: {v.detail}" for v in self.violations)


def validate(response: AgentResponse, envelope: ContextEnvelope) -> GuardVerdict:
    violations: list[GuardViolation] = []
    policy = envelope.policy

    code_blocks = [b for b in response.blocks if isinstance(b, CodeBlock)]
    hint_blocks = [b for b in response.blocks if isinstance(b, HintBlock)]

    # 1 — schema-adjacent sanity (Pydantic already validated shape).
    if not response.blocks:
        violations.append(GuardViolation(rule="SCHEMA", detail="empty response"))

    # 2 — line budget.
    for block in code_blocks:
        lines = [line for line in block.content.split("\n") if line.strip()]
        if len(lines) > policy.maxCodeLines:
            violations.append(
                GuardViolation(
                    rule="LINE_BUDGET",
                    detail=(
                        f"code block has {len(lines)} lines, budget is "
                        f"{policy.maxCodeLines} in {envelope.assistMode.value} mode"
                    ),
                )
            )

    if code_blocks and not policy.mayWriteSolutionCode:
        joined = "\n".join(b.content for b in code_blocks)
        # A complete function definition is a solution, not an illustration.
        if re.search(r"^\s*(def|function|public\s+\w+|int|void)\s+\w+\s*\(", joined, re.MULTILINE):
            if len([line for line in joined.split("\n") if line.strip()]) > policy.maxCodeLines:
                violations.append(
                    GuardViolation(
                        rule="POLICY_FIDELITY",
                        detail="response defines a complete function while solution code is disallowed",
                    )
                )

    # 3 — hint-level fidelity.
    if not policy.mayRevealAlgorithmName:
        text = " ".join(_block_text(b) for b in response.blocks).lower()
        named = [term for term in ALGORITHM_LEXICON if term in text]
        if named:
            violations.append(
                GuardViolation(
                    rule="HINT_LEVEL_FIDELITY",
                    detail=f"names the technique ({named[0]}) before the hint level allows it",
                )
            )

    for block in hint_blocks:
        if policy.hintLevel is not None and block.level > policy.hintLevel + 1:
            violations.append(
                GuardViolation(
                    rule="HINT_LEVEL_FIDELITY",
                    detail=f"emitted level {block.level} when level {policy.hintLevel} was requested",
                )
            )

    # 4 — solution similarity. The reference solution never enters a prompt;
    # only its fingerprint is compared here, locally.
    if envelope.solutionFingerprint and not envelope.solved and code_blocks:
        proposed = fingerprint("\n".join(b.content for b in code_blocks))
        score = similarity(proposed, envelope.solutionFingerprint)
        if score >= settings.solution_similarity_threshold:
            violations.append(
                GuardViolation(
                    rule="SOLUTION_SIMILARITY",
                    detail=f"proposed code is {score:.0%} similar to the official solution",
                )
            )

    # 5 — safety.
    blob = " ".join(_block_text(b) for b in response.blocks)
    if any(pattern.search(blob) for pattern in _UNSAFE):
        violations.append(GuardViolation(rule="SAFETY", detail="response contains unsafe instructions"))

    return GuardVerdict(passed=not violations, violations=violations)


def _block_text(block: object) -> str:
    for attribute in ("content", "message", "explanation"):
        value = getattr(block, attribute, None)
        if isinstance(value, str):
            return value
    return ""
