"""Parsing layer.

Tree-sitter is the primary backend, chosen for one decisive property: it parses
BROKEN code. A student mid-thought has unbalanced braces and half-typed
identifiers; a conventional parser returns an error, Tree-sitter returns a tree
with ERROR nodes and usable structure around them. Analysis that only works on
valid code is analysis that never runs when the learner most needs it.

If the grammars are unavailable (a slim container, an install failure) the
service degrades to a regex/indentation analyser rather than losing Stage 1
entirely. Degraded signals are still real signals.
"""

from __future__ import annotations

import re
from functools import lru_cache

from app.analysis.model import CodeModel, FunctionNode, LoopNode, Span
from app.core.logging import log

# ── Optional Tree-sitter import ──────────────────────────────────────────
try:  # pragma: no cover - import guard
    from tree_sitter_language_pack import get_parser as _get_parser

    TREE_SITTER_AVAILABLE = True
except Exception:  # noqa: BLE001
    _get_parser = None  # type: ignore[assignment]
    TREE_SITTER_AVAILABLE = False


GRAMMAR_BY_LANGUAGE: dict[str, str] = {
    "PYTHON": "python",
    "JAVASCRIPT": "javascript",
    "TYPESCRIPT": "typescript",
    "JAVA": "java",
    "CPP": "cpp",
    "C": "c",
    "CSHARP": "csharp",
    "GO": "go",
    "RUST": "rust",
    "PHP": "php",
    "KOTLIN": "kotlin",
    "SWIFT": "swift",
}

# Node-kind vocabularies. Matching by kind-name rather than per-grammar visitors
# is what keeps one analyser working across twelve languages.
FUNCTION_KINDS = {
    "function_definition",
    "function_declaration",
    "function_item",
    "function_expression",
    "method_declaration",
    "method_definition",
    "arrow_function",
    "lambda",
    "constructor_declaration",
    "fun_declaration",
}
FOR_KINDS = {
    "for_statement",
    "for_in_statement",
    "for_of_statement",
    "for_range_loop",
    "enhanced_for_statement",
    "foreach_statement",
    "for_expression",
    "range_clause",
}
WHILE_KINDS = {
    "while_statement",
    "while_expression",
    "do_statement",
    "do_while_statement",
    "loop_expression",
    "repeat_while_statement",
}
BRANCH_KINDS = {
    "if_statement",
    "if_expression",
    "conditional_expression",
    "ternary_expression",
    "switch_statement",
    "switch_expression",
    "match_expression",
    "when_expression",
    "elif_clause",
    "else_clause",
}
CALL_KINDS = {"call", "call_expression", "method_invocation", "function_call_expression"}
RETURN_KINDS = {"return_statement", "return_expression"}
IDENT_KINDS = {"identifier", "field_identifier", "property_identifier", "simple_identifier"}

DATA_STRUCTURE_PATTERNS: list[tuple[str, str]] = [
    (r"\bdict\s*\(|\{\s*\}|\bdefaultdict\b|\bHashMap\b|\bunordered_map\b|\bnew Map\b|\bmap\[", "hash map"),
    (r"\bset\s*\(|\bHashSet\b|\bunordered_set\b|\bnew Set\b", "hash set"),
    (r"\bdeque\b|\bQueue\b|\bLinkedList\b|\bqueue<", "queue"),
    (r"\bheapq\b|\bPriorityQueue\b|\bpriority_queue\b|\bheappush\b", "heap"),
    (r"\bstack\b|\bStack\b|\bstack<", "stack"),
    (r"\bCounter\b", "counter"),
    (r"\bvector<|\bArrayList\b|\bnew Array\b|\blist\s*\(", "dynamic array"),
    (r"\bTreeMap\b|\bmap<|\bsorted\s*\(", "ordered structure"),
]

MEMO_PATTERNS = re.compile(
    r"\bmemo\b|\bcache\b|\blru_cache\b|@cache\b|\bdp\b|\bmemoi[sz]e\b", re.IGNORECASE
)


@lru_cache(maxsize=16)
def _parser_for(grammar: str):  # pragma: no cover - depends on optional dep
    return _get_parser(grammar)  # type: ignore[misc]


def warm_grammars(languages: list[str]) -> int:
    """Preload grammars at startup so the first request doesn't pay for it."""
    if not TREE_SITTER_AVAILABLE:
        return 0
    loaded = 0
    for language in languages:
        grammar = GRAMMAR_BY_LANGUAGE.get(language)
        if not grammar:
            continue
        try:
            _parser_for(grammar)
            loaded += 1
        except Exception as exc:  # noqa: BLE001
            log.warning("grammar_load_failed", grammar=grammar, error=str(exc))
    return loaded


def parse(language: str, code: str, cursor_line: int | None = None) -> CodeModel:
    if TREE_SITTER_AVAILABLE and language in GRAMMAR_BY_LANGUAGE:
        try:
            return _parse_tree_sitter(language, code, cursor_line)
        except Exception as exc:  # noqa: BLE001
            log.warning("tree_sitter_parse_failed", language=language, error=str(exc))
    return _parse_fallback(language, code, cursor_line)


# ── Tree-sitter backend ──────────────────────────────────────────────────


def _span(node) -> Span:  # noqa: ANN001
    return Span(
        start_line=node.start_point[0],
        start_col=node.start_point[1],
        end_line=node.end_point[0],
        end_col=node.end_point[1],
    )


def _text(node, source: bytes) -> str:  # noqa: ANN001
    return source[node.start_byte : node.end_byte].decode("utf8", errors="replace")


def _function_name(node, source: bytes) -> str:  # noqa: ANN001
    named = node.child_by_field_name("name")
    if named is not None:
        return _text(named, source)
    # C/C++ put the name inside a declarator; walk down to the first identifier.
    declarator = node.child_by_field_name("declarator")
    if declarator is not None:
        for child in _walk(declarator):
            if child.type in IDENT_KINDS:
                return _text(child, source)
    for child in node.children:
        if child.type in IDENT_KINDS:
            return _text(child, source)
    return "<anonymous>"


def _walk(node):  # noqa: ANN001
    stack = [node]
    while stack:
        current = stack.pop()
        yield current
        stack.extend(reversed(current.children))


def _parse_tree_sitter(language: str, code: str, cursor_line: int | None) -> CodeModel:
    grammar = GRAMMAR_BY_LANGUAGE[language]
    parser = _parser_for(grammar)
    source = code.encode("utf8")
    tree = parser.parse(source)
    root = tree.root_node

    model = CodeModel(
        backend="tree-sitter",
        source=code,
        language=language,
        line_count=code.count("\n") + 1,
    )

    functions: list[FunctionNode] = []
    loops: list[LoopNode] = []
    calls: list[str] = []
    branch_count = 0
    node_count = 0
    error_spans: list[Span] = []

    # Depth of loop nesting is tracked on the descent, so a loop knows how
    # deeply it sits without a second traversal.
    def visit(node, loop_depth: int, current_fn: FunctionNode | None) -> None:  # noqa: ANN001
        nonlocal branch_count, node_count
        node_count += 1

        # Tree-sitter reports broken code two different ways: an ERROR node
        # where it could not parse at all, and a MISSING node where it recovered
        # by inserting an absent token (`enumerate(nums:` yields a MISSING ")").
        # Only checking for ERROR silently treats the second case as valid.
        if node.is_error or node.type == "ERROR" or node.is_missing:
            error_spans.append(_span(node))

        kind = node.type
        next_depth = loop_depth
        fn_for_children = current_fn

        if kind in FUNCTION_KINDS:
            fn = FunctionNode(
                name=_function_name(node, source),
                span=_span(node),
                body=_text(node, source),
            )
            params = node.child_by_field_name("parameters") or node.child_by_field_name(
                "parameter_list"
            )
            if params is not None:
                fn.param_count = sum(1 for c in params.named_children)
            functions.append(fn)
            fn_for_children = fn
            next_depth = 0  # loop depth is measured per function

        elif kind in FOR_KINDS or kind in WHILE_KINDS:
            next_depth = loop_depth + 1
            loops.append(
                LoopNode(
                    kind="for" if kind in FOR_KINDS else "while",
                    span=_span(node),
                    depth=next_depth,
                    text=_text(node, source)[:600],
                )
            )
            if current_fn is not None:
                current_fn.max_loop_depth = max(current_fn.max_loop_depth, next_depth)

        elif kind in BRANCH_KINDS:
            branch_count += 1

        elif kind in CALL_KINDS:
            fn_node = node.child_by_field_name("function") or node.child_by_field_name("name")
            callee = _text(fn_node, source) if fn_node is not None else _text(node, source)[:40]
            calls.append(callee.strip())

        elif kind in RETURN_KINDS and current_fn is not None:
            current_fn.has_return = True

        elif kind in IDENT_KINDS and current_fn is not None:
            current_fn.used_names.append(_text(node, source))

        elif kind in {"assignment", "assignment_expression", "variable_declarator", "let_declaration"}:
            target = node.child_by_field_name("left") or node.child_by_field_name("name")
            if target is not None and current_fn is not None:
                current_fn.assigned_names.append(_text(target, source))

        for child in node.children:
            visit(child, next_depth, fn_for_children)

    visit(root, 0, None)

    model.functions = functions
    model.loops = loops
    model.calls = calls
    model.branch_count = branch_count
    model.node_count = node_count
    model.error_spans = error_spans[:10]
    # `has_error` on the tree is the authoritative signal; the span walk is only
    # for *locating* the problem. Trusting the walk alone lets a recovery shape
    # we did not anticipate pass as clean code.
    model.parse_ok = len(error_spans) == 0 and not root.has_error
    if root.has_error and not model.error_spans:
        model.error_spans = [_span(root)]
    model.max_loop_depth = max((loop.depth for loop in loops), default=0)
    model.has_recursion = _detect_recursion(functions, calls)
    model.has_memoization = bool(MEMO_PATTERNS.search(code))
    model.data_structures = _detect_data_structures(code)

    if cursor_line is not None:
        fn = model.function_at(cursor_line)
        model.cursor_function = fn.name if fn else None
        model.scope_chain = [fn.name] if fn else []
        model.cursor_node_kind = _node_kind_at(root, cursor_line)

    return model


def _node_kind_at(root, line: int) -> str | None:  # noqa: ANN001
    best: str | None = None
    for node in _walk(root):
        if node.start_point[0] <= line <= node.end_point[0] and node.child_count == 0:
            best = node.type
    return best


# ── Fallback backend ─────────────────────────────────────────────────────

_FN_PATTERNS = [
    re.compile(r"^\s*def\s+(\w+)\s*\(([^)]*)\)"),
    re.compile(r"^\s*(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)"),
    # C/C++/Java/C# style: `<modifiers> <Type> name(args) {`. The type part must
    # start with a letter and contain no whitespace, otherwise the leading
    # indentation gets absorbed and `for (…) {` reads as a declaration.
    re.compile(
        r"^\s*(?:(?:public|private|protected|static|final|virtual|inline)\s+)*"
        r"[A-Za-z_][\w<>\[\]:,*&]*\s+\*?(\w+)\s*\(([^)]*)\)\s*(?:const\s*)?\{"
    ),
    re.compile(r"^\s*fn\s+(\w+)\s*\(([^)]*)\)"),
    re.compile(r"^\s*func\s+(\w+)\s*\(([^)]*)\)"),
]

#: Never a function name. Control keywords followed by `(` look exactly like a
#: call site to a regex, which is why the blocklist exists as a second gate.
_NOT_FUNCTION_NAMES = {
    "if", "else", "for", "while", "do", "switch", "case", "return", "catch",
    "elif", "with", "when", "match", "foreach", "using", "lock", "synchronized",
}
_LOOP_RE = re.compile(r"^\s*(for|while|do)\b")
_BRANCH_RE = re.compile(r"^\s*(if|elif|else if|switch|when|match)\b")
_CALL_RE = re.compile(r"(\w+)\s*\(")
_RETURN_RE = re.compile(r"^\s*return\b")


def _indent_of(line: str) -> int:
    return len(line) - len(line.lstrip())


def _parse_fallback(language: str, code: str, cursor_line: int | None) -> CodeModel:
    """Indentation/brace heuristics. Coarser than a real parse — but it keeps
    complexity estimates, loop depth and unused-variable hints alive when the
    grammars aren't there."""
    lines = code.split("\n")
    model = CodeModel(
        backend="fallback",
        source=code,
        language=language,
        line_count=len(lines),
    )

    functions: list[FunctionNode] = []
    loops: list[LoopNode] = []
    calls: list[str] = []
    branch_count = 0
    brace_depth = 0
    # (close-marker, depth, node) — the node is carried so we can set its end
    # line when we pop, which is what makes body-scoped rules work.
    loop_stack: list[tuple[int, int, LoopNode]] = []
    python_like = language in {"PYTHON"}

    current_fn: FunctionNode | None = None

    for i, raw in enumerate(lines):
        line = raw.split("#")[0].split("//")[0]
        if not line.strip():
            continue
        indent = _indent_of(raw)

        # Close loops we've dedented (or unbraced) out of.
        if python_like:
            while loop_stack and indent <= loop_stack[-1][0]:
                loop_stack.pop()[2].span.end_line = max(i - 1, 0)
        else:
            closes = line.count("}")
            brace_depth -= closes
            while loop_stack and brace_depth <= loop_stack[-1][0]:
                loop_stack.pop()[2].span.end_line = i
            brace_depth += line.count("{")

        for pattern in _FN_PATTERNS:
            match = pattern.match(raw)
            if match:
                if match.group(1) in _NOT_FUNCTION_NAMES:
                    break
                if current_fn is not None:
                    current_fn.span.end_line = max(0, i - 1)
                params = [p for p in match.group(2).split(",") if p.strip() and p.strip() != "self"]
                current_fn = FunctionNode(
                    name=match.group(1),
                    span=Span(start_line=i, end_line=len(lines) - 1),
                    param_count=len(params),
                )
                functions.append(current_fn)
                loop_stack.clear()
                break

        if _LOOP_RE.match(line):
            depth = (loop_stack[-1][1] + 1) if loop_stack else 1
            node = LoopNode(
                kind="for" if line.strip().startswith("for") else "while",
                span=Span(start_line=i, end_line=len(lines) - 1),
                depth=depth,
                text=raw.strip()[:300],
            )
            loops.append(node)
            loop_stack.append((indent if python_like else brace_depth - 1, depth, node))
            if current_fn is not None:
                current_fn.max_loop_depth = max(current_fn.max_loop_depth, depth)

        if _BRANCH_RE.match(line):
            branch_count += 1
        if _RETURN_RE.match(line) and current_fn is not None:
            current_fn.has_return = True
        calls.extend(_CALL_RE.findall(line))
        if current_fn is not None:
            current_fn.used_names.extend(re.findall(r"[A-Za-z_]\w*", line))

    while loop_stack:
        loop_stack.pop()[2].span.end_line = len(lines) - 1

    # The complexity estimator needs the loop BODY, not just its header — a
    # halving update lives inside the loop, never in the `while` line.
    for loop in loops:
        end = min(loop.span.end_line, loop.span.start_line + 40)
        loop.text = "\n".join(lines[loop.span.start_line : end + 1])[:600]

    model.functions = functions
    model.loops = loops
    model.calls = calls
    model.branch_count = branch_count
    model.node_count = sum(len(line.split()) for line in lines)
    model.max_loop_depth = max((loop.depth for loop in loops), default=0)
    model.has_recursion = _detect_recursion(functions, calls)
    model.has_memoization = bool(MEMO_PATTERNS.search(code))
    model.data_structures = _detect_data_structures(code)
    # Without a grammar we can still catch the most common in-progress breakage:
    # an unbalanced bracket. It is coarse, but it keeps `parseOk` meaningful and
    # stops the progress estimate from claiming completeness on broken code.
    model.error_spans = _unbalanced_spans(lines)
    model.parse_ok = not model.error_spans

    if cursor_line is not None:
        fn = model.function_at(cursor_line)
        model.cursor_function = fn.name if fn else None
        model.scope_chain = [fn.name] if fn else []

    return model


_PAIRS = {")": "(", "]": "[", "}": "{"}


def _unbalanced_spans(lines: list[str]) -> list[Span]:
    """Bracket balance, ignoring string and comment content.

    Reports the line of the first unmatched opener (or a stray closer), which
    is almost always where a mid-thought edit sits.
    """
    stack: list[tuple[str, int, int]] = []
    for index, raw in enumerate(lines):
        line = raw.split("#")[0].split("//")[0]
        in_string: str | None = None
        for col, ch in enumerate(line):
            if in_string:
                if ch == in_string and (col == 0 or line[col - 1] != "\\"):
                    in_string = None
                continue
            if ch in {'"', "'"}:
                in_string = ch
                continue
            if ch in "([{":
                stack.append((ch, index, col))
            elif ch in ")]}":
                if stack and stack[-1][0] == _PAIRS[ch]:
                    stack.pop()
                else:
                    return [Span(start_line=index, start_col=col, end_line=index, end_col=col + 1)]
    if stack:
        _ch, line_no, col = stack[0]
        return [Span(start_line=line_no, start_col=col, end_line=line_no, end_col=col + 1)]
    return []


# ── Shared detectors ─────────────────────────────────────────────────────


def _detect_recursion(functions: list[FunctionNode], calls: list[str]) -> bool:
    names = {fn.name for fn in functions if fn.name != "<anonymous>"}
    if not names:
        return False
    for fn in functions:
        if fn.body and re.search(rf"\b{re.escape(fn.name)}\s*\(", fn.body[fn.body.find("\n") :]):
            fn.is_recursive = True
    if any(fn.is_recursive for fn in functions):
        return True
    # Fallback backend has no bodies: a name appearing in both sets is a decent
    # proxy, though it can false-positive on mutual helpers.
    return any(call in names for call in calls[len(names) :])


def _detect_data_structures(code: str) -> list[str]:
    found: list[str] = []
    for pattern, label in DATA_STRUCTURE_PATTERNS:
        if re.search(pattern, code) and label not in found:
            found.append(label)
    return found
