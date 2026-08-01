"""Code-quality scoring — the engine behind the live strength bar.

Design constraints that shaped this:

  1. It must be DETERMINISTIC. The bar updates on every 2-second tick, so it
     cannot cost an LLM call. Everything here is computed from the code model.
  2. It must be STABLE. A score that jitters while you type is noise, not
     signal — so partial code is scored against what it *is*, not penalised for
     what it has not become yet.
  3. It must be HONEST. The score is a weighted rollup of named dimensions, and
     the UI shows those dimensions. A single opaque number nobody can act on is
     worse than no number.

Scores are 0–100 per dimension. The overall score is a weighted mean, but
correctness-blocking problems (a syntax error, a non-terminating loop) clamp the
ceiling — because "beautifully named code that does not run" is not strong code.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.analysis import complexity as complexity_mod
from app.analysis.model import CodeModel
from app.schemas import Finding, QualityDimension, QualityReport, Severity

# Weights sum to 1.0. Correctness dominates because it is the only dimension a
# learner cannot trade away.
WEIGHTS: dict[str, float] = {
    "correctness": 0.34,
    "efficiency": 0.26,
    "readability": 0.16,
    "robustness": 0.14,
    "structure": 0.10,
}

# Names that carry no meaning. `i`/`j`/`k` are excluded on purpose — they are
# idiomatic loop counters, and flagging them is the kind of pedantry that makes
# a tool feel wrong.
VAGUE_NAMES = {
    "a", "b", "c", "d", "e", "f", "x", "y", "z", "t", "tmp", "temp", "foo",
    "bar", "baz", "val", "val1", "val2", "arr2", "data1", "thing", "stuff",
    "aa", "bb", "xx", "yy", "num1", "num2", "res1", "res2",
}

_ASSIGN = re.compile(r"^\s*(?:let|const|var|int|float|double|long|String|bool|auto)?\s*([A-Za-z_]\w*)\s*(?::[^=]+)?=(?!=)")
_MAGIC_NUMBER = re.compile(r"(?<![\w.])(?!0|1|2|-1)\d{2,}(?![\w.])")
_STUB = re.compile(r"Write your code here|^\s*pass\s*$|TODO", re.IGNORECASE | re.MULTILINE)
_EDGE_GUARDS = re.compile(
    r"if\s+not\s+\w+|if\s+len\s*\(\s*\w+\s*\)\s*==\s*0|\.empty\(\)|"
    r"==\s*null|is\s+None|\.length\s*===?\s*0|if\s*\(\s*!\w+\s*\)",
    re.IGNORECASE,
)
_COMMENT = re.compile(r"^\s*(#|//|/\*|\*)")


@dataclass
class _Dimension:
    key: str
    label: str
    score: float
    notes: list[str] = field(default_factory=list)


def score(model: CodeModel, findings: list[Finding], expected_time: str) -> QualityReport:
    """Returns a QualityReport with an overall score and per-dimension detail."""
    source = model.source
    lines = [line for line in source.split("\n")]
    code_lines = [line for line in lines if line.strip() and not _COMMENT.match(line)]

    # An empty or stub-only buffer has no quality to measure. Reporting 0 would
    # be accurate but useless; reporting `measurable=False` lets the UI show a
    # neutral state instead of a red bar that feels like failure.
    if not code_lines or (_STUB.search(source) and model.max_loop_depth == 0 and not model.has_recursion):
        return QualityReport(
            overall=0,
            measurable=False,
            grade="—",
            headline="Start writing and the strength meter will track your code.",
            dimensions=[],
            topFix=None,
        )

    dimensions = [
        _correctness(model, findings),
        _efficiency(model, expected_time),
        _readability(model, lines, code_lines),
        _robustness(model, source, findings),
        _structure(model, code_lines),
    ]

    overall = sum(d.score * WEIGHTS[d.key] for d in dimensions)

    # Hard ceilings. These are correctness blockers: no amount of elegance
    # compensates for code that cannot run or cannot terminate.
    blocking = [f for f in findings if f.severity is Severity.ERROR]
    if blocking:
        overall = min(overall, 42)
    if any(f.rule == "possible_infinite_loop" for f in findings):
        overall = min(overall, 55)
    if not model.parse_ok:
        overall = min(overall, 48)

    overall_int = int(round(max(0, min(100, overall))))
    weakest = min(dimensions, key=lambda d: d.score)

    return QualityReport(
        overall=overall_int,
        measurable=True,
        grade=_grade(overall_int),
        headline=_headline(overall_int, weakest, blocking),
        dimensions=[
            QualityDimension(
                key=d.key,
                label=d.label,
                score=int(round(d.score)),
                weight=WEIGHTS[d.key],
                notes=d.notes[:3],
            )
            for d in dimensions
        ],
        topFix=weakest.notes[0] if weakest.notes and weakest.score < 80 else None,
    )


# ── dimensions ───────────────────────────────────────────────────────────


def _correctness(model: CodeModel, findings: list[Finding]) -> _Dimension:
    notes: list[str] = []
    value = 100.0

    if not model.parse_ok:
        value -= 45
        notes.append("The code does not parse yet — check for an unclosed bracket or a missing colon.")

    errors = [f for f in findings if f.severity is Severity.ERROR]
    for finding in errors[:2]:
        value -= 20
        notes.append(f"Line {finding.range.startLine + 1}: {finding.message}")

    missing_return = [f for f in findings if f.rule == "missing_return"]
    if missing_return:
        value -= 22
        notes.append("A solution function never returns a value — the judge reads your return.")

    bounds = [f for f in findings if f.rule == "suspicious_bounds"]
    if bounds:
        value -= 14
        notes.append(bounds[0].message)

    if not model.functions:
        value -= 10
        notes.append("No function defined yet.")

    return _Dimension("correctness", "Correctness", max(0.0, value), notes)


def _efficiency(model: CodeModel, expected_time: str) -> _Dimension:
    notes: list[str] = []
    inferred, _space, confidence = complexity_mod.estimate(model)

    inferred_rank = complexity_mod.rank_of(inferred)
    expected_rank = complexity_mod.rank_of(expected_time)
    gap = inferred_rank - expected_rank

    if gap <= 0:
        value = 100.0
        if gap < 0:
            notes.append(f"{inferred} — better than the expected {expected_time}.")
    else:
        # Each complexity class you are above expectation costs ~22 points.
        value = max(10.0, 100.0 - gap * 22.0)
        notes.append(
            f"Your approach looks like {inferred}; the constraints point at {expected_time}."
        )

    # Low confidence should not produce a confident penalty.
    if confidence < 0.6 and gap > 0:
        value = (value + 75.0) / 2
        notes.append("Low-confidence estimate — the structure is still changing.")

    if re.search(r"\bin\s+\w*(list|nums|arr|array)\w*\b", model.source, re.IGNORECASE) and model.loops:
        value = min(value, 62.0)
        notes.append("Membership testing a list inside a loop is a hidden O(n²). A set is O(1).")

    if model.has_recursion and not model.has_memoization and model.branch_count >= 2:
        value = min(value, 58.0)
        notes.append("Branching recursion without memoisation recomputes the same subproblems.")

    return _Dimension("efficiency", "Efficiency", max(0.0, min(100.0, value)), notes)


def _readability(model: CodeModel, lines: list[str], code_lines: list[str]) -> _Dimension:
    notes: list[str] = []
    value = 100.0

    # Vague identifiers.
    assigned: list[str] = []
    for raw in lines:
        match = _ASSIGN.match(raw.split("#")[0].split("//")[0])
        if match:
            assigned.append(match.group(1))
    vague = sorted({name for name in assigned if name.lower() in VAGUE_NAMES})
    if vague:
        value -= min(24, 8 * len(vague))
        notes.append(
            f"Rename {', '.join(f'`{v}`' for v in vague[:3])} to say what it holds."
        )

    # Long lines.
    long_lines = [i + 1 for i, raw in enumerate(lines) if len(raw.rstrip()) > 100]
    if long_lines:
        value -= min(12, 4 * len(long_lines))
        notes.append(f"Line {long_lines[0]} is over 100 characters — hard to scan.")

    # Deep nesting is a readability problem before it is a performance one.
    max_indent = max((len(raw) - len(raw.lstrip())) for raw in code_lines) if code_lines else 0
    if max_indent >= 20:
        value -= 16
        notes.append("Nesting is 5+ levels deep. An early return or a helper would flatten it.")
    elif max_indent >= 16:
        value -= 8

    # Magic numbers.
    magic = [
        i + 1
        for i, raw in enumerate(lines)
        if not _COMMENT.match(raw) and _MAGIC_NUMBER.search(raw.split("#")[0].split("//")[0])
    ]
    if len(magic) >= 2:
        value -= 8
        notes.append(f"Unexplained constants on line {magic[0]} — name them.")

    # Very long functions.
    for fn in model.functions:
        length = fn.span.end_line - fn.span.start_line
        if length > 45:
            value -= 12
            notes.append(f"`{fn.name}` is {length} lines. Consider splitting it.")
            break

    return _Dimension("readability", "Readability", max(0.0, min(100.0, value)), notes)


def _robustness(model: CodeModel, source: str, findings: list[Finding]) -> _Dimension:
    notes: list[str] = []
    value = 88.0  # start below full: proving robustness requires evidence

    if _EDGE_GUARDS.search(source):
        value += 12
    else:
        notes.append("No empty-input guard. What does your code do with an empty collection?")

    unused = [f for f in findings if f.rule == "unused_variable"]
    if unused:
        value -= min(18, 9 * len(unused))
        notes.append(f"`{unused[0].symbol}` is assigned but never used — dead weight or a bug.")

    if any(f.rule == "possible_infinite_loop" for f in findings):
        value -= 40
        notes.append("A loop may never terminate.")

    if any(f.rule == "possible_null_deref" for f in findings):
        value -= 15

    # Indexing without a bounds check is the most common runtime error here.
    if re.search(r"\[\s*\w+\s*[-+]\s*1\s*\]", source) and not _EDGE_GUARDS.search(source):
        value -= 10
        notes.append("You index with an offset but never check the bound.")

    return _Dimension("robustness", "Robustness", max(0.0, min(100.0, value)), notes)


def _structure(model: CodeModel, code_lines: list[str]) -> _Dimension:
    notes: list[str] = []
    value = 100.0

    if not model.functions:
        value -= 30
        notes.append("Code is not organised into a function.")

    for fn in model.functions:
        if fn.param_count > 5:
            value -= 12
            notes.append(f"`{fn.name}` takes {fn.param_count} parameters — group them.")
            break

    # Duplicated non-trivial lines suggest copy-paste rather than a loop/helper.
    meaningful = [line.strip() for line in code_lines if len(line.strip()) > 24]
    duplicates = len(meaningful) - len(set(meaningful))
    if duplicates >= 2:
        value -= min(20, 7 * duplicates)
        notes.append(f"{duplicates} duplicated lines — extract a helper or loop.")

    if model.max_loop_depth >= 3:
        value -= 12
        notes.append("Three levels of loop nesting is hard to reason about.")

    if model.data_structures:
        value = min(100.0, value + 6)

    return _Dimension("structure", "Structure", max(0.0, min(100.0, value)), notes)


# ── presentation ─────────────────────────────────────────────────────────


def _grade(overall: int) -> str:
    if overall >= 90:
        return "A"
    if overall >= 80:
        return "B"
    if overall >= 68:
        return "C"
    if overall >= 55:
        return "D"
    return "E"


def _headline(overall: int, weakest: _Dimension, blocking: list[Finding]) -> str:
    if blocking:
        return "Fix the error first — everything else is downstream of running code."
    if overall >= 90:
        return "Strong on every axis. This is submission quality."
    if overall >= 80:
        return f"Solid. {weakest.label.lower()} is the weakest link."
    if overall >= 68:
        return f"Working, but {weakest.label.lower()} needs attention."
    if overall >= 55:
        return f"On the right track — {weakest.label.lower()} is holding it back."
    return "Early days. Keep going."
