import type { SeedProblem } from './problems.js';

/**
 * Third tranche — the Advanced track's problem pool: heaps, backtracking,
 * bit manipulation, greedy/intervals, graph connectivity, DP patterns, and
 * harder array/string work.
 *
 * Scope note: linked-list, tree and "design" problems (Trie, LRU Cache) are
 * deliberately NOT here yet. The current judge harness (packages/db/src/harness.ts)
 * supports one function over int/int[]/str/str[]/grid — it has no serialisation
 * for pointer-based structures or multi-call class designs across 4 languages.
 * Rather than ship those with an untested harness extension, every problem
 * below is expressed against the existing, battle-tested types so the same
 * "every test case verified by executing the reference solution" guarantee
 * holds without exception. Extending the harness for those is a follow-up.
 *
 * Test cases here declare INPUTS ONLY — outputs are derived by executing the
 * reference solution (see verify.ts), same as every other problem file.
 */
export const ADVANCED_PROBLEMS: SeedProblem[] = [
  /* ══════════════════════ Heaps & Top-K ═══════════════════════════════ */
  {
    slug: 'top-k-frequent-elements',
    title: 'Top K Frequent Elements',
    difficulty: 'MEDIUM',
    topics: ['array', 'hash-table', 'heap'],
    companies: [{ slug: 'amazon', frequency: 22 }, { slug: 'meta', frequency: 16 }],
    statement: `Given an integer array \`nums\` and an integer \`k\`, return the \`k\` most frequent values.

If frequencies tie, prefer the **smaller** value first. Return the result sorted by frequency descending, then value ascending among ties.

### Input format
Line 1: the array \`nums\`, space-separated.
Line 2: the integer \`k\`.

### Output format
The \`k\` values, space-separated.`,
    statementDigest:
      'Return the k most frequent values in nums; ties broken by smaller value first.',
    constraints: `- \`1 <= nums.length <= 10^5\`
- \`k\` is between 1 and the number of distinct values in \`nums\`.`,
    constraintsDigest: 'n <= 1e5, k <= distinct value count, deterministic tie-break by value.',
    expectedTime: 'O(n log k)',
    expectedSpace: 'O(n)',
    io: { fn: 'topKFrequent', params: [{ name: 'nums', type: 'int[]' }, { name: 'k', type: 'int' }], returns: 'int[]' },
    examples: [
      { input: '1 1 1 2 2 3\n2', output: '1 2', explanation: '1 appears 3 times, 2 appears twice.' },
      { input: '1\n1', output: '1', explanation: 'Only one distinct value.' },
    ],
    sampleTests: [{ input: '1 1 1 2 2 3\n2' }, { input: '1\n1' }],
    hiddenTests: [
      { input: '4 4 4 6 6 8 8 8 8\n2' },
      { input: '5 5 3 3 1 1\n3' },
      { input: '-1 -1 -2 -2 -2 3\n2' },
      { input: '7 7 7 7\n1' },
    ],
    hints: [
      'You need to know how often each value occurs before you can rank anything. What structure builds that in one pass?',
      'Sorting all distinct values by frequency is O(d log d). If k is much smaller than the number of distinct values, is there a way to avoid sorting all of them?',
      'Count frequencies into a map, then keep a size-k min-heap keyed by (frequency, -value) so it evicts the least-frequent (or largest, on a tie) candidate.',
    ],
    editorial: {
      approachSummary: 'Frequency map, then a bounded min-heap of size k.',
      content: `Count frequencies in one pass — that part is not in question. The interesting decision is how to extract the top \`k\` from the distinct values.

Sorting all distinct values by frequency is \`O(d log d)\` where \`d\` is the distinct count, and is perfectly fine when \`d\` is small. When \`d\` is large and \`k\` is small, a size-\`k\` min-heap does better: push each \`(count, value)\` pair, and once the heap exceeds size \`k\`, pop the smallest. What survives is the top \`k\`.

The tie-break is where implementations usually diverge from the spec. "Smaller value wins a tie" means the heap's ordering key must be \`(count, -value)\` (or the equivalent comparator) so that among equal counts, the *larger* value is evicted first, leaving the smaller one behind.`,
      timeComplexity: 'O(n log k)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Bounded min-heap',
      time: 'O(n log k)',
      space: 'O(n)',
      python: `import heapq

counts = {}
for value in nums:
    counts[value] = counts.get(value, 0) + 1

heap = []
for value, count in counts.items():
    heapq.heappush(heap, (count, -value))
    if len(heap) > k:
        heapq.heappop(heap)

heap.sort(key=lambda pair: (-pair[0], -pair[1]))
return [-value for _count, value in heap]`,
    },
  },

  {
    slug: 'connect-ropes-min-cost',
    title: 'Minimum Cost To Connect Ropes',
    difficulty: 'MEDIUM',
    topics: ['heap', 'greedy'],
    companies: [{ slug: 'amazon', frequency: 17 }, { slug: 'microsoft', frequency: 10 }],
    statement: `You have ropes of given lengths. Connecting two ropes of length \`a\` and \`b\` costs \`a + b\`, and produces one rope of length \`a + b\`.

Return the **minimum total cost** to connect all ropes into one.

### Input format
Line 1: the array \`ropes\`, space-separated.

### Output format
The minimum total cost.`,
    statementDigest:
      'Repeatedly connect ropes (cost = sum of the two lengths) until one remains; return the minimum total cost.',
    constraints: `- \`1 <= ropes.length <= 10^4\`
- \`1 <= ropes[i] <= 10^4\``,
    constraintsDigest: 'n <= 1e4, positive lengths, minimise total connection cost.',
    expectedTime: 'O(n log n)',
    expectedSpace: 'O(n)',
    io: { fn: 'minCost', params: [{ name: 'ropes', type: 'int[]' }], returns: 'int' },
    examples: [
      { input: '4 3 2 6', output: '29', explanation: 'Connect 2+3=5 (cost 5), 5+4=9 (cost 9), 9+6=15 (cost 15). Total 29.' },
      { input: '1 2 3', output: '9', explanation: '1+2=3 (cost 3), 3+3=6 (cost 6). Total 9.' },
    ],
    sampleTests: [{ input: '4 3 2 6' }, { input: '1 2 3' }],
    hiddenTests: [
      { input: '1' },
      { input: '5 5' },
      { input: '1 8 3 5' },
      { input: '10 10 10 10 10' },
      { input: '2 2 2 2 2 2' },
    ],
    hints: [
      'Every connection cost gets carried forward into every later connection it participates in. What kind of rope do you most want to avoid touching early?',
      'A long rope connected early gets re-added to the total cost every time it is combined again later. Which ropes should you connect first to minimise how often large sums get re-paid?',
      'Always connect the two SHORTEST remaining ropes. A min-heap gives you the two smallest in O(log n) each round.',
    ],
    editorial: {
      approachSummary: 'Greedily connect the two shortest ropes, using a min-heap.',
      content: `Every time two ropes are connected, the resulting length re-enters the pool and will be paid for again in a future connection if it isn't the last one standing. So a long rope combined early is expensive — its length gets "re-charged" every subsequent merge it takes part in.

The greedy fix: always connect the **two shortest** ropes available. This keeps large sums out of circulation for as long as possible, which minimises how many times they get re-added.

A min-heap makes "the two shortest" a pair of \`O(log n)\` pops. Push the combined length back in, repeat until one rope remains.

This is the same shape as Huffman coding — repeatedly merging the two lowest-weight items is optimal by an exchange argument: swapping any other merge order for this one never increases the total.`,
      timeComplexity: 'O(n log n)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Min-heap greedy merge',
      time: 'O(n log n)',
      space: 'O(n)',
      python: `import heapq

heap = list(ropes)
heapq.heapify(heap)
total = 0
while len(heap) > 1:
    a = heapq.heappop(heap)
    b = heapq.heappop(heap)
    cost = a + b
    total += cost
    heapq.heappush(heap, cost)
return total`,
    },
  },

  {
    slug: 'task-scheduler-cooldown',
    title: 'Task Scheduler With Cooldown',
    difficulty: 'MEDIUM',
    topics: ['heap', 'greedy', 'array'],
    companies: [{ slug: 'meta', frequency: 15 }, { slug: 'amazon', frequency: 12 }],
    statement: `You are given \`tasks\`, where each value is a task type (\`0\`–\`25\`), and an integer \`coolDown\`. The same task type must wait at least \`coolDown\` intervals before it can run again; the CPU may idle if nothing is eligible.

Return the **minimum number of intervals** needed to finish all tasks.

### Input format
Line 1: the array \`tasks\`, space-separated.
Line 2: the integer \`coolDown\`.

### Output format
The minimum number of intervals.`,
    statementDigest:
      'Schedule tasks with a per-type cooldown, minimising total intervals including idle slots.',
    constraints: `- \`1 <= tasks.length <= 10^4\`
- \`0 <= tasks[i] <= 25\`
- \`0 <= coolDown <= 100\``,
    constraintsDigest: 'up to 26 task types, cooldown up to 100, minimise makespan.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'minIntervals', params: [{ name: 'tasks', type: 'int[]' }, { name: 'coolDown', type: 'int' }], returns: 'int' },
    examples: [
      { input: '0 0 0 1 1 1\n2', output: '8', explanation: 'A,A,A,B,B,B with cooldown 2 needs idle slots: A B idle A B idle A B.' },
      { input: '0 0 0 1 1 1\n0', output: '6', explanation: 'No cooldown: run them back to back.' },
    ],
    sampleTests: [{ input: '0 0 0 1 1 1\n2' }, { input: '0 0 0 1 1 1\n0' }],
    hiddenTests: [
      { input: '0\n5' },
      { input: '0 0 0 0 1 2 3\n2' },
      { input: '0 0 0 1 1 1 2 2 2\n2' },
      { input: '0 0 1 1\n50' },
    ],
    hints: [
      'The task type with the most occurrences forces the overall structure — everything else has to fit around it. Why?',
      'Picture the most frequent task laid out with exactly `coolDown` gaps after each occurrence except the last. That skeleton has a fixed length — what fills the gaps?',
      'Let maxCount be the highest frequency and maxCountTies the number of types tied for it. The answer is at least `(maxCount - 1) * (coolDown + 1) + maxCountTies`, and it is never less than `len(tasks)`.',
    ],
    editorial: {
      approachSummary: 'A closed-form built from the most frequent task, floored at the task count.',
      content: `Think about the single most frequent task type. It must appear \`maxCount\` times, each occurrence separated by at least \`coolDown\` idle-or-other slots. That forces a skeleton of \`(maxCount - 1)\` gaps, each of length \`coolDown + 1\` (the slot for the task itself, plus the cooldown), followed by the final occurrence:

\`\`\`
frame = (maxCount - 1) * (coolDown + 1) + maxCountTies
\`\`\`

\`maxCountTies\` accounts for every task type that shares the maximum frequency — each of them needs its own slot in that final round.

Every other, less-frequent task type can always be slotted into the gaps of this frame without extending it — there is provably enough room, because no other type has more occurrences than the frame has gaps.

The one case this formula undershoots is when there are enough total tasks that they simply don't fit inside idle slots at all — i.e., there's no idling needed. So the true answer is:

\`\`\`
max(frame, len(tasks))
\`\`\`

No simulation, no heap — just counting. (A heap-based greedy simulation also works and generalises better to variants of this problem, but for the plain version the formula is both correct and \`O(n)\`.)`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'Closed-form frame around the most frequent task',
      time: 'O(n)',
      space: 'O(1)',
      python: `counts = {}
for task in tasks:
    counts[task] = counts.get(task, 0) + 1

max_count = max(counts.values())
max_ties = sum(1 for c in counts.values() if c == max_count)

frame = (max_count - 1) * (coolDown + 1) + max_ties
return max(frame, len(tasks))`,
    },
  },

  /* ══════════════════════ Backtracking ═════════════════════════════════ */
  {
    slug: 'n-queens-count',
    title: 'N-Queens: Count Solutions',
    difficulty: 'HARD',
    topics: ['backtracking', 'array'],
    companies: [{ slug: 'google', frequency: 18 }, { slug: 'amazon', frequency: 12 }],
    statement: `Given an integer \`n\`, return the number of distinct ways to place \`n\` queens on an \`n x n\` chessboard so that no two queens attack each other (no shared row, column, or diagonal).

### Input format
Line 1: the integer \`n\`.

### Output format
The number of distinct solutions.`,
    statementDigest:
      'Count placements of n non-attacking queens on an n x n board.',
    constraints: `- \`1 <= n <= 9\``,
    constraintsDigest: 'n <= 9, count only (not enumerate) valid placements.',
    expectedTime: 'O(n!)',
    expectedSpace: 'O(n)',
    io: { fn: 'countSolutions', params: [{ name: 'n', type: 'int' }], returns: 'int' },
    examples: [
      { input: '4', output: '2', explanation: 'Two distinct arrangements exist for a 4x4 board.' },
      { input: '1', output: '1', explanation: 'A single queen trivially does not attack itself.' },
    ],
    sampleTests: [{ input: '4' }, { input: '1' }],
    hiddenTests: [
      { input: '2' },
      { input: '3' },
      { input: '5' },
      { input: '6' },
      { input: '8' },
    ],
    hints: [
      'Since no two queens can share a row, you can decide the placement one row at a time. How many queens can end up in row i?',
      'For row i you are choosing exactly one column, and that choice must not conflict with any queen already placed in an earlier row. What three things can a conflict be?',
      'Backtrack row by row, tracking which columns and which two diagonals (col - row, col + row) are already occupied. Try each column, recurse to the next row, then undo before trying the next column.',
    ],
    editorial: {
      approachSummary: 'Row-by-row backtracking with column and diagonal occupancy sets.',
      content: `The "no shared row" constraint is a gift: it means the search can be organised as "choose exactly one column for row 0, then row 1, then row 2, …" rather than searching over arbitrary square placements. That collapses the search space from choosing \`n²\` cells to choosing one of \`n\` columns per row, \`n\` times.

At each row, a candidate column is legal only if:
- no earlier queen shares that **column**
- no earlier queen shares the diagonal \`col - row\` (constant along a "\\" diagonal)
- no earlier queen shares the diagonal \`col + row\` (constant along a "/" diagonal)

Track three sets (or boolean arrays) for these. Placing a queen adds to all three; backtracking removes from all three. When a full assignment (all \`n\` rows placed) is reached, increment the solution counter — since we only need a count, there is no need to materialise or store the board itself.

The search space is bounded by \`n!\` in the worst case, but the column/diagonal pruning cuts it down enormously in practice — this is a canonical example of why backtracking with early pruning beats brute enumeration even though both are technically exponential.`,
      timeComplexity: 'O(n!) worst case, pruned heavily in practice',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Backtracking with occupancy sets',
      time: 'O(n!)',
      space: 'O(n)',
      python: `cols = set()
diag1 = set()
diag2 = set()
count = 0

def place(row):
    nonlocal count
    if row == n:
        count += 1
        return
    for col in range(n):
        if col in cols or (col - row) in diag1 or (col + row) in diag2:
            continue
        cols.add(col)
        diag1.add(col - row)
        diag2.add(col + row)
        place(row + 1)
        cols.remove(col)
        diag1.remove(col - row)
        diag2.remove(col + row)

place(0)
return count`,
    },
  },

  {
    slug: 'subset-sum-count',
    title: 'Count Subsets With Given Sum',
    difficulty: 'MEDIUM',
    topics: ['backtracking', 'dynamic-programming', 'array'],
    companies: [{ slug: 'microsoft', frequency: 14 }, { slug: 'adobe', frequency: 9 }],
    statement: `Given an array of non-negative integers \`nums\` and an integer \`target\`, return the number of **subsets** (by index, not by value) whose elements sum to \`target\`.

### Input format
Line 1: the array \`nums\`, space-separated.
Line 2: the integer \`target\`.

### Output format
The number of qualifying subsets.`,
    statementDigest:
      'Count index-subsets of nums (non-negative values) summing exactly to target.',
    constraints: `- \`1 <= nums.length <= 20\`
- \`0 <= nums[i] <= 1000\`
- \`0 <= target <= 1000\``,
    constraintsDigest: 'n <= 20, non-negative values, target <= 1000.',
    expectedTime: 'O(n * target)',
    expectedSpace: 'O(target)',
    io: { fn: 'countSubsets', params: [{ name: 'nums', type: 'int[]' }, { name: 'target', type: 'int' }], returns: 'int' },
    examples: [
      { input: '1 2 3 3\n6', output: '3', explanation: '{1,2,3} (first 3), {1,2,3} (second 3), {3,3} all sum to 6.' },
      { input: '1 1 1 1\n2', output: '6', explanation: 'Every pair of the four 1s sums to 2: C(4,2) = 6.' },
    ],
    sampleTests: [{ input: '1 2 3 3\n6' }, { input: '1 1 1 1\n2' }],
    hiddenTests: [
      { input: '0 0 0\n0' },
      { input: '5\n5' },
      { input: '5\n4' },
      { input: '2 2 2 2 2\n10' },
      { input: '1 2 5 10\n0' },
    ],
    hints: [
      'For each element, you face a binary decision: include it in the subset, or don\'t. What does that suggest about how to count?',
      'Trying every 2^n subset directly is correct but too slow for n=20 in the worst case pattern of this judge. Do overlapping "remaining target" subproblems appear as you branch?',
      'Let ways(i, remaining) be the count using elements from index i onward. ways(i, r) = ways(i+1, r) [skip] + ways(i+1, r - nums[i]) [take, if nums[i] <= r]. Memoise on (i, remaining).',
    ],
    editorial: {
      approachSummary: 'Include/exclude recursion memoised over (index, remaining target).',
      content: `Every element has exactly two fates: it's in the subset, or it isn't. That include/exclude framing is the entire recursion:

\`\`\`
ways(i, remaining) = ways(i+1, remaining)                         # exclude nums[i]
                    + ways(i+1, remaining - nums[i])   if nums[i] <= remaining   # include it
\`\`\`

with \`ways(n, 0) = 1\` (an empty remaining target with nothing left to place is one valid way — the empty continuation) and \`ways(n, r>0) = 0\`.

Naively this branches into \`2^n\` calls, but notice the state is fully described by just two numbers: which index you're at, and how much target remains. Many different decision paths land on the same \`(i, remaining)\` pair, so memoising collapses the exponential tree into an \`O(n × target)\` table.

Zero-valued elements deserve a second look: they never change \`remaining\`, so if \`target == 0\`, every subset of the zeros is independently valid, and the count reflects that correctly through the recursion without any special-casing — that's why \`{0,0,0}\` with target \`0\` is in the test set, and why it's a good gut-check that your recursion handles "include" branches that don't actually shrink the problem.`,
      timeComplexity: 'O(n * target)',
      spaceComplexity: 'O(n * target)',
    },
    solution: {
      approachName: 'Memoised include/exclude',
      time: 'O(n * target)',
      space: 'O(n * target)',
      python: `from functools import lru_cache
import sys

sys.setrecursionlimit(10000)

@lru_cache(maxsize=None)
def ways(i, remaining):
    if i == len(nums):
        return 1 if remaining == 0 else 0
    total = ways(i + 1, remaining)
    if nums[i] <= remaining:
        total += ways(i + 1, remaining - nums[i])
    return total

return ways(0, target)`,
    },
  },

  {
    slug: 'word-search-grid',
    title: 'Word Search',
    difficulty: 'MEDIUM',
    topics: ['backtracking', 'matrix'],
    companies: [{ slug: 'amazon', frequency: 20 }, { slug: 'microsoft', frequency: 13 }],
    statement: `Given a grid of characters \`board\` and a string \`word\`, return \`true\` if \`word\` can be traced through **adjacent** cells (horizontally or vertically), using each cell **at most once** per path.

### Input format
Line 1: two integers \`m\` and \`n\`.
Next \`m\` lines: a string of \`n\` characters each.
Final line: the string \`word\`.

### Output format
\`true\` or \`false\`.`,
    statementDigest:
      'Return true if word can be traced through adjacent grid cells without reusing a cell.',
    constraints: `- \`1 <= m, n <= 6\`
- \`1 <= word.length <= 15\`
- Board and word consist of lowercase English letters.`,
    constraintsDigest: 'small grid (<=6x6), word length <= 15, 4-directional adjacency, no cell reuse.',
    expectedTime: 'O(m * n * 4^L)',
    expectedSpace: 'O(L)',
    io: { fn: 'exists', params: [{ name: 'board', type: 'grid' }, { name: 'word', type: 'str' }], returns: 'bool' },
    examples: [
      {
        input: '3 4\nabce\nsfcs\nadee\nabcced',
        output: 'true',
        explanation: 'a→b→c→c→e→d traces a valid adjacent path.',
      },
      {
        input: '3 4\nabce\nsfcs\nadee\nabcb',
        output: 'false',
        explanation: 'The second b would require reusing the first b.',
      },
    ],
    sampleTests: [
      { input: '3 4\nabce\nsfcs\nadee\nabcced' },
      { input: '3 4\nabce\nsfcs\nadee\nabcb' },
    ],
    hiddenTests: [
      { input: '1 1\na\na' },
      { input: '1 1\na\nb' },
      { input: '2 2\naa\naa\naaa' },
      { input: '1 4\nabcd\ncd' },
      { input: '3 3\nabc\ndef\nghi\nafd' },
    ],
    hints: [
      'The word must be traced letter by letter, and each step can only go to a neighbouring cell. What happens once a cell has been used in the current path?',
      'You need to try every starting cell that matches the first letter, and from each, explore every direction — backing out of dead ends. What technique explores-then-undoes?',
      'From each cell matching word[0], DFS: mark the cell visited (e.g. temporarily overwrite it), recurse to matching neighbours for word[1:], then UNMARK it before returning — even on failure.',
    ],
    editorial: {
      approachSummary: 'DFS from every matching start cell, with mark-and-unmark backtracking.',
      content: `This is a graph search where the graph is implicit: cells are nodes, 4-directional adjacency is the edge set, and you're looking for a simple path (no repeated node) spelling out \`word\`.

Try every cell equal to \`word[0]\` as a start. From there, DFS: at each step, check the current cell matches the needed letter, then recurse into the four neighbours looking for the next letter.

The part that's easy to get subtly wrong is **path-local uniqueness**: a cell can't be reused *within one attempt*, but it's perfectly fine for a different starting attempt to use it. The clean way to express that is to temporarily mark the cell as visited (overwriting it with a sentinel character works well and needs no extra memory) right before recursing, and to **restore it immediately after** — regardless of whether the recursive call succeeded. Forgetting the restore-on-failure path is the single most common bug here, because it silently poisons cells for later, unrelated starting attempts.

Small board and word-length bounds keep the \`O(4^L)\` branching factor per start cell manageable — this is exponential in the word length, not the board size, which is why the constraints cap the word at 15 characters.`,
      timeComplexity: 'O(m * n * 4^L)',
      spaceComplexity: 'O(L) recursion depth',
    },
    solution: {
      approachName: 'DFS with mark/unmark backtracking',
      time: 'O(m * n * 4^L)',
      space: 'O(L)',
      python: `rows, cols = len(board), len(board[0])

def dfs(r, c, i):
    if i == len(word):
        return True
    if r < 0 or r >= rows or c < 0 or c >= cols or board[r][c] != word[i]:
        return False
    saved = board[r][c]
    board[r][c] = '#'
    found = (
        dfs(r + 1, c, i + 1)
        or dfs(r - 1, c, i + 1)
        or dfs(r, c + 1, i + 1)
        or dfs(r, c - 1, i + 1)
    )
    board[r][c] = saved
    return found

for r in range(rows):
    for c in range(cols):
        if dfs(r, c, 0):
            return True
return False`,
    },
  },

  {
    slug: 'kth-permutation-sequence',
    title: 'Kth Permutation Sequence',
    difficulty: 'HARD',
    topics: ['backtracking', 'math'],
    companies: [{ slug: 'google', frequency: 14 }, { slug: 'meta', frequency: 9 }],
    statement: `The set \`[1, 2, ..., n]\` has \`n!\` distinct permutations, listed in lexicographic order starting from 1. Given \`n\` and \`k\`, return the \`k\`-th permutation (1-indexed) as a string of digits.

### Input format
Line 1: the integer \`n\`.
Line 2: the integer \`k\`.

### Output format
The k-th permutation, digits with no separator.`,
    statementDigest:
      'Return the kth (1-indexed) lexicographic permutation of 1..n as a digit string.',
    constraints: `- \`1 <= n <= 9\`
- \`1 <= k <= n!\``,
    constraintsDigest: 'n <= 9 (fits in a single digit each), k within n! bounds.',
    expectedTime: 'O(n^2)',
    expectedSpace: 'O(n)',
    io: { fn: 'kthPermutation', params: [{ name: 'n', type: 'int' }, { name: 'k', type: 'int' }], returns: 'str' },
    examples: [
      { input: '3\n3', output: '213', explanation: 'Order: 123,132,213,231,312,321 — the 3rd is 213.' },
      { input: '4\n9', output: '2314', explanation: 'The 9th permutation of 1..4 in lex order.' },
    ],
    sampleTests: [{ input: '3\n3' }, { input: '4\n9' }],
    hiddenTests: [
      { input: '1\n1' },
      { input: '3\n1' },
      { input: '3\n6' },
      { input: '9\n1' },
      { input: '9\n362880' },
    ],
    hints: [
      'You could generate all n! permutations in order and index into them, but that is wasteful. How many permutations share the same FIRST digit?',
      'Fixing the first digit leaves (n-1)! permutations of the rest. So dividing (k-1) by (n-1)! tells you which candidate digit to pick first, without generating anything.',
      'Maintain a list of unused digits. Repeatedly compute block = (n-1)!, pick index (k-1) // block from the remaining digits, append it, remove it from the pool, then reduce k to (k-1) % block and n by 1.',
    ],
    editorial: {
      approachSummary: 'Factorial-number-system digit selection — no permutations generated.',
      content: `Generating all \`n!\` permutations and indexing into them works but is needlessly expensive — and unnecessary, because the *count* of permutations sharing any given first digit is knowable in advance: fixing the first digit leaves \`(n-1)!\` arrangements of the rest.

That turns "find the k-th permutation" into repeated division. With digits \`1..n\` available and target rank \`k\` (convert to 0-indexed: \`k -= 1\`):

1. \`block = (n-1)!\` — how many permutations share each choice of first remaining digit.
2. The first digit is the one at index \`k // block\` in the sorted pool of remaining digits.
3. Remove that digit from the pool, set \`k = k % block\`, drop \`n\` by one, and repeat.

This is exactly converting \`k\` into the **factorial number system** and using each "digit" of that representation as an index into the shrinking pool of unused numbers. It runs in \`O(n²)\` (removal from a list is \`O(n)\`, done \`n\` times) with no recursion and no wasted enumeration — a nice example of counting your way past a search instead of performing it.`,
      timeComplexity: 'O(n^2)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Factorial number system',
      time: 'O(n^2)',
      space: 'O(n)',
      python: `import math

digits = [str(d) for d in range(1, n + 1)]
k -= 1
result = []
for i in range(n, 0, -1):
    block = math.factorial(i - 1)
    index = k // block
    result.append(digits.pop(index))
    k %= block
return ''.join(result)`,
    },
  },

  /* ══════════════════════ Bit Manipulation ═════════════════════════════ */
  {
    slug: 'counting-bits',
    title: 'Counting Bits',
    difficulty: 'EASY',
    topics: ['bit-manipulation', 'dynamic-programming'],
    companies: [{ slug: 'google', frequency: 12 }, { slug: 'amazon', frequency: 9 }],
    statement: `Given an integer \`n\`, return an array \`ans\` of length \`n + 1\` where \`ans[i]\` is the number of \`1\` bits in the binary representation of \`i\`, for every \`i\` from \`0\` to \`n\`.

### Input format
Line 1: the integer \`n\`.

### Output format
The array \`ans\`, space-separated.`,
    statementDigest:
      'For every i from 0 to n, return the popcount of i, as one array.',
    constraints: `- \`0 <= n <= 10^5\``,
    constraintsDigest: 'n <= 1e5, compute popcount for every value 0..n in O(n) total.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(n)',
    io: { fn: 'countBits', params: [{ name: 'n', type: 'int' }], returns: 'int[]' },
    examples: [
      { input: '2', output: '0 1 1', explanation: '0=0b0, 1=0b1, 2=0b10.' },
      { input: '5', output: '0 1 1 2 1 2', explanation: '3=0b11 has two 1-bits, 4=0b100 has one.' },
    ],
    sampleTests: [{ input: '2' }, { input: '5' }],
    hiddenTests: [
      { input: '0' },
      { input: '1' },
      { input: '15' },
      { input: '16' },
    ],
    hints: [
      'Computing popcount independently for every number costs O(n log n) overall. Does the popcount of i relate to the popcount of some smaller number you have already computed?',
      'Every number i is either even or odd. If i is even, how does its bit pattern relate to i/2? If i is odd?',
      'ans[i] = ans[i >> 1] + (i & 1). Shifting right by one drops the last bit; add it back separately. Build the array from 0 upward so ans[i >> 1] is already known.',
    ],
    editorial: {
      approachSummary: 'Reuse each number\'s popcount to build the next in O(1).',
      content: `Calling a popcount routine independently for each of \`0..n\` costs \`O(n log n)\` in total (each call is \`O(log n)\`). The values are related, though, and exploiting that gets it down to \`O(n)\`.

Look at \`i\` in binary and \`i >> 1\` (i.e. \`i\` with its last bit dropped). Every bit of \`i\` except the last one is *identical* to \`i >> 1\` — right-shifting just removes the last bit, it doesn't disturb the others. So:

\`\`\`
popcount(i) = popcount(i >> 1) + (i & 1)
\`\`\`

\`i & 1\` is the last bit itself (0 or 1). Since \`i >> 1 < i\`, this value is already sitting in \`ans\` by the time you reach index \`i\`, provided you fill the array from \`0\` upward. One pass, one array, no per-element loop over bits.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Bottom-up bit-shift recurrence',
      time: 'O(n)',
      space: 'O(n)',
      python: `ans = [0] * (n + 1)
for i in range(1, n + 1):
    ans[i] = ans[i >> 1] + (i & 1)
return ans`,
    },
  },

  {
    slug: 'single-number-two-uniques',
    title: 'Two Single Numbers',
    difficulty: 'MEDIUM',
    topics: ['bit-manipulation', 'array'],
    companies: [{ slug: 'amazon', frequency: 11 }, { slug: 'bloomberg', frequency: 7 }],
    statement: `Every value in \`nums\` appears **exactly twice**, except for **two** values which each appear exactly once. Return those two values, in **ascending** order.

Solve it in linear time using constant extra space (beyond the output).

### Input format
Line 1: the array \`nums\`, space-separated.

### Output format
The two unique values, ascending, space-separated.`,
    statementDigest:
      'All values in nums are paired except exactly two; return those two, ascending, in O(n) time and O(1) space.',
    constraints: `- \`2 <= nums.length <= 3 * 10^4\`
- Exactly two elements appear once; the rest appear exactly twice.`,
    constraintsDigest: 'exactly two unpaired values exist; O(n) time, O(1) extra space required.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'twoSingleNumbers', params: [{ name: 'nums', type: 'int[]' }], returns: 'int[]' },
    examples: [
      { input: '1 2 1 3 2 5', output: '3 5', explanation: '3 and 5 are the two unpaired values.' },
      { input: '-1 0', output: '-1 0', explanation: 'Both values are unpaired.' },
    ],
    sampleTests: [{ input: '1 2 1 3 2 5' }, { input: '-1 0' }],
    hiddenTests: [
      { input: '4 1 4 2' },
      { input: '0 1' },
      { input: '7 3 7 -5 -5 9' },
      { input: '10 20 10 30 40 30' },
    ],
    hints: [
      'With ONE unpaired value, XOR-ing everything together isolates it, since pairs cancel. With two unpaired values, what does XOR-ing everything give you instead?',
      'XOR-ing all values gives you `a XOR b` for the two unique values a and b — not either one individually. Is there a bit position that must differ between a and b?',
      'Any set bit in `a XOR b` is a position where a and b differ. Split ALL numbers into two groups by that bit, and XOR each group separately — each group now contains exactly one unique value plus intact pairs.',
    ],
    editorial: {
      approachSummary: 'XOR everything to isolate a^b, then split by a differing bit.',
      content: `With exactly one unpaired value, XOR-ing the whole array works because pairs cancel (\`x ^ x = 0\`) and the identity (\`x ^ 0 = x\`) leaves the lone survivor. With **two** unpaired values \`a\` and \`b\`, the same full XOR still cancels every pair — but it leaves \`a ^ b\`, not \`a\` or \`b\` individually.

\`a ^ b\` is still useful: any bit that is **set** in it is a position where \`a\` and \`b\` differ (since XOR is 1 exactly where the two bits disagree). Pick any one such bit — the lowest set bit is a convenient, unambiguous choice: \`diff = combined & (-combined)\`.

Now partition the **entire original array** into two groups by whether each number has that bit set. Because \`a\` and \`b\` differ on that bit, they land in *different* groups. Every paired value, by contrast, is identical to its partner, so both copies land in the *same* group — meaning they still cancel when you XOR within the group.

XOR each group independently: one group's XOR collapses to \`a\`, the other's to \`b\`. Two more linear passes, still \`O(n)\` time and \`O(1)\` extra space.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'XOR isolation via a differing bit',
      time: 'O(n)',
      space: 'O(1)',
      python: `combined = 0
for value in nums:
    combined ^= value

diff = combined & (-combined)

a = 0
for value in nums:
    if value & diff:
        a ^= value

b = combined ^ a
lo, hi = (a, b) if a < b else (b, a)
return [lo, hi]`,
    },
  },

  {
    slug: 'hamming-distance-sum',
    title: 'Total Hamming Distance',
    difficulty: 'MEDIUM',
    topics: ['bit-manipulation', 'array'],
    companies: [{ slug: 'google', frequency: 9 }, { slug: 'apple', frequency: 6 }],
    statement: `The Hamming distance between two integers is the number of bit positions at which they differ. Given an array \`nums\`, return the sum of the Hamming distances between **all pairs** of elements.

### Input format
Line 1: the array \`nums\`, space-separated.

### Output format
The sum of pairwise Hamming distances.`,
    statementDigest:
      'Sum the pairwise Hamming distance across every pair of elements in nums.',
    constraints: `- \`1 <= nums.length <= 10^4\`
- \`0 <= nums[i] <= 10^9\``,
    constraintsDigest: 'n <= 1e4, values fit in 32 bits, avoid the O(n^2) pair enumeration.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'totalHammingDistance', params: [{ name: 'nums', type: 'int[]' }], returns: 'int' },
    examples: [
      { input: '4 14 2', output: '6', explanation: 'Pairwise distances: (4,14)=2, (4,2)=2, (14,2)=2, total 6.' },
      { input: '4 14 4', output: '4', explanation: '(4,14)=2, (4,4)=0, (14,4)=2, total 4.' },
    ],
    sampleTests: [{ input: '4 14 2' }, { input: '4 14 4' }],
    hiddenTests: [
      { input: '1' },
      { input: '0 0 0' },
      { input: '1 3 5 7' },
      { input: '1000000000 0' },
      { input: '1 2 4 8 16' },
    ],
    hints: [
      'Computing every pair directly is O(n^2). If you looked at just ONE bit position across all n numbers, could you count that position\'s contribution to every pair at once?',
      'At a single bit position, some numbers have a 0 there and some have a 1. A pair contributes to the Hamming distance at that position exactly when the pair disagrees.',
      'For each of the 32 bit positions, count how many numbers have that bit set (call it c). That position contributes c * (n - c) to the total, since every 1 pairs with every 0. Sum over all 32 positions.',
    ],
    editorial: {
      approachSummary: 'Per-bit counting: c ones times (n - c) zeros, summed over 32 positions.',
      content: `Comparing every pair directly is \`O(n²)\` — at \`n = 10^4\` that's \`10^8\` comparisons, each doing up to 32 bit-compares. Too slow.

The trick is to swap the order of summation: instead of "for each pair, count differing bits", compute "for each bit position, count how many pairs differ there" — and sum that over the (fixed, small) 32 bit positions.

At a fixed bit position, every number either has a 0 or a 1 there. If \`c\` numbers have a 1 and \`n - c\` have a 0, then a pair disagrees at this position exactly when one is drawn from each group — and there are \`c × (n - c)\` such pairs (every 1-number paired with every 0-number).

So the total Hamming distance is:

\`\`\`
sum over bit positions b:  count_with_bit_b_set(b) * (n - count_with_bit_b_set(b))
\`\`\`

32 bit positions, one linear pass each to count set bits — \`O(32n) = O(n)\`. This "sum per bit position instead of per pair" reframing is a recurring trick anywhere you're aggregating something pairwise over fixed-width numbers.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'Per-bit-position counting',
      time: 'O(n)',
      space: 'O(1)',
      python: `n = len(nums)
total = 0
for bit in range(32):
    ones = 0
    for value in nums:
        if value & (1 << bit):
            ones += 1
    total += ones * (n - ones)
return total`,
    },
  },

  /* ══════════════════════ Greedy & Intervals ═══════════════════════════ */
  {
    slug: 'merge-intervals',
    title: 'Merge Overlapping Intervals',
    difficulty: 'MEDIUM',
    topics: ['array', 'greedy', 'sorting'],
    companies: [{ slug: 'meta', frequency: 26 }, { slug: 'amazon', frequency: 19 }],
    statement: `Given a list of intervals, merge every pair that overlaps and return the resulting non-overlapping intervals, sorted by start.

Intervals are given **flattened**: \`s1 e1 s2 e2 …\`. Touching intervals (where one ends exactly where another begins) count as overlapping and must be merged.

### Input format
Line 1: the flattened intervals, space-separated. May be empty.

### Output format
The merged intervals, flattened, sorted by start.`,
    statementDigest:
      'Merge overlapping (including touching) intervals given as a flattened list; return merged, sorted by start, flattened.',
    constraints: `- \`0 <= number of intervals <= 10^4\`
- \`0 <= start <= end <= 10^9\``,
    constraintsDigest: 'up to 1e4 intervals, touching intervals merge, output sorted by start.',
    expectedTime: 'O(n log n)',
    expectedSpace: 'O(n)',
    io: { fn: 'mergeIntervals', params: [{ name: 'flat', type: 'int[]' }], returns: 'int[]' },
    examples: [
      { input: '1 3 2 6 8 10 15 18', output: '1 6 8 10 15 18', explanation: '[1,3] and [2,6] overlap and merge into [1,6].' },
      { input: '1 4 4 5', output: '1 5', explanation: 'Touching intervals [1,4] and [4,5] merge into [1,5].' },
    ],
    sampleTests: [{ input: '1 3 2 6 8 10 15 18' }, { input: '1 4 4 5' }],
    hiddenTests: [
      { input: '1 4' },
      { input: '1 4 2 3' },
      { input: '' },
      { input: '1 10 2 3 4 5 6 7' },
      { input: '5 7 1 3 2 4 10 12' },
    ],
    hints: [
      'If the intervals were sorted by start, two intervals could only possibly overlap if they were adjacent in that order. Why does sorting first make the rest of the problem easy?',
      'Once sorted, walk left to right keeping a "current merged interval". When does the next interval extend it versus start a fresh one?',
      'Sort by start. Keep a running interval [curStart, curEnd]. If the next interval\'s start <= curEnd, extend curEnd to max(curEnd, nextEnd). Otherwise close the current interval and start a new one.',
    ],
    editorial: {
      approachSummary: 'Sort by start, then a single greedy sweep merging as you go.',
      content: `Without sorting, any interval could potentially overlap any other, which looks like it needs pairwise comparison. Sorting by start collapses that: once ordered, an interval can only extend the *immediately preceding* merged group — if it doesn't overlap the current group, it can't have overlapped anything before that group either, since everything before starts even earlier.

That gives a single linear sweep after the sort. Maintain a "current" interval. For each next interval in sorted order:
- if \`next.start <= current.end\` (they overlap or touch), fold it in: \`current.end = max(current.end, next.end)\`
- otherwise, the current interval is finished — emit it, and the next interval becomes the new current

The "touching counts as overlapping" rule (\`start <= end\`, not \`<\`) is where implementations most often diverge from the spec — get it backwards and \`[1,4]\` and \`[4,5]\` stay separate when they should merge into \`[1,5]\`.

Cost is dominated by the sort: \`O(n log n)\`.`,
      timeComplexity: 'O(n log n)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Sort then greedy sweep',
      time: 'O(n log n)',
      space: 'O(n)',
      python: `pairs = [(flat[i], flat[i + 1]) for i in range(0, len(flat), 2)]
pairs.sort()

merged = []
for start, end in pairs:
    if merged and start <= merged[-1][1]:
        merged[-1] = (merged[-1][0], max(merged[-1][1], end))
    else:
        merged.append((start, end))

result = []
for start, end in merged:
    result.append(start)
    result.append(end)
return result`,
    },
  },

  {
    slug: 'non-overlapping-intervals',
    title: 'Minimum Removals For Non-Overlapping Intervals',
    difficulty: 'MEDIUM',
    topics: ['greedy', 'sorting', 'array'],
    companies: [{ slug: 'google', frequency: 13 }, { slug: 'meta', frequency: 10 }],
    statement: `Given a flattened list of intervals, return the **minimum number** you must remove so that none of the remaining intervals overlap. Touching intervals (one ends where another begins) do **not** count as overlapping here.

### Input format
Line 1: the flattened intervals, space-separated.

### Output format
The minimum number of removals.`,
    statementDigest:
      'Minimum removals from a flattened interval list so the remainder is pairwise non-overlapping (touching is allowed).',
    constraints: `- \`1 <= number of intervals <= 10^4\`
- \`-5 * 10^4 <= start < end <= 5 * 10^4\``,
    constraintsDigest: 'up to 1e4 intervals, touching is allowed, minimise removals.',
    expectedTime: 'O(n log n)',
    expectedSpace: 'O(n)',
    io: { fn: 'minRemovals', params: [{ name: 'flat', type: 'int[]' }], returns: 'int' },
    examples: [
      { input: '1 2 2 3 3 4 1 3', output: '1', explanation: 'Removing [1,3] leaves the rest non-overlapping.' },
      { input: '1 2 1 2 1 2', output: '2', explanation: 'Keep one [1,2], remove the other two duplicates.' },
    ],
    sampleTests: [{ input: '1 2 2 3 3 4 1 3' }, { input: '1 2 1 2 1 2' }],
    hiddenTests: [
      { input: '1 2' },
      { input: '1 100 11 22 1 11 2 12' },
      { input: '0 2 1 3 2 4 3 5' },
      { input: '-5 -1 -3 0 2 4' },
    ],
    hints: [
      'This is equivalent to a different, more familiar question: what is the LARGEST set of intervals you can keep with no overlaps? How does that relate to the removal count?',
      'To maximise how many intervals you can keep without overlap, does it matter more where an interval STARTS or where it ENDS?',
      'Sort by END time. Greedily keep an interval if its start is >= the end of the last kept interval. The removal count is total minus kept.',
    ],
    editorial: {
      approachSummary: '"Activity selection": sort by end time, greedily keep what fits.',
      content: `Minimising removals is the same problem as **maximising** how many intervals survive — the answer is \`total - kept\`. That reframing turns this into the classic activity-selection problem.

The key greedy insight is sorting by **end time**, not start time. An interval that ends earlier leaves more room for everything that comes after it, regardless of where it started — so always preferring the earliest-ending option among your candidates is never worse than any other choice, and this can be shown by a standard exchange argument (any optimal solution can be rearranged to match the greedy choice without becoming worse).

Mechanically: sort intervals by end. Keep a \`lastEnd\` tracker, initialised to \`-infinity\`. Walk the sorted intervals; keep (and update \`lastEnd\`) any interval whose start is \`>= lastEnd\`— since touching is allowed here, the comparison is non-strict. Count how many you kept; the answer is \`total - kept\`.

This is a different sort key from the "merge intervals" problem (which sorts by *start*) — worth noticing, since reaching for the wrong sort key is the most common way to get this family of problems wrong.`,
      timeComplexity: 'O(n log n)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Activity selection — sort by end, greedy keep',
      time: 'O(n log n)',
      space: 'O(n)',
      python: `pairs = [(flat[i], flat[i + 1]) for i in range(0, len(flat), 2)]
pairs.sort(key=lambda p: p[1])

kept = 0
last_end = float('-inf')
for start, end in pairs:
    if start >= last_end:
        kept += 1
        last_end = end

return len(pairs) - kept`,
    },
  },

  {
    slug: 'jump-game-reachability',
    title: 'Jump Game',
    difficulty: 'MEDIUM',
    topics: ['greedy', 'array', 'dynamic-programming'],
    companies: [{ slug: 'amazon', frequency: 17 }, { slug: 'microsoft', frequency: 11 }],
    statement: `You start at index \`0\` of array \`nums\`. \`nums[i]\` is the maximum number of steps you may jump forward from index \`i\`. Return \`true\` if you can reach the last index.

### Input format
Line 1: the array \`nums\`, space-separated.

### Output format
\`true\` or \`false\`.`,
    statementDigest:
      'Starting at index 0 with nums[i] as the max forward jump from i, return whether index n-1 is reachable.',
    constraints: `- \`1 <= nums.length <= 10^4\`
- \`0 <= nums[i] <= 10^5\``,
    constraintsDigest: 'n <= 1e4, non-negative max-jump values, single pass expected.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'canReachEnd', params: [{ name: 'nums', type: 'int[]' }], returns: 'bool' },
    examples: [
      { input: '2 3 1 1 4', output: 'true', explanation: 'Jump 1 step then 3 steps to reach the last index.' },
      { input: '3 2 1 0 4', output: 'false', explanation: 'Every path gets stuck at the 0.' },
    ],
    sampleTests: [{ input: '2 3 1 1 4' }, { input: '3 2 1 0 4' }],
    hiddenTests: [
      { input: '0' },
      { input: '1 0 1 0' },
      { input: '2 0 0' },
      { input: '5 0 0 0 0' },
    ],
    hints: [
      'You do not need to know the exact sequence of jumps — only whether SOME sequence works. What single number about "how far you could possibly get" would answer that?',
      'As you scan left to right, keep track of the farthest index reachable so far using only positions you have already confirmed are reachable.',
      'Track farthest = 0. For each index i (only while i <= farthest, meaning i is itself reachable), update farthest = max(farthest, i + nums[i]). If farthest ever reaches the last index, return true.',
    ],
    editorial: {
      approachSummary: 'Track the single farthest reachable index in one linear pass.',
      content: `Trying every jump sequence is exponential. But you don't need a sequence — you only need to know whether *some* sequence reaches the end, and that collapses to tracking a single running number: the farthest index reachable so far.

Scan left to right, maintaining \`farthest\`. At each index \`i\` — but only if \`i\` is itself within \`farthest\` (otherwise you could never have legally arrived there) — update:

\`\`\`
farthest = max(farthest, i + nums[i])
\`\`\`

If at any point \`farthest >= n - 1\`, the end is reachable and you can stop early. If you finish the scan (or hit an index beyond \`farthest\`) without ever reaching that bound, it's unreachable.

The guard "only advance while \`i <= farthest\`" matters: without it you'd read \`nums[i]\` for an index you can't actually stand on, and incorrectly let its jump value contribute to the answer. That's exactly what \`[1, 0, 1, 0]\` tests — index 2 is unreachable (you get stuck at index 1's zero), so its \`nums[2] = 1\` must never be consulted.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'Running farthest-reachable-index sweep',
      time: 'O(n)',
      space: 'O(1)',
      python: `farthest = 0
n = len(nums)
for i in range(n):
    if i > farthest:
        return False
    if i + nums[i] > farthest:
        farthest = i + nums[i]
    if farthest >= n - 1:
        return True
return farthest >= n - 1`,
    },
  },

  {
    slug: 'gas-station-circuit',
    title: 'Gas Station Circuit',
    difficulty: 'MEDIUM',
    topics: ['greedy', 'array'],
    companies: [{ slug: 'amazon', frequency: 10 }, { slug: 'google', frequency: 8 }],
    statement: `There are \`n\` gas stations in a circle. \`gas[i]\` is the fuel available at station \`i\`; \`cost[i]\` is the fuel needed to travel from station \`i\` to station \`i + 1\`. Your tank starts empty.

Return the starting station index from which you can complete the full circuit, or \`-1\` if none exists. Exactly one solution is guaranteed if any exists.

### Input format
Line 1: the array \`gas\`, space-separated.
Line 2: the array \`cost\`, space-separated.

### Output format
The starting index, or \`-1\`.`,
    statementDigest:
      'Circular gas stations; find the unique starting index that permits completing the loop, or -1.',
    constraints: `- \`1 <= n <= 10^4\`
- \`0 <= gas[i], cost[i] <= 10^4\`
- \`gas.length == cost.length\``,
    constraintsDigest: 'n <= 1e4, circular route, at most one valid start guaranteed.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'startStation', params: [{ name: 'gas', type: 'int[]' }, { name: 'cost', type: 'int[]' }], returns: 'int' },
    examples: [
      { input: '1 2 3 4 5\n3 4 5 1 2', output: '3', explanation: 'Starting at station 3 completes the circuit.' },
      { input: '2 3 4\n3 4 3', output: '-1', explanation: 'No starting point works.' },
    ],
    sampleTests: [{ input: '1 2 3 4 5\n3 4 5 1 2' }, { input: '2 3 4\n3 4 3' }],
    hiddenTests: [
      { input: '5\n4' },
      { input: '3\n4' },
      { input: '4 5 2 6 5 3\n3 6 7 3 2 5' },
      { input: '0 0\n0 0' },
    ],
    hints: [
      'First: is there even a quick check for whether ANY valid start exists at all, before worrying about which one?',
      'A valid start exists if and only if total gas >= total cost overall. Given that, does the specific starting point matter for whether a solution CAN be found, or only for finding it?',
      'Track a running tank balance while sweeping once around from index 0. Whenever the tank goes negative, no station in the segment just completed could have been a valid start — reset the candidate start to the next index and the tank to 0.',
    ],
    editorial: {
      approachSummary: 'One sweep: a feasibility check, plus a candidate-reset greedy for the index.',
      content: `Two separate facts combine to make this solvable in one pass.

**Feasibility.** A valid starting point exists at all if and only if \`sum(gas) >= sum(cost)\`. If the total fuel available is less than the total needed, no rotation of the starting point can fix that — the deficit is global, not local.

**Finding it.** Given that a solution exists, here's the greedy argument: sweep from index 0, maintaining a running \`tank = gas[i] - cost[i]\` accumulated since the current candidate start. If \`tank\` ever goes negative at some index \`j\`, then **no station between the current candidate and \`j\` (inclusive) can be a valid start either** — because starting from any of them means arriving at \`j\` with a tank that's *at least* as depleted as it is now (you'd have accumulated a subset of the same deficit). So the whole segment is eliminated at once: reset the candidate to \`j + 1\` and the tank to \`0\`, and keep going.

Because the problem guarantees at most one valid answer exists, the candidate surviving at the end of one full sweep (given the feasibility check passed) is provably correct — no second pass needed. This "eliminate a whole run of candidates at once" move is what gets this down from an apparent \`O(n²)\` (try every start) to \`O(n)\`.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'Single-pass greedy with candidate elimination',
      time: 'O(n)',
      space: 'O(1)',
      python: `total = 0
tank = 0
start = 0
for i in range(len(gas)):
    diff = gas[i] - cost[i]
    total += diff
    tank += diff
    if tank < 0:
        start = i + 1
        tank = 0
return start if total >= 0 else -1`,
    },
  },

  /* ══════════════════════ Graphs — Connectivity ═════════════════════════ */
  {
    slug: 'number-of-provinces',
    title: 'Number Of Provinces',
    difficulty: 'MEDIUM',
    topics: ['graph', 'union-find', 'dfs'],
    companies: [{ slug: 'amazon', frequency: 16 }, { slug: 'meta', frequency: 12 }],
    statement: `There are \`n\` cities. \`isConnected\` is an \`n x n\` adjacency matrix (\`'1'\` if directly connected, \`'0'\` otherwise; always symmetric, diagonal is always \`'1'\`). A **province** is a maximal group of cities reachable from one another, directly or indirectly.

Return the number of provinces.

### Input format
Line 1: the integer \`n\`.
Next \`n\` lines: a string of \`n\` characters (\`0\`/\`1\`), the adjacency matrix.

### Output format
The number of provinces.`,
    statementDigest:
      'Given an n x n symmetric 0/1 adjacency matrix, count connected components (provinces).',
    constraints: `- \`1 <= n <= 200\`
- \`isConnected[i][j]\` is \`'0'\` or \`'1'\`, symmetric, diagonal is \`'1'\`.`,
    constraintsDigest: 'n <= 200, symmetric adjacency matrix as a character grid, count components.',
    expectedTime: 'O(n^2)',
    expectedSpace: 'O(n)',
    io: { fn: 'countProvinces', params: [{ name: 'isConnected', type: 'grid' }], returns: 'int' },
    examples: [
      {
        input: '3\n110\n110\n001',
        output: '2',
        explanation: 'Cities 0-1 form one province; city 2 is its own.',
      },
      {
        input: '3\n100\n010\n001',
        output: '3',
        explanation: 'No city is connected to any other.',
      },
    ],
    sampleTests: [{ input: '3\n110\n110\n001' }, { input: '3\n100\n010\n001' }],
    hiddenTests: [
      { input: '1\n1' },
      { input: '4\n1100\n1100\n0011\n0011' },
      { input: '5\n10000\n01000\n00100\n00010\n00001' },
      { input: '4\n1111\n1111\n1111\n1111' },
    ],
    hints: [
      'This is the same shape as counting islands in a grid, except the "adjacency" here is given directly as a matrix rather than implied by neighbouring cells. What does that change about the search?',
      'Two cities are in the same province if you can walk from one to the other via any chain of direct connections. What happens if you flood-fill from an unvisited city using the matrix as the adjacency list?',
      'For each unvisited city, increment the count and DFS/BFS to every city j where isConnected[i][j] == \'1\', marking each visited so it is never counted again.',
    ],
    editorial: {
      approachSummary: 'Connected-components counting, same shape as Number of Islands.',
      content: `Strip away the "cities" framing and this is exactly connected-components counting on an explicit graph — the adjacency matrix *is* the graph, row \`i\` listing every city directly reachable from city \`i\`.

The algorithm is the same one used for grid-based island counting, just with a different notion of "neighbour": instead of checking four grid-adjacent cells, you check every column \`j\` in row \`i\` where the matrix says \`'1'\`.

For each city not yet visited, that's a new province — increment the counter and flood-fill (BFS or DFS) to every city reachable from it, marking each as visited so it's never counted twice. Because the matrix is symmetric and includes the diagonal, ordinary undirected-graph traversal applies with no special-casing.

Union-Find is an equally valid, often faster-in-practice alternative: union every pair \`(i, j)\` where the matrix has a \`1\`, then count distinct roots. Either approach is \`O(n²)\` here, dominated by reading the matrix itself.`,
      timeComplexity: 'O(n^2)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'DFS flood fill over the adjacency matrix',
      time: 'O(n^2)',
      space: 'O(n)',
      python: `n = len(isConnected)
visited = [False] * n
provinces = 0

def dfs(city):
    visited[city] = True
    for other in range(n):
        if isConnected[city][other] == '1' and not visited[other]:
            dfs(other)

for city in range(n):
    if not visited[city]:
        provinces += 1
        dfs(city)

return provinces`,
    },
  },

  {
    slug: 'rotting-oranges',
    title: 'Rotting Oranges',
    difficulty: 'MEDIUM',
    topics: ['graph', 'bfs', 'matrix'],
    companies: [{ slug: 'amazon', frequency: 19 }, { slug: 'microsoft', frequency: 12 }],
    statement: `A grid contains \`'0'\` (empty), \`'1'\` (fresh orange), or \`'2'\` (rotten orange). Every minute, a rotten orange rots every **4-directionally adjacent** fresh orange.

Return the minimum minutes until no fresh orange remains, or \`-1\` if that's impossible.

### Input format
Line 1: two integers \`m\` and \`n\`.
Next \`m\` lines: a string of \`n\` characters (\`0\`, \`1\`, or \`2\`).

### Output format
The minimum minutes, or \`-1\`.`,
    statementDigest:
      'Multi-source spread from rotten oranges through a grid; return minutes to rot all fresh oranges, or -1.',
    constraints: `- \`1 <= m, n <= 10\`
- Grid cells are \`'0'\`, \`'1'\`, or \`'2'\`.`,
    constraintsDigest: 'small grid (<=10x10), multi-source simultaneous spread, minutes to saturation.',
    expectedTime: 'O(m * n)',
    expectedSpace: 'O(m * n)',
    io: { fn: 'minutesToRot', params: [{ name: 'grid', type: 'grid' }], returns: 'int' },
    examples: [
      {
        input: '3 3\n210\n111\n011',
        output: '4',
        explanation: 'Rot spreads outward from the initial rotten orange over 4 minutes.',
      },
      {
        input: '2 2\n01\n11',
        output: '-1',
        explanation: 'No rotten orange exists, so the isolated fresh ones never rot.',
      },
    ],
    sampleTests: [{ input: '3 3\n210\n111\n011' }, { input: '2 2\n01\n11' }],
    hiddenTests: [
      { input: '1 1\n0' },
      { input: '1 1\n2' },
      { input: '1 1\n1' },
      { input: '3 3\n000\n000\n000' },
      { input: '2 3\n212\n111' },
    ],
    hints: [
      'All initially rotten oranges rot their neighbours SIMULTANEOUSLY, not one after another. What search strategy naturally processes things level by level, all at once per round?',
      'Multi-source BFS: start the queue with EVERY initially rotten orange at once, not just one. What does one full round of the BFS frontier correspond to in minutes?',
      'Queue all rotten oranges with time 0. Standard BFS; each cell you rot gets time = parent time + 1. Track fresh-orange count; if it never reaches 0, return -1, else return the max time seen.',
    ],
    editorial: {
      approachSummary: 'Multi-source BFS seeded from every rotten orange at once.',
      content: `The key word is "simultaneously" — every rotten orange spreads in the same minute, not sequentially. That's precisely what **multi-source BFS** models: instead of starting a BFS from one node, seed the queue with *every* rotten orange at time 0. Because BFS explores level by level, one full round of dequeuing the current frontier and enqueuing newly-rotted neighbours corresponds exactly to one minute passing.

Track each cell's rot-time as it's enqueued (parent's time + 1), and count fresh oranges as you initialise. Standard BFS from there: pop a cell, rot each fresh 4-directional neighbour, record its time, decrement the fresh counter, push it.

At the end, two things to check:
- if any fresh orange is left unrotted (the fresh counter never hit zero), return \`-1\` — it was unreachable
- otherwise, the answer is the **maximum** rot-time recorded across all cells, not the count of BFS rounds — a grid that's entirely rotten or empty from the start correctly reports 0 minutes.`,
      timeComplexity: 'O(m * n)',
      spaceComplexity: 'O(m * n)',
    },
    solution: {
      approachName: 'Multi-source BFS',
      time: 'O(m * n)',
      space: 'O(m * n)',
      python: `from collections import deque

rows, cols = len(grid), len(grid[0])
queue = deque()
fresh = 0

for r in range(rows):
    for c in range(cols):
        if grid[r][c] == '2':
            queue.append((r, c, 0))
        elif grid[r][c] == '1':
            fresh += 1

if fresh == 0:
    return 0

max_time = 0
visited_fresh = 0
while queue:
    r, c, t = queue.popleft()
    max_time = max(max_time, t)
    for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nr, nc = r + dr, c + dc
        if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == '1':
            grid[nr][nc] = '2'
            visited_fresh += 1
            queue.append((nr, nc, t + 1))

return max_time if visited_fresh == fresh else -1`,
    },
  },

  {
    slug: 'redundant-connection',
    title: 'Redundant Connection',
    difficulty: 'MEDIUM',
    topics: ['graph', 'union-find'],
    companies: [{ slug: 'google', frequency: 11 }, { slug: 'amazon', frequency: 8 }],
    statement: `A tree with \`n\` nodes (labelled \`1..n\`) had one extra edge added, creating exactly one cycle. Given the \`n\` edges (flattened as \`u1 v1 u2 v2 …\`, in the order they were added), return the edge that can be removed to restore a tree.

If several edges could be removed, return the **last** one in the input order.

### Input format
Line 1: the flattened edges, space-separated.

### Output format
The redundant edge, two integers space-separated.`,
    statementDigest:
      'n edges on n nodes create exactly one cycle; return the last edge (in input order) that closes a cycle.',
    constraints: `- \`3 <= n <= 1000\`
- Edges are given in the order added; exactly one creates a cycle.`,
    constraintsDigest: 'n nodes, n edges, exactly one redundant edge, return it by input order.',
    expectedTime: 'O(n * alpha(n))',
    expectedSpace: 'O(n)',
    io: { fn: 'findRedundant', params: [{ name: 'flatEdges', type: 'int[]' }], returns: 'int[]' },
    examples: [
      { input: '1 2 1 3 2 3', output: '2 3', explanation: 'Edge [2,3] closes the cycle 1-2-3-1.' },
      { input: '1 2 2 3 3 4 1 4 1 5', output: '1 4', explanation: '[1,4] is the last edge that closes a cycle.' },
    ],
    sampleTests: [{ input: '1 2 1 3 2 3' }, { input: '1 2 2 3 3 4 1 4 1 5' }],
    hiddenTests: [
      { input: '1 2 2 3 1 3' },
      { input: '1 2 1 3 1 4 2 3' },
      { input: '1 2 2 3 3 4 4 5 5 1' },
    ],
    hints: [
      'A tree with n nodes has exactly n-1 edges. With n edges given, exactly one is the "extra" one. As you add edges one at a time, what does an edge whose two endpoints are ALREADY connected tell you?',
      'If you process edges in order and can quickly ask "are these two nodes already in the same connected group?", the first edge that answers yes is the culprit.',
      'Use Union-Find. For each edge (u, v) in order, if find(u) == find(v) already, this edge is redundant — return it immediately (this naturally gives the LAST such edge if you process in order and only the first true cycle-closer matters, since a tree has no cycle before it).',
    ],
    editorial: {
      approachSummary: 'Union-Find, processing edges in order; the first cycle-closer is the answer.',
      content: `A tree on \`n\` nodes has exactly \`n - 1\` edges and no cycles. Being handed \`n\` edges means exactly one of them is superfluous — adding it is what creates the graph's one and only cycle.

Union-Find (disjoint set union) answers exactly the question this needs: "are these two nodes already connected by edges added so far?" Process the edges **in the given order**. For each \`(u, v)\`:
- if \`find(u) != find(v)\`, they're in different components — union them, this edge is legitimately part of the tree
- if \`find(u) == find(v)\`, they're already connected by some earlier path of edges — this new edge is redundant, since it closes a cycle rather than connecting anything new

Because there is exactly one redundant edge and the input is a valid "tree plus one extra edge" by construction, **the first edge that triggers "already connected" is guaranteed to be the (unique) answer** — and since we process in input order, that's automatically the edge that appears last needed to complete the cycle, matching the "return the last such edge in input order" requirement without any extra bookkeeping.

Path compression and union by rank/size keep each \`find\`/\`union\` call close to \`O(1)\` amortised (formally \`O(α(n))\`, the inverse Ackermann function), so the whole pass is effectively linear.`,
      timeComplexity: 'O(n * alpha(n))',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Union-Find, first cycle-closing edge',
      time: 'O(n * alpha(n))',
      space: 'O(n)',
      python: `edges = [(flatEdges[i], flatEdges[i + 1]) for i in range(0, len(flatEdges), 2)]
n = len(edges)
parent = list(range(n + 1))

def find(x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x

for u, v in edges:
    ru, rv = find(u), find(v)
    if ru == rv:
        return [u, v]
    parent[ru] = rv

return []`,
    },
  },

  /* ══════════════════════ Dynamic Programming — Patterns ═══════════════ */
  {
    slug: 'longest-increasing-subsequence',
    title: 'Longest Increasing Subsequence',
    difficulty: 'MEDIUM',
    topics: ['dynamic-programming', 'binary-search', 'array'],
    companies: [{ slug: 'microsoft', frequency: 18 }, { slug: 'google', frequency: 14 }],
    statement: `Given an integer array \`nums\`, return the length of the longest **strictly increasing** subsequence (not necessarily contiguous).

### Input format
Line 1: the array \`nums\`, space-separated.

### Output format
The length of the longest strictly increasing subsequence.`,
    statementDigest:
      'Length of the longest strictly increasing (not necessarily contiguous) subsequence of nums.',
    constraints: `- \`1 <= nums.length <= 2500\`
- \`-10^4 <= nums[i] <= 10^4\``,
    constraintsDigest: 'n <= 2500, strictly increasing, subsequence need not be contiguous.',
    expectedTime: 'O(n log n)',
    expectedSpace: 'O(n)',
    io: { fn: 'lengthOfLIS', params: [{ name: 'nums', type: 'int[]' }], returns: 'int' },
    examples: [
      { input: '10 9 2 5 3 7 101 18', output: '4', explanation: '2, 3, 7, 101 (or 2, 3, 7, 18) has length 4.' },
      { input: '7 7 7 7', output: '1', explanation: 'Strictly increasing — equal values do not extend a run.' },
    ],
    sampleTests: [{ input: '10 9 2 5 3 7 101 18' }, { input: '7 7 7 7' }],
    hiddenTests: [
      { input: '1' },
      { input: '0 1 0 3 2 3' },
      { input: '4 10 4 3 8 9' },
      { input: '1 2 3 4 5' },
      { input: '5 4 3 2 1' },
    ],
    hints: [
      'A direct DP defining best(i) as "the longest increasing subsequence ending exactly at i" works but costs O(n^2) comparing every pair. Can you avoid comparing every earlier index?',
      'Instead of tracking lengths per ending index, try maintaining a separate array: for each possible LENGTH so far, what is the SMALLEST possible value that a subsequence of that length could end on?',
      'Maintain `tails`, where tails[k] is the smallest tail value of any increasing subsequence of length k+1 found so far. For each new number, binary-search tails for where it belongs and either extend or replace.',
    ],
    editorial: {
      approachSummary: 'Patience sorting: maintain the smallest possible tail per subsequence length.',
      content: `The straightforward DP — \`best[i]\` = longest increasing subsequence ending at index \`i\`, computed by scanning all \`j < i\` with \`nums[j] < nums[i]\` — is correct and a fine \`O(n²)\` answer. Getting to \`O(n log n)\` needs a different state entirely.

Maintain an array \`tails\`, where \`tails[k]\` holds the **smallest possible ending value** among all increasing subsequences of length \`k + 1\` discovered so far. This array is always sorted, which is what unlocks binary search.

For each new number \`x\`:
- binary-search \`tails\` for the leftmost position where \`tails[pos] >= x\`
- if no such position exists (x is larger than every tail), append it — you've extended the longest subsequence found so far by one
- otherwise, **replace** \`tails[pos]\` with \`x\` — you haven't found a longer subsequence, but you've found a strictly better (smaller) way to achieve a subsequence of that length, which gives future numbers more room to extend it

The final length of \`tails\` is the answer. It's worth being clear that \`tails\` is **not** an actual valid subsequence by the end — it's a bookkeeping structure — which is why this reframing feels non-obvious the first time, even though the resulting code is short.`,
      timeComplexity: 'O(n log n)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Patience sorting with binary search',
      time: 'O(n log n)',
      space: 'O(n)',
      python: `import bisect

tails = []
for value in nums:
    pos = bisect.bisect_left(tails, value)
    if pos == len(tails):
        tails.append(value)
    else:
        tails[pos] = value
return len(tails)`,
    },
  },

  {
    slug: 'unique-paths-grid',
    title: 'Unique Paths In A Grid',
    difficulty: 'MEDIUM',
    topics: ['dynamic-programming', 'matrix', 'math'],
    companies: [{ slug: 'amazon', frequency: 15 }, { slug: 'meta', frequency: 10 }],
    statement: `A robot starts at the top-left corner of an \`m x n\` grid and can move only **right** or **down**. Return the number of distinct paths to the bottom-right corner.

### Input format
Line 1: two integers \`m\` and \`n\`.

### Output format
The number of distinct paths.`,
    statementDigest:
      'Count right/down-only paths from top-left to bottom-right of an m x n grid.',
    constraints: `- \`1 <= m, n <= 100\`
- The answer fits in a 32-bit signed integer.`,
    constraintsDigest: 'grid up to 100x100, movement restricted to right/down.',
    expectedTime: 'O(m * n)',
    expectedSpace: 'O(n)',
    io: { fn: 'uniquePaths', params: [{ name: 'm', type: 'int' }, { name: 'n', type: 'int' }], returns: 'int' },
    examples: [
      { input: '3\n7', output: '28', explanation: 'A 3x7 grid has 28 distinct right/down paths.' },
      { input: '3\n2', output: '3', explanation: 'A 3x2 grid has 3 distinct paths.' },
    ],
    sampleTests: [{ input: '3\n7' }, { input: '3\n2' }],
    hiddenTests: [
      { input: '1\n1' },
      { input: '1\n10' },
      { input: '10\n1' },
      { input: '10\n10' },
    ],
    hints: [
      'How many ways are there to reach a cell in the top row, or the leftmost column? Is there really a choice involved there?',
      'For any interior cell, a path must have arrived either from directly above or directly from the left. How does that let you build up an answer cell by cell?',
      'ways[r][c] = ways[r-1][c] + ways[r][c-1], with the first row and first column initialised to 1 (only one way to walk straight along an edge). Only the previous row is ever needed, so one rolling array suffices.',
    ],
    editorial: {
      approachSummary: 'Grid DP: each cell\'s path count is the sum of the cell above and the cell to the left.',
      content: `Every cell in the top row can only have been reached by moving right the whole way — there's exactly one such path. Same for the leftmost column, moving down the whole way. That gives a clean base case: the entire first row and first column are all \`1\`.

For any other cell \`(r, c)\`, the last move into it was either from directly above \`(r-1, c)\` or directly to the left \`(r, c-1)\` — those are the only two ways to arrive, and they're mutually exclusive, so:

\`\`\`
ways[r][c] = ways[r-1][c] + ways[r][c-1]
\`\`\`

Filling the table row by row (or column by column) gives the answer at the bottom-right in \`O(m × n)\`.

Since each row only depends on the row directly above it, the full 2D table can be compressed to a single 1D array of length \`n\` that gets overwritten in place as you sweep down — \`O(n)\` space instead of \`O(m × n)\`.

(This also has a closed-form combinatorial answer — \`C(m+n-2, m-1)\`, choosing which of the \`m+n-2\` total moves are "down" — worth knowing exists, though the DP is the more generally useful pattern since it extends naturally to grids with obstacles, which the closed form does not.)`,
      timeComplexity: 'O(m * n)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Rolling-row grid DP',
      time: 'O(m * n)',
      space: 'O(n)',
      python: `row = [1] * n
for _ in range(1, m):
    for c in range(1, n):
        row[c] += row[c - 1]
return row[n - 1]`,
    },
  },

  {
    slug: 'partition-equal-subset-sum',
    title: 'Partition Into Two Equal-Sum Subsets',
    difficulty: 'MEDIUM',
    topics: ['dynamic-programming', 'array'],
    companies: [{ slug: 'meta', frequency: 12 }, { slug: 'amazon', frequency: 9 }],
    statement: `Given an array of positive integers \`nums\`, return \`true\` if it can be partitioned into two subsets with **equal sum**.

### Input format
Line 1: the array \`nums\`, space-separated.

### Output format
\`true\` or \`false\`.`,
    statementDigest:
      'Return true if nums (positive integers) can be split into two subsets of equal sum.',
    constraints: `- \`1 <= nums.length <= 200\`
- \`1 <= nums[i] <= 100\``,
    constraintsDigest: 'n <= 200, positive values up to 100, subset-sum feasibility.',
    expectedTime: 'O(n * sum)',
    expectedSpace: 'O(sum)',
    io: { fn: 'canPartition', params: [{ name: 'nums', type: 'int[]' }], returns: 'bool' },
    examples: [
      { input: '1 5 11 5', output: 'true', explanation: '[1,5,5] and [11] both sum to 11.' },
      { input: '1 2 3 5', output: 'false', explanation: 'The total is 11, which is odd — no equal split exists.' },
    ],
    sampleTests: [{ input: '1 5 11 5' }, { input: '1 2 3 5' }],
    hiddenTests: [
      { input: '1' },
      { input: '1 1' },
      { input: '2 2 3 5' },
      { input: '100 100 100 100 100 100 100 100' },
      { input: '3 3 3 4 5' },
    ],
    hints: [
      'If a valid equal split exists, what must be true about the total sum of the array before you even look at individual values?',
      'If the total is even, the question becomes: does some subset sum to exactly half the total? Where have you solved "does a subset sum to a target" before?',
      'This is subset-sum feasibility with target = total // 2. Use a boolean DP: reachable[s] = true if some subset sums to s. Process each number, updating reachable from high sums to low to avoid reusing a number twice in one step.',
    ],
    editorial: {
      approachSummary: 'Even-total check, then 0/1 subset-sum feasibility for half the total.',
      content: `First, a cheap filter: if the total sum is odd, no equal split can possibly exist — reject immediately. That's the \`[1,2,3,5]\` case (total 11).

If the total is even, the question reduces to: does some subset sum to exactly \`total / 2\`? (If one subset hits that target, the rest of the array automatically sums to the same value.) That's the 0/1 subset-sum feasibility problem — each number is either included or excluded, no reuse.

Maintain a boolean array \`reachable\`, where \`reachable[s]\` means "some subset of the numbers processed so far sums to exactly \`s\`". Initialise \`reachable[0] = True\` (the empty subset). For each number \`x\`, update the array — but critically, iterate \`s\` **from high to low**. Going low-to-high would let the same \`x\` be "used" multiple times within a single number's update pass (since you'd read an already-updated cell), silently turning this into unbounded subset sum instead of 0/1.

The answer is \`reachable[total // 2]\` after processing every number. Time and space are \`O(n × sum)\`, which is pseudo-polynomial — fine here since \`sum <= 200 × 100 = 20000\`.`,
      timeComplexity: 'O(n * sum)',
      spaceComplexity: 'O(sum)',
    },
    solution: {
      approachName: '0/1 subset-sum feasibility DP',
      time: 'O(n * sum)',
      space: 'O(sum)',
      python: `total = sum(nums)
if total % 2 != 0:
    return False

target = total // 2
reachable = [False] * (target + 1)
reachable[0] = True

for value in nums:
    for s in range(target, value - 1, -1):
        if reachable[s - value]:
            reachable[s] = True

return reachable[target]`,
    },
  },

  {
    slug: 'minimum-path-sum-grid',
    title: 'Minimum Path Sum',
    difficulty: 'MEDIUM',
    topics: ['dynamic-programming', 'matrix'],
    companies: [{ slug: 'amazon', frequency: 13 }, { slug: 'google', frequency: 10 }],
    statement: `Given a grid of non-negative single digits, find a path from the top-left to the bottom-right that **minimises the sum** of digits along the path, moving only **right** or **down**.

### Input format
Line 1: two integers \`m\` and \`n\`.
Next \`m\` lines: a string of \`n\` digits each.

### Output format
The minimum path sum.`,
    statementDigest:
      'Minimum-sum right/down-only path from top-left to bottom-right of a digit grid.',
    constraints: `- \`1 <= m, n <= 50\`
- Grid cells are digits \`0\`-\`9\`.`,
    constraintsDigest: 'grid up to 50x50, digit values, right/down movement only.',
    expectedTime: 'O(m * n)',
    expectedSpace: 'O(n)',
    io: { fn: 'minPathSum', params: [{ name: 'grid', type: 'grid' }], returns: 'int' },
    examples: [
      {
        input: '3 3\n119\n191\n191',
        output: '13',
        explanation: 'Down, down, right, right: 1+1+1+9+1 = 13 is the cheapest route.',
      },
      { input: '1 4\n1234', output: '10', explanation: 'Only one row: must sum every digit, 1+2+3+4=10.' },
    ],
    sampleTests: [{ input: '3 3\n119\n191\n191' }, { input: '1 4\n1234' }],
    hiddenTests: [
      { input: '1 1\n5' },
      { input: '2 2\n12\n13' },
      { input: '4 1\n1\n2\n3\n4' },
      { input: '2 3\n123\n456' },
    ],
    hints: [
      'This is structurally the same shape as counting paths in a grid — except now each cell has a cost, and you want the best total rather than the count of ways.',
      'The cheapest way to reach a cell must come from whichever of its two possible predecessors (above, or left) was itself cheaper to reach.',
      'best[r][c] = grid[r][c] + min(best[r-1][c], best[r][c-1]), with the first row and column handled as a running sum along the edge (only one way in from an edge).',
    ],
    editorial: {
      approachSummary: 'Grid DP: each cell\'s best cost is its own value plus the cheaper predecessor.',
      content: `Same skeleton as counting grid paths, with "count the ways" swapped for "minimise the cost". A cell can only be entered from above or from the left, so its best achievable cost is its own value plus whichever of those two predecessors was cheaper:

\`\`\`
best[r][c] = grid[r][c] + min(best[r-1][c], best[r][c-1])
\`\`\`

The edges are the base case, but unlike the pure path-counting version they aren't all \`1\` — along the top row and left column there is still only *one* way in (straight along the edge), so each edge cell's cost is simply the running sum of everything before it plus itself.

As before, each row only depends on the row above, so the table compresses to one rolling array of length \`n\`, updated in place left to right — \`O(n)\` space, \`O(m × n)\` time.

Grid values here are given as single-character digits (reusing the platform's grid type), so remember to convert each cell with \`int(ch)\` before summing.`,
      timeComplexity: 'O(m * n)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Rolling-row grid DP',
      time: 'O(m * n)',
      space: 'O(n)',
      python: `rows, cols = len(grid), len(grid[0])
row = [0] * cols
row[0] = int(grid[0][0])
for c in range(1, cols):
    row[c] = row[c - 1] + int(grid[0][c])

for r in range(1, rows):
    row[0] += int(grid[r][0])
    for c in range(1, cols):
        row[c] = int(grid[r][c]) + min(row[c], row[c - 1])

return row[cols - 1]`,
    },
  },

  /* ══════════════════════ Advanced Arrays & Strings ═════════════════════ */
  {
    slug: 'three-sum-triplets',
    title: 'Three Sum',
    difficulty: 'MEDIUM',
    topics: ['array', 'two-pointers', 'sorting'],
    companies: [{ slug: 'amazon', frequency: 29 }, { slug: 'meta', frequency: 22 }],
    statement: `Given an integer array \`nums\`, return all **unique** triplets \`[a, b, c]\` with \`a + b + c == 0\`. No duplicate triplets (by value, not index).

Return the triplets flattened, each sorted ascending internally, and the triplets themselves ordered ascending (by first element, then second, then third).

### Input format
Line 1: the array \`nums\`, space-separated.

### Output format
The flattened, sorted triplets. Empty line if none exist.`,
    statementDigest:
      'Return all unique triplets summing to zero, each internally sorted, triplets ordered ascending, flattened.',
    constraints: `- \`3 <= nums.length <= 3000\`
- \`-10^5 <= nums[i] <= 10^5\``,
    constraintsDigest: 'n <= 3000, values may repeat, output must be unique triplets in sorted order.',
    expectedTime: 'O(n^2)',
    expectedSpace: 'O(n)',
    io: { fn: 'threeSum', params: [{ name: 'nums', type: 'int[]' }], returns: 'int[]' },
    examples: [
      { input: '-1 0 1 2 -1 -4', output: '-1 -1 2 -1 0 1', explanation: 'Two unique triplets: [-1,-1,2] and [-1,0,1].' },
      { input: '0 1 1', output: '', explanation: 'No triplet sums to zero.' },
    ],
    sampleTests: [{ input: '-1 0 1 2 -1 -4' }, { input: '0 1 1' }],
    hiddenTests: [
      { input: '0 0 0' },
      { input: '0 0 0 0' },
      { input: '-2 0 1 1 2' },
      { input: '-4 -2 -2 -2 0 1 2 2 2 3 3 4 4 6 6' },
    ],
    hints: [
      'Brute force over all triplets is O(n^3). If the array were sorted and you fixed the first value, what technique finds pairs summing to a target in one linear pass?',
      'Sort first, then for each index i, look for two OTHER numbers summing to -nums[i] using two pointers converging from both ends of the remaining range.',
      'After sorting, fix i and run left/right pointers over (i+1, n-1). Skip past duplicate values for i, for left, and for right to avoid emitting the same triplet twice.',
    ],
    editorial: {
      approachSummary: 'Sort, fix one value, two-pointer scan for the other two — with duplicate skipping.',
      content: `Brute force checks every triplet: \`O(n³)\`. Sorting first unlocks a much better structure: fixing one element turns "find two more that sum to a target" into the classic two-pointer-on-a-sorted-array pattern, which is \`O(n)\` per fixed element — giving \`O(n²)\` overall.

For each index \`i\` (stopping once \`nums[i] > 0\`, since three sorted non-negative numbers can't sum to zero unless all are zero), set \`target = -nums[i]\` and run \`left = i+1\`, \`right = n-1\` converging inward: if the pair sums too low, advance \`left\`; too high, retreat \`right\`; exactly right, record the triplet.

The real difficulty is the **uniqueness** requirement, not the search. Three separate duplicate-skips are needed:
- skip repeated values of \`i\` (don't re-fix the same first element)
- after recording a match, skip repeated values while advancing \`left\`
- and symmetrically while retreating \`right\`

Miss any one of these three and you'll emit the same triplet multiple times — which is exactly why \`[0,0,0,0]\` and the longer duplicate-heavy hidden test exist: they're only correct if all three skips are in place.`,
      timeComplexity: 'O(n^2)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Sort + two pointers with triple duplicate-skipping',
      time: 'O(n^2)',
      space: 'O(n)',
      python: `nums = sorted(nums)
n = len(nums)
result = []

for i in range(n - 2):
    if nums[i] > 0:
        break
    if i > 0 and nums[i] == nums[i - 1]:
        continue

    left, right = i + 1, n - 1
    while left < right:
        total = nums[i] + nums[left] + nums[right]
        if total < 0:
            left += 1
        elif total > 0:
            right -= 1
        else:
            result.extend([nums[i], nums[left], nums[right]])
            left += 1
            right -= 1
            while left < right and nums[left] == nums[left - 1]:
                left += 1
            while left < right and nums[right] == nums[right + 1]:
                right -= 1

return result`,
    },
  },

  {
    slug: 'next-permutation',
    title: 'Next Permutation',
    difficulty: 'MEDIUM',
    topics: ['array', 'two-pointers'],
    companies: [{ slug: 'meta', frequency: 14 }, { slug: 'google', frequency: 10 }],
    statement: `Given an array \`nums\` representing a permutation, rearrange it **in place** into the **next** lexicographically greater permutation. If none exists (it's already the highest), rearrange into the lowest (sorted ascending).

Return the resulting array.

### Input format
Line 1: the array \`nums\`, space-separated.

### Output format
The next permutation, space-separated.`,
    statementDigest:
      'Transform nums into the next lexicographic permutation, wrapping to sorted-ascending if already maximal.',
    constraints: `- \`1 <= nums.length <= 100\`
- \`0 <= nums[i] <= 100\``,
    constraintsDigest: 'n <= 100, may contain duplicates, in-place next-permutation semantics.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'nextPermutation', params: [{ name: 'nums', type: 'int[]' }], returns: 'int[]' },
    examples: [
      { input: '1 2 3', output: '1 3 2', explanation: 'The next permutation after 123 is 132.' },
      { input: '3 2 1', output: '1 2 3', explanation: 'Already the highest permutation — wraps to the lowest.' },
    ],
    sampleTests: [{ input: '1 2 3' }, { input: '3 2 1' }],
    hiddenTests: [
      { input: '1' },
      { input: '1 1 5' },
      { input: '1 3 2' },
      { input: '2 3 1' },
      { input: '1 5 1' },
    ],
    hints: [
      'To get the NEXT permutation (just barely larger), you want to change the array as little as possible, and as far RIGHT as possible. What does the longest non-increasing suffix tell you?',
      'Find the rightmost position i where nums[i] < nums[i+1] — everything after i is already the largest arrangement possible for that suffix. What needs to happen at position i?',
      'Find the rightmost ascent i (nums[i] < nums[i+1]). Find the rightmost element in the suffix greater than nums[i], swap them, then reverse the suffix after i to make it the smallest possible arrangement.',
    ],
    editorial: {
      approachSummary: 'Rightmost ascent, swap with its just-larger successor, reverse the tail.',
      content: `"Next permutation" means the smallest possible increase — so change the array as little as possible, and make whatever change you do make as far to the **right** as possible, since later positions are lower-order.

Three steps:

1. **Find the pivot.** Scan from the right for the first index \`i\` where \`nums[i] < nums[i+1]\`. Everything to the right of \`i\` is in strictly decreasing order — i.e., it's already the *largest* possible arrangement of those elements, which is exactly why no smaller change is possible without touching index \`i\`.
2. **Find the successor.** Scan from the right again (within the same suffix) for the smallest value that's still greater than \`nums[i]\` — equivalently, the rightmost element greater than \`nums[i]\`, since the suffix is decreasing. Swap it with \`nums[i]\`.
3. **Reverse the tail.** The suffix after position \`i\` is still in decreasing order after the swap. Reverse it to make it ascending — the smallest possible arrangement — which minimises the overall increase.

If no ascent exists at all (the whole array is strictly decreasing, e.g. \`[3,2,1]\`), the array is already the maximum permutation; reversing the entire thing (step 3 applied from the start) correctly wraps around to the minimum.

Every step is a single linear scan or swap — \`O(n)\` time, done in place with \`O(1)\` extra space.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'Pivot, successor swap, reverse suffix',
      time: 'O(n)',
      space: 'O(1)',
      python: `nums = list(nums)
n = len(nums)
i = n - 2
while i >= 0 and nums[i] >= nums[i + 1]:
    i -= 1

if i >= 0:
    j = n - 1
    while nums[j] <= nums[i]:
        j -= 1
    nums[i], nums[j] = nums[j], nums[i]

nums[i + 1:] = reversed(nums[i + 1:])
return nums`,
    },
  },

  {
    slug: 'spiral-matrix-order',
    title: 'Spiral Matrix Traversal',
    difficulty: 'MEDIUM',
    topics: ['array', 'matrix', 'greedy'],
    companies: [{ slug: 'microsoft', frequency: 16 }, { slug: 'amazon', frequency: 11 }],
    statement: `Given an \`m x n\` grid of digits, return all elements in **spiral order** (clockwise, starting top-left).

### Input format
Line 1: two integers \`m\` and \`n\`.
Next \`m\` lines: a string of \`n\` digits each.

### Output format
The elements in spiral order, space-separated.`,
    statementDigest:
      'Return the elements of an m x n digit grid visited in clockwise spiral order from the top-left.',
    constraints: `- \`1 <= m, n <= 10\`
- Grid cells are digits \`0\`-\`9\`.`,
    constraintsDigest: 'grid up to 10x10, clockwise spiral order starting top-left.',
    expectedTime: 'O(m * n)',
    expectedSpace: 'O(m * n)',
    io: { fn: 'spiralOrder', params: [{ name: 'grid', type: 'grid' }], returns: 'int[]' },
    examples: [
      {
        input: '3 3\n123\n456\n789',
        output: '1 2 3 6 9 8 7 4 5',
        explanation: 'Right along the top, down the side, left along the bottom, up, then inward.',
      },
      {
        input: '1 4\n1234',
        output: '1 2 3 4',
        explanation: 'A single row is just left-to-right.',
      },
    ],
    sampleTests: [{ input: '3 3\n123\n456\n789' }, { input: '1 4\n1234' }],
    hiddenTests: [
      { input: '1 1\n5' },
      { input: '4 1\n1\n2\n3\n4' },
      { input: '2 2\n12\n34' },
      { input: '3 4\n1234\n5678\n9012' },
    ],
    hints: [
      'The path traces a shrinking rectangle: right along the top, down the right side, left along the bottom, up the left side, then repeat one layer in. What four boundaries would you track to know when each leg ends?',
      'Maintain top, bottom, left, right boundaries. After completing a full leg in one direction, that boundary is exhausted and should move inward — but be careful about a leg becoming degenerate.',
      'After the "left along the bottom" and "up the left side" legs, explicitly check the boundaries have not crossed — a single remaining row or column must not be traversed twice.',
    ],
    editorial: {
      approachSummary: 'Four shrinking boundaries, walked in rotation, with degenerate-leg guards.',
      content: `Picture four boundaries — \`top\`, \`bottom\`, \`left\`, \`right\` — bounding the not-yet-visited region. The spiral is four legs repeated in rotation, each followed by shrinking the boundary that leg just exhausted:

1. walk **right** along \`top\`, then \`top += 1\`
2. walk **down** along \`right\`, then \`right -= 1\`
3. walk **left** along \`bottom\`, then \`bottom -= 1\`
4. walk **up** along \`left\`, then \`left += 1\`

Repeat while \`top <= bottom and left <= right\`.

The subtlety is that legs 3 and 4 must **check the boundaries haven't already crossed** before executing, because a grid that's down to a single remaining row or column would otherwise get traversed twice — once as the "bottom" row in leg 1 or 3, and then incorrectly again in the leg meant for the perpendicular direction. Guarding legs 3 and 4 with an explicit \`if top <= bottom\` / \`if left <= right\` check (in addition to the outer loop condition) is what makes single-row and single-column grids come out right — which is exactly what the \`1x4\` and \`4x1\` test cases are checking.

Each cell is visited exactly once, so this is \`O(m × n)\` regardless of the grid's aspect ratio.`,
      timeComplexity: 'O(m * n)',
      spaceComplexity: 'O(m * n)',
    },
    solution: {
      approachName: 'Four shrinking boundaries',
      time: 'O(m * n)',
      space: 'O(m * n)',
      python: `rows, cols = len(grid), len(grid[0])
top, bottom, left, right = 0, rows - 1, 0, cols - 1
result = []

while top <= bottom and left <= right:
    for c in range(left, right + 1):
        result.append(int(grid[top][c]))
    top += 1

    for r in range(top, bottom + 1):
        result.append(int(grid[r][right]))
    right -= 1

    if top <= bottom:
        for c in range(right, left - 1, -1):
            result.append(int(grid[bottom][c]))
        bottom -= 1

    if left <= right:
        for r in range(bottom, top - 1, -1):
            result.append(int(grid[r][left]))
        left += 1

return result`,
    },
  },
];
