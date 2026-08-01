"""Static rules — the free half of "the AI reviews your code".

Every finding here is deterministic and costs nothing, so these render as
Monaco squiggles on every 2-second tick without any LLM involvement. Rules are
deliberately conservative: a false positive from a rule feels like a bug in the
platform, whereas a missed one is merely a missed opportunity.
"""

from __future__ import annotations

import re

from app.analysis.model import CodeModel, Span
from app.schemas import Finding, Range, Severity

_KEYWORDS = {
    "if", "else", "elif", "for", "while", "return", "def", "class", "import", "from",
    "in", "is", "not", "and", "or", "true", "false", "none", "null", "new", "int",
    "float", "str", "bool", "void", "public", "private", "static", "const", "let",
    "var", "function", "print", "len", "range", "self", "this", "break", "continue",
    "pass", "try", "except", "catch", "finally", "throw", "raise", "with", "as",
}

_ASSIGN_RE = re.compile(r"^\s*([A-Za-z_]\w*)\s*(?::[^=]+)?=(?!=)")
_DECLARE_RE = re.compile(r"^\s*(?:let|const|var|int|float|double|long|String|bool|auto)\s+([A-Za-z_]\w*)\s*=")
_TODO_RE = re.compile(r"#\s*(Write your code here|TODO)|//\s*(Write your code here|TODO)", re.IGNORECASE)


def _to_range(span: Span) -> Range:
    return Range(
        startLine=span.start_line,
        startColumn=span.start_col,
        endLine=span.end_line,
        endColumn=span.end_col,
    )


def run_rules(model: CodeModel) -> list[Finding]:
    findings: list[Finding] = []
    lines = model.source.split("\n")

    findings.extend(_syntax_errors(model))
    findings.extend(_unused_variables(model, lines))
    findings.extend(_missing_return(model))
    findings.extend(_infinite_loop(model, lines))
    findings.extend(_off_by_one(model, lines))
    findings.extend(_unfilled_stub(lines))
    findings.extend(_linear_membership_in_loop(model, lines))

    # Cap the list: a wall of squiggles is noise, and the top few are the ones
    # a mentor would actually mention.
    return findings[:14]


def _syntax_errors(model: CodeModel) -> list[Finding]:
    return [
        Finding(
            rule="syntax_error",
            message="This part doesn't parse yet — check for a missing bracket, colon or quote.",
            severity=Severity.ERROR,
            range=_to_range(span),
        )
        for span in model.error_spans[:3]
    ]


def _unused_variables(model: CodeModel, lines: list[str]) -> list[Finding]:
    findings: list[Finding] = []
    seen: set[str] = set()

    for index, raw in enumerate(lines):
        line = raw.split("#")[0].split("//")[0]
        match = _ASSIGN_RE.match(line) or _DECLARE_RE.match(line)
        if not match:
            continue
        name = match.group(1)
        if name in _KEYWORDS or name.startswith("_") or len(name) <= 1 or name in seen:
            continue
        seen.add(name)

        # Count uses anywhere other than this assignment's left-hand side.
        uses = 0
        for other_index, other in enumerate(lines):
            if other_index == index:
                # A compound assignment (x += 1) still counts as a use.
                if re.search(rf"\b{re.escape(name)}\b", other.split("=", 1)[1] if "=" in other else ""):
                    uses += 1
                continue
            uses += len(re.findall(rf"\b{re.escape(name)}\b", other))

        if uses == 0:
            findings.append(
                Finding(
                    rule="unused_variable",
                    message=f"'{name}' is assigned but never used.",
                    severity=Severity.INFO,
                    range=Range(
                        startLine=index,
                        startColumn=len(raw) - len(raw.lstrip()),
                        endLine=index,
                        endColumn=len(raw),
                    ),
                    symbol=name,
                )
            )
    return findings[:5]


def _missing_return(model: CodeModel) -> list[Finding]:
    findings: list[Finding] = []
    for fn in model.functions:
        if fn.name.startswith("_") or fn.name in {"main", "_main", "<anonymous>"}:
            continue
        if fn.has_return:
            continue
        body_lines = fn.span.end_line - fn.span.start_line
        if body_lines < 1:
            continue
        findings.append(
            Finding(
                rule="missing_return",
                message=f"'{fn.name}' never returns a value — the judge reads what you return.",
                severity=Severity.WARNING,
                range=Range(
                    startLine=fn.span.start_line,
                    startColumn=0,
                    endLine=fn.span.start_line,
                    endColumn=80,
                ),
                symbol=fn.name,
            )
        )
    return findings[:3]


def _infinite_loop(model: CodeModel, lines: list[str]) -> list[Finding]:
    """`while` whose condition variables are never modified inside the body.

    Restricted to while-loops with a simple identifier condition, because that
    is the case where we can be confident rather than merely suspicious.
    """
    findings: list[Finding] = []
    for loop in model.loops:
        if loop.kind != "while":
            continue
        start = loop.span.start_line
        header = lines[start] if 0 <= start < len(lines) else ""
        condition = header.split("while", 1)[-1].strip().rstrip(":{ ")
        names = [n for n in re.findall(r"[A-Za-z_]\w*", condition) if n not in _KEYWORDS]
        if not names:
            continue

        end = loop.span.end_line if loop.span.end_line > start else min(len(lines) - 1, start + 12)
        body = "\n".join(lines[start + 1 : end + 1])
        if not body.strip():
            continue

        mutated = any(
            re.search(rf"\b{re.escape(name)}\s*(=[^=]|\+\+|--|\+=|-=|\*=|/=|//=|>>=)", body)
            or re.search(rf"\b{re.escape(name)}\s*,\s*\w+\s*=", body)
            for name in names
        )
        has_exit = re.search(r"\b(break|return)\b", body) is not None
        if not mutated and not has_exit:
            findings.append(
                Finding(
                    rule="possible_infinite_loop",
                    message=(
                        f"Nothing in this loop changes {', '.join(names[:2])}, and there's no "
                        "break — it may never terminate."
                    ),
                    severity=Severity.WARNING,
                    range=Range(startLine=start, startColumn=0, endLine=start, endColumn=len(header)),
                )
            )
    return findings[:2]


def _off_by_one(model: CodeModel, lines: list[str]) -> list[Finding]:
    findings: list[Finding] = []
    for index, raw in enumerate(lines):
        line = raw.split("#")[0].split("//")[0]
        # `for i in range(len(x))` then `x[i + 1]` inside — a classic.
        if re.search(r"range\s*\(\s*len\s*\(\s*(\w+)\s*\)\s*\)", line):
            name = re.search(r"range\s*\(\s*len\s*\(\s*(\w+)\s*\)\s*\)", line)
            target = name.group(1) if name else ""
            window = "\n".join(lines[index : index + 6])
            if target and re.search(rf"{re.escape(target)}\s*\[\s*\w+\s*\+\s*1\s*\]", window):
                findings.append(
                    Finding(
                        rule="suspicious_bounds",
                        message=(
                            f"You index {target}[i + 1] while i runs to len({target}) - 1 — "
                            "the last iteration will go out of range."
                        ),
                        severity=Severity.WARNING,
                        range=Range(startLine=index, startColumn=0, endLine=index, endColumn=len(raw)),
                    )
                )
        if re.search(r"<=\s*len\s*\(", line) or re.search(r"<=\s*\w+\.length\b", line):
            findings.append(
                Finding(
                    rule="suspicious_bounds",
                    message="Comparing with <= length will run one index past the end.",
                    severity=Severity.WARNING,
                    range=Range(startLine=index, startColumn=0, endLine=index, endColumn=len(raw)),
                )
            )
    return findings[:3]


def _unfilled_stub(lines: list[str]) -> list[Finding]:
    for index, raw in enumerate(lines):
        if _TODO_RE.search(raw):
            return [
                Finding(
                    rule="unfilled_stub",
                    message="This is still the starter stub — the solution goes here.",
                    severity=Severity.INFO,
                    range=Range(startLine=index, startColumn=0, endLine=index, endColumn=len(raw)),
                )
            ]
    return []


def _linear_membership_in_loop(model: CodeModel, lines: list[str]) -> list[Finding]:
    """`x in some_list` inside a loop — the hidden quadratic students write most.

    It never *looks* like a nested loop, which is exactly why it's worth
    surfacing structurally rather than hoping the learner spots it.
    """
    if not model.loops:
        return []
    findings: list[Finding] = []
    for index, raw in enumerate(lines):
        line = raw.split("#")[0].split("//")[0]
        if not re.search(r"\bin\s+\w*(list|nums|arr|array|values|items)\w*\b", line, re.IGNORECASE):
            continue
        inside_loop = any(
            loop.span.start_line <= index <= max(loop.span.end_line, loop.span.start_line + 20)
            for loop in model.loops
        )
        if inside_loop:
            findings.append(
                Finding(
                    rule="linear_membership_in_loop",
                    message=(
                        "Membership testing against a list is O(n) — inside a loop that makes the "
                        "whole thing quadratic. A set answers the same question in O(1)."
                    ),
                    severity=Severity.INFO,
                    range=Range(startLine=index, startColumn=0, endLine=index, endColumn=len(raw)),
                )
            )
    return findings[:2]
