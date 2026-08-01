/**
 * The curriculum: two independently-ordered, originally-authored paths over
 * the same problem catalogue.
 *
 * A section IS a concept — this file is concept-first by design. `lesson` is
 * the actual teaching content (what it is, when to reach for it, a worked
 * walkthrough); `core`/`depth` problems are attached as practice for that
 * concept, not the other way round. The ORDER is the real content here: no
 * amount of tagging tells you that hashing should come before two-pointers,
 * or that trees should come before graphs — that is an editorial judgement,
 * made explicit by the `order` field within each track.
 *
 * FOUNDATIONS is a beginner-first sequence. ADVANCED is a separate,
 * interview-style deep pass covering harder patterns (heaps, backtracking,
 * bit tricks, greedy proofs, graph connectivity, DP patterns). Both are
 * original content — not a reproduction of any named external syllabus.
 */
export interface SeedCurriculumSection {
  track: 'FOUNDATIONS' | 'ADVANCED';
  slug: string;
  title: string;
  description: string;
  outcome: string;
  icon: string;
  order: number;
  lesson: string;
  keyPatterns: string[];
  commonPitfall: string;
  typicalTime: string;
  typicalSpace: string;
  core: string[];
  depth?: string[];
}

export const CURRICULUM: SeedCurriculumSection[] = [
  /* ═══════════════════════════ FOUNDATIONS ═══════════════════════════ */
  {
    track: 'FOUNDATIONS',
    slug: 'dsa-basics-and-complexity',
    title: 'DSA Basics & Complexity',
    description:
      'What an algorithm actually is, how to count the work it does, and why that count is the entire point of Big-O.',
    outcome: 'You can look at a loop and state, correctly, how many times its body runs as a function of the input size.',
    icon: 'Gauge',
    order: 1,
    lesson: `Before any pattern — scanning, hashing, two pointers — makes sense, it helps to be explicit about what a "data structure and algorithms" problem is actually asking: given an input of some size \`n\`, how much *work* does a procedure do, and how does that work grow as \`n\` grows?

**An algorithm is just a precise, finite sequence of steps.** "Find the largest number in a list" has many valid algorithms — scan once and remember the biggest seen so far, or sort the list and take the last element — and they cost different amounts of work for the same answer. Comparing algorithms is comparing *how their cost grows*, not just whether they're correct.

**Counting operations is the honest way to build intuition for Big-O**, before trusting the shorthand. A single loop over \`n\` elements does work proportional to \`n\` — written \`O(n)\`. A loop nested inside another loop, each running roughly \`n\` times, does work proportional to \`n * n = n^2\` — written \`O(n^2)\`. Big-O deliberately drops constants and lower-order terms (an algorithm doing \`3n + 7\` operations is still \`O(n)\`) because what matters at scale is the *shape* of the growth, not the exact count on any one input.

**Why this matters immediately, not just later:** a constraint like "\`n\` up to \`10^5\`" is a direct hint about the required complexity class. An \`O(n^2)\` algorithm on \`n = 10^5\` performs on the order of \`10^{10}\` operations — far too slow for an interactive system, which typically budgets on the order of \`10^8\` operations per second. Learning to read constraints as a complexity budget, before writing a line of code, is one of the highest-leverage habits this entire curriculum tries to build.

**Worked example.** Reversing an array by walking it once and building the result backward touches each of the \`n\` elements exactly once — \`O(n)\`. Checking every pair of elements for a matching sum touches roughly \`n^2/2\` pairs — \`O(n^2)\`. Same input, same size \`n\`, very different cost, purely because of *how many times* each element gets touched.`,
    keyPatterns: [
      'A single pass over n elements is O(n); a pass nested inside another pass is O(n^2)',
      'Big-O describes the SHAPE of growth, dropping constants and lower-order terms',
      'Read the input-size constraint as a complexity budget before choosing an approach',
    ],
    commonPitfall:
      'Assuming an algorithm is "fast enough" without checking it against the stated constraints — an O(n^2) approach is often fine for n <= 1000 and unusable for n >= 10^6, and the constraints tell you which regime you\'re in.',
    typicalTime: 'varies — the point of this section is learning to derive it, not memorise it',
    typicalSpace: 'varies',
    core: [
      'array-sum-and-average',
      'find-second-largest',
      'is-power-of-two-basic',
      'count-operations-linear-scan',
      'reverse-array-in-place',
      'rotate-array-by-k-brute',
    ],
    depth: [],
  },
  {
    track: 'FOUNDATIONS',
    slug: 'arrays-and-scanning',
    title: 'Arrays & Single-Pass Scanning',
    description:
      'The habit everything else builds on: walking a collection once while maintaining exactly the state you need.',
    outcome: 'You can recognise when an entire history can be collapsed into one or two running variables.',
    icon: 'Rows3',
    order: 2,
    lesson: `An array is the default container for "a sequence of things", and a huge share of DSA difficulty comes down to one question: **how much of the array's history do you actually need to remember** to answer the question at each position?

The naive instinct is to keep looking backward — for every element, re-scan everything before it. That's what produces the nested loops beginners write everywhere, and it's almost always avoidable, because most "look backward" questions only need a small, fixed summary of the past: a running maximum, a running sum, a count seen so far, a minimum-to-date.

**The core move:** as you scan left to right, ask "what single number (or small fixed set of numbers) about everything I've seen so far would let me answer the question at this position, without re-reading the past?" If you can name that number, you have a single-pass, O(n) algorithm. If you genuinely can't — if the answer at position i truly depends on some *specific* earlier element rather than a summary of all of them — that's usually a signal you need a different structure (a hash map, a stack, two pointers), which later sections build on.

**Worked example.** "Best Time to Buy and Sell Stock": for each day, the best possible profit if you *sell* today depends only on the cheapest price seen on any earlier day. You don't need to remember every previous price — just the minimum so far. That's the whole algorithm: track \`minSoFar\`, and at each day compute \`price - minSoFar\`, keeping the best.`,
    keyPatterns: [
      'Running maximum/minimum updated once per element',
      'A single accumulator (sum, count, product) instead of re-deriving it',
      '"Best answer ending here" compared against "best answer overall"',
    ],
    commonPitfall:
      'Initialising an accumulator to 0 when the array can contain negative values — this silently produces a wrong answer of 0 on an all-negative input instead of the correct (negative) maximum.',
    typicalTime: 'O(n)',
    typicalSpace: 'O(1)',
    core: ['contains-duplicate', 'best-time-to-buy-and-sell-stock', 'maximum-subarray'],
    depth: ['majority-element', 'move-zeroes'],
  },
  {
    track: 'FOUNDATIONS',
    slug: 'hashing',
    title: 'Hashing & Lookup',
    description:
      'The single biggest lever in this whole subject: turning a search into a constant-time question.',
    outcome: 'When you see a nested loop searching for a value, your first instinct is a hash structure.',
    icon: 'KeyRound',
    order: 3,
    lesson: `Almost every accidental O(n²) solution has the same shape: a loop, and inside it, another loop (or a linear \`in\` check) *searching* for something. A hash map or hash set answers "have I seen this?" or "what index was this at?" in O(1) instead of O(n) — which is precisely the operation that was making the inner loop necessary in the first place.

**The reframe that unlocks most hashing problems:** stop asking "which pair of elements works?" and start asking, for each element in turn, "what specific OTHER value would I need to have already seen for this element to complete an answer?" If you can name that value, look it up. If it's there, you're done; if not, record the current element and move on. This turns a search over the whole array into a single membership check.

**Two closely related but different tools:**
- a **set** answers "have I seen this value at all?" — useful for duplicates, uniqueness, and any all-or-nothing question
- a **map** answers "have I seen this value, and if so, *where* / how many times?" — useful whenever the answer needs more than a yes/no

**Worked example.** Two Sum: for each number \`x\`, the partner you need is exactly \`target - x\` — not "some number less than x" or any other vague condition, but one specific value. Check the map for it before inserting \`x\`, and you never need to compare \`x\` against anything you haven't already indexed.`,
    keyPatterns: [
      '"Have I seen X before?" → hash set membership',
      '"What was seen at value X?" → hash map lookup',
      'Frequency counting via a map, then a second pass over the counts',
      'Look up the complement/partner BEFORE inserting the current element, to avoid self-pairing',
    ],
    commonPitfall:
      'Inserting the current element into the map before checking for its complement — this lets an element pair with itself when it shouldn\'t.',
    typicalTime: 'O(n)',
    typicalSpace: 'O(n)',
    core: ['two-sum', 'valid-anagram', 'longest-consecutive-sequence'],
    depth: ['single-number', 'missing-number', 'subarray-sum-equals-k'],
  },
  {
    track: 'FOUNDATIONS',
    slug: 'two-pointers-and-windows',
    title: 'Two Pointers & Sliding Windows',
    description:
      'Two indices moving under an invariant, and windows that maintain an aggregate incrementally.',
    outcome: 'You can decide whether a problem wants a fixed window, a shrinking window, or converging ends.',
    icon: 'MoveHorizontal',
    order: 4,
    lesson: `This section covers two related but distinct techniques that both use a pair of indices instead of nested loops.

**Two pointers (converging ends).** Used when the array is sorted (or can be treated as such) and you're looking for a pair or checking a symmetric property. Start one pointer at each end; based on a comparison, move exactly one of them inward. Each pointer moves at most n times total, giving O(n) instead of the O(n²) of checking every pair. The classic tell: "sorted array" + "pair/triplet satisfying a sum condition" or "palindrome-style symmetry".

**Sliding window (same-direction, variable width).** Used when you're looking for the best/longest/shortest *contiguous* range satisfying some property. Grow the window by advancing a right pointer; when the window becomes invalid (or you want to try shrinking it), advance a left pointer. The insight that makes this O(n) rather than O(n²): each pointer only ever moves forward, so the total movement across the whole algorithm is bounded by 2n, even though it looks like a nested loop.

**How to tell them apart:** two pointers usually start at opposite ends and move toward each other; a sliding window usually starts both pointers together at the left and only ever expands right / contracts left, tracking some aggregate (a sum, a character count, a set of "seen" elements) incrementally as the window changes — never recomputing it from scratch.

**Worked example.** "Longest Substring Without Repeating Characters": grow the window right by one character at a time. If that character already exists inside the current window, don't restart from scratch — jump the left edge directly to just past its previous occurrence. That's what keeps it O(n) instead of O(n²).`,
    keyPatterns: [
      'Sorted array + pair/triplet sum → converging pointers from both ends',
      'Longest/shortest contiguous range with a property → sliding window',
      'Maintain the window\'s aggregate incrementally (add on expand, remove on shrink) rather than recomputing it',
    ],
    commonPitfall:
      'Recomputing the window\'s sum/count from scratch on every shrink or grow step instead of updating it incrementally — this silently turns an O(n) sliding window into O(n²).',
    typicalTime: 'O(n)',
    typicalSpace: 'O(1) to O(k)',
    core: ['longest-substring-without-repeating-characters', 'container-with-most-water'],
    depth: ['is-palindrome', 'product-of-array-except-self'],
  },
  {
    track: 'FOUNDATIONS',
    slug: 'stacks-and-strings',
    title: 'Stacks & String Structure',
    description: 'Nesting, matching and monotonic scans — where last-in-first-out is the answer.',
    outcome: 'You recognise nesting problems on sight and reach for a stack without hesitating.',
    icon: 'Layers',
    order: 5,
    lesson: `A stack answers exactly one question extremely well: **"what is the most recent unresolved thing?"** Any problem whose structure is nested — brackets, function calls, undo history — has that shape, because the thing that must close next is always the thing that opened most recently.

**How to recognise a stack problem:** look for the words "matching", "nesting", "most recent", or "valid ordering of opens and closes". If closing something out of order would be invalid, and the correct partner for any "close" is always the *nearest* unmatched "open", that's a stack.

**The mechanical pattern:** push on "open" events. On a "close" event, pop and check it matches what you expected; if the stack is empty when you expect something to pop, or something is left unpopped at the end, that's invalid.

**A second family — monotonic stacks — solves a different-looking but related question:** "for each element, what is the nearest earlier/later element that is smaller/larger than it?" Keep a stack whose elements are in increasing (or decreasing) order; when a new element would break that order, pop everything it invalidates, and each pop tells you something about the relationship between the popped element and the current one. This is how problems like Trapping Rain Water and Largest Rectangle in Histogram get solved in O(n) instead of the O(n²) that checking every pair of boundaries would cost.

**Worked example.** Valid Parentheses: push every opening bracket. On a closing bracket, the ONLY thing it could legally match is whatever is on top of the stack right now — not any earlier opener, only the most recent one — which is precisely what makes this a stack problem rather than, say, a counting problem.`,
    keyPatterns: [
      'Push on "open", pop-and-check on "close"',
      'Empty stack when expecting a match, or leftover items at the end, both mean invalid',
      'Monotonic stack: maintain increasing/decreasing order, popping resolves a "nearest greater/smaller" relationship',
    ],
    commonPitfall:
      'Forgetting to check the final stack is empty — a string of only unclosed openers passes every individual match check but is still invalid overall.',
    typicalTime: 'O(n)',
    typicalSpace: 'O(n)',
    core: ['valid-parentheses', 'longest-common-prefix'],
    depth: ['largest-rectangle-in-histogram', 'valid-string-with-backspaces', 'min-add-to-make-parens-valid'],
  },
  {
    track: 'FOUNDATIONS',
    slug: 'binary-search',
    title: 'Binary Search',
    description:
      'Halving a search space that carries a monotone predicate — and getting the boundary conditions right.',
    outcome: 'You can write binary search correctly from memory, including on a rotated array.',
    icon: 'Crosshair',
    order: 6,
    lesson: `Binary search applies whenever you can ask a yes/no question about a position that is **monotone** — once the answer flips from "no" to "yes" as you move through the space, it never flips back. A sorted array is the obvious case ("is this element >= target?" flips exactly once), but the technique applies far more broadly: to answers you're guessing (binary search "on the answer"), to rotated arrays, to any monotone predicate at all.

**Why it's O(log n):** every comparison eliminates HALF of the remaining candidates, not just one. That halving is the entire source of the speedup over a linear scan — it's also why getting the halving step wrong (an off-by-one that doesn't actually shrink the range) is so damaging: it doesn't just slow the algorithm down, it can make it loop forever.

**The three things that decide correctness, every time:**
1. **A consistent interval convention.** Pick either a closed interval (\`hi = n-1\`, loop while \`lo <= hi\`, moves are \`mid+1\`/\`mid-1\`) or a half-open one (\`hi = n\`, loop while \`lo < hi\`, moves are \`mid+1\`/\`mid\`) — and don't mix them.
2. **Strict progress on every branch.** Every branch must exclude \`mid\` from the next range (in the closed convention). Writing \`hi = mid\` there can leave the range unchanged and hang forever.
3. **No overflow.** Compute \`mid\` as \`lo + (hi - lo) // 2\`, not \`(lo + hi) // 2\` — irrelevant in Python, but the habit matters for fixed-width languages.

**Worked example — rotated array.** The array isn't globally sorted anymore, but a strong local property survives: split it at any midpoint, and **at least one half is still fully sorted**. Test which half is sorted with one comparison (\`nums[lo] <= nums[mid]\`), then check whether the target could be in that sorted half; if not, it must be in the other half. Still O(log n), just with an extra branch.`,
    keyPatterns: [
      'A monotone yes/no predicate over a range → binary search that predicate, not just a plain sorted array',
      'Pick ONE interval convention (closed or half-open) and apply it consistently',
      'On a rotated sorted array, at least one half of any split is still fully sorted — test which',
    ],
    commonPitfall:
      'Mixing interval conventions — using `hi = n - 1` with `while lo < hi` and `hi = mid`, which can leave the range stuck and loop forever on certain inputs.',
    typicalTime: 'O(log n)',
    typicalSpace: 'O(1)',
    core: ['binary-search', 'search-in-rotated-sorted-array'],
    depth: ['kth-largest-element', 'search-insert-position', 'find-peak-element'],
  },
  {
    track: 'FOUNDATIONS',
    slug: 'recursion-patterns',
    title: 'Recursion Patterns',
    description:
      'The choose/explore/un-choose template that underlies every recursive algorithm you will write from here on.',
    outcome: 'You can write a recursive function by naming its base case and its self-similar step, and add memoisation when calls repeat.',
    icon: 'GitFork',
    order: 7,
    lesson: `Recursion is a function calling itself on a *smaller* version of the same problem, until it reaches a case small enough to answer directly — the **base case**. Every recursive function you will ever write has exactly these two parts: a base case that stops the recursion, and a recursive step that reduces the problem and trusts the recursive call to solve that smaller piece correctly.

**Why trust the recursive call?** This is the part beginners find hardest to accept: you do not need to trace through every level of recursion in your head to know it works. If you can show that the function is correct for the base case, and that it's correct for size \`n\` ASSUMING it's already correct for every smaller size, then by induction it's correct for every size. This is exactly mathematical induction, just running as code.

**The template that covers almost every recursive function:**
1. **Base case** — the smallest input you can answer without recursing.
2. **Recursive step** — reduce the input by *some* amount, call the same function on the reduced input, and combine that result with whatever work belongs at this level.

**When recursion gets slow — overlapping subproblems.** Some recursive functions (Fibonacci is the classic example) call themselves multiple times per level, and those calls can ask the exact same question repeatedly. If \`fib(5)\` calls \`fib(4)\` and \`fib(3)\`, and \`fib(4)\` *also* calls \`fib(3)\`, that's the same subproblem computed twice — and the redundancy compounds exponentially with depth. The fix, memoisation, is simple: cache each result the first time it's computed, keyed by its input, and return the cached value instead of recomputing on every repeat.

**Worked example.** Computing \`power(2, 5)\`: the recursive step is \`power(base, exp) = base * power(base, exp - 1)\`, and the base case is \`power(base, 0) = 1\`. So \`power(2,5) = 2 * power(2,4) = 2 * (2 * power(2,3)) = ...\` all the way down to \`power(2,0) = 1\`, and the multiplications unwind back up: \`1 → 2 → 4 → 8 → 16 → 32\`.`,
    keyPatterns: [
      'Name the base case first — the smallest input answerable with no recursion',
      'The recursive step reduces the input and trusts the recursive call, rather than re-deriving the whole answer',
      'If the same (arguments) are recursed into more than once, memoise — cache by argument, return the cached value on a repeat',
    ],
    commonPitfall:
      'Writing a recursive step that does not actually shrink toward the base case on every path (e.g. an off-by-one in the reduction), which produces infinite recursion and a stack overflow instead of a slow-but-correct answer.',
    typicalTime: 'O(branches^depth) without memoisation; O(distinct states) with it',
    typicalSpace: 'O(depth) call stack, plus O(states) if memoised',
    core: [
      'factorial-and-power-recursive',
      'sum-of-digits-recursive',
      'fibonacci-memoized',
      'count-subsets-with-target-sum',
      'count-valid-parenthesis-combinations',
      'letter-case-permutation-count',
      'tower-of-hanoi-move-count',
    ],
    depth: ['kth-lexicographic-permutation'],
  },
  {
    track: 'FOUNDATIONS',
    slug: 'dynamic-programming-intro',
    title: 'Dynamic Programming — Getting Started',
    description:
      'Overlapping subproblems and optimal substructure, starting from the smallest possible state.',
    outcome: 'You can define a state, write its recurrence, and decide between top-down and bottom-up.',
    icon: 'Network',
    order: 8,
    lesson: `Dynamic programming is not a new algorithm so much as a discipline for **recursion that repeats work**. If a recursive solution to a problem calls itself with the *same arguments* many times along different paths, you're paying exponential cost to solve what is really a small number of distinct subproblems.

**The three questions that define a DP:**
1. **What is the state?** — the minimal set of parameters that fully describes a subproblem. "The best answer using only the first i elements" is a classic one-dimensional state.
2. **What is the recurrence?** — how does the answer for a state relate to the answers for smaller states? This almost always comes from asking "what are the choices available at this step, and where does each choice lead?"
3. **What is the base case?** — the smallest state(s) you can answer directly, without recursing further.

**Two ways to compute it, same underlying idea:**
- **top-down (memoisation):** write the natural recursion, but cache results by state so repeated calls return instantly instead of re-descending
- **bottom-up (tabulation):** compute every state in an order where its dependencies are already known, usually smallest-to-largest, storing results in an array/table

Bottom-up is usually more memory-efficient (you can often discard old rows once nothing needs them) and avoids recursion-depth limits; top-down is usually easier to *write* the first time, because it mirrors your natural recursive thinking.

**Worked example.** Climbing Stairs: to reach step \`i\`, your very last move was either a single step (arriving from \`i-1\`) or a double step (arriving from \`i-2\`) — those two cases are the entire recurrence, \`ways(i) = ways(i-1) + ways(i-2)\`, and it's exactly the Fibonacci sequence in disguise.`,
    keyPatterns: [
      'Define state → write recurrence from "what are my choices here" → identify the base case',
      'Naive recursion + repeated identical calls → memoise or tabulate',
      'A state defined by only 1-2 numbers can usually be computed bottom-up with rolling variables instead of a full table',
    ],
    commonPitfall:
      'Writing the recurrence correctly but computing states in the wrong order for a bottom-up table, so a needed dependency isn\'t filled in yet when you try to use it.',
    typicalTime: 'O(states × transitions per state)',
    typicalSpace: 'varies — often reducible from O(n) to O(1)',
    core: ['climbing-stairs', 'house-robber', 'coin-change'],
    depth: ['word-break', 'edit-distance'],
  },
  {
    track: 'FOUNDATIONS',
    slug: 'graphs-and-traversal',
    title: 'Graphs & Traversal',
    description:
      'BFS, DFS, connectivity and ordering — on explicit graphs and on grids that are graphs in disguise.',
    outcome: 'You can model a problem as a graph and pick the traversal that matches the question.',
    icon: 'Share2',
    order: 9,
    lesson: `A huge number of problems that don't *look* like graphs actually are one: a grid where you move between adjacent cells, a dependency list, a network of accounts — anywhere there's a notion of "nodes" and "which nodes connect to which", graph traversal applies.

**BFS vs. DFS — the question decides the tool:**
- **BFS (queue-based, level by level)** explores the *nearest* things first. Use it whenever the question involves "shortest path" or "fewest steps" in an unweighted graph, or "spread simultaneously from multiple sources" (like a multi-source flood-fill).
- **DFS (stack-based or recursive, go deep first)** explores one path as far as it can before backtracking. Use it for connectivity questions ("can I reach X at all"), counting components, or anywhere the specific *distance* doesn't matter — only reachability or structure.

**The pattern that recurs everywhere:** counting connected components (islands, provinces, friend circles) is always the same three-step shape: scan every node; on an unvisited one, that's a *new* component — increment a counter and flood-fill (BFS or DFS, either works here) to mark every node reachable from it as visited, so it's never counted again.

**A subtlety worth internalising early:** mark a node as visited **the moment you decide to visit it** (when you enqueue it in BFS, or the instant you recurse into it in DFS) — not later, when you finally process it. Marking too late lets the same node get queued multiple times from different directions, which at best wastes work and at worst causes incorrect counts.

**Worked example.** Number of Islands: for every unvisited land cell, that's a brand-new island — flood-fill from it (marking cells visited as you go) to consume the whole island in one pass, so the counter increments exactly once per island.`,
    keyPatterns: [
      'Shortest path / fewest steps in an unweighted graph → BFS',
      'Reachability / connectivity / component counting → DFS or BFS, either works',
      'Multiple simultaneous starting points spreading outward → multi-source BFS, all sources queued at once',
      'Mark visited at enqueue/recurse time, not at process time',
    ],
    commonPitfall:
      'Marking a node visited only when it is dequeued/processed rather than when it is first discovered — this lets the same node enter the queue multiple times.',
    typicalTime: 'O(V + E)',
    typicalSpace: 'O(V)',
    core: ['number-of-islands', 'course-schedule'],
    depth: [
      'count-connected-components-basic',
      'flood-fill-region',
      'clone-graph-adjacency-count',
      'shortest-path-unweighted-grid',
    ],
  },
  {
    track: 'FOUNDATIONS',
    slug: 'hard-synthesis',
    title: 'Combining Ideas Under Pressure',
    description:
      'Problems that need two ideas at once, where the first correct approach is still too slow.',
    outcome: 'You can hold a two-part invariant in your head and reason about it under pressure.',
    icon: 'Flame',
    order: 10,
    lesson: `Every earlier section taught one idea in isolation. The problems here need **two ideas simultaneously** — and often, the first approach you think of is correct but too slow, which is itself useful information: getting a working O(n²) solution first, then asking "what is this recomputing that it doesn't need to?", is a completely legitimate way to find the faster approach.

**What tends to combine:**
- a scanning/window idea PLUS a monotonic structure (Trapping Rain Water: two-pointer convergence, but each side also needs to track a running maximum)
- a DP recurrence PLUS a decision about what to optimise over two related sequences at once (Edit Distance: the state is a *pair* of positions, one in each string, not a single index)
- a stack PLUS a geometric/counting insight (Largest Rectangle in Histogram: the stack tracks candidates for "nearest shorter bar", which is what bounds each rectangle)

**A general strategy for this tier:** first write down what you'd compute if you were willing to look at every pair / every combination — even if it's O(n²) or worse. That naive version usually contains the real recurrence or invariant, just computed wastefully. Then ask specifically: *what is being recomputed across different iterations that could instead be maintained incrementally, or looked up instead of re-derived?* That question is what turns the brute force into the accepted solution.

**Worked example.** Trapping Rain Water: the brute-force insight — water at position i rises to \`min(tallest-to-the-left, tallest-to-the-right) - height[i]\` — is correct immediately, but computing both "tallest to the left" and "tallest to the right" independently for every position looks like it needs two full passes of precomputed arrays. The refinement (two pointers with running maxima, converging inward) doesn't change the underlying formula at all — it just finds a way to *know enough* about one side to commit to an answer without having fully explored the other side yet.`,
    keyPatterns: [
      'Write the brute-force version first — it usually contains the correct recurrence or invariant, just computed wastefully',
      'Ask specifically what is being recomputed across iterations, and whether it can be maintained incrementally instead',
      'A DP state can be a PAIR of positions (one per sequence) when the problem compares two sequences at once',
    ],
    commonPitfall:
      'Jumping straight to an optimised approach without first confirming a brute-force version is even correct — making it much harder to tell whether a bug is in the logic or in the optimisation.',
    typicalTime: 'varies — often O(n) or O(n²) after the key insight',
    typicalSpace: 'varies',
    core: ['trapping-rain-water', 'edit-distance'],
    depth: ['largest-rectangle-in-histogram', 'word-break'],
  },

  /* ═══════════════════════════ ADVANCED ═══════════════════════════════ */
  {
    track: 'ADVANCED',
    slug: 'heaps-and-top-k',
    title: 'Heaps & Top-K Selection',
    description:
      'Whenever you need "the k biggest/smallest" without fully sorting everything, a heap is the tool.',
    outcome: 'You reach for a bounded heap instead of a full sort whenever k is much smaller than n.',
    icon: 'ArrowUpDown',
    order: 1,
    lesson: `Sorting the entire input to find the top \`k\` costs O(n log n) — correct, but wasteful when \`k\` is small relative to \`n\`. A heap gives you exactly the operations "insert" and "peek/remove the smallest (or largest)" in O(log n) each, which is precisely enough to maintain a **bounded** collection of the best \`k\` items seen so far, in O(n log k) total.

**The inversion that trips people up:** to track the \`k\` LARGEST values, you maintain a MIN-heap of size \`k\`. That feels backwards until you see why: the element you want to evict, whenever the heap grows past size \`k\`, is the *smallest* of your current top-\`k\` candidates — and a min-heap gives you exactly that element at the root, in O(log k) to remove. (Symmetrically, tracking the \`k\` smallest uses a max-heap.)

**Beyond top-k, heaps solve two other recurring shapes:**
- **greedy merging** — repeatedly combine the two smallest/cheapest items, because doing so keeps large values out of circulation for as long as possible (rope-joining, Huffman-style problems)
- **scheduling under a resource constraint** — when you need to always pick the currently-most-urgent or currently-least-loaded option, a heap keeps that choice available in O(log n) as the situation changes

**Worked example.** Top K Frequent Elements: count frequencies with a hash map first (that part is not in question), then push \`(count, value)\` pairs into a size-\`k\` min-heap, popping the minimum whenever the heap exceeds \`k\`. What survives at the end is exactly the \`k\` most frequent values — found without ever sorting the full list of distinct values.`,
    keyPatterns: [
      'Need the k largest → maintain a size-k MIN-heap (evict the smallest of your current best-k)',
      'Need the k smallest → maintain a size-k MAX-heap',
      'Repeatedly combine the two cheapest/smallest items → min-heap greedy merge',
      'A priority constantly changes as you process input → heap keeps "current best/most-urgent" available cheaply',
    ],
    commonPitfall:
      'Using a max-heap to track the k largest values (or vice versa) — the eviction logic is inverted, and the heap ends up holding the wrong end of the distribution.',
    typicalTime: 'O(n log k)',
    typicalSpace: 'O(k)',
    core: ['top-k-frequent-elements', 'connect-ropes-min-cost', 'task-scheduler-cooldown'],
    depth: ['kth-largest-element', 'k-closest-points-to-origin'],
  },
  {
    track: 'ADVANCED',
    slug: 'backtracking-search',
    title: 'Backtracking',
    description: 'Systematic search over decisions, with the ability to undo a bad choice and try another.',
    outcome: 'You can write a backtracking search from the choose/explore/un-choose template without hesitating.',
    icon: 'GitBranch',
    order: 2,
    lesson: `Backtracking is depth-first search over a **decision tree**, where each node represents a partial solution and each edge represents one choice. The technique is a template you can apply almost mechanically once you see the shape:

\`\`\`
def backtrack(partial_solution):
    if partial_solution is complete:
        record it / count it
        return
    for choice in available_choices(partial_solution):
        if choice is valid given partial_solution:
            make the choice           # e.g. mark a cell used, place a queen
            backtrack(partial_solution + choice)
            undo the choice           # THIS STEP IS NOT OPTIONAL
\`\`\`

**The step people forget is the undo.** After recursing, the state must be restored to exactly what it was before the choice was made — otherwise the next sibling choice in the loop is exploring a corrupted state, not a true alternative. This is the single most common backtracking bug, and it's silent: the code runs, it just gives fewer (or wrong) results because later branches were poisoned by earlier ones.

**Why this isn't just "brute force with extra steps":** the moment a partial solution is provably invalid (a queen already attacks the current square; a path has revisited a cell), you stop exploring that branch immediately rather than completing it and checking at the end. This pruning is what makes backtracking tractable in practice even though its worst-case complexity is still exponential — most of the search tree gets cut off long before it's fully explored.

**Worked example.** N-Queens: place queens row by row (never row-by-row conflicts, since no two queens share a row by construction). At each row, try each column; if it conflicts with an existing queen's column or either diagonal, skip it immediately rather than recursing into a doomed branch. Track occupied columns and diagonals as sets you add to before recursing and remove from after — that add/recurse/remove triad IS the choose/explore/un-choose template.`,
    keyPatterns: [
      'choose → explore (recurse) → un-choose, every single time, including on the failing branches',
      'Prune as early as possible — check validity before recursing, not after completing',
      'Track "used" state (columns, cells, remaining budget) with structures that support fast add/remove',
    ],
    commonPitfall:
      'Forgetting to undo a choice after the recursive call returns — this corrupts the state for every sibling branch explored afterward, producing wrong or incomplete results with no error or crash.',
    typicalTime: 'exponential in the worst case, heavily reduced by pruning',
    typicalSpace: 'O(depth of the decision tree)',
    core: ['n-queens-count', 'subset-sum-count', 'word-search-grid'],
    depth: ['kth-permutation-sequence', 'word-break-count-ways', 'restore-ip-addresses-count'],
  },
  {
    track: 'ADVANCED',
    slug: 'bit-manipulation',
    title: 'Bit Manipulation',
    description: 'Reasoning about numbers one bit at a time — XOR tricks, masks, and per-position counting.',
    outcome: 'You recognise when a problem is really about one bit position at a time, not the whole number.',
    icon: 'Binary',
    order: 3,
    lesson: `Most bit-manipulation problems come down to exploiting one of a small number of properties of XOR, or reframing a problem as "count something separately at each of the (fixed, small — usually 32) bit positions".

**XOR's defining properties**, which do almost all the work:
- \`x ^ x = 0\` — a value cancels with itself
- \`x ^ 0 = x\` — the identity
- commutative and associative — order and grouping don't matter

Those three facts are why "every value appears twice except one" collapses to "XOR the whole array" — every pair cancels, and the identity leaves the lone survivor. When there are **two** unpaired values instead of one, XOR-ing everything gives you \`a ^ b\`, not either value alone — but any bit that's *set* in that result is a position where \`a\` and \`b\` differ, which lets you split the whole array into two groups (by that bit) that each independently XOR down to one of the two answers.

**The "per bit position" reframe** applies whenever you're aggregating something across *pairs* or *all elements* in a way that's expensive to do directly. Instead of "for each pair, compare all 32 bits" (expensive), do "for each of the 32 bit positions, count how many numbers have it set" (cheap, and the counts alone often answer the whole question — e.g. Hamming distance sums reduce to \`count_set × count_unset\` at each position).

**Worked example.** Counting Bits: rather than computing the popcount of every number from scratch, notice \`i >> 1\` (i.e. \`i\` with its last bit dropped) already has a known popcount if you've filled the array in order — so \`popcount(i) = popcount(i >> 1) + (i & 1)\`. Each number's answer is built from a smaller number's answer already sitting in the array, in O(1) per element.`,
    keyPatterns: [
      '"Every element appears twice except one/two" → XOR-based cancellation',
      'Aggregating something across all pairs → reframe as counting per bit position instead',
      'A number\'s bit-derived property often relates simply to a smaller number\'s (i >> 1) same property',
    ],
    commonPitfall:
      'Assuming XOR-ing everything isolates a single unique value when there are actually TWO unpaired values — the direct XOR only gives you their XOR, not either one individually, and needs one more step (splitting by a differing bit) to separate them.',
    typicalTime: 'O(n) or O(32n)',
    typicalSpace: 'O(1)',
    core: ['counting-bits', 'single-number-two-uniques', 'hamming-distance-sum'],
    depth: ['single-number-ii', 'reverse-bits-count'],
  },
  {
    track: 'ADVANCED',
    slug: 'greedy-and-intervals',
    title: 'Greedy & Intervals',
    description:
      'Locally optimal choices that provably compose into a globally optimal answer — and interval scheduling, where they show up constantly.',
    outcome:
      'You can state the greedy rule for an interval problem AND explain in one sentence why a counterexample to it can\'t exist.',
    icon: 'ListTree',
    order: 4,
    lesson: `A greedy algorithm makes the locally-best choice at each step and never reconsiders it — which only works when you can argue that choice is *never worse* than any alternative, no matter what comes later. That argument is the entire content of a greedy solution; without it, "greedy" is just "a guess that happened to pass the examples".

**The classic proof shape (exchange argument):** take any hypothetical optimal solution that *doesn't* make the greedy choice at some step. Show you can swap in the greedy choice instead without making the solution any worse. If that's always possible, the greedy choice is safe, and induction carries the argument across every step.

**Interval problems are where greedy shows up most often**, and the sort key you choose is the whole ballgame:
- **maximise how many non-overlapping intervals you can keep** → sort by **end** time. An interval that finishes earlier always leaves at least as much room for everything after it, regardless of when it started — that's the exchange argument in one sentence.
- **merge all overlapping intervals** → sort by **start** time, then sweep, extending a "current" interval whenever the next one overlaps it.
- **"can you complete a circuit" / resource-tracking greedy** → track a running balance, and when it goes negative, the ENTIRE prefix up to that point is eliminated as a valid starting point at once — not just the immediately preceding candidate.

**Worked example.** Non-Overlapping Intervals (minimum removals): this is secretly "maximise how many intervals survive without overlapping" (removals = total − survivors), so sort by end time and greedily keep any interval whose start is at or after the last kept interval's end. Sorting by *start* instead — the natural first instinct — does not give a correct greedy rule here, which is exactly why naming the correct sort key matters more than remembering "sort the intervals".`,
    keyPatterns: [
      'State the greedy rule explicitly, then justify it with an exchange argument, before trusting it',
      'Maximise surviving non-overlapping intervals → sort by END time',
      'Merge overlapping intervals → sort by START time',
      'Running-balance greedy: a deficit eliminates the whole prefix as candidates, not just one position',
    ],
    commonPitfall:
      'Sorting intervals by start time for a "maximise non-overlapping survivors" problem — start-time sorting is correct for merging, but the wrong key for interval scheduling/selection.',
    typicalTime: 'O(n log n)',
    typicalSpace: 'O(n)',
    core: ['merge-intervals', 'non-overlapping-intervals', 'jump-game-reachability'],
    depth: ['gas-station-circuit'],
  },
  {
    track: 'ADVANCED',
    slug: 'graph-connectivity',
    title: 'Graphs — Connectivity & Multi-Source Spread',
    description: 'Counting components, detecting redundant connections, and spreading from many sources at once.',
    outcome: 'You can choose between DFS/BFS flood-fill and Union-Find, and justify the choice.',
    icon: 'Waypoints',
    order: 5,
    lesson: `This section is a deeper pass on the connectivity ideas from the Foundations graph section, adding a second tool — **Union-Find (disjoint set union)** — and the multi-source BFS pattern for "spreading" problems.

**DFS/BFS flood-fill vs. Union-Find** solve overlapping problems, and the right choice depends on how the graph is *given* to you:
- if you naturally have an adjacency list/matrix or a grid and want to explore FROM a node, flood-fill (DFS or BFS) is the direct tool
- if you're processing a STREAM of edges/connections one at a time and repeatedly asking "are these two things already connected?", Union-Find answers that question in near-O(1) per query (with path compression), without ever needing to traverse anything

**Multi-source BFS** is the pattern for "several things start spreading simultaneously, and you need to know how long until they've covered everything" (or "what's reachable from any of them"). The trick is seeding the BFS queue with *every* source at once, at time 0, rather than running a separate BFS per source — because they truly are spreading in parallel, one shared BFS models that correctly and each full level of the queue corresponds to one unit of time passing everywhere at once.

**Worked example — Redundant Connection.** Given edges added one at a time to build what should be a tree, Union-Find processes them in order: for each edge, check if its two endpoints are already connected (same root). If they are, this edge closes a cycle — it's the redundant one. If not, union them and continue. This is a query pattern (many "already connected?" checks against a growing structure) that flood-fill isn't naturally suited to, since re-running a full traversal after every single edge would be far more expensive.`,
    keyPatterns: [
      'Exploring outward from a known starting node/grid position → DFS or BFS flood-fill',
      'Repeated "are these already connected?" queries as edges stream in → Union-Find',
      'Several sources spreading simultaneously → seed a BFS queue with ALL of them at time 0',
    ],
    commonPitfall:
      'Running a fresh traversal from scratch after every new edge to check connectivity, instead of using Union-Find — technically correct but far more expensive than necessary for a stream of connectivity queries.',
    typicalTime: 'O(V + E) for traversal; O(E · α(V)) for Union-Find',
    typicalSpace: 'O(V)',
    core: ['number-of-provinces', 'rotting-oranges', 'redundant-connection'],
    depth: ['number-of-provinces-union-find', 'redundant-connection-ii', 'bipartite-check'],
  },
  {
    track: 'ADVANCED',
    slug: 'dp-patterns',
    title: 'Dynamic Programming — Recognisable Patterns',
    description:
      'Beyond the single-array DP from Foundations: sequence comparison, subset feasibility, and grid paths.',
    outcome:
      'You can match a new problem to one of a small number of known DP shapes rather than deriving from scratch.',
    icon: 'LayoutGrid',
    order: 6,
    lesson: `Foundations covered the mechanics of DP — state, recurrence, base case. This section is about pattern recognition: a large fraction of DP problems you'll encounter are variations on a handful of well-known shapes, and recognising which shape you're looking at gets you most of the way to the recurrence.

**Grid path DP.** State = a cell \`(r, c)\`. The recurrence almost always looks like \`best[r][c] = f(grid[r][c], best[r-1][c], best[r][c-1])\` — because with only right/down movement, a cell can only have been entered from directly above or directly to the left. The base case is the first row and column, handled as a running edge. This compresses naturally to O(n) space, since each row only needs the row before it.

**Subset feasibility / subset-sum DP.** State = "using elements up to index i, is sum s achievable?" — a boolean table indexed by (index, running sum). The 0/1 constraint (each element used at most once) means you must iterate the sum dimension **from high to low** when updating in place, otherwise you'll accidentally reuse an element within the same update pass. This shape underlies partition problems, target-sum problems, and knapsack variants.

**Sequence-length DP with a faster-than-obvious solution (LIS-style).** The natural state — "longest valid subsequence ending at index i" — gives an O(n²) solution by comparing every pair of indices. Some problems in this family (Longest Increasing Subsequence specifically) admit a cleverer O(n log n) reformulation by tracking, for each achievable subsequence LENGTH, the smallest possible ending value — which turns the search into a binary search rather than a linear scan.

**Two-sequence DP.** When comparing two strings/sequences (edit distance, longest common subsequence), the state is a PAIR of positions, one per sequence — a 2D table, not a 1D array — because the recurrence needs to know how far into *both* sequences you've progressed.`,
    keyPatterns: [
      'Right/down grid movement → best[r][c] depends only on best[r-1][c] and best[r][c-1]',
      '0/1 subset feasibility → boolean DP over (index, sum), iterate sum HIGH to LOW when updating in place',
      'Comparing two sequences → 2D state, one dimension per sequence',
    ],
    commonPitfall:
      'Iterating the sum dimension low-to-high in a 0/1 subset-sum DP — this lets a single element be "used" more than once within one update pass, silently turning bounded (0/1) knapsack into unbounded knapsack.',
    typicalTime: 'O(n·m) or O(n·sum), problem-dependent',
    typicalSpace: 'often reducible by one dimension via rolling arrays',
    core: ['longest-increasing-subsequence', 'unique-paths-grid', 'partition-equal-subset-sum'],
    depth: ['minimum-path-sum-grid', 'longest-common-subsequence-length', 'min-insertions-for-palindrome'],
  },
  {
    track: 'ADVANCED',
    slug: 'advanced-arrays-strings',
    title: 'Advanced Arrays & Strings',
    description: 'Harder array manipulation: three-way sums, in-place reordering, and boundary tracking.',
    outcome: 'You can extend two-pointer and simulation techniques to problems with more moving parts.',
    icon: 'Grid3x3',
    order: 7,
    lesson: `A capstone section: problems that extend techniques from earlier sections to situations with more moving parts — three values instead of two, an in-place transformation instead of a single answer, or a boundary that shrinks from four sides instead of two.

**Extending two pointers to three values.** The two-pointer technique from Foundations assumed you were looking for a *pair*. Fixing one element and running two pointers over the rest for the *remaining two* extends it directly — the search for the last two values is still a standard converging-pointers scan, just nested one level inside a loop over the first value. The genuinely hard part in these problems is almost always **duplicate handling**, not the core search — skipping past repeated values correctly (for the fixed element AND for each pointer) is what the bulk of the implementation care goes toward.

**In-place transformation with a "minimal change" goal (Next Permutation).** Instead of computing a value, you're rearranging the input to be the *next* one in some order, changing as little as possible and as far right (i.e., as low-impact) as possible. The recipe — find the rightmost position where an increase is still possible, swap in the smallest sufficient replacement, then reverse everything after that point to minimise the resulting change — is a specific and memorable three-step pattern worth recognising on sight rather than re-deriving.

**Boundary simulation (Spiral Matrix).** Four shrinking boundaries (top/bottom/left/right) walked in rotation model "traverse the outer ring, then the next ring in, then the next" directly. The part that catches people out is **degenerate legs**: once the grid narrows to a single remaining row or column, two of the four legs must be skipped explicitly, or that row/column gets traversed twice.`,
    keyPatterns: [
      'Fix one element, two-pointer-search the rest → extends pair-finding to triplets and beyond',
      'Careful, explicit duplicate-skipping at every level of a multi-pointer search',
      'Four shrinking boundaries model "traverse ring by ring" — guard against degenerate single-row/column legs',
    ],
    commonPitfall:
      'In a three-pointer (fixed element + two pointers) search, skipping duplicates for the two moving pointers but forgetting to also skip duplicate values for the FIXED outer element — producing repeated triplets in the output.',
    typicalTime: 'O(n log n) to O(n^2), problem-dependent',
    typicalSpace: 'O(1) to O(n)',
    core: ['three-sum-triplets', 'next-permutation', 'spiral-matrix-order'],
    depth: ['group-anagrams-count-groups', 'minimum-window-substring-length'],
  },
];
