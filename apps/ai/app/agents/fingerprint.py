"""Solution fingerprinting — Python side.

Byte-identical algorithm to packages/db/prisma/seed/fingerprint.ts. The seed
computes the reference solution's fingerprint at publish time; the Response
Guard computes the model's proposed code the same way and compares.

IMPORTANT: if you change one, change both. tests/test_guard/test_fingerprint.py
holds shared fixtures precisely so drift is caught rather than silently
disabling leak detection.
"""

from __future__ import annotations

import re
from collections import Counter

KEYWORDS: set[str] = {
    # control flow
    "if", "else", "elif", "for", "while", "do", "switch", "case", "default",
    "break", "continue", "return", "yield", "goto",
    # declarations
    "def", "function", "fn", "func", "lambda", "class", "struct", "interface",
    "enum", "const", "let", "var", "val", "static", "public", "private",
    "protected", "void", "new", "delete", "this", "self", "super", "extends",
    "implements", "import", "from", "include", "using", "namespace", "package",
    # types
    "int", "long", "short", "char", "float", "double", "bool", "boolean",
    "string", "str", "list", "dict", "set", "map", "vector", "array", "auto",
    "unsigned", "signed", "size_t",
    # values / word operators
    "true", "false", "null", "none", "nil", "nullptr", "undefined",
    "and", "or", "not", "in", "is", "try", "catch", "except", "finally",
    "throw", "raise", "with", "as", "pass", "global", "nonlocal",
    # library calls whose presence is structural rather than cosmetic
    "range", "len", "enumerate", "sorted", "sort", "append", "push", "pop",
    "min", "max", "sum", "abs", "print", "push_back", "insert", "get",
}

_IDENT_START = re.compile(r"[A-Za-z_]")
_IDENT_PART = re.compile(r"[A-Za-z0-9_]")
_NUMBER_PART = re.compile(r"[0-9.eExXaAbBcCdDfF]")


def _strip_literals_and_comments(src: str) -> str:
    out: list[str] = []
    i = 0
    n = len(src)

    while i < n:
        ch = src[i]
        nxt = src[i + 1] if i + 1 < n else ""

        if (ch == "/" and nxt == "/") or ch == "#":
            while i < n and src[i] != "\n":
                i += 1
            continue

        if ch == "/" and nxt == "*":
            i += 2
            while i + 1 < n and not (src[i] == "*" and src[i + 1] == "/"):
                i += 1
            i += 2
            continue

        if ch in {'"', "'"} and src[i : i + 3] == ch * 3:
            quote = ch * 3
            i += 3
            end = src.find(quote, i)
            i = n if end == -1 else end + 3
            out.append(" ")
            continue

        if ch in {'"', "'", "`"}:
            quote = ch
            i += 1
            while i < n and src[i] != quote:
                if src[i] == "\\":
                    i += 1
                i += 1
            i += 1
            out.append(" ")
            continue

        out.append(ch)
        i += 1

    return "".join(out)


def fingerprint(source: str) -> str:
    """Identifiers → `v`, numbers → `n`, keywords and punctuation survive.

    Renaming variables or reformatting does not change the fingerprint;
    changing the algorithm does. That is exactly the property the Guard needs.
    """
    src = _strip_literals_and_comments(source)
    tokens: list[str] = []
    i = 0
    n = len(src)

    while i < n:
        ch = src[i]

        if ch.isspace():
            i += 1
            continue

        if _IDENT_START.match(ch):
            start = i
            while i < n and _IDENT_PART.match(src[i]):
                i += 1
            word = src[start:i].lower()
            tokens.append(word if word in KEYWORDS else "v")
            continue

        if ch.isdigit():
            while i < n and _NUMBER_PART.match(src[i]):
                i += 1
            tokens.append("n")
            continue

        tokens.append(ch)
        i += 1

    return " ".join(tokens)


def similarity(a: str, b: str) -> float:
    """Dice coefficient over token bigrams.

    Symmetric and length-tolerant — appropriate for "is this suspiciously close
    to the official answer?" rather than exact plagiarism detection.
    """

    def bigrams(s: str) -> Counter[str]:
        parts = [p for p in s.split(" ") if p]
        return Counter(f"{parts[i]} {parts[i + 1]}" for i in range(len(parts) - 1))

    ca, cb = bigrams(a), bigrams(b)
    total_a, total_b = sum(ca.values()), sum(cb.values())
    if total_a == 0 or total_b == 0:
        return 0.0
    overlap = sum(min(count, cb[key]) for key, count in ca.items())
    return (2 * overlap) / (total_a + total_b)
