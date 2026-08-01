"""Line-by-line review.

Powers the workspace's "explain what I'm writing" mode: a per-line annotation
saying what the line *does*, what it *costs*, and whether it could be better.

Entirely deterministic, so it can be toggled on and stay live on every tick
without spending inference. When a model provider is available the API can
optionally enrich a single selected line via the Tutor agent, but the baseline
here is what makes the feature always work.

The tone rule: describe the line in terms of the learner's own identifiers, and
only suggest a change when there is a concrete, defensible one. Annotating every
line with filler teaches nothing and trains people to ignore the gutter.
"""

from __future__ import annotations

import re

from app.analysis.model import CodeModel
from app.schemas import LineNote, LineReview, LineRole

_FUNC = re.compile(r"^\s*(?:def|function|fn|func)\s+(\w+)\s*\(([^)]*)\)|^\s*(?:public|private|static|\s)*[\w<>\[\]]+\s+(\w+)\s*\(([^)]*)\)\s*\{")
_FOR = re.compile(r"^\s*for\b")
_WHILE = re.compile(r"^\s*while\b")
_IF = re.compile(r"^\s*(?:if|elif|else\s+if)\b")
_ELSE = re.compile(r"^\s*else\b")
_RETURN = re.compile(r"^\s*return\b")
_ASSIGN = re.compile(r"^\s*(?:let|const|var|int|float|double|long|String|bool|auto)?\s*([A-Za-z_]\w*)\s*(?::[^=]+)?=(?!=)\s*(.+)$")
_AUGMENT = re.compile(r"^\s*([A-Za-z_]\w*)\s*(\+=|-=|\*=|/=|//=|\|=|&=)\s*(.+)$")
_COMMENT = re.compile(r"^\s*(#|//|/\*|\*/|\*)")
_BREAK = re.compile(r"^\s*(break|continue)\b")

_HASH_LITERAL = re.compile(r"\{\s*\}|dict\s*\(|set\s*\(|defaultdict|Counter|new Map|new Set|HashMap|HashSet|unordered_map|unordered_set")
_LIST_LITERAL = re.compile(r"\[\s*\]|list\s*\(|new ArrayList|vector<|\[\s*0\s*\]\s*\*")
_QUEUE_LITERAL = re.compile(r"deque\s*\(|Queue\s*\(|LinkedList|queue<")
_HEAP_LITERAL = re.compile(r"heapq|heappush|PriorityQueue|priority_queue")

_LINEAR_MEMBERSHIP = re.compile(r"\bin\s+(\w*(?:list|nums|arr|array|values|items|words|prices)\w*)\b", re.IGNORECASE)
_INDEX_OFFSET = re.compile(r"(\w+)\s*\[\s*\w+\s*\+\s*1\s*\]")
_RANGE_LEN = re.compile(r"range\s*\(\s*len\s*\(\s*(\w+)\s*\)\s*\)")
_MIN_MAX = re.compile(r"\b(min|max)\s*\(")
_SORT = re.compile(r"\.sort\s*\(|\bsorted\s*\(|Arrays\.sort|std::sort")
_HALVING = re.compile(r"//\s*2|/\s*2|>>\s*1|\bmid\b")


def review(model: CodeModel, expected_time: str, max_notes: int = 60) -> LineReview:
    lines = model.source.split("\n")
    notes: list[LineNote] = []

    # Loop nesting per line, so a note can state the real cost contribution.
    depth_at: dict[int, int] = {}
    for loop in model.loops:
        for line_no in range(loop.span.start_line, max(loop.span.end_line, loop.span.start_line) + 1):
            depth_at[line_no] = max(depth_at.get(line_no, 0), loop.depth)

    known_structures: dict[str, str] = {}

    for index, raw in enumerate(lines):
        stripped = raw.strip()
        if not stripped or _COMMENT.match(raw):
            continue

        note = _classify(raw, stripped, index, depth_at, known_structures, model, expected_time)
        if note:
            notes.append(note)
        if len(notes) >= max_notes:
            break

    improvable = sum(1 for n in notes if n.role in (LineRole.IMPROVE, LineRole.RISK))
    return LineReview(
        notes=notes,
        annotatedLines=len(notes),
        improvableLines=improvable,
        summary=_summary(notes, improvable),
    )


def _classify(
    raw: str,
    stripped: str,
    index: int,
    depth_at: dict[int, int],
    known: dict[str, str],
    model: CodeModel,
    expected_time: str,
) -> LineNote | None:
    def note(role: LineRole, what: str, why: str | None = None, fix: str | None = None) -> LineNote:
        return LineNote(line=index, role=role, what=what, why=why, fix=fix)

    # ── risks first: these matter more than description ──────────────────
    membership = _LINEAR_MEMBERSHIP.search(stripped)
    if membership and depth_at.get(index, 0) >= 1:
        target = membership.group(1)
        return note(
            LineRole.RISK,
            f"Searches `{target}` for a value on every iteration.",
            "Scanning a list is O(n); doing it inside a loop makes the whole thing O(n²).",
            f"Keep a `set` alongside `{target}` and test membership against that instead — O(1).",
        )

    offset = _INDEX_OFFSET.search(stripped)
    if offset:
        return note(
            LineRole.RISK,
            f"Reads `{offset.group(1)}` one position ahead.",
            "On the final iteration that index is past the end of the collection.",
            "Stop the loop one step early, or guard the access.",
        )

    # ── structure ────────────────────────────────────────────────────────
    func = _FUNC.match(raw)
    if func:
        name = func.group(1) or func.group(3) or "function"
        params = (func.group(2) or func.group(4) or "").strip()
        count = len([p for p in params.split(",") if p.strip() and p.strip() != "self"])
        return note(
            LineRole.NEUTRAL,
            f"Defines `{name}` taking {count} input{'' if count == 1 else 's'}.",
            "This is the function the judge calls with each test case.",
        )

    if _FOR.match(stripped) or _WHILE.match(stripped):
        depth = depth_at.get(index, 1)
        halving = bool(_HALVING.search(stripped))
        range_len = _RANGE_LEN.search(stripped)

        if halving:
            return note(
                LineRole.GOOD,
                "Halves the search space each pass.",
                "That is logarithmic — O(log n) rather than O(n).",
            )
        if depth >= 3:
            return note(
                LineRole.RISK,
                f"Third level of loop nesting (contributes O(n³)).",
                f"The constraints expect {expected_time}. Three nested passes will time out.",
                "Look for a pass that can be replaced by a lookup or a running aggregate.",
            )
        if depth == 2:
            return note(
                LineRole.IMPROVE,
                "Inner loop — this is the second nesting level, so O(n²).",
                f"Expected complexity here is {expected_time}.",
                "Ask what this inner scan is looking for. If it is a value, a hash map removes it.",
            )
        if range_len:
            return note(
                LineRole.NEUTRAL,
                f"Walks the indices of `{range_len.group(1)}` once.",
                "Linear pass — O(n).",
                "If you only need the values, iterating them directly reads cleaner.",
            )
        return note(LineRole.NEUTRAL, "Single pass over the input — O(n).")

    if _IF.match(stripped):
        return note(LineRole.NEUTRAL, "Branches on a condition.")

    if _ELSE.match(stripped):
        return None  # nothing useful to say

    if _BREAK.match(stripped):
        return note(
            LineRole.GOOD,
            f"Exits early with `{stripped.split()[0]}`.",
            "Early exit avoids work you no longer need — good instinct.",
        )

    if _RETURN.match(stripped):
        payload = stripped[6:].strip() if stripped.startswith("return") else ""
        return note(
            LineRole.GOOD,
            "Returns the answer." if payload else "Returns.",
            "The judge compares whatever you return with the expected output.",
        )

    # ── assignments ──────────────────────────────────────────────────────
    augment = _AUGMENT.match(raw)
    if augment:
        return note(
            LineRole.NEUTRAL,
            f"Updates `{augment.group(1)}` in place.",
            "Running aggregates like this are what let a single pass replace a nested one.",
        )

    assign = _ASSIGN.match(raw.split("#")[0].split("//")[0])
    if assign:
        name, value = assign.group(1), assign.group(2).strip()

        if _HASH_LITERAL.search(value):
            known[name] = "hash"
            return note(
                LineRole.GOOD,
                f"Creates `{name}` as a hash structure.",
                "Membership and lookup become O(1) — this is usually what turns O(n²) into O(n).",
            )
        if _QUEUE_LITERAL.search(value):
            known[name] = "queue"
            return note(
                LineRole.GOOD,
                f"Creates `{name}` as a queue.",
                "A queue processes nodes in level order — the engine of BFS.",
            )
        if _HEAP_LITERAL.search(value):
            known[name] = "heap"
            return note(
                LineRole.GOOD,
                f"Uses a heap for `{name}`.",
                "O(log n) insert and extract-min, ideal for top-k and scheduling.",
            )
        if _LIST_LITERAL.search(value):
            known[name] = "list"
            return note(LineRole.NEUTRAL, f"Allocates `{name}` as a list.")
        if _SORT.search(value):
            return note(
                LineRole.NEUTRAL,
                f"Sorts into `{name}`.",
                "Sorting costs O(n log n) — that becomes the floor for the whole function.",
            )
        if _MIN_MAX.search(value):
            return note(
                LineRole.GOOD,
                f"Tracks a running best in `{name}`.",
                "Collapsing history into one number is what makes a single pass sufficient.",
            )
        if name.lower() in {"tmp", "temp", "x", "y", "a", "b", "val", "foo"}:
            return note(
                LineRole.IMPROVE,
                f"Assigns `{name}`.",
                "The name does not say what it holds, so the next reader has to re-derive it.",
                "Rename it after the thing it represents.",
            )
        return note(LineRole.NEUTRAL, f"Sets `{name}`.")

    return None


def _summary(notes: list[LineNote], improvable: int) -> str:
    if not notes:
        return "Nothing to annotate yet."
    risks = sum(1 for n in notes if n.role is LineRole.RISK)
    good = sum(1 for n in notes if n.role is LineRole.GOOD)

    if risks:
        return f"{risks} line{'' if risks == 1 else 's'} will cause real problems — those are marked in red."
    if improvable:
        return f"{improvable} line{'' if improvable == 1 else 's'} could be stronger. Nothing is broken."
    if good >= 3:
        return "Every annotated line is pulling its weight."
    return "Structure reads cleanly so far."
