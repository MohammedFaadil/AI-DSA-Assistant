"""Assembles SessionSignals — the complete Stage-1 output.

Everything in here is deterministic and runs in single-digit milliseconds. No
network call, no inference. This is the "understanding" half of the mentor, and
it is free, which is precisely why it can run every two seconds.
"""

from __future__ import annotations

import difflib
import re
import time

from app.analysis import algorithms, complexity, rules
from app.analysis.model import CodeModel
from app.analysis.parser import parse
from app.schemas import (
    AnalyzeRequest,
    DiffSummary,
    FunctionInfo,
    Range,
    SessionSignals,
)

_STUB_RE = re.compile(r"Write your code here|^\s*pass\s*$", re.MULTILINE | re.IGNORECASE)


def build_signals(request: AnalyzeRequest) -> tuple[SessionSignals, CodeModel, float]:
    started = time.perf_counter()

    cursor_line = request.cursor.line if request.cursor else None
    model = parse(request.language.value, request.code, cursor_line)

    inferred_time, inferred_space, confidence = complexity.estimate(model)
    fingerprint = algorithms.fingerprint(model)
    findings = rules.run_rules(model)
    diff = _semantic_diff(request.previousCode, request.code, model)
    behaviour = request.behaviour

    total_keys = behaviour.charsTyped + behaviour.backspaces
    backspace_ratio = round(behaviour.backspaces / total_keys, 3) if total_keys else 0.0
    elapsed_min = max(behaviour.elapsedMs / 60_000, 0.01)
    edit_velocity = round(behaviour.charsTyped / elapsed_min, 1)

    signals = SessionSignals(
        parseOk=model.parse_ok,
        errorRanges=[
            Range(
                startLine=s.start_line,
                startColumn=s.start_col,
                endLine=s.end_line,
                endColumn=s.end_col,
            )
            for s in model.error_spans[:5]
        ],
        currentFunction=model.cursor_function,
        scopeChain=model.scope_chain,
        cursorNodeKind=model.cursor_node_kind,
        functions=[
            FunctionInfo(
                name=fn.name,
                startLine=fn.span.start_line,
                endLine=fn.span.end_line,
                paramCount=fn.param_count,
                hasReturn=fn.has_return,
                loopDepth=fn.max_loop_depth,
                isRecursive=fn.is_recursive,
            )
            for fn in model.functions[:12]
        ],
        dataStructures=model.data_structures,
        lineCount=model.line_count,
        maxLoopDepth=model.max_loop_depth,
        hasRecursion=model.has_recursion,
        hasMemoization=model.has_memoization,
        branchCount=model.branch_count,
        findings=findings,
        inferredTime=inferred_time,
        inferredSpace=inferred_space,
        complexityConfidence=confidence,
        algorithmFingerprint=fingerprint,
        matchesExpectedBand=complexity.within_expected(inferred_time, request.expectedTime),
        semanticDiff=diff,
        idleMs=behaviour.idleMs,
        editVelocity=edit_velocity,
        backspaceRatio=backspace_ratio,
        thrashScore=_thrash_score(backspace_ratio, diff, behaviour.editCount),
        dwellLine=behaviour.dwellLine,
        progressEstimate=_progress(model, request.code, findings),
    )

    elapsed_ms = (time.perf_counter() - started) * 1000
    return signals, model, elapsed_ms


def _semantic_diff(previous: str | None, current: str, model: CodeModel) -> DiffSummary:
    """What actually changed since the last tick — not a character diff.

    `addedCorrectStructure` is what drives the MILESTONE trigger: it fires when
    the learner adds real structure (a loop, a base case, a return) rather than
    when they merely typed something.
    """
    if not previous:
        return DiffSummary(changedLines=current.count("\n") + 1 if current.strip() else 0)

    previous_lines = previous.split("\n")
    current_lines = current.split("\n")
    matcher = difflib.SequenceMatcher(None, previous_lines, current_lines)

    changed = 0
    added_text: list[str] = []
    removed = 0
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        changed += max(i2 - i1, j2 - j1)
        if tag in {"insert", "replace"}:
            added_text.extend(current_lines[j1:j2])
        if tag in {"delete", "replace"}:
            removed += i2 - i1

    added_blob = "\n".join(added_text)
    structural = bool(
        re.search(r"\b(for|while|if|return|def|function|class)\b", added_blob)
    ) and not _STUB_RE.search(added_blob)

    touched = [
        fn.name
        for fn in model.functions
        if any(
            fn.span.start_line <= idx <= fn.span.end_line
            for idx, line in enumerate(current_lines)
            if line in added_text
        )
    ]

    return DiffSummary(
        changedLines=changed,
        addedNodes=len([line for line in added_text if line.strip()]),
        removedNodes=removed,
        addedCorrectStructure=structural,
        touchedFunctions=touched[:5],
    )


def _thrash_score(backspace_ratio: float, diff: DiffSummary, edit_count: int) -> float:
    """Rewriting the same region repeatedly without adding structure.

    High deletion ratio plus churn without new structure is the signature of a
    learner going in circles — which is a different problem from being stuck,
    and deserves a different intervention (Tutor, not Hint).
    """
    if edit_count < 4:
        return 0.0
    score = 0.0
    if backspace_ratio > 0.35:
        score += 0.45
    if backspace_ratio > 0.55:
        score += 0.25
    if diff.changedLines > 0 and not diff.addedCorrectStructure:
        score += 0.25
    if diff.removedNodes > diff.addedNodes:
        score += 0.15
    return round(min(1.0, score), 2)


def _progress(model: CodeModel, code: str, findings: list) -> float:
    """A rough 0–1 completeness estimate.

    Used only to decide whether "stuck" is plausible — a learner idling on a
    finished solution is thinking, not stuck, and should be left alone.
    """
    if not code.strip():
        return 0.0
    if _STUB_RE.search(code) and model.max_loop_depth == 0 and not model.has_recursion:
        return 0.05

    score = 0.15
    if model.functions:
        score += 0.15
    if any(fn.has_return for fn in model.functions):
        score += 0.25
    if model.max_loop_depth > 0 or model.has_recursion:
        score += 0.2
    if model.data_structures:
        score += 0.1
    if model.branch_count > 0:
        score += 0.1
    if model.parse_ok:
        score += 0.1
    if any(f.severity.value == "ERROR" for f in findings):
        score -= 0.25
    return round(max(0.0, min(1.0, score)), 2)
