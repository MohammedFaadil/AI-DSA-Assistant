"""Practice Zone problem generation.

A learner types what they want to practise; this turns it into a complete,
judgeable problem.

The important design decision: **the model is never asked for expected
outputs.** It produces a statement, an I/O spec, a reference solution and a set
of raw inputs. The API then executes the reference solution over those inputs to
derive the expected outputs. A model asked to invent both an input and its
answer gets the answer wrong often enough to poison a whole test suite; this way
the tests are correct by construction, and the worst a bad generation can do is
produce an uninteresting problem rather than an unsolvable one.

Validation is strict and the fallback is a curated template, so this endpoint
cannot return something the compiler chokes on.
"""

from __future__ import annotations

import ast
import re

from app.core.logging import log
from app.models.providers import ProviderError, parse_json_object
from app.models.router import TaskClass, router
from app.practice import templates
from app.schemas import GeneratedIo, GeneratedParam, GeneratedProblem, PracticeRequest

VALID_PARAM_TYPES = {"int", "int[]", "str", "str[]", "grid"}
VALID_RETURN_TYPES = {"int", "bool", "int[]", "str"}

SYSTEM = """You author data-structures practice problems for a coding-judge platform.

The platform runs submissions as stdin/stdout programs. A harness is generated
around a single function, so you specify that function's signature and nothing
about I/O plumbing.

HARD REQUIREMENTS
- Parameter types must each be one of: int, int[], str, str[], grid
- Return type must be one of: int, bool, int[], str
- `referenceSolution` is the BODY ONLY of a Python function with that exact
  signature. No `def` line, no imports at module level except inside the body,
  no printing, no reading stdin. It must `return` the answer.
- `testInputs` are raw stdin payloads. One line per parameter, in order.
    int      -> a single integer on its line
    int[]    -> space-separated integers on one line
    str      -> the raw string on its line
    str[]    -> space-separated tokens on one line
    grid     -> a line "rows cols", then that many lines of characters
- Provide 6 to 9 testInputs. Include degenerate cases: smallest legal size,
  all-equal values, negatives where legal, and one larger case.
- Do NOT include expected outputs. They are computed by running your solution.
- `hints` must be exactly 3, escalating: (1) point at a property without naming
  a technique, (2) name the property and the shape of the technique, (3) name
  the technique and the first concrete step.

Reply with ONE JSON object and nothing else:
{
  "title": "Title Case, max 60 chars",
  "difficulty": "EASY" | "MEDIUM" | "HARD",
  "topics": ["array", "hash-table"],
  "statement": "markdown. Include an '### Input format' and '### Output format' section.",
  "constraints": "markdown bullet list of bounds",
  "expectedTime": "O(n)",
  "expectedSpace": "O(1)",
  "io": {"fn": "camelCaseName", "params": [{"name": "nums", "type": "int[]"}], "returns": "int"},
  "referenceSolution": "body only, 4-space indented is NOT required — write it unindented",
  "testInputs": ["1 2 3\\n4", "..."],
  "hints": ["...", "...", "..."],
  "editorial": "2-4 paragraphs: why the naive approach fails, the insight, the complexity."
}"""


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:60] or "practice-problem"


def _validate(payload: dict, seed: int) -> GeneratedProblem:
    """Raises ValueError on anything the platform could not actually run."""
    io_raw = payload.get("io") or {}
    params_raw = io_raw.get("params") or []

    if not io_raw.get("fn") or not re.fullmatch(r"[A-Za-z_]\w{0,40}", str(io_raw["fn"])):
        raise ValueError("invalid function name")
    if not params_raw or len(params_raw) > 3:
        raise ValueError("expected between 1 and 3 parameters")

    params: list[GeneratedParam] = []
    for entry in params_raw:
        name = str(entry.get("name", "")).strip()
        ptype = str(entry.get("type", "")).strip()
        if not re.fullmatch(r"[A-Za-z_]\w{0,30}", name):
            raise ValueError(f"invalid parameter name: {name!r}")
        if ptype not in VALID_PARAM_TYPES:
            raise ValueError(f"unsupported parameter type: {ptype!r}")
        params.append(GeneratedParam(name=name, type=ptype))

    returns = str(io_raw.get("returns", "")).strip()
    if returns not in VALID_RETURN_TYPES:
        raise ValueError(f"unsupported return type: {returns!r}")

    body = str(payload.get("referenceSolution", "")).strip("\n")
    if not body.strip():
        raise ValueError("empty reference solution")
    if "input(" in body or "sys.stdin" in body or re.search(r"^\s*print\(", body, re.MULTILINE):
        raise ValueError("reference solution must not do I/O")
    if "return" not in body:
        raise ValueError("reference solution never returns")

    # Must actually parse as the body of a function with this signature.
    signature = ", ".join(p.name for p in params)
    indented = "\n".join(f"    {line}" if line.strip() else line for line in body.split("\n"))
    try:
        ast.parse(f"def {io_raw['fn']}({signature}):\n{indented}\n")
    except SyntaxError as exc:
        raise ValueError(f"reference solution does not parse: {exc.msg}") from exc

    inputs = [str(t) for t in (payload.get("testInputs") or []) if str(t).strip()]
    if len(inputs) < 3:
        raise ValueError("need at least 3 test inputs")

    # Each input must supply at least one line per non-grid parameter.
    minimum_lines = sum(1 for p in params if p.type != "grid") + sum(
        2 for p in params if p.type == "grid"
    )
    inputs = [t for t in inputs if len(t.split("\n")) >= minimum_lines]
    if len(inputs) < 3:
        raise ValueError("test inputs do not match the parameter shape")

    hints = [str(h).strip() for h in (payload.get("hints") or []) if str(h).strip()]
    if len(hints) < 3:
        raise ValueError("need 3 escalating hints")

    difficulty = str(payload.get("difficulty", "MEDIUM")).upper()
    if difficulty not in {"EASY", "MEDIUM", "HARD"}:
        difficulty = "MEDIUM"

    statement = str(payload.get("statement", "")).strip()
    if len(statement) < 80:
        raise ValueError("statement too short to be useful")

    title = str(payload.get("title", "Practice Problem")).strip()[:60]
    constraints = str(payload.get("constraints", "")).strip() or "- No additional constraints."

    return GeneratedProblem(
        title=title,
        slug=f"practice-{_slugify(title)}-{seed % 100000}",
        difficulty=difficulty,
        topics=[str(t).strip().lower() for t in (payload.get("topics") or [])][:5],
        statement=statement,
        statementDigest=re.sub(r"\s+", " ", re.sub(r"#+ .*", "", statement))[:400].strip(),
        constraints=constraints,
        constraintsDigest=re.sub(r"\s+", " ", constraints.replace("-", ""))[:200].strip(),
        expectedTime=str(payload.get("expectedTime", "O(n)")).strip()[:20],
        expectedSpace=str(payload.get("expectedSpace", "O(1)")).strip()[:20],
        io=GeneratedIo(fn=str(io_raw["fn"]), params=params, returns=returns),
        referenceSolution=body,
        testInputs=inputs[:9],
        sampleCount=2,
        hints=hints[:3],
        editorial=str(payload.get("editorial", "")).strip(),
        source="model",
    )


async def generate(request: PracticeRequest, seed: int) -> GeneratedProblem:
    """Model-generated when possible, curated template otherwise."""
    if not router.any_available or router.usage.exhausted:
        log.info("practice_template_path", reason="no provider configured")
        return templates.generate(request.prompt, request.difficulty, seed)

    difficulty_hint = (
        f"Target difficulty: {request.difficulty}." if request.difficulty else
        "Choose the difficulty that fits the request."
    )
    user = (
        f"The learner wants to practise:\n\n{request.prompt.strip()[:1200]}\n\n"
        f"{difficulty_hint}\n"
        "Author one problem that genuinely exercises that skill. Prefer a concrete, "
        "checkable task over an open-ended one."
    )

    for attempt in range(2):
        try:
            completion = await router.generate(
                task=TaskClass.REASON,
                system=SYSTEM,
                user=user,
                max_tokens=2600,
                temperature=0.6 if attempt == 0 else 0.3,
                json_mode=True,
            )
            problem = _validate(parse_json_object(completion.text), seed)
            log.info(
                "practice_generated",
                source="model",
                model=completion.model,
                difficulty=problem.difficulty,
                tests=len(problem.testInputs),
            )
            return problem
        except (ProviderError, ValueError, KeyError, TypeError) as exc:
            log.info("practice_generation_rejected", attempt=attempt + 1, error=str(exc)[:200])

    log.info("practice_template_path", reason="model output failed validation twice")
    return templates.generate(request.prompt, request.difficulty, seed)
