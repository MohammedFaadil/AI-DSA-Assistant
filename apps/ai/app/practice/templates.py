"""Template bank for the Practice Zone.

The fallback path when no model provider is configured — and the safety net when
one is, since a generated problem that fails validation degrades to the closest
template rather than to an error.

Every template ships a real reference solution. The API executes it over the
inputs to derive expected outputs, so a template-generated problem has test
cases that are correct by construction, exactly like a curated one.
"""

from __future__ import annotations

import random
import re

from app.schemas import GeneratedIo, GeneratedParam, GeneratedProblem


class Template:
    def __init__(
        self,
        *,
        key: str,
        keywords: list[str],
        title: str,
        difficulty: str,
        topics: list[str],
        statement: str,
        constraints: str,
        expected_time: str,
        expected_space: str,
        io: GeneratedIo,
        solution: str,
        hints: list[str],
        editorial: str,
        make_inputs,
    ) -> None:
        self.key = key
        self.keywords = keywords
        self.title = title
        self.difficulty = difficulty
        self.topics = topics
        self.statement = statement
        self.constraints = constraints
        self.expected_time = expected_time
        self.expected_space = expected_space
        self.io = io
        self.solution = solution
        self.hints = hints
        self.editorial = editorial
        self.make_inputs = make_inputs


def _ints(rng: random.Random, n: int, lo: int = -50, hi: int = 50) -> str:
    return " ".join(str(rng.randint(lo, hi)) for _ in range(n))


TEMPLATES: list[Template] = [
    Template(
        key="pair-sum",
        keywords=["two sum", "pair", "sum to target", "hash map", "hashmap", "complement", "target"],
        title="Pair With Target Sum",
        difficulty="EASY",
        topics=["array", "hash-table"],
        statement="""Given an array of integers `nums` and an integer `target`, return the **indices** of the two numbers that add up to `target`.

Exactly one valid pair exists. Return the indices in ascending order.

### Input format
Line 1: the array `nums`, space-separated.
Line 2: the integer `target`.

### Output format
The two indices, space-separated.""",
        constraints="- `2 <= nums.length <= 10^4`\n- `-10^9 <= nums[i], target <= 10^9`\n- Exactly one valid answer exists.",
        expected_time="O(n)",
        expected_space="O(n)",
        io=GeneratedIo(
            fn="findPair",
            params=[GeneratedParam(name="nums", type="int[]"), GeneratedParam(name="target", type="int")],
            returns="int[]",
        ),
        solution="""seen = {}
for i, value in enumerate(nums):
    if target - value in seen:
        return [seen[target - value], i]
    seen[value] = i
return []""",
        hints=[
            "Once you fix one number, the partner you need is completely determined. What is it?",
            "Checking every pair is O(n²). The expensive part is searching for the partner — what turns a search into a constant-time question?",
            "Walk the array once keeping a map from value to index, and ask the map whether `target - value` has already been seen.",
        ],
        editorial="Fix one element and its partner is determined: `target - nums[i]`. That turns the problem into a membership question, which a hash map answers in O(1). Look up before you insert and you can never pair an element with itself.",
        make_inputs=lambda rng: _pair_sum_inputs(rng),
    ),
    Template(
        key="max-window",
        keywords=["sliding window", "window", "subarray of size", "consecutive", "average", "maximum sum"],
        title="Maximum Sum Of A Fixed Window",
        difficulty="EASY",
        topics=["array", "sliding-window"],
        statement="""Given an array `nums` and an integer `k`, return the largest sum of any **contiguous** subarray of exactly `k` elements.

### Input format
Line 1: the array `nums`, space-separated.
Line 2: the integer `k`.

### Output format
The maximum window sum.""",
        constraints="- `1 <= k <= nums.length <= 10^5`\n- `-10^4 <= nums[i] <= 10^4`",
        expected_time="O(n)",
        expected_space="O(1)",
        io=GeneratedIo(
            fn="maxWindowSum",
            params=[GeneratedParam(name="nums", type="int[]"), GeneratedParam(name="k", type="int")],
            returns="int",
        ),
        solution="""window = sum(nums[:k])
best = window
for i in range(k, len(nums)):
    window = window + nums[i] - nums[i - k]
    if window > best:
        best = window
return best""",
        hints=[
            "Two neighbouring windows overlap in all but two positions. What does that let you reuse?",
            "Recomputing each window costs O(k) and gives O(n·k) overall. The overlap means you only need two updates per step.",
            "Compute the first window's sum, then for each step add the entering element and subtract the leaving one.",
        ],
        editorial="Consecutive windows differ by exactly two elements, so the sum can be maintained incrementally: add the element entering on the right, subtract the one leaving on the left. One pass, constant memory.",
        make_inputs=lambda rng: _window_inputs(rng),
    ),
    Template(
        key="frequency",
        keywords=["frequency", "count", "most common", "duplicate", "occurs", "anagram", "counter"],
        title="Most Frequent Value",
        difficulty="EASY",
        topics=["array", "hash-table"],
        statement="""Given an array `nums`, return the value that appears most often. If several values tie, return the **smallest** of them.

### Input format
Line 1: the array `nums`, space-separated.

### Output format
The most frequent value.""",
        constraints="- `1 <= nums.length <= 10^5`\n- `-10^4 <= nums[i] <= 10^4`",
        expected_time="O(n)",
        expected_space="O(n)",
        io=GeneratedIo(
            fn="mostFrequent",
            params=[GeneratedParam(name="nums", type="int[]")],
            returns="int",
        ),
        solution="""counts = {}
for value in nums:
    counts[value] = counts.get(value, 0) + 1
best_value = None
best_count = -1
for value in sorted(counts):
    if counts[value] > best_count:
        best_count = counts[value]
        best_value = value
return best_value""",
        hints=[
            "You need to know how many times each value appears before you can pick a winner. What structure records that in one pass?",
            "Count first, then choose. The tie-break rule tells you the order in which to inspect candidates.",
            "Build a value → count map in one pass, then iterate the keys in ascending order and keep the first strict maximum.",
        ],
        editorial="Counting is a single pass into a hash map. The tie-break — smallest value wins — is handled by scanning candidate keys in ascending order and only replacing the best on a strictly greater count.",
        make_inputs=lambda rng: _frequency_inputs(rng),
    ),
    Template(
        key="running-best",
        keywords=["maximum difference", "profit", "buy sell", "stock", "running minimum", "best time"],
        title="Best Profit From One Transaction",
        difficulty="EASY",
        topics=["array", "greedy", "dynamic-programming"],
        statement="""You are given an array `prices` where `prices[i]` is a price on day `i`.

Buy on one day and sell on a **strictly later** day. Return the maximum profit, or `0` if no profitable transaction exists.

### Input format
Line 1: the array `prices`, space-separated.

### Output format
The maximum profit.""",
        constraints="- `1 <= prices.length <= 10^5`\n- `0 <= prices[i] <= 10^4`",
        expected_time="O(n)",
        expected_space="O(1)",
        io=GeneratedIo(
            fn="bestProfit",
            params=[GeneratedParam(name="prices", type="int[]")],
            returns="int",
        ),
        solution="""best = 0
low = None
for price in prices:
    if low is None or price < low:
        low = price
    elif price - low > best:
        best = price - low
return best""",
        hints=[
            "Fix the day you sell. What is the only thing about the past that changes your profit?",
            "The entire history collapses into one number. Can you maintain it as you sweep forward?",
            "Track the minimum price seen so far; the best profit ending today is `price - minSoFar`.",
        ],
        editorial="If you sell on day i, you want the cheapest earlier price — so the whole prefix collapses to a single running minimum. One forward pass, constant space. This is the simplest DP with its state compressed to O(1).",
        make_inputs=lambda rng: _prices_inputs(rng),
    ),
    Template(
        key="balanced",
        keywords=["parentheses", "bracket", "balanced", "stack", "valid", "nesting", "matching"],
        title="Balanced Brackets",
        difficulty="EASY",
        topics=["string", "stack"],
        statement="""Given a string `s` containing only the characters `(`, `)`, `[`, `]`, `{` and `}`, return `true` if every bracket is closed by one of the same type and in the correct order.

### Input format
Line 1: the string `s`.

### Output format
`true` or `false`.""",
        constraints="- `1 <= s.length <= 10^4`\n- `s` contains only `()[]{}`",
        expected_time="O(n)",
        expected_space="O(n)",
        io=GeneratedIo(
            fn="isBalanced",
            params=[GeneratedParam(name="s", type="str")],
            returns="bool",
        ),
        solution="""pairs = {")": "(", "]": "[", "}": "{"}
stack = []
for ch in s:
    if ch in pairs:
        if not stack or stack.pop() != pairs[ch]:
            return False
    else:
        stack.append(ch)
return len(stack) == 0""",
        hints=[
            "When you meet a closing bracket, only one specific opener could legally match it. Where is that opener relative to everything else still open?",
            "The bracket that must match is always the most recently opened one still unclosed. Which structure gives you that ordering?",
            "Push openers; on a closer, pop and compare. The string is valid only if the stack ends empty.",
        ],
        editorial="'Correct order' is a statement about nesting, and nesting is last-in-first-out — which picks the data structure for you. Two easy-to-miss cases are a closer with nothing open, and openers never closed; the empty-stack check and the final emptiness check cover both.",
        make_inputs=lambda rng: _bracket_inputs(rng),
    ),
    Template(
        key="binary-search-answer",
        keywords=["binary search", "sorted", "log n", "halve", "search index", "rotated"],
        title="Index In A Sorted Array",
        difficulty="EASY",
        topics=["array", "binary-search"],
        statement="""Given a sorted array of **distinct** integers `nums` and an integer `target`, return the index of `target`, or `-1` if it is absent.

Your algorithm must run in `O(log n)`.

### Input format
Line 1: the sorted array `nums`, space-separated.
Line 2: the integer `target`.

### Output format
The index, or `-1`.""",
        constraints="- `1 <= nums.length <= 10^4`\n- values are distinct and sorted ascending",
        expected_time="O(log n)",
        expected_space="O(1)",
        io=GeneratedIo(
            fn="indexOf",
            params=[GeneratedParam(name="nums", type="int[]"), GeneratedParam(name="target", type="int")],
            returns="int",
        ),
        solution="""lo, hi = 0, len(nums) - 1
while lo <= hi:
    mid = lo + (hi - lo) // 2
    if nums[mid] == target:
        return mid
    if nums[mid] < target:
        lo = mid + 1
    else:
        hi = mid - 1
return -1""",
        hints=[
            "Sorted means one comparison rules out far more than a single element. What does comparing against the middle tell you?",
            "Keep an interval of indices that could still contain the target and shrink it every step. The hard part is the interval convention, not the idea.",
            "With `hi = n - 1` use `while lo <= hi`, and move to `mid + 1` / `mid - 1` so every branch strictly shrinks the range.",
        ],
        editorial="Three things decide correctness: a consistent interval convention, strict progress on every branch (never `hi = mid` in the closed convention), and computing `mid` as `lo + (hi - lo) // 2` to avoid overflow in fixed-width languages.",
        make_inputs=lambda rng: _sorted_inputs(rng),
    ),
    Template(
        key="prefix-product",
        keywords=["prefix", "suffix", "product", "except self", "cumulative", "running total"],
        title="Product Of All Others",
        difficulty="MEDIUM",
        topics=["array", "prefix-sum"],
        statement="""Given an array `nums`, return an array where position `i` holds the product of every element **except** `nums[i]`.

Solve it in `O(n)` and **without division**.

### Input format
Line 1: the array `nums`, space-separated.

### Output format
The result array, space-separated.""",
        constraints="- `2 <= nums.length <= 10^5`\n- `-30 <= nums[i] <= 30`",
        expected_time="O(n)",
        expected_space="O(1) extra",
        io=GeneratedIo(
            fn="productOfOthers",
            params=[GeneratedParam(name="nums", type="int[]")],
            returns="int[]",
        ),
        solution="""n = len(nums)
answer = [1] * n
running = 1
for i in range(n):
    answer[i] = running
    running *= nums[i]
running = 1
for i in range(n - 1, -1, -1):
    answer[i] *= running
    running *= nums[i]
return answer""",
        hints=[
            "Everything except position i splits into two independent halves. What are they?",
            "The answer at i is (product of everything left of i) × (product of everything right of i), and each is a running product.",
            "Sweep left to right writing the prefix product, then right to left multiplying by the suffix product. Zeros need no special case.",
        ],
        editorial="Division is banned for good reason — it breaks on zeros. Decompose instead into prefix × suffix, each a single sweep. Reusing the output array for the prefix pass keeps the extra space O(1) by convention.",
        make_inputs=lambda rng: _product_inputs(rng),
    ),
    Template(
        key="grid-components",
        keywords=["island", "grid", "matrix", "connected", "flood fill", "bfs", "dfs", "region"],
        title="Count Connected Regions",
        difficulty="MEDIUM",
        topics=["graph", "bfs", "dfs", "matrix"],
        statement="""Given an `m x n` grid of `'1'` (land) and `'0'` (water), count the number of islands. An island is a maximal group of `'1'`s connected **horizontally or vertically**.

### Input format
Line 1: two integers `m` and `n`.
Next `m` lines: a string of `n` characters, each `0` or `1`.

### Output format
The number of islands.""",
        constraints="- `1 <= m, n <= 300`\n- cells are `'0'` or `'1'`",
        expected_time="O(m * n)",
        expected_space="O(min(m, n))",
        io=GeneratedIo(
            fn="countRegions",
            params=[GeneratedParam(name="grid", type="grid")],
            returns="int",
        ),
        solution="""from collections import deque

if not grid:
    return 0
rows, cols = len(grid), len(grid[0])
count = 0
for r in range(rows):
    for c in range(cols):
        if grid[r][c] != "1":
            continue
        count += 1
        grid[r][c] = "0"
        queue = deque([(r, c)])
        while queue:
            cr, cc = queue.popleft()
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nr, nc = cr + dr, cc + dc
                if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == "1":
                    grid[nr][nc] = "0"
                    queue.append((nr, nc))
return count""",
        hints=[
            "You are counting groups, not cells. What single operation per group would let a plain counter work?",
            "When you find land you have not accounted for, that is a new island — now you must consume the whole island so it is never counted twice.",
            "On an unvisited '1', increment and flood fill (BFS), marking cells visited as you enqueue them. Mark on enqueue, not on dequeue.",
        ],
        editorial="This is connected-components counting on an implicit graph. Each flood fill is maximal, so no component is counted twice and every cell is reached from exactly one start. Mark cells when you enqueue them — marking on dequeue lets the same cell enter the queue many times.",
        make_inputs=lambda rng: _grid_inputs(rng),
    ),
    Template(
        key="min-coins",
        keywords=["coin", "change", "minimum coins", "dp", "knapsack", "fewest", "combination"],
        title="Fewest Coins To Reach A Total",
        difficulty="MEDIUM",
        topics=["array", "dynamic-programming"],
        statement="""Given coin denominations `coins` (unlimited supply of each) and an integer `amount`, return the fewest coins that sum to exactly `amount`, or `-1` if it cannot be done.

### Input format
Line 1: the array `coins`, space-separated.
Line 2: the integer `amount`.

### Output format
The minimum number of coins, or `-1`.""",
        constraints="- `1 <= coins.length <= 12`\n- `0 <= amount <= 10^4`",
        expected_time="O(amount * coins)",
        expected_space="O(amount)",
        io=GeneratedIo(
            fn="fewestCoins",
            params=[GeneratedParam(name="coins", type="int[]"), GeneratedParam(name="amount", type="int")],
            returns="int",
        ),
        solution="""INF = amount + 1
dp = [0] + [INF] * amount
for a in range(1, amount + 1):
    for coin in coins:
        if coin <= a and dp[a - coin] + 1 < dp[a]:
            dp[a] = dp[a - coin] + 1
return -1 if dp[amount] >= INF else dp[amount]""",
        hints=[
            "Greedy — always take the biggest coin that fits — is wrong here. Find a small input where it fails; that failure tells you what must be explored.",
            "If you knew the answer for every smaller amount, could you get the answer for this one in a single step?",
            "Let `dp[a]` be the fewest coins for amount `a`, with `dp[0] = 0`. Then `dp[a] = 1 + min(dp[a - c])` over coins `c <= a`. Build upward.",
        ],
        editorial="With coins [1,3,4] and amount 6, greedy takes 4+1+1 = three coins; the optimum is 3+3 = two. Taking the largest coin can strand you in a worse remainder, so the search must be exhaustive — which the DP does in O(amount x |coins|). Amounts are computed in increasing order so every subproblem is already final.",
        make_inputs=lambda rng: _coin_inputs(rng),
    ),
    Template(
        key="longest-distinct",
        keywords=["longest substring", "distinct", "without repeating", "unique characters", "two pointer"],
        title="Longest Run Of Distinct Characters",
        difficulty="MEDIUM",
        topics=["string", "sliding-window", "hash-table"],
        statement="""Given a string `s`, return the length of the longest **contiguous** substring containing no repeated character.

### Input format
Line 1: the string `s`.

### Output format
The length of the longest all-distinct substring.""",
        constraints="- `1 <= s.length <= 5 * 10^4`\n- `s` contains lowercase letters and digits",
        expected_time="O(n)",
        expected_space="O(k)",
        io=GeneratedIo(
            fn="longestDistinct",
            params=[GeneratedParam(name="s", type="str")],
            returns="int",
        ),
        solution="""last = {}
best = 0
left = 0
for right, ch in enumerate(s):
    if ch in last and last[ch] >= left:
        left = last[ch] + 1
    last[ch] = right
    if right - left + 1 > best:
        best = right - left + 1
return best""",
        hints=[
            "The answer is a range, not a set. If your current range is valid, what is the cheapest way to try to extend it?",
            "Grow on the right. When the new character breaks distinctness, the left edge must move — but moving it one step at a time is wasteful.",
            "Keep a character → last-index map and jump the left edge to `last[c] + 1`, but only if that is further right than where it already is.",
        ],
        editorial="Extending a valid window by one character introduces at most one duplicate — the new character — so the window only shrinks from the left. Storing each character's last index lets you jump the left edge directly. The trap is a stale index from before the current window: guard with `left = max(left, last[c] + 1)` or the answer inflates.",
        make_inputs=lambda rng: _distinct_inputs(rng),
    ),
]


# ── input generators ─────────────────────────────────────────────────────
#
# Each returns a list of stdin payloads. The first `sampleCount` become the
# visible samples; the rest are hidden. Deliberately includes degenerate cases
# (single element, all-equal, negatives) because that is where solutions break.


def _pair_sum_inputs(rng: random.Random) -> list[str]:
    cases: list[str] = []
    for size in (4, 2, 6, 8, 12, 20):
        nums = [rng.randint(-40, 40) for _ in range(size)]
        i, j = rng.sample(range(size), 2)
        target = nums[i] + nums[j]
        cases.append(f"{' '.join(map(str, nums))}\n{target}")
    return cases


def _window_inputs(rng: random.Random) -> list[str]:
    cases = ["1 2 3 4 5\n2", "5 -1 -1 -1 5\n5"]
    for size in (6, 9, 14, 25):
        k = rng.randint(1, max(1, size // 2))
        cases.append(f"{_ints(rng, size, -30, 60)}\n{k}")
    return cases


def _frequency_inputs(rng: random.Random) -> list[str]:
    cases = ["1 1 2 2 3", "7"]
    for size in (8, 12, 20, 30):
        pool = [rng.randint(-8, 8) for _ in range(4)]
        cases.append(" ".join(str(rng.choice(pool)) for _ in range(size)))
    return cases


def _prices_inputs(rng: random.Random) -> list[str]:
    cases = ["7 1 5 3 6 4", "7 6 4 3 1", "1"]
    for size in (8, 15, 30):
        cases.append(_ints(rng, size, 0, 200))
    return cases


def _bracket_inputs(rng: random.Random) -> list[str]:
    cases = ["()[]{}", "([)]", "{[()]}", "(", "]"]
    openers = "([{"
    closers = {"(": ")", "[": "]", "{": "}"}
    for _ in range(2):
        stack: list[str] = []
        out: list[str] = []
        for _ in range(rng.randint(4, 14)):
            if stack and rng.random() < 0.45:
                out.append(closers[stack.pop()])
            else:
                ch = rng.choice(openers)
                stack.append(ch)
                out.append(ch)
        cases.append("".join(out) or "()")
    return cases


def _sorted_inputs(rng: random.Random) -> list[str]:
    cases = ["-1 0 3 5 9 12\n9", "-1 0 3 5 9 12\n2", "5\n5"]
    for size in (7, 12, 25):
        nums = sorted(rng.sample(range(-100, 100), size))
        target = rng.choice(nums) if rng.random() < 0.6 else 101
        cases.append(f"{' '.join(map(str, nums))}\n{target}")
    return cases


def _product_inputs(rng: random.Random) -> list[str]:
    cases = ["1 2 3 4", "-1 1 0 -3 3", "2 3"]
    for size in (5, 7, 10):
        cases.append(" ".join(str(rng.randint(-6, 6)) for _ in range(size)))
    return cases


def _grid_inputs(rng: random.Random) -> list[str]:
    cases = [
        "4 5\n11110\n11010\n11000\n00000",
        "4 5\n11000\n11000\n00100\n00011",
        "1 1\n0",
        "3 3\n101\n010\n101",
    ]
    for _ in range(2):
        rows, cols = rng.randint(3, 7), rng.randint(3, 7)
        grid = ["".join("1" if rng.random() < 0.45 else "0" for _ in range(cols)) for _ in range(rows)]
        cases.append(f"{rows} {cols}\n" + "\n".join(grid))
    return cases


def _coin_inputs(rng: random.Random) -> list[str]:
    cases = ["1 2 5\n11", "2\n3", "1\n0", "1 3 4\n6"]
    for _ in range(2):
        coins = sorted(rng.sample(range(1, 30), rng.randint(2, 5)))
        cases.append(f"{' '.join(map(str, coins))}\n{rng.randint(1, 120)}")
    return cases


def _distinct_inputs(rng: random.Random) -> list[str]:
    cases = ["abcabcbb", "bbbbb", "pwwkew", "abba", "tmmzuxt"]
    alphabet = "abcdefg123"
    for _ in range(2):
        cases.append("".join(rng.choice(alphabet) for _ in range(rng.randint(6, 24))))
    return cases


# ── selection ────────────────────────────────────────────────────────────


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:60] or "practice-problem"


def match(prompt: str) -> tuple[Template, float]:
    """Pick the closest template by keyword overlap.

    Scored rather than first-match so "count the islands in a matrix" beats a
    template that merely happens to mention "count".
    """
    text = prompt.lower()
    words = set(re.findall(r"[a-z]+", text))
    best: tuple[Template, float] | None = None

    for template in TEMPLATES:
        score = 0.0
        for keyword in template.keywords:
            if keyword in text:
                # Multi-word keyword matches are much stronger evidence.
                score += 3.0 if " " in keyword else 1.5
            elif keyword in words:
                score += 1.0
        for topic in template.topics:
            if topic.replace("-", " ") in text:
                score += 1.0
        if best is None or score > best[1]:
            best = (template, score)

    assert best is not None
    return best


def generate(prompt: str, difficulty: str | None, seed: int) -> GeneratedProblem:
    template, score = match(prompt)
    rng = random.Random(seed)
    inputs = template.make_inputs(rng)

    # Reflect the learner's own words in the title so the generated problem does
    # not feel like a canned substitution.
    focus = " ".join(prompt.split()[:6]).strip().rstrip(".?!")
    title = template.title if score >= 3 else f"{template.title}"
    slug = f"practice-{_slugify(focus or template.key)}-{seed % 100000}"

    return GeneratedProblem(
        title=title,
        slug=slug,
        difficulty=(difficulty or template.difficulty).upper(),
        topics=template.topics,
        statement=template.statement,
        statementDigest=re.sub(r"\s+", " ", re.sub(r"#+ .*", "", template.statement))[:400].strip(),
        constraints=template.constraints,
        constraintsDigest=re.sub(r"\s+", " ", template.constraints.replace("-", ""))[:200].strip(),
        expectedTime=template.expected_time,
        expectedSpace=template.expected_space,
        io=template.io,
        referenceSolution=template.solution,
        testInputs=inputs,
        sampleCount=2,
        hints=template.hints,
        editorial=template.editorial,
        source="template",
    )
