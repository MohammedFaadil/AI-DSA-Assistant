import type { IoSpec } from '../../src/harness.js';

export interface SeedTest {
  input: string;
  /**
   * Optional. Expected outputs are derived by executing the reference solution
   * (see verify.ts); anything declared here is treated as an ASSERTION against
   * the derived value, so a mistake in either one fails the seed loudly.
   */
  expectedOutput?: string;
  isSample?: boolean;
}

export interface SeedProblem {
  slug: string;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  topics: string[];
  companies: { slug: string; frequency: number }[];
  statement: string;
  /** Compressed form fed to the LLM — never the raw markdown (docs 01 §6). */
  statementDigest: string;
  constraints: string;
  constraintsDigest: string;
  expectedTime: string;
  expectedSpace: string;
  io: IoSpec;
  examples: { input: string; output: string; explanation: string }[];
  /** First N are samples (visible); the rest are hidden. */
  sampleTests: SeedTest[];
  hiddenTests: SeedTest[];
  hints: [string, string, string];
  editorial: {
    approachSummary: string;
    content: string;
    timeComplexity: string;
    spaceComplexity: string;
  };
  solution: { approachName: string; python: string; time: string; space: string };
}

export const PROBLEMS: SeedProblem[] = [
  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'EASY',
    topics: ['array', 'hash-table'],
    companies: [
      { slug: 'google', frequency: 42 },
      { slug: 'amazon', frequency: 38 },
      { slug: 'microsoft', frequency: 25 },
    ],
    statement: `Given an array of integers \`nums\` and an integer \`target\`, return the **indices** of the two numbers such that they add up to \`target\`.

You may assume that each input has **exactly one solution**, and you may not use the same element twice. Return the indices in ascending order.

### Input format
Line 1: the array \`nums\`, space-separated.
Line 2: the integer \`target\`.

### Output format
The two indices, space-separated.`,
    statementDigest:
      'Given int array nums and int target, return the two indices whose values sum to target. Exactly one solution exists; an element cannot be reused.',
    constraints: `- \`2 <= nums.length <= 10^4\`
- \`-10^9 <= nums[i] <= 10^9\`
- \`-10^9 <= target <= 10^9\`
- Exactly one valid answer exists.`,
    constraintsDigest: 'n <= 1e4, values fit in int32, exactly one answer.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(n)',
    io: { fn: 'twoSum', params: [{ name: 'nums', type: 'int[]' }, { name: 'target', type: 'int' }], returns: 'int[]' },
    examples: [
      { input: '2 7 11 15\n9', output: '0 1', explanation: 'nums[0] + nums[1] == 9.' },
      { input: '3 2 4\n6', output: '1 2', explanation: 'nums[1] + nums[2] == 6.' },
    ],
    sampleTests: [
      { input: '2 7 11 15\n9', expectedOutput: '0 1' },
      { input: '3 2 4\n6', expectedOutput: '1 2' },
      { input: '3 3\n6', expectedOutput: '0 1' },
    ],
    hiddenTests: [
      { input: '-1 -2 -3 -4 -5\n-8', expectedOutput: '2 4' },
      { input: '1 5 3 7 9 2\n11', expectedOutput: '4 5' },
      { input: '0 4 3 0\n0', expectedOutput: '0 3' },
      { input: '-3 4 3 90\n0', expectedOutput: '0 2' },
    ],
    hints: [
      'For each number you look at, there is exactly one other number that would complete the pair. Can you say what it is before you go looking for it?',
      'Checking every pair costs O(n²). The expensive part is the search for the partner. What data structure turns a search into a constant-time question?',
      'Walk the array once, keeping a map from value to index. For each element, ask the map whether `target - value` has already been seen. If it has, you have your answer; otherwise record the current value.',
    ],
    editorial: {
      approachSummary: 'One pass with a hash map from value to index.',
      content: `The brute-force solution checks every pair: \`O(n²)\` time, \`O(1)\` space. It passes small inputs and times out on the real constraints.

The insight is that the pair is not really two unknowns. Once you fix one element \`nums[i]\`, its partner is determined: it must equal \`target - nums[i]\`. So the problem reduces to *"have I already seen the value I need?"* — a membership question.

A hash map answers membership in \`O(1)\`. Walk the array once, and for each element look up its complement. If it's present, return the stored index and the current index. Otherwise store the current value and continue.

Because we look up **before** we insert, we never pair an element with itself.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Hash Map (one pass)',
      time: 'O(n)',
      space: 'O(n)',
      python: `seen = {}
for i, value in enumerate(nums):
    complement = target - value
    if complement in seen:
        return [seen[complement], i]
    seen[value] = i
return []`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'contains-duplicate',
    title: 'Contains Duplicate',
    difficulty: 'EASY',
    topics: ['array', 'hash-table', 'sorting'],
    companies: [{ slug: 'amazon', frequency: 18 }, { slug: 'apple', frequency: 12 }],
    statement: `Given an integer array \`nums\`, return \`true\` if any value appears **at least twice**, and \`false\` if every element is distinct.

### Input format
Line 1: the array \`nums\`, space-separated.

### Output format
\`true\` or \`false\`.`,
    statementDigest: 'Return true if any value in nums appears at least twice, else false.',
    constraints: `- \`1 <= nums.length <= 10^5\`
- \`-10^9 <= nums[i] <= 10^9\``,
    constraintsDigest: 'n <= 1e5, int32 values.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(n)',
    io: { fn: 'containsDuplicate', params: [{ name: 'nums', type: 'int[]' }], returns: 'bool' },
    examples: [
      { input: '1 2 3 1', output: 'true', explanation: 'The value 1 appears twice.' },
      { input: '1 2 3 4', output: 'false', explanation: 'All values are distinct.' },
    ],
    sampleTests: [
      { input: '1 2 3 1', expectedOutput: 'true' },
      { input: '1 2 3 4', expectedOutput: 'false' },
      { input: '1 1 1 3 3 4 3 2 4 2', expectedOutput: 'true' },
    ],
    hiddenTests: [
      { input: '7', expectedOutput: 'false' },
      { input: '-1 -1', expectedOutput: 'true' },
      { input: '1 2 3 4 5 6 7 8 9 10', expectedOutput: 'false' },
      { input: '0 0 0 0 0', expectedOutput: 'true' },
    ],
    hints: [
      'You do not need to know *where* the duplicate is, or *which* value it is — only whether one exists. Does that let you throw information away?',
      'Comparing every pair is O(n²). Two cheaper strategies exist: make equal values adjacent, or remember what you have already seen.',
      'Insert values into a set as you scan. The moment an insert finds the value already present, you have your answer. Equivalently: compare the size of the set of values with the length of the array.',
    ],
    editorial: {
      approachSummary: 'Compare the size of a set of the values with the array length.',
      content: `Three approaches, in increasing order of quality:

1. **Brute force** — compare every pair. \`O(n²)\`, times out at \`n = 10^5\`.
2. **Sort first** — duplicates become adjacent, then one linear scan. \`O(n log n)\` time, \`O(1)\` extra space if sorting in place. A good answer when memory is tight.
3. **Hash set** — insert as you scan; a collision *is* the answer. \`O(n)\` time, \`O(n)\` space.

Approach 3 is the expected one here. Note the one-liner \`len(set(nums)) != len(nums)\` expresses it exactly, though the explicit loop is better when you want to exit early on the first duplicate.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Hash Set',
      time: 'O(n)',
      space: 'O(n)',
      python: `seen = set()
for value in nums:
    if value in seen:
        return True
    seen.add(value)
return False`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'EASY',
    topics: ['string', 'stack'],
    companies: [
      { slug: 'google', frequency: 30 },
      { slug: 'meta', frequency: 22 },
      { slug: 'bloomberg', frequency: 15 },
    ],
    statement: `Given a string \`s\` containing only the characters \`(\`, \`)\`, \`{\`, \`}\`, \`[\` and \`]\`, determine whether the string is **valid**.

A string is valid when:
1. every open bracket is closed by a bracket of the same type, and
2. brackets close in the correct order.

### Input format
Line 1: the string \`s\`.

### Output format
\`true\` or \`false\`.`,
    statementDigest:
      'Given a string of only bracket characters, return true if brackets are correctly matched and nested.',
    constraints: `- \`1 <= s.length <= 10^4\`
- \`s\` consists only of \`()[]{}\``,
    constraintsDigest: 'len <= 1e4, only bracket characters.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(n)',
    io: { fn: 'isValid', params: [{ name: 's', type: 'str' }], returns: 'bool' },
    examples: [
      { input: '()[]{}', output: 'true', explanation: 'Every bracket is matched in order.' },
      { input: '([)]', output: 'false', explanation: 'The brackets are interleaved, not nested.' },
    ],
    sampleTests: [
      { input: '()', expectedOutput: 'true' },
      { input: '()[]{}', expectedOutput: 'true' },
      { input: '(]', expectedOutput: 'false' },
    ],
    hiddenTests: [
      { input: '([)]', expectedOutput: 'false' },
      { input: '{[]}', expectedOutput: 'true' },
      { input: '(', expectedOutput: 'false' },
      { input: ']', expectedOutput: 'false' },
      { input: '{[()()]}', expectedOutput: 'true' },
    ],
    hints: [
      'When you meet a closing bracket, only one specific open bracket could legally match it. Which one — and where is it in the string relative to everything else still open?',
      'The bracket that must match is always the *most recently opened* one that is still unclosed. That "most recent, still open" ordering is exactly what one classic data structure gives you.',
      'Push every opening bracket. On a closing bracket, pop and check the popped value is its partner — failing if the stack is empty. At the end, the string is valid only if the stack is empty.',
    ],
    editorial: {
      approachSummary: 'A stack of unclosed opening brackets.',
      content: `The rule "closed in the correct order" is a statement about **nesting**, and nesting is last-in-first-out. That single observation picks the data structure for you.

Scan left to right:
- opening bracket → push it
- closing bracket → the only legal partner is the top of the stack. If the stack is empty, or the top isn't the matching opener, the string is invalid.

At the end, any leftover openers mean unclosed brackets, so a valid string leaves the stack empty.

Two failure cases are easy to miss and are both covered by the checks above: a closing bracket with nothing open (\`"]"\`), and openers never closed (\`"("\`).`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Stack',
      time: 'O(n)',
      space: 'O(n)',
      python: `pairs = {")": "(", "]": "[", "}": "{"}
stack = []
for ch in s:
    if ch in pairs:
        if not stack or stack.pop() != pairs[ch]:
            return False
    else:
        stack.append(ch)
return len(stack) == 0`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'best-time-to-buy-and-sell-stock',
    title: 'Best Time to Buy and Sell Stock',
    difficulty: 'EASY',
    topics: ['array', 'dynamic-programming', 'greedy'],
    companies: [
      { slug: 'amazon', frequency: 35 },
      { slug: 'microsoft', frequency: 20 },
      { slug: 'bloomberg', frequency: 18 },
    ],
    statement: `You are given an array \`prices\` where \`prices[i]\` is the price of a stock on day \`i\`.

You may choose **one** day to buy and a **later** day to sell. Return the maximum profit you can achieve, or \`0\` if no profitable transaction exists.

### Input format
Line 1: the array \`prices\`, space-separated.

### Output format
The maximum profit as an integer.`,
    statementDigest:
      'Given daily prices, buy on one day and sell on a strictly later day to maximise profit. Return max profit, or 0 if none is positive.',
    constraints: `- \`1 <= prices.length <= 10^5\`
- \`0 <= prices[i] <= 10^4\``,
    constraintsDigest: 'n <= 1e5, prices are non-negative.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'maxProfit', params: [{ name: 'prices', type: 'int[]' }], returns: 'int' },
    examples: [
      { input: '7 1 5 3 6 4', output: '5', explanation: 'Buy on day 1 (price 1), sell on day 4 (price 6).' },
      { input: '7 6 4 3 1', output: '0', explanation: 'Prices only fall — no profitable transaction.' },
    ],
    sampleTests: [
      { input: '7 1 5 3 6 4', expectedOutput: '5' },
      { input: '7 6 4 3 1', expectedOutput: '0' },
    ],
    hiddenTests: [
      { input: '1 2', expectedOutput: '1' },
      { input: '2 4 1', expectedOutput: '2' },
      { input: '3 3 5 0 0 3 1 4', expectedOutput: '4' },
      { input: '1', expectedOutput: '0' },
      { input: '2 1 2 1 0 1 2', expectedOutput: '2' },
    ],
    hints: [
      'Fix the day you sell. Given that day, what is the only thing about the past that affects your profit?',
      'You never need the whole history — only one number about it. Can you maintain that number as you scan forward?',
      'Track the minimum price seen so far. At each day, the best profit ending on that day is `price - minSoFar`. Take the maximum of those, updating `minSoFar` as you go. One pass, constant memory.',
    ],
    editorial: {
      approachSummary: 'One pass tracking the running minimum price.',
      content: `The brute force tries every (buy, sell) pair: \`O(n²)\`.

Reframe it. If you decide to sell on day \`i\`, your profit is \`prices[i] - prices[j]\` for some \`j < i\`, and you obviously want the smallest such \`prices[j]\`. So the entire past collapses into one number: **the minimum price seen so far**.

That gives a single forward pass:
- update \`minSoFar = min(minSoFar, prices[i])\`
- update \`best = max(best, prices[i] - minSoFar)\`

Order matters only in that updating the minimum first is still correct — buying and selling on the same day yields 0, which never beats a real answer and never goes negative.

This is also the simplest example of a DP whose state has been compressed to \`O(1)\`.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'Running minimum',
      time: 'O(n)',
      space: 'O(1)',
      python: `best = 0
low = None
for price in prices:
    if low is None or price < low:
        low = price
    elif price - low > best:
        best = price - low
return best`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'maximum-subarray',
    title: 'Maximum Subarray',
    difficulty: 'MEDIUM',
    topics: ['array', 'dynamic-programming', 'greedy'],
    companies: [
      { slug: 'amazon', frequency: 40 },
      { slug: 'microsoft', frequency: 28 },
      { slug: 'apple', frequency: 16 },
    ],
    statement: `Given an integer array \`nums\`, find the **contiguous** subarray containing at least one number which has the largest sum, and return that sum.

### Input format
Line 1: the array \`nums\`, space-separated.

### Output format
The maximum subarray sum.`,
    statementDigest:
      'Return the largest sum obtainable from a non-empty contiguous subarray of nums. Values may be negative.',
    constraints: `- \`1 <= nums.length <= 10^5\`
- \`-10^4 <= nums[i] <= 10^4\``,
    constraintsDigest: 'n <= 1e5, values may be negative, subarray must be non-empty.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'maxSubArray', params: [{ name: 'nums', type: 'int[]' }], returns: 'int' },
    examples: [
      { input: '-2 1 -3 4 -1 2 1 -5 4', output: '6', explanation: 'The subarray [4,-1,2,1] sums to 6.' },
      { input: '5 4 -1 7 8', output: '23', explanation: 'The whole array is the best subarray.' },
    ],
    sampleTests: [
      { input: '-2 1 -3 4 -1 2 1 -5 4', expectedOutput: '6' },
      { input: '1', expectedOutput: '1' },
      { input: '5 4 -1 7 8', expectedOutput: '23' },
    ],
    hiddenTests: [
      { input: '-1', expectedOutput: '-1' },
      { input: '-2 -1', expectedOutput: '-1' },
      { input: '8 -19 5 -4 20', expectedOutput: '21' },
      { input: '1 2 3 4 5', expectedOutput: '15' },
      { input: '-5 -4 -3 -2 -1', expectedOutput: '-1' },
    ],
    hints: [
      'Think about the best subarray that *ends exactly at* index i. How does it relate to the best subarray ending at i-1?',
      'At each index you face one decision: extend the previous run, or start a new run here. Which one is better is decided by a single comparison.',
      'Let `cur` be the best sum ending at i. Then `cur = max(nums[i], cur + nums[i])`. Track the maximum `cur` you have ever seen. Initialise from the first element, not from 0 — the answer can be negative.',
    ],
    editorial: {
      approachSummary: "Kadane's algorithm — one decision per element.",
      content: `Trying every subarray is \`O(n²)\` (or \`O(n³)\` if you re-sum each one).

The DP formulation is small. Define \`cur[i]\` as the largest sum of a subarray **ending exactly at** \`i\`. Then:

\`\`\`
cur[i] = max(nums[i], cur[i-1] + nums[i])
\`\`\`

That is: either the previous run is worth carrying forward, or it isn't and you start fresh at \`i\`. The answer is \`max(cur[i])\` over all \`i\`.

Since \`cur[i]\` depends only on \`cur[i-1]\`, keep one variable instead of an array — \`O(1)\` space.

**The single most common bug** is initialising the answer to \`0\`. That silently returns \`0\` for an all-negative array, where the correct answer is the largest (least negative) element. Initialise both variables from \`nums[0]\`.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: "Kadane's algorithm",
      time: 'O(n)',
      space: 'O(1)',
      python: `best = nums[0]
cur = nums[0]
for value in nums[1:]:
    cur = value if cur < 0 else cur + value
    if cur > best:
        best = cur
return best`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'binary-search',
    title: 'Binary Search',
    difficulty: 'EASY',
    topics: ['array', 'binary-search'],
    companies: [{ slug: 'google', frequency: 20 }, { slug: 'microsoft', frequency: 14 }],
    statement: `Given a sorted array of distinct integers \`nums\` and an integer \`target\`, return the index of \`target\` if it exists, otherwise return \`-1\`.

You must write an algorithm with \`O(log n)\` runtime complexity.

### Input format
Line 1: the sorted array \`nums\`, space-separated.
Line 2: the integer \`target\`.

### Output format
The index, or \`-1\`.`,
    statementDigest:
      'Sorted distinct int array; return index of target or -1. Must run in O(log n).',
    constraints: `- \`1 <= nums.length <= 10^4\`
- \`-10^4 < nums[i], target < 10^4\`
- All integers in \`nums\` are distinct and sorted in ascending order.`,
    constraintsDigest: 'n <= 1e4, sorted, distinct, O(log n) required.',
    expectedTime: 'O(log n)',
    expectedSpace: 'O(1)',
    io: { fn: 'search', params: [{ name: 'nums', type: 'int[]' }, { name: 'target', type: 'int' }], returns: 'int' },
    examples: [
      { input: '-1 0 3 5 9 12\n9', output: '4', explanation: '9 is at index 4.' },
      { input: '-1 0 3 5 9 12\n2', output: '-1', explanation: '2 is not present.' },
    ],
    sampleTests: [
      { input: '-1 0 3 5 9 12\n9', expectedOutput: '4' },
      { input: '-1 0 3 5 9 12\n2', expectedOutput: '-1' },
    ],
    hiddenTests: [
      { input: '5\n5', expectedOutput: '0' },
      { input: '5\n-5', expectedOutput: '-1' },
      { input: '1 2 3 4 5 6 7 8 9 10\n1', expectedOutput: '0' },
      { input: '1 2 3 4 5 6 7 8 9 10\n10', expectedOutput: '9' },
      { input: '-100 -50 0 50 100\n-50', expectedOutput: '1' },
    ],
    hints: [
      'Sorted means one comparison tells you far more than "not this one". What does comparing the middle element to the target let you rule out?',
      'Maintain a half-open or closed interval of indices that could still contain the target, and shrink it every step. The hard part is not the idea — it is the interval convention.',
      'Use `lo = 0`, `hi = n - 1`, and loop while `lo <= hi`. Compute `mid = lo + (hi - lo) // 2`. If `nums[mid] < target`, move `lo = mid + 1`; if greater, `hi = mid - 1`. Every branch must strictly shrink the interval or you will loop forever.',
    ],
    editorial: {
      approachSummary: 'Closed-interval binary search with a strict shrink on every branch.',
      content: `Binary search is easy to describe and famously easy to get subtly wrong. Three things decide correctness:

1. **The interval convention.** With \`hi = n - 1\` (closed interval), the loop condition must be \`lo <= hi\`, and the updates must be \`mid + 1\` / \`mid - 1\`. Mixing this with the half-open convention (\`hi = n\`, \`lo < hi\`, \`hi = mid\`) is the most common source of off-by-one bugs.
2. **Strict progress.** Every branch must exclude \`mid\`. Writing \`hi = mid\` in the closed convention can leave the interval unchanged and hang.
3. **Overflow.** \`(lo + hi) / 2\` can overflow in fixed-width languages. \`lo + (hi - lo) / 2\` never does. Python doesn't care; C++/Java do.

Each step halves the candidate range, giving \`O(log n)\`.`,
      timeComplexity: 'O(log n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'Iterative binary search',
      time: 'O(log n)',
      space: 'O(1)',
      python: `lo, hi = 0, len(nums) - 1
while lo <= hi:
    mid = lo + (hi - lo) // 2
    if nums[mid] == target:
        return mid
    if nums[mid] < target:
        lo = mid + 1
    else:
        hi = mid - 1
return -1`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'climbing-stairs',
    title: 'Climbing Stairs',
    difficulty: 'EASY',
    topics: ['dynamic-programming', 'math', 'recursion'],
    companies: [{ slug: 'adobe', frequency: 14 }, { slug: 'amazon', frequency: 12 }],
    statement: `You are climbing a staircase with \`n\` steps. Each time you may climb either **1** or **2** steps.

In how many distinct ways can you reach the top?

### Input format
Line 1: the integer \`n\`.

### Output format
The number of distinct ways.`,
    statementDigest:
      'Count distinct ways to climb n stairs taking 1 or 2 steps at a time.',
    constraints: `- \`1 <= n <= 45\``,
    constraintsDigest: 'n <= 45, so the answer fits in a 32-bit signed integer.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'climbStairs', params: [{ name: 'n', type: 'int' }], returns: 'int' },
    examples: [
      { input: '2', output: '2', explanation: '1+1 or 2.' },
      { input: '3', output: '3', explanation: '1+1+1, 1+2, 2+1.' },
    ],
    sampleTests: [
      { input: '2', expectedOutput: '2' },
      { input: '3', expectedOutput: '3' },
    ],
    hiddenTests: [
      { input: '1', expectedOutput: '1' },
      { input: '5', expectedOutput: '8' },
      { input: '10', expectedOutput: '89' },
      { input: '45', expectedOutput: '1836311903' },
    ],
    hints: [
      'Think about the very last move you make. There are only two possibilities. What does each one leave behind?',
      'If your last step was a single step, you were previously at step n-1; if it was a double, you were at n-2. Those two situations are disjoint and cover everything.',
      'So `ways(n) = ways(n-1) + ways(n-2)` with `ways(1) = 1`, `ways(2) = 2` — the Fibonacci recurrence. Compute it bottom-up with two variables. Plain recursion without memoisation is O(2^n) and will time out.',
    ],
    editorial: {
      approachSummary: 'Fibonacci recurrence, computed bottom-up in O(1) space.',
      content: `Reason backwards from the final move. To arrive at step \`n\`, your last move was either a 1-step (from \`n-1\`) or a 2-step (from \`n-2\`). Those cases are mutually exclusive and exhaustive, so:

\`\`\`
ways(n) = ways(n-1) + ways(n-2),  ways(1) = 1, ways(2) = 2
\`\`\`

This is the Fibonacci sequence offset by one.

**Why naive recursion fails:** the recursion tree recomputes the same subproblems exponentially often — \`O(2^n)\`, which at \`n = 45\` is far beyond any time limit. Two fixes: memoise (top-down, \`O(n)\` time and space) or iterate bottom-up (\`O(n)\` time, \`O(1)\` space, no stack depth risk). Prefer the second.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'Bottom-up Fibonacci',
      time: 'O(n)',
      space: 'O(1)',
      python: `if n <= 2:
    return n
prev, cur = 1, 2
for _ in range(3, n + 1):
    prev, cur = cur, prev + cur
return cur`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'longest-substring-without-repeating-characters',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'MEDIUM',
    topics: ['string', 'hash-table', 'sliding-window', 'two-pointers'],
    companies: [
      { slug: 'amazon', frequency: 45 },
      { slug: 'google', frequency: 32 },
      { slug: 'uber', frequency: 18 },
    ],
    statement: `Given a string \`s\`, find the length of the **longest substring** without repeating characters.

A substring is a contiguous, non-empty sequence of characters.

### Input format
Line 1: the string \`s\`.

### Output format
The length of the longest substring with all-distinct characters.`,
    statementDigest:
      'Return the length of the longest contiguous substring of s with no repeated character.',
    constraints: `- \`1 <= s.length <= 5 * 10^4\`
- \`s\` consists of English letters, digits, symbols and spaces.`,
    constraintsDigest: 'len <= 5e4, arbitrary printable characters.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(k)',
    io: { fn: 'lengthOfLongestSubstring', params: [{ name: 's', type: 'str' }], returns: 'int' },
    examples: [
      { input: 'abcabcbb', output: '3', explanation: 'The answer is "abc".' },
      { input: 'pwwkew', output: '3', explanation: 'The answer is "wke". Note "pwke" is a subsequence, not a substring.' },
    ],
    sampleTests: [
      { input: 'abcabcbb', expectedOutput: '3' },
      { input: 'bbbbb', expectedOutput: '1' },
      { input: 'pwwkew', expectedOutput: '3' },
    ],
    hiddenTests: [
      { input: 'au', expectedOutput: '2' },
      { input: 'dvdf', expectedOutput: '3' },
      { input: 'abba', expectedOutput: '2' },
      { input: 'a', expectedOutput: '1' },
      { input: 'tmmzuxt', expectedOutput: '5' },
    ],
    hints: [
      'The answer is a *range*, not a set. If you are examining a range that is currently valid, what is the cheapest way to try to make it longer?',
      'Grow a window on the right. When the new character breaks the "all distinct" property, you must move the left edge — but how far? Moving it one step at a time is correct but wasteful.',
      'Keep a map from character to its last index. When you meet a repeat, jump the left edge to `lastIndex[c] + 1` — but only if that is further right than where it already is, otherwise stale entries will drag the window backwards.',
    ],
    editorial: {
      approachSummary: 'Sliding window with a character → last-index map, jumping the left edge.',
      content: `Brute force checks every substring for distinctness: \`O(n²)\` or worse.

The window insight: if \`s[l..r]\` has all distinct characters, then extending to \`r+1\` either keeps it valid or introduces exactly one duplicate — the new character. So the window only ever needs to shrink from the left, and only in response to the character just added.

Naive shrinking moves \`l\` one step at a time. Better: store each character's **last seen index**. When \`s[r]\` was seen at index \`j\`, every window starting at or before \`j\` is now invalid, so jump \`l\` to \`j + 1\` directly.

**The trap** — and the reason \`"abba"\` and \`"tmmzuxt"\` are in the test set — is that the map can hold a stale index from *before* the current window. Jumping blindly moves \`l\` backwards and inflates the answer. Guard it:

\`\`\`
l = max(l, last[c] + 1)
\`\`\`

Each index is visited by \`r\` once and \`l\` moves only forward, giving \`O(n)\`.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(min(n, alphabet))',
    },
    solution: {
      approachName: 'Sliding window with last-index map',
      time: 'O(n)',
      space: 'O(k)',
      python: `last = {}
best = 0
left = 0
for right, ch in enumerate(s):
    if ch in last and last[ch] >= left:
        left = last[ch] + 1
    last[ch] = right
    if right - left + 1 > best:
        best = right - left + 1
return best`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'product-of-array-except-self',
    title: 'Product of Array Except Self',
    difficulty: 'MEDIUM',
    topics: ['array', 'prefix-sum'],
    companies: [
      { slug: 'meta', frequency: 30 },
      { slug: 'amazon', frequency: 24 },
      { slug: 'apple', frequency: 15 },
    ],
    statement: `Given an integer array \`nums\`, return an array \`answer\` such that \`answer[i]\` is the product of **all elements of \`nums\` except \`nums[i]\`**.

You must write an algorithm that runs in \`O(n)\` time and **without using the division operation**.

### Input format
Line 1: the array \`nums\`, space-separated.

### Output format
The \`answer\` array, space-separated.`,
    statementDigest:
      'Return an array where answer[i] is the product of all elements except nums[i]. O(n) time, no division.',
    constraints: `- \`2 <= nums.length <= 10^5\`
- \`-30 <= nums[i] <= 30\`
- The product of any prefix or suffix fits in a 32-bit integer.`,
    constraintsDigest: 'n <= 1e5, no division allowed, products fit in int32.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'productExceptSelf', params: [{ name: 'nums', type: 'int[]' }], returns: 'int[]' },
    examples: [
      { input: '1 2 3 4', output: '24 12 8 6', explanation: '24 = 2*3*4, 12 = 1*3*4, and so on.' },
      { input: '-1 1 0 -3 3', output: '0 0 9 0 0', explanation: 'A single zero makes every other position zero.' },
    ],
    sampleTests: [
      { input: '1 2 3 4', expectedOutput: '24 12 8 6' },
      { input: '-1 1 0 -3 3', expectedOutput: '0 0 9 0 0' },
    ],
    hiddenTests: [
      { input: '2 3', expectedOutput: '3 2' },
      { input: '1 0', expectedOutput: '0 1' },
      { input: '0 0', expectedOutput: '0 0' },
      { input: '5 2 1 4', expectedOutput: '8 20 40 10' },
      { input: '-1 -1 -1 -1', expectedOutput: '-1 -1 -1 -1' },
    ],
    hints: [
      'Everything except position i splits cleanly into two independent pieces. What are they?',
      'The answer at i is (product of everything to the left) × (product of everything to the right). Both of those can be built incrementally in a single sweep each.',
      'First pass left to right: fill `answer[i]` with the running product of everything before i. Second pass right to left: multiply each `answer[i]` by a running product of everything after i. The output array does not count as extra space.',
    ],
    editorial: {
      approachSummary: 'Prefix products left-to-right, then suffix products right-to-left in place.',
      content: `The division trick — compute the total product and divide by \`nums[i]\` — is explicitly banned, and for good reason: it breaks on zeros and requires special-casing one zero versus two.

Decompose instead:

\`\`\`
answer[i] = (nums[0] * … * nums[i-1]) * (nums[i+1] * … * nums[n-1])
          = prefix[i] * suffix[i]
\`\`\`

Both factors are running products, so each needs one sweep.

To hit \`O(1)\` extra space, do it in two passes over the output array itself:
1. Left to right, write the prefix product into \`answer[i]\` while accumulating.
2. Right to left, multiply \`answer[i]\` by the accumulated suffix product.

The output array is not counted as auxiliary space by convention, so this is \`O(1)\` extra.

Zeros need no special handling at all — a zero simply propagates through the prefix or suffix product naturally.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1) extra',
    },
    solution: {
      approachName: 'Prefix and suffix products',
      time: 'O(n)',
      space: 'O(1) extra',
      python: `n = len(nums)
answer = [1] * n
running = 1
for i in range(n):
    answer[i] = running
    running *= nums[i]
running = 1
for i in range(n - 1, -1, -1):
    answer[i] *= running
    running *= nums[i]
return answer`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'coin-change',
    title: 'Coin Change',
    difficulty: 'MEDIUM',
    topics: ['array', 'dynamic-programming', 'bfs'],
    companies: [
      { slug: 'amazon', frequency: 28 },
      { slug: 'google', frequency: 22 },
      { slug: 'uber', frequency: 12 },
    ],
    statement: `You are given an array \`coins\` of distinct coin denominations and an integer \`amount\`.

Return the **fewest number of coins** needed to make up \`amount\`. If it cannot be made from any combination, return \`-1\`. You have an unlimited supply of each coin.

### Input format
Line 1: the array \`coins\`, space-separated.
Line 2: the integer \`amount\`.

### Output format
The minimum number of coins, or \`-1\`.`,
    statementDigest:
      'Unbounded coin denominations; return the fewest coins summing to amount, or -1 if impossible.',
    constraints: `- \`1 <= coins.length <= 12\`
- \`1 <= coins[i] <= 2^31 - 1\`
- \`0 <= amount <= 10^4\``,
    constraintsDigest: 'up to 12 denominations, amount <= 1e4, unlimited supply.',
    expectedTime: 'O(amount * coins)',
    expectedSpace: 'O(amount)',
    io: { fn: 'coinChange', params: [{ name: 'coins', type: 'int[]' }, { name: 'amount', type: 'int' }], returns: 'int' },
    examples: [
      { input: '1 2 5\n11', output: '3', explanation: '11 = 5 + 5 + 1.' },
      { input: '2\n3', output: '-1', explanation: '3 cannot be formed from 2s.' },
    ],
    sampleTests: [
      { input: '1 2 5\n11', expectedOutput: '3' },
      { input: '2\n3', expectedOutput: '-1' },
      { input: '1\n0', expectedOutput: '0' },
    ],
    hiddenTests: [
      { input: '1 2 5\n100', expectedOutput: '20' },
      { input: '186 419 83 408\n6249', expectedOutput: '20' },
      { input: '2 5 10 1\n27', expectedOutput: '4' },
      { input: '1 3 4\n6', expectedOutput: '2' },
      { input: '5\n5', expectedOutput: '1' },
    ],
    hints: [
      'Greedy — always take the largest coin that fits — is wrong here. Find a small input where it fails; that failure tells you what the algorithm must actually explore.',
      'If you knew the answer for every amount smaller than the target, could you compute the answer for the target itself in one step?',
      'Let `dp[a]` be the fewest coins making amount `a`, with `dp[0] = 0` and everything else initialised to infinity. Then `dp[a] = 1 + min(dp[a - c])` over all coins `c <= a`. Build it upward and return `dp[amount]`, or -1 if it is still infinity.',
    ],
    editorial: {
      approachSummary: 'Bottom-up DP over amounts.',
      content: `**Why greedy fails.** With \`coins = [1, 3, 4]\` and \`amount = 6\`, greedy takes 4, then 1, then 1 — three coins. The optimum is \`3 + 3\` — two coins. Taking the largest coin is not safe because it can strand you in a worse residual amount. This is exactly the difference between this problem and making change with real-world currency systems, which happen to be greedy-safe.

**The DP.** Define \`dp[a]\` = fewest coins summing to exactly \`a\`.

\`\`\`
dp[0] = 0
dp[a] = 1 + min(dp[a - c])  for every coin c <= a
\`\`\`

Compute \`a\` from \`1\` upward so every \`dp[a - c]\` is already final. Unreachable amounts stay at infinity; if \`dp[amount]\` is still infinity at the end, return \`-1\`.

Time is \`O(amount × |coins|)\` — at most \`10^4 × 12 = 1.2 × 10^5\` operations. Space is \`O(amount)\`.

An equivalent framing is BFS over amounts, where each coin is an edge — the answer is then the shortest path from 0 to \`amount\`. Same complexity, and worth recognising because it generalises to problems where the DP order is not obvious.`,
      timeComplexity: 'O(amount * coins)',
      spaceComplexity: 'O(amount)',
    },
    solution: {
      approachName: 'Bottom-up DP',
      time: 'O(amount * coins)',
      space: 'O(amount)',
      python: `INF = amount + 1
dp = [0] + [INF] * amount
for a in range(1, amount + 1):
    for coin in coins:
        if coin <= a and dp[a - coin] + 1 < dp[a]:
            dp[a] = dp[a - coin] + 1
return -1 if dp[amount] >= INF else dp[amount]`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'number-of-islands',
    title: 'Number of Islands',
    difficulty: 'MEDIUM',
    topics: ['graph', 'dfs', 'bfs', 'matrix', 'union-find'],
    companies: [
      { slug: 'amazon', frequency: 44 },
      { slug: 'google', frequency: 30 },
      { slug: 'meta', frequency: 26 },
    ],
    statement: `Given an \`m x n\` binary grid where \`'1'\` is land and \`'0'\` is water, return the number of **islands**.

An island is a maximal group of \`'1'\`s connected **horizontally or vertically**. Assume all four edges of the grid are surrounded by water.

### Input format
Line 1: two integers \`m\` and \`n\`, space-separated.
Next \`m\` lines: each a string of \`n\` characters, either \`0\` or \`1\`.

### Output format
The number of islands.`,
    statementDigest:
      'Count connected components of 1s (4-directionally) in a binary character grid.',
    constraints: `- \`1 <= m, n <= 300\`
- \`grid[i][j]\` is \`'0'\` or \`'1'\``,
    constraintsDigest: 'grid up to 300x300, 4-directional connectivity.',
    expectedTime: 'O(m * n)',
    expectedSpace: 'O(m * n)',
    io: { fn: 'numIslands', params: [{ name: 'grid', type: 'grid' }], returns: 'int' },
    examples: [
      {
        input: '4 5\n11110\n11010\n11000\n00000',
        output: '1',
        explanation: 'All the land cells are connected into a single island.',
      },
      {
        input: '4 5\n11000\n11000\n00100\n00011',
        output: '3',
        explanation: 'Three separate groups of land.',
      },
    ],
    sampleTests: [
      { input: '4 5\n11110\n11010\n11000\n00000', expectedOutput: '1' },
      { input: '4 5\n11000\n11000\n00100\n00011', expectedOutput: '3' },
    ],
    hiddenTests: [
      { input: '1 1\n0', expectedOutput: '0' },
      { input: '1 1\n1', expectedOutput: '1' },
      { input: '3 3\n101\n010\n101', expectedOutput: '5' },
      { input: '3 4\n1011\n0100\n1101', expectedOutput: '4' },
      { input: '2 2\n11\n11', expectedOutput: '1' },
    ],
    hints: [
      'You are not really counting land cells — you are counting *groups*. What single operation, applied once per group, would let a simple counter work?',
      'Scan every cell. When you find land that you have not accounted for yet, that is a brand-new island. Now you need to consume the whole island so you never count it again.',
      'On finding an unvisited `1`, increment the counter and run a flood fill (DFS or BFS) that marks every reachable land cell as visited. Marking in place by overwriting with `0` avoids a separate visited array. Prefer BFS or an explicit stack — a recursive DFS on a 300×300 all-land grid can blow the call stack.',
    ],
    editorial: {
      approachSummary: 'Flood fill each unvisited land cell; each fill is exactly one island.',
      content: `This is connected-components counting on an implicit graph: cells are nodes, and 4-directional adjacency between land cells provides the edges.

The algorithm:
1. Scan every cell in the grid.
2. On an unvisited \`'1'\`, increment the island counter and flood fill from it, marking every reachable land cell visited.
3. The counter is the answer.

Correctness follows from the flood fill being **maximal** — it consumes the entire component, so no component is ever counted twice, and every land cell is reached from exactly one starting cell.

Each cell is enqueued at most once, so the total work is \`O(m × n)\`.

**Implementation notes that matter in practice:**
- Overwriting visited land with \`'0'\` avoids a separate visited matrix. It mutates the input, which is worth mentioning in an interview.
- Mark cells as visited **when you enqueue them**, not when you dequeue. Marking on dequeue lets the same cell be enqueued many times, and the queue can blow up.
- Recursive DFS is elegant but risks stack overflow at \`300 × 300 = 90{,}000\` depth in the worst case. BFS with an explicit queue is the safer default.`,
      timeComplexity: 'O(m * n)',
      spaceComplexity: 'O(min(m, n)) for BFS',
    },
    solution: {
      approachName: 'BFS flood fill',
      time: 'O(m * n)',
      space: 'O(min(m, n))',
      python: `from collections import deque

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
return count`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'valid-anagram',
    title: 'Valid Anagram',
    difficulty: 'EASY',
    topics: ['string', 'hash-table', 'sorting'],
    companies: [{ slug: 'meta', frequency: 16 }, { slug: 'bloomberg', frequency: 10 }],
    statement: `Given two strings \`s\` and \`t\`, return \`true\` if \`t\` is an anagram of \`s\`, and \`false\` otherwise.

An anagram uses exactly the same characters with exactly the same multiplicities, in any order.

### Input format
Line 1: the string \`s\`.
Line 2: the string \`t\`.

### Output format
\`true\` or \`false\`.`,
    statementDigest: 'Return true if t is a permutation of s (same characters with same counts).',
    constraints: `- \`1 <= s.length, t.length <= 5 * 10^4\`
- \`s\` and \`t\` consist of lowercase English letters.`,
    constraintsDigest: 'len <= 5e4, lowercase letters only.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'isAnagram', params: [{ name: 's', type: 'str' }, { name: 't', type: 'str' }], returns: 'bool' },
    examples: [
      { input: 'anagram\nnagaram', output: 'true', explanation: 'Same letters, same counts.' },
      { input: 'rat\ncar', output: 'false', explanation: 'Different letters.' },
    ],
    sampleTests: [
      { input: 'anagram\nnagaram', expectedOutput: 'true' },
      { input: 'rat\ncar', expectedOutput: 'false' },
    ],
    hiddenTests: [
      { input: 'a\na', expectedOutput: 'true' },
      { input: 'ab\na', expectedOutput: 'false' },
      { input: 'listen\nsilent', expectedOutput: 'true' },
      { input: 'aacc\nccac', expectedOutput: 'false' },
    ],
    hints: [
      'Order does not matter, only *how many of each*. What is the smallest amount of information about a string that determines whether two strings are anagrams?',
      'Two options: destroy the ordering in both strings so they become directly comparable, or count characters. One is O(n log n), the other O(n).',
      'Count characters of `s`, then decrement while scanning `t`, returning false the moment a count goes negative. Check the lengths first — it is an O(1) rejection that also guarantees a zero final tally means equality.',
    ],
    editorial: {
      approachSummary: 'Character frequency counting with an early length check.',
      content: `Two standard approaches:

**Sort both strings** and compare: \`O(n log n)\` time, and \`O(n)\` or \`O(1)\` space depending on the language's sort. Short to write, and fine when \`n\` is small.

**Count frequencies**: \`O(n)\` time. Build a count of \`s\`, then walk \`t\` decrementing. If any count goes negative, \`t\` has a character \`s\` doesn't have enough of. With a lowercase-only alphabet the counter is a fixed 26-slot array, so space is \`O(1)\`.

Compare lengths first. It's an \`O(1)\` rejection, and it also makes the counting argument airtight: with equal lengths, "no count went negative" implies "all counts are exactly zero", so you don't need a second pass to verify.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'Frequency counting',
      time: 'O(n)',
      space: 'O(1)',
      python: `if len(s) != len(t):
    return False
counts = {}
for ch in s:
    counts[ch] = counts.get(ch, 0) + 1
for ch in t:
    if counts.get(ch, 0) == 0:
        return False
    counts[ch] -= 1
return True`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'search-in-rotated-sorted-array',
    title: 'Search in Rotated Sorted Array',
    difficulty: 'MEDIUM',
    topics: ['array', 'binary-search'],
    companies: [
      { slug: 'meta', frequency: 34 },
      { slug: 'amazon', frequency: 26 },
      { slug: 'microsoft', frequency: 20 },
    ],
    statement: `An ascending array of **distinct** integers has been rotated at some unknown pivot. For example \`[0,1,2,4,5,6,7]\` might become \`[4,5,6,7,0,1,2]\`.

Given the rotated array \`nums\` and an integer \`target\`, return the index of \`target\`, or \`-1\` if it is absent.

You must write an algorithm with \`O(log n)\` runtime complexity.

### Input format
Line 1: the array \`nums\`, space-separated.
Line 2: the integer \`target\`.

### Output format
The index, or \`-1\`.`,
    statementDigest:
      'Rotated sorted array of distinct ints; find index of target in O(log n) or return -1.',
    constraints: `- \`1 <= nums.length <= 5000\`
- \`-10^4 <= nums[i], target <= 10^4\`
- All values in \`nums\` are distinct.
- \`nums\` is an ascending array rotated at some pivot.`,
    constraintsDigest: 'n <= 5000, distinct, rotated ascending, O(log n) required.',
    expectedTime: 'O(log n)',
    expectedSpace: 'O(1)',
    io: { fn: 'search', params: [{ name: 'nums', type: 'int[]' }, { name: 'target', type: 'int' }], returns: 'int' },
    examples: [
      { input: '4 5 6 7 0 1 2\n0', output: '4', explanation: '0 sits at index 4.' },
      { input: '4 5 6 7 0 1 2\n3', output: '-1', explanation: '3 is not in the array.' },
    ],
    sampleTests: [
      { input: '4 5 6 7 0 1 2\n0', expectedOutput: '4' },
      { input: '4 5 6 7 0 1 2\n3', expectedOutput: '-1' },
      { input: '1\n0', expectedOutput: '-1' },
    ],
    hiddenTests: [
      { input: '1 3\n3', expectedOutput: '1' },
      { input: '5 1 3\n3', expectedOutput: '2' },
      { input: '3 1\n1', expectedOutput: '1' },
      { input: '4 5 6 7 8 1 2 3\n8', expectedOutput: '4' },
      { input: '1 2 3 4 5\n4', expectedOutput: '3' },
    ],
    hints: [
      'The array is not sorted, but it is not arbitrary either. If you split it at any midpoint, what can you say about the two halves?',
      'At least one of the two halves is always fully sorted — and you can tell which by a single comparison against the endpoint. In a sorted half you can decide membership immediately.',
      'Compare `nums[lo]` with `nums[mid]`. If `nums[lo] <= nums[mid]` the left half is sorted, so check whether `target` lies within `[nums[lo], nums[mid])` — if yes go left, else go right. Otherwise the right half is sorted; apply the mirror-image test.',
    ],
    editorial: {
      approachSummary: 'Binary search, identifying the sorted half at each step.',
      content: `Rotation destroys global order but preserves a strong local property: **when you split a rotated sorted array at any midpoint, at least one half is fully sorted**. The pivot can only live in one of them.

At each step:
1. Compute \`mid\`. If \`nums[mid] == target\`, done.
2. If \`nums[lo] <= nums[mid]\`, the **left** half is sorted. Then \`target\` is in it if and only if \`nums[lo] <= target < nums[mid]\`. Recurse there, otherwise the right half.
3. Otherwise the **right** half is sorted, and \`target\` is in it if and only if \`nums[mid] < target <= nums[hi]\`.

The half you discard is guaranteed not to contain the target, so each step still halves the search space: \`O(log n)\`.

**Boundary care.** The comparisons must be inclusive on the correct sides — \`nums[lo] <= target < nums[mid]\` and \`nums[mid] < target <= nums[hi]\`. Getting an endpoint wrong produces a solution that passes the obvious tests and fails on two-element arrays like \`[3,1]\`, which is why they're in the test set.

Distinctness matters: with duplicates, \`nums[lo] == nums[mid]\` no longer identifies a sorted half, and the worst case degrades to \`O(n)\`.`,
      timeComplexity: 'O(log n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'Modified binary search',
      time: 'O(log n)',
      space: 'O(1)',
      python: `lo, hi = 0, len(nums) - 1
while lo <= hi:
    mid = lo + (hi - lo) // 2
    if nums[mid] == target:
        return mid
    if nums[lo] <= nums[mid]:
        if nums[lo] <= target < nums[mid]:
            hi = mid - 1
        else:
            lo = mid + 1
    else:
        if nums[mid] < target <= nums[hi]:
            lo = mid + 1
        else:
            hi = mid - 1
return -1`,
    },
  },
];
