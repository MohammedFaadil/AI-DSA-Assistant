"""Pydantic mirrors of packages/contracts.

These are the Python half of the API↔AI seam. The `contracts:check` CI job
exports both sides to JSON Schema and diffs them, so drift fails at PR time
rather than at runtime.
"""

from __future__ import annotations

from enum import Enum
from typing import Annotated, Literal

from pydantic import BaseModel, Field


class Language(str, Enum):
    PYTHON = "PYTHON"
    C = "C"
    CPP = "CPP"
    JAVA = "JAVA"
    CSHARP = "CSHARP"
    JAVASCRIPT = "JAVASCRIPT"
    TYPESCRIPT = "TYPESCRIPT"
    GO = "GO"
    RUST = "RUST"
    PHP = "PHP"
    KOTLIN = "KOTLIN"
    SWIFT = "SWIFT"


class AssistMode(str, Enum):
    EASY = "EASY"
    MODERATE = "MODERATE"
    HIGH = "HIGH"


class AgentType(str, Enum):
    PLANNER = "PLANNER"
    TUTOR = "TUTOR"
    CODE_REVIEW = "CODE_REVIEW"
    HINT = "HINT"
    DEBUG = "DEBUG"
    COMPLEXITY = "COMPLEXITY"
    PROGRESS = "PROGRESS"
    SYSTEM = "SYSTEM"
    FALLBACK = "FALLBACK"


class TriggerType(str, Enum):
    EXPLICIT_ASK = "EXPLICIT_ASK"
    IDLE_STUCK = "IDLE_STUCK"
    THRASHING = "THRASHING"
    COMPLEXITY_GAP = "COMPLEXITY_GAP"
    REPEATED_COMPILE_ERROR = "REPEATED_COMPILE_ERROR"
    RUNTIME_FAILURE = "RUNTIME_FAILURE"
    MILESTONE = "MILESTONE"
    GHOST_TEXT = "GHOST_TEXT"
    SESSION_SUMMARY = "SESSION_SUMMARY"
    QUALITY_DROP = "QUALITY_DROP"
    QUALITY_IMPROVED = "QUALITY_IMPROVED"


class Severity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


FAILING_VERDICTS = {
    "WRONG_ANSWER",
    "TIME_LIMIT_EXCEEDED",
    "MEMORY_LIMIT_EXCEEDED",
    "RUNTIME_ERROR",
    "COMPILATION_ERROR",
    "OUTPUT_LIMIT_EXCEEDED",
}


class Position(BaseModel):
    line: int = 0
    column: int = 0


class Range(BaseModel):
    startLine: int = 0
    startColumn: int = 0
    endLine: int = 0
    endColumn: int = 0


class Finding(BaseModel):
    rule: str
    message: str
    severity: Severity
    range: Range
    symbol: str | None = None


class FunctionInfo(BaseModel):
    name: str
    startLine: int
    endLine: int
    paramCount: int
    hasReturn: bool
    loopDepth: int
    isRecursive: bool


class DiffSummary(BaseModel):
    changedLines: int = 0
    addedNodes: int = 0
    removedNodes: int = 0
    addedCorrectStructure: bool = False
    touchedFunctions: list[str] = Field(default_factory=list)


class SessionSignals(BaseModel):
    parseOk: bool = True
    errorRanges: list[Range] = Field(default_factory=list)
    currentFunction: str | None = None
    scopeChain: list[str] = Field(default_factory=list)
    cursorNodeKind: str | None = None
    functions: list[FunctionInfo] = Field(default_factory=list)
    dataStructures: list[str] = Field(default_factory=list)
    lineCount: int = 0

    maxLoopDepth: int = 0
    hasRecursion: bool = False
    hasMemoization: bool = False
    branchCount: int = 0

    findings: list[Finding] = Field(default_factory=list)

    inferredTime: str = "O(1)"
    inferredSpace: str = "O(1)"
    complexityConfidence: float = 0.0
    algorithmFingerprint: str | None = None
    matchesExpectedBand: bool = True

    semanticDiff: DiffSummary = Field(default_factory=DiffSummary)
    idleMs: int = 0
    editVelocity: float = 0.0
    backspaceRatio: float = 0.0
    thrashScore: float = 0.0
    dwellLine: int | None = None
    progressEstimate: float = 0.0


class QualityDimension(BaseModel):
    key: str
    label: str
    score: int
    weight: float
    notes: list[str] = Field(default_factory=list)


class QualityReport(BaseModel):
    overall: int = 0
    #: False for an empty or stub-only buffer — the UI shows a neutral meter
    #: rather than a red one, which would read as failure before you start.
    measurable: bool = False
    grade: str = "—"
    headline: str = ""
    dimensions: list[QualityDimension] = Field(default_factory=list)
    topFix: str | None = None
    #: Delta vs. the last few ticks this session — None until enough history
    #: has accumulated. Lets the UI show a rising/falling indicator.
    trend: float | None = None


class LineRole(str, Enum):
    GOOD = "GOOD"
    NEUTRAL = "NEUTRAL"
    IMPROVE = "IMPROVE"
    RISK = "RISK"


class LineNote(BaseModel):
    line: int
    role: LineRole
    what: str
    why: str | None = None
    fix: str | None = None


class LineReview(BaseModel):
    notes: list[LineNote] = Field(default_factory=list)
    annotatedLines: int = 0
    improvableLines: int = 0
    summary: str = ""


class BehaviourInput(BaseModel):
    idleMs: int = 0
    editCount: int = 0
    backspaces: int = 0
    dwellLine: int | None = None
    charsTyped: int = 0
    elapsedMs: int = 0
    sameErrorCount: int = 0
    lastVerdict: str | None = None
    stableForMs: int = 0
    #: Previous tick's overall quality score, if any — lets QUALITY_DROP/
    #: QUALITY_IMPROVED be computed without the API duplicating scoring logic.
    previousQuality: float | None = None


class AnalyzeRequest(BaseModel):
    requestId: str
    language: Language
    code: str
    previousCode: str | None = None
    cursor: Position | None = None
    expectedTime: str = "O(n)"
    expectedSpace: str = "O(1)"
    behaviour: BehaviourInput = Field(default_factory=BehaviourInput)
    assistMode: AssistMode = AssistMode.MODERATE
    cooldowns: dict[str, float] = Field(default_factory=dict)
    confidence: float = 0.5
    idleThresholdMs: int = 45_000


class TriggerDecision(BaseModel):
    fired: bool = False
    trigger: TriggerType | None = None
    route: AgentType | None = None
    reason: str = "silent"
    cooldownSec: int = 0


class AnalyzeResponse(BaseModel):
    requestId: str
    signals: SessionSignals
    decision: TriggerDecision
    quality: QualityReport = Field(default_factory=QualityReport)
    elapsedMs: float


class LineReviewRequest(BaseModel):
    requestId: str
    language: Language
    code: str
    expectedTime: str = "O(n)"


class LineReviewResponse(BaseModel):
    requestId: str
    review: LineReview
    elapsedMs: float


# ── Practice Zone ────────────────────────────────────────────────────────


class PracticeRequest(BaseModel):
    requestId: str
    prompt: str
    difficulty: str | None = None
    language: Language = Language.PYTHON


class GeneratedParam(BaseModel):
    name: str
    #: int | int[] | str | str[] | grid — mirrors packages/db/prisma/seed/io.ts
    type: str


class GeneratedIo(BaseModel):
    fn: str
    params: list[GeneratedParam]
    returns: str  # int | bool | int[] | str


class GeneratedProblem(BaseModel):
    """A problem spec WITHOUT expected outputs.

    Expected outputs are deliberately absent: the API derives them by executing
    the reference solution over `testInputs`. An LLM asked to invent both the
    input and its answer gets the answer wrong often enough to poison a test
    suite, so we never ask it to. Tests end up correct by construction.
    """

    title: str
    slug: str
    difficulty: str
    topics: list[str] = Field(default_factory=list)
    statement: str
    statementDigest: str
    constraints: str
    constraintsDigest: str
    expectedTime: str = "O(n)"
    expectedSpace: str = "O(1)"
    io: GeneratedIo
    referenceSolution: str
    testInputs: list[str] = Field(default_factory=list)
    sampleCount: int = 2
    hints: list[str] = Field(default_factory=list)
    editorial: str = ""
    source: str = "template"  # "model" | "template"


# ── Context envelope ─────────────────────────────────────────────────────


class MentorPolicy(BaseModel):
    maxCodeLines: int = 3
    mayRevealAlgorithmName: bool = False
    mayWriteSolutionCode: bool = False
    hintLevel: int | None = None
    language: str = "en"


class EnvelopeProblem(BaseModel):
    id: str
    slug: str
    title: str
    difficulty: str
    statementDigest: str
    constraintsDigest: str
    topics: list[str] = Field(default_factory=list)
    expectedTime: str
    expectedSpace: str


class EnvelopeCode(BaseModel):
    language: Language
    buffer: str
    cursor: Position | None = None
    selection: str | None = None
    recentEdits: list[str] = Field(default_factory=list)


class EnvelopeExecution(BaseModel):
    lastVerdict: str | None = None
    compilerStderr: str | None = None
    failingTest: dict[str, str] | None = None
    sameErrorCount: int = 0


class EnvelopeMessage(BaseModel):
    role: str
    content: str
    agent: str | None = None


class EnvelopeHistory(BaseModel):
    hintsUsed: list[int] = Field(default_factory=list)
    attemptCount: int = 0
    recentMessages: list[EnvelopeMessage] = Field(default_factory=list)
    conversationSummary: str | None = None


class EnvelopeLearner(BaseModel):
    skillLevel: str = "BEGINNER"
    confidence: float = 0.5
    hintDependency: float = 0.0
    weakTopics: list[str] = Field(default_factory=list)
    strongTopics: list[str] = Field(default_factory=list)
    misconceptions: list[str] = Field(default_factory=list)


class ContextEnvelope(BaseModel):
    v: Literal[1] = 1
    requestId: str
    userId: str
    sessionId: str | None = None
    trigger: TriggerType
    assistMode: AssistMode
    userMessage: str | None = None
    problem: EnvelopeProblem
    code: EnvelopeCode
    signals: SessionSignals | None = None
    execution: EnvelopeExecution = Field(default_factory=EnvelopeExecution)
    history: EnvelopeHistory = Field(default_factory=EnvelopeHistory)
    learner: EnvelopeLearner = Field(default_factory=EnvelopeLearner)
    policy: MentorPolicy = Field(default_factory=MentorPolicy)
    solutionFingerprint: str | None = None
    solved: bool = False


# ── Agent responses ──────────────────────────────────────────────────────


class TextBlock(BaseModel):
    type: Literal["text"] = "text"
    content: str


class CodeBlock(BaseModel):
    type: Literal["code"] = "code"
    language: str
    content: str
    caption: str | None = None


class QuestionBlock(BaseModel):
    type: Literal["question"] = "question"
    content: str


class DiagnosticBlock(BaseModel):
    type: Literal["diagnostic"] = "diagnostic"
    severity: Severity
    message: str
    range: Range | None = None


class ComplexityBlock(BaseModel):
    type: Literal["complexity"] = "complexity"
    current: str
    target: str
    explanation: str


class HintBlock(BaseModel):
    type: Literal["hint"] = "hint"
    level: int
    content: str


ResponseBlock = Annotated[
    TextBlock | CodeBlock | QuestionBlock | DiagnosticBlock | ComplexityBlock | HintBlock,
    Field(discriminator="type"),
]


class AgentResponse(BaseModel):
    agent: AgentType
    blocks: list[ResponseBlock]
    followUp: str | None = None
    conceptTags: list[str] = Field(default_factory=list)


class GuardViolation(BaseModel):
    rule: Literal[
        "SCHEMA",
        "LINE_BUDGET",
        "HINT_LEVEL_FIDELITY",
        "SOLUTION_SIMILARITY",
        "POLICY_FIDELITY",
        "SAFETY",
    ]
    detail: str


class AgentTelemetry(BaseModel):
    model: str | None = None
    promptTokens: int = 0
    completionTokens: int = 0
    latencyMs: int = 0
    cacheHit: bool = False
    guardRejections: int = 0
    fallbackUsed: bool = False
    routeReason: str = ""


class MentorTurn(BaseModel):
    requestId: str
    response: AgentResponse
    telemetry: AgentTelemetry


class CompleteRequest(BaseModel):
    requestId: str
    language: Language
    prefix: str
    suffix: str
    problemTitle: str
    maxTokens: int = 48


class CompleteResponse(BaseModel):
    requestId: str
    text: str
    cacheHit: bool = False
    model: str | None = None


# ── AI Training (curriculum-scoped tutoring) ────────────────────────────
#
# Deliberately has no `policy`/`solutionFingerprint`: there is no solution to
# protect in a "teach me this concept" conversation, so — unlike
# ContextEnvelope — teaching mode is unconditionally open by construction.
# The Response Guard is not invoked against this envelope at all (see
# agents/teach.py); Pydantic validation on TeachResponse is the safety net.


class ConceptEnvelopeSection(BaseModel):
    slug: str
    title: str
    lessonDigest: str
    keyPatterns: list[str] = Field(default_factory=list)
    commonPitfall: str | None = None


class ConceptEnvelope(BaseModel):
    v: Literal[1] = 1
    requestId: str
    userId: str
    userMessage: str | None = None
    section: ConceptEnvelopeSection
    history: EnvelopeHistory = Field(default_factory=EnvelopeHistory)
    learner: EnvelopeLearner = Field(default_factory=EnvelopeLearner)


class TeachResponse(BaseModel):
    blocks: list[ResponseBlock]
    followUp: str | None = None
    readyForPractice: bool = False
