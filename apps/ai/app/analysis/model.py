"""The normalised code model.

Extractors, rules, the complexity estimator and the fingerprint matchers all
work against this structure — never against a raw parse tree. That means the
Tree-sitter backend and the regex fallback are interchangeable, and adding a
13th language is a grammar entry rather than new analysis code.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Span:
    start_line: int = 0
    start_col: int = 0
    end_line: int = 0
    end_col: int = 0


@dataclass
class LoopNode:
    kind: str  # "for" | "while"
    span: Span
    depth: int  # 1-based nesting depth within its function
    text: str
    #: "linear" | "log" | "constant" — the per-iteration cost class of this loop
    bound: str = "linear"


@dataclass
class FunctionNode:
    name: str
    span: Span
    param_count: int = 0
    has_return: bool = False
    is_recursive: bool = False
    max_loop_depth: int = 0
    body: str = ""
    local_names: list[str] = field(default_factory=list)
    assigned_names: list[str] = field(default_factory=list)
    used_names: list[str] = field(default_factory=list)


@dataclass
class CodeModel:
    backend: str = "fallback"
    parse_ok: bool = True
    error_spans: list[Span] = field(default_factory=list)
    line_count: int = 0
    source: str = ""
    language: str = "PYTHON"

    functions: list[FunctionNode] = field(default_factory=list)
    loops: list[LoopNode] = field(default_factory=list)
    calls: list[str] = field(default_factory=list)
    branch_count: int = 0
    data_structures: list[str] = field(default_factory=list)
    has_recursion: bool = False
    has_memoization: bool = False
    max_loop_depth: int = 0
    node_count: int = 0

    #: kind of the AST node under the cursor, when a cursor was supplied
    cursor_node_kind: str | None = None
    cursor_function: str | None = None
    scope_chain: list[str] = field(default_factory=list)

    def function_at(self, line: int) -> FunctionNode | None:
        for fn in self.functions:
            if fn.span.start_line <= line <= fn.span.end_line:
                return fn
        return None
