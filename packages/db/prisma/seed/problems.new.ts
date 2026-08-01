import type { SeedProblem } from './problems.js';

/**
 * Fourth tranche — 34 new problems: two new FOUNDATIONS sections
 * (dsa-basics-and-complexity, recursion-patterns) plus top-ups to the
 * thinnest existing sections across both tracks. Same scope rules as
 * problems.advanced.ts: every problem fits the harness's int/int[]/str/str[]/grid
 * param types and int/bool/int[]/str return type (no nested-array returns,
 * so "generate all X" ideas are reformulated as count/decide/select-one).
 * Test cases declare INPUTS ONLY — outputs are derived by executing the
 * reference solution (see verify.ts), same as every other problem file.
 */
export const NEW_PROBLEMS: SeedProblem[] = [
  {
    slug: "array-sum-and-average",
    title: "Array Sum and Floor Average",
    difficulty: "EASY",
    topics: [
      "arrays",
      "math",
    ],
    companies: [],
    statement: "Given an array of integers `nums`, compute the sum of all elements and return the floor of their average (i.e., the average rounded down toward negative infinity).\n\n### Input format\n- Line 1: the array `nums` as space-separated integers.\n\n### Output format\n- A single integer: the floor of the average of `nums`.",
    statementDigest: "Return the floor of the average of an array of integers.",
    constraints: "- `1 <= nums.length <= 1000`\n- `-10^6 <= nums[i] <= 10^6`",
    constraintsDigest: "The array has between 1 and 1000 integers, each within plus or minus one million.",
    expectedTime: "O(n)",
    expectedSpace: "O(1)",
    io: {
      fn: "sumAndFloorAverage",
      params: [
        {
          name: "nums",
          type: "int[]",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "1 2 3 4",
        output: "2",
        explanation: "Sum is 10, length is 4, average is 2.5, and the floor of 2.5 is 2.",
      },
      {
        input: "5",
        output: "5",
        explanation: "A single-element array's average equals that element.",
      },
    ],
    sampleTests: [
      {
        input: "1 2 3 4",
      },
      {
        input: "5",
      },
      {
        input: "-1 -2 -3",
      },
    ],
    hiddenTests: [
      {
        input: "1000",
      },
      {
        input: "-7 0",
      },
      {
        input: "5 5 5 5",
      },
      {
        input: "3 -5 12 7 0 -2 8 15 -10 4 6 -1 9 2 -3 11 5 -6 13 1",
      },
    ],
    hints: [
      "Think about what information you actually need from the array before you can answer the question — do you need every value, or just a couple of summary numbers?",
      "This only needs a single pass to accumulate a running total, followed by one arithmetic step.",
      "Sum every element in one loop, then use integer floor division (not regular division followed by rounding) to get the floor of the average, since floor division handles negative sums correctly.",
    ],
    editorial: {
      approachSummary: "Single pass to sum, then integer floor division.",
      content: "The task boils down to two simple steps: add up every element of the array, then divide that sum by the number of elements and take the floor.\n\nThe key subtlety is handling the floor correctly, especially when the sum is negative. A naive approach might compute the average as a floating point number and then round down, but floating point rounding can introduce precision errors on large sums. Instead, use integer floor division directly on the sum and count: in Python, the `//` operator already performs floor division, correctly rounding toward negative infinity for negative results (for example, `-7 // 2` gives `-4`, not `-3`).\n\nThe algorithm itself is a straightforward linear scan: initialize a running total to zero, add each element to it, and once the loop finishes, divide the total by the array length using floor division. There's no need for sorting, extra data structures, or multiple passes — one pass to sum is all that's required.\n\nThis problem is meant to build the habit of translating a word problem directly into a loop and a small amount of arithmetic, and to highlight that 'floor of the average' is not the same as 'round the average', particularly once negative numbers are involved.",
      timeComplexity: "O(n)",
      spaceComplexity: "O(1)",
    },
    solution: {
      approachName: "Single-pass sum with floor division",
      time: "O(n)",
      space: "O(1)",
      python: "total = sum(nums)\nreturn total // len(nums)",
    },
  },
  {
    slug: "find-second-largest",
    title: "Find the Second Largest Element",
    difficulty: "EASY",
    topics: [
      "arrays",
    ],
    companies: [
      {
        slug: "amazon",
        frequency: 12,
      },
    ],
    statement: "Given an array of integers `nums` that contains at least two distinct values, return the second-largest distinct value — that is, the largest value that is strictly less than the maximum value in the array. Note that the maximum value may appear more than once; duplicates of the maximum do not count as the second largest.\n\n### Input format\n- Line 1: the array `nums` as space-separated integers.\n\n### Output format\n- A single integer: the second-largest distinct value in `nums`.",
    statementDigest: "Return the largest value strictly less than the maximum value of an array.",
    constraints: "- `2 <= nums.length <= 1000`\n- `-10^6 <= nums[i] <= 10^6`\n- `nums` contains at least 2 distinct values",
    constraintsDigest: "The array has 2 to 1000 integers with at least two distinct values.",
    expectedTime: "O(n)",
    expectedSpace: "O(1)",
    io: {
      fn: "secondLargest",
      params: [
        {
          name: "nums",
          type: "int[]",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "3 1 4 1 5 9 2 6",
        output: "6",
        explanation: "The maximum is 9; the largest value less than 9 is 6.",
      },
      {
        input: "5 5 5 3",
        output: "3",
        explanation: "The maximum 5 appears three times, so it's skipped; the next largest distinct value is 3.",
      },
    ],
    sampleTests: [
      {
        input: "3 1 4 1 5 9 2 6",
      },
      {
        input: "5 5 5 3",
      },
      {
        input: "2 2 3 3",
      },
    ],
    hiddenTests: [
      {
        input: "1 2",
      },
      {
        input: "-1 -2 -3 -1",
      },
      {
        input: "7 7 7 7 6",
      },
      {
        input: "10 20 20 5 15 20 3 15 8 1",
      },
    ],
    hints: [
      "The largest value doesn't tell you the whole story here — what happens if it shows up more than once?",
      "Think in two stages: first isolate the maximum, then search again while ignoring anything equal to it.",
      "Find the maximum of the array first, then find the maximum among only the elements that are strictly less than that maximum.",
    ],
    editorial: {
      approachSummary: "Find the max, then find the max of everything smaller than it.",
      content: "A common mistake is to sort the array and take the second element from the end, which breaks when the maximum value is duplicated (you'd get another copy of the maximum instead of a genuinely smaller value). The fix is to be explicit about what 'second largest' means: it's the largest value that is strictly less than the true maximum.\n\nThe clean way to compute this in one conceptual pass is to first find the maximum of the whole array, and then find the maximum among only those elements that are strictly less than that maximum. Because the problem guarantees at least two distinct values, this second maximum is always well-defined.\n\nThis can be done in a single loop by tracking two running values, `first` and `second`: whenever a new element beats `first`, the old `first` becomes a candidate for `second` — but only if it's actually different from the new maximum being tracked, so equal duplicates of the current maximum never get promoted into `second`. An equivalent and simpler-to-reason-about approach, since the array is small, is exactly two linear scans: one to find the max, one to find the max of the filtered remainder.\n\nEither way, the point of this exercise is to notice that 'second' in a list with duplicates usually means 'second distinct value', not 'element at index n-2 after sorting' — a distinction that trips up a lot of naive solutions.",
      timeComplexity: "O(n)",
      spaceComplexity: "O(1)",
    },
    solution: {
      approachName: "Two-pass maximum filtering",
      time: "O(n)",
      space: "O(1)",
      python: "first = max(nums)\nsecond = max(x for x in nums if x < first)\nreturn second",
    },
  },
  {
    slug: "is-power-of-two-basic",
    title: "Is Power of Two",
    difficulty: "EASY",
    topics: [
      "math",
      "bit-manipulation",
    ],
    companies: [
      {
        slug: "microsoft",
        frequency: 8,
      },
    ],
    statement: "Given a positive integer `n`, determine whether it is a power of two (that is, whether `n` equals `2^k` for some non-negative integer `k`).\n\n### Input format\n- Line 1: the integer `n`.\n\n### Output format\n- `true` if `n` is a power of two, `false` otherwise.",
    statementDigest: "Decide whether a positive integer is a power of two.",
    constraints: "- `1 <= n <= 10^9`",
    constraintsDigest: "n is a positive integer up to one billion.",
    expectedTime: "O(log n)",
    expectedSpace: "O(1)",
    io: {
      fn: "isPowerOfTwo",
      params: [
        {
          name: "n",
          type: "int",
        },
      ],
      returns: "bool",
    },
    examples: [
      {
        input: "16",
        output: "true",
        explanation: "16 = 2^4.",
      },
      {
        input: "18",
        output: "false",
        explanation: "18 is not a power of two; dividing repeatedly by two leaves a remainder of 9 which is odd and not 1.",
      },
    ],
    sampleTests: [
      {
        input: "16",
      },
      {
        input: "18",
      },
      {
        input: "1",
      },
    ],
    hiddenTests: [
      {
        input: "1",
      },
      {
        input: "2",
      },
      {
        input: "3",
      },
      {
        input: "1073741824",
      },
      {
        input: "999999999",
      },
    ],
    hints: [
      "A power of two has a very distinctive pattern when you keep dividing it in half.",
      "Repeatedly halving a power of two never leaves a remainder until you reach 1.",
      "While the number is even, divide it by two; if you ever land on an odd number greater than 1, it isn't a power of two — otherwise it is.",
    ],
    editorial: {
      approachSummary: "Repeatedly divide by two and check you land exactly on 1.",
      content: "A positive integer is a power of two exactly when its binary representation has a single set bit. Without relying on bitwise tricks, you can verify this with plain division: repeatedly divide `n` by two as long as it's even. If `n` is genuinely a power of two, this process will always land exactly on 1 with no remainder at any step. If at any point the number becomes odd while still being greater than 1, it can't be a power of two, and the loop naturally stops with a value other than 1.\n\nConcretely: while `n` is even, replace it with `n // 2`; once the loop ends (because `n` is now odd), check whether `n` equals 1. For example, 16 becomes 8, 4, 2, 1 — ends at 1, so it's a power of two. But 18 becomes 9, which is odd and not 1, so it's not a power of two.\n\nThis loop runs at most `log2(n)` times, since each iteration halves the value, giving an efficient O(log n) solution. It's also a nice bridge toward the bitwise identity `n & (n - 1) == 0`, which does the same check in O(1), but reasoning about it through repeated halving first builds the right intuition before jumping to bit tricks.",
      timeComplexity: "O(log n)",
      spaceComplexity: "O(1)",
    },
    solution: {
      approachName: "Repeated halving",
      time: "O(log n)",
      space: "O(1)",
      python: "if n <= 0:\n    return False\nwhile n % 2 == 0:\n    n //= 2\nreturn n == 1",
    },
  },
  {
    slug: "count-operations-linear-scan",
    title: "Count Linear Search Comparisons",
    difficulty: "EASY",
    topics: [
      "arrays",
      "complexity-analysis",
    ],
    companies: [],
    statement: "Given an array of integers `nums` and an integer `target`, simulate a linear search for `target` from left to right. Return the number of comparisons made against elements of `nums` before the search stops — that is, the 1-indexed position of the first occurrence of `target` if it is found, or the full length of `nums` if `target` never appears.\n\nThis problem is meant to make the idea of 'counting operations' concrete: it's exactly the kind of counting that explains why linear search is described as an O(n) algorithm.\n\n### Input format\n- Line 1: the array `nums` as space-separated integers.\n- Line 2: the integer `target`.\n\n### Output format\n- A single integer: the number of comparisons performed.",
    statementDigest: "Count how many comparisons a left-to-right linear search makes to find a target, or the array length if it's absent.",
    constraints: "- `1 <= nums.length <= 10^5`\n- `-10^9 <= nums[i], target <= 10^9`",
    constraintsDigest: "The array has up to 100000 integers and the target and values can be any 32-bit-range integer.",
    expectedTime: "O(n)",
    expectedSpace: "O(1)",
    io: {
      fn: "countComparisons",
      params: [
        {
          name: "nums",
          type: "int[]",
        },
        {
          name: "target",
          type: "int",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "4 2 7 1 9\n7",
        output: "3",
        explanation: "The search compares 4, then 2, then 7 — a match is found on the 3rd comparison.",
      },
      {
        input: "1 2 3\n5",
        output: "3",
        explanation: "5 never appears, so all 3 elements are compared before giving up.",
      },
    ],
    sampleTests: [
      {
        input: "4 2 7 1 9\n7",
      },
      {
        input: "1 2 3\n5",
      },
      {
        input: "5 1 2\n5",
      },
    ],
    hiddenTests: [
      {
        input: "1\n1",
      },
      {
        input: "1\n2",
      },
      {
        input: "3 3 3\n3",
      },
      {
        input: "1 2 3 4\n4",
      },
      {
        input: "1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20\n100",
      },
    ],
    hints: [
      "Imagine physically scanning the list left to right, keeping a tally mark for every element you look at.",
      "The count you're building up is just the position where the search stops, whether that's a match or the end of the array.",
      "Loop through the array with an index; the moment you find target, the number of comparisons is that index plus one (since indices start at 0); if the loop finishes without a match, the answer is the array's length.",
    ],
    editorial: {
      approachSummary: "Walk the array left to right and count steps until a match or the end.",
      content: "This problem is a direct simulation of linear search, but instead of returning whether the target was found, it asks you to report how much work was done to find out — which is exactly the quantity Big-O notation is trying to summarize.\n\nThe implementation is a single loop: walk through `nums` from the beginning, and for each element compare it to `target`. The moment a match is found, the number of comparisons made so far (counting the current one) is the answer. If the loop finishes without ever matching, every element was compared exactly once, so the answer is simply the length of the array.\n\nA clean way to implement this is to iterate with an index `i` from 0 upward; as soon as `nums[i] == target`, return `i + 1` (since comparisons are 1-indexed — the first element checked counts as comparison number 1, not 0). If the loop never returns, fall through to returning `len(nums)`.\n\nThe value of this exercise isn't the algorithm itself, which is trivial, but the habit of translating 'how many steps does this take' into actual code that counts those steps — the same instinct used later to reason about why an algorithm is O(n), O(n^2), or O(log n) without needing a formal proof each time.",
      timeComplexity: "O(n)",
      spaceComplexity: "O(1)",
    },
    solution: {
      approachName: "Indexed linear scan with early return",
      time: "O(n)",
      space: "O(1)",
      python: "for i in range(len(nums)):\n    if nums[i] == target:\n        return i + 1\nreturn len(nums)",
    },
  },
  {
    slug: "reverse-array-in-place",
    title: "Reverse an Array",
    difficulty: "EASY",
    topics: [
      "arrays",
    ],
    companies: [],
    statement: "Given an array of integers `nums`, return a new array containing the same elements in reverse order.\n\n### Input format\n- Line 1: the array `nums` as space-separated integers.\n\n### Output format\n- The reversed array as space-separated integers on one line.",
    statementDigest: "Return the array with its elements in reverse order.",
    constraints: "- `1 <= nums.length <= 1000`\n- `-10^6 <= nums[i] <= 10^6`",
    constraintsDigest: "The array has between 1 and 1000 integers.",
    expectedTime: "O(n)",
    expectedSpace: "O(n)",
    io: {
      fn: "reverseArray",
      params: [
        {
          name: "nums",
          type: "int[]",
        },
      ],
      returns: "int[]",
    },
    examples: [
      {
        input: "1 2 3 4 5",
        output: "5 4 3 2 1",
        explanation: "Elements are emitted from last to first.",
      },
      {
        input: "1",
        output: "1",
        explanation: "A single-element array reversed is itself.",
      },
    ],
    sampleTests: [
      {
        input: "1 2 3 4 5",
      },
      {
        input: "1",
      },
      {
        input: "1 2 3 4",
      },
    ],
    hiddenTests: [
      {
        input: "42",
      },
      {
        input: "1 2 3 4",
      },
      {
        input: "-5 -10 3 0 7",
      },
      {
        input: "9 8 7 6 5 4 3 2 1 0 -1 -2 -3 -4 -5",
      },
    ],
    hints: [
      "You want the last thing to come first and the first thing to come last — what's the simplest way to flip an order?",
      "Two pointers moving toward each other from opposite ends can swap their way to a reversed sequence, or you can just build a new list back-to-front.",
      "Iterate through `nums` from the last index down to the first, appending each visited value to a result list (or use slicing to reverse in one step).",
    ],
    editorial: {
      approachSummary: "Traverse from the end and build the reversed list (or use slicing).",
      content: "Reversing an array is one of the most fundamental array manipulations and a good first exercise in thinking about traversal direction. There are two natural approaches.\n\nThe first is a two-pointer swap: keep a pointer at the start and one at the end, swap the values they point to, then move the pointers toward each other until they meet or cross. This does the reversal using only O(1) extra space beyond the array itself, which matters when the array must be reversed truly in place.\n\nThe second, simpler approach when you just need to produce a reversed result, is to build a brand-new list by walking the original array from the last index to the first and appending each value, or equivalently using a language feature like Python's slice `nums[::-1]`, which constructs the reversed array directly.\n\nBoth approaches are O(n) time, since every element must be visited once. The two-pointer swap is O(1) extra space (ignoring the output), while building a new list is O(n) extra space. For this problem, either is acceptable since the function is expected to return a new array.\n\nThe broader lesson is recognizing that 'reverse' is really just 'read backward', and that many array problems reduce to picking the right traversal direction and either mutating in place or constructing a new result.",
      timeComplexity: "O(n)",
      spaceComplexity: "O(n)",
    },
    solution: {
      approachName: "Slice reversal",
      time: "O(n)",
      space: "O(n)",
      python: "return nums[::-1]",
    },
  },
  {
    slug: "rotate-array-by-k-brute",
    title: "Rotate Array by K Positions",
    difficulty: "EASY",
    topics: [
      "arrays",
    ],
    companies: [
      {
        slug: "adobe",
        frequency: 9,
      },
    ],
    statement: "Given an array of integers `nums` and a non-negative integer `k`, rotate the array to the right by `k` positions and return the result. Since `k` may be larger than the length of the array, only `k` modulo the array length actually matters.\n\n### Input format\n- Line 1: the array `nums` as space-separated integers.\n- Line 2: the integer `k`.\n\n### Output format\n- The rotated array as space-separated integers on one line.",
    statementDigest: "Rotate an array right by k positions, wrapping k using the array length.",
    constraints: "- `1 <= nums.length <= 1000`\n- `0 <= k <= 10^9`\n- `-10^6 <= nums[i] <= 10^6`",
    constraintsDigest: "The array has up to 1000 integers and k can be arbitrarily large, requiring a modulo wrap.",
    expectedTime: "O(n)",
    expectedSpace: "O(n)",
    io: {
      fn: "rotateByK",
      params: [
        {
          name: "nums",
          type: "int[]",
        },
        {
          name: "k",
          type: "int",
        },
      ],
      returns: "int[]",
    },
    examples: [
      {
        input: "1 2 3 4 5\n2",
        output: "4 5 1 2 3",
        explanation: "Rotating [1,2,3,4,5] right by 2 moves the last 2 elements (4, 5) to the front.",
      },
      {
        input: "1 2 3\n5",
        output: "2 3 1",
        explanation: "k=5 on a length-3 array is equivalent to rotating by 5 mod 3 = 2, which gives the same result as rotating by 2.",
      },
    ],
    sampleTests: [
      {
        input: "1 2 3 4 5\n2",
      },
      {
        input: "1 2 3\n5",
      },
      {
        input: "1 2 3 4\n0",
      },
    ],
    hiddenTests: [
      {
        input: "1 2 3\n0",
      },
      {
        input: "1 2 3 4\n4",
      },
      {
        input: "7\n100",
      },
      {
        input: "1 2 3 4 5 6 7 8 9 10\n13",
      },
    ],
    hints: [
      "Rotating by the array's own length gets you back to where you started — what does that tell you about very large values of k?",
      "Once k is reduced to something smaller than the array length, the rotated array splits neatly into two contiguous chunks that swap places.",
      "Compute `k mod n` first, then the answer is the last k elements followed by the first n-k elements.",
    ],
    editorial: {
      approachSummary: "Reduce k modulo the array length, then concatenate the last k elements with the rest.",
      content: "The key realization is that rotating an array of length `n` by exactly `n` positions returns it to its original order, so any rotation amount `k` behaves identically to `k mod n`. Reducing `k` this way first turns a potentially huge rotation count into a small, manageable one, and also handles the edge case where `k` is an exact multiple of `n` (which should leave the array unchanged).\n\nOnce `k` is reduced to the range `[0, n)`, rotating right by `k` positions is equivalent to taking the last `k` elements of the array and moving them to the front, followed by the remaining first `n - k` elements. For example, rotating `[1,2,3,4,5]` right by 2 takes the last two elements `[4,5]` and places them before the rest, `[1,2,3]`, giving `[4,5,1,2,3]`.\n\nA subtlety worth watching for is the case `k mod n == 0`: the array should be returned unchanged. This needs to be handled explicitly rather than relying on slicing like `nums[-0:]`, because in most languages a slice from index `-0` is the same as index `0`, which would (incorrectly) return the whole array as the 'moved' portion instead of an empty one.\n\nThis two-chunk swap runs in O(n) time and uses O(n) extra space for the result, and is a good stepping stone toward the harder in-place O(1)-extra-space rotation using the three-reversal trick.",
      timeComplexity: "O(n)",
      spaceComplexity: "O(n)",
    },
    solution: {
      approachName: "Modulo reduction plus two-chunk concatenation",
      time: "O(n)",
      space: "O(n)",
      python: "n = len(nums)\nk = k % n\nif k == 0:\n    return list(nums)\nreturn nums[-k:] + nums[:-k]",
    },
  },
  {
    slug: "factorial-and-power-recursive",
    title: "Recursive Power",
    difficulty: "EASY",
    topics: [
      "recursion",
      "math",
    ],
    companies: [
      {
        slug: "google",
        frequency: 10,
      },
    ],
    statement: "Given two integers `base` and a non-negative integer `exp`, compute `base` raised to the power `exp` using recursion.\n\n### Input format\n- Line 1: the integer `base`.\n- Line 2: the integer `exp`.\n\n### Output format\n- A single integer: `base^exp`.",
    statementDigest: "Recursively compute base raised to a non-negative integer exponent.",
    constraints: "- `-20 <= base <= 20`\n- `0 <= exp <= 20`",
    constraintsDigest: "base is between -20 and 20 and exp is a non-negative integer up to 20.",
    expectedTime: "O(exp)",
    expectedSpace: "O(exp)",
    io: {
      fn: "power",
      params: [
        {
          name: "base",
          type: "int",
        },
        {
          name: "exp",
          type: "int",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "2\n10",
        output: "1024",
        explanation: "2^10 = 1024.",
      },
      {
        input: "5\n3",
        output: "125",
        explanation: "5^3 = 125.",
      },
    ],
    sampleTests: [
      {
        input: "2\n10",
      },
      {
        input: "5\n3",
      },
      {
        input: "-2\n3",
      },
    ],
    hiddenTests: [
      {
        input: "7\n0",
      },
      {
        input: "1\n20",
      },
      {
        input: "-3\n4",
      },
      {
        input: "10\n15",
      },
    ],
    hints: [
      "What's the smallest exponent you can answer instantly without doing any multiplication at all?",
      "Multiplying base by the result of the same problem with one smaller exponent builds the answer up from that base case.",
      "Write a recursive function where exp == 0 returns 1, and otherwise returns base times the result of the same function called with exp - 1.",
    ],
    editorial: {
      approachSummary: "Recurse down to exp == 0 as the base case, multiplying base back up.",
      content: "Recursion works by breaking a problem into a smaller version of itself plus a small amount of extra work. For exponentiation, the smaller version is easy to spot: `base^exp` is just `base` multiplied by `base^(exp-1)`, and this shrinking stops at the base case `base^0 = 1`, which needs no computation at all.\n\nThe recursive function therefore has exactly two cases: if `exp` is 0, return 1 immediately. Otherwise, return `base * power(base, exp - 1)`. Each recursive call reduces `exp` by exactly one, so after `exp` calls the base case is reached, and the multiplications unwind back up the call stack to produce the final result.\n\nThis is intentionally the simplest possible recursion: linear recursion with a single recursive call per invocation, no branching, and a single base case. It's a good first exercise for understanding how a call stack accumulates pending work (the pending multiplication by `base`) until the base case resolves, after which each stack frame completes in order from the innermost outward.\n\nA faster O(log exp) version exists using the 'fast exponentiation' trick of squaring the result and halving the exponent, but that's a separate technique worth learning after this simpler linear recursion is comfortable. Watch out for negative bases: they should still work correctly since Python's multiplication naturally handles sign, e.g. `(-3) * (-3) * (-3) = -27`.",
      timeComplexity: "O(exp)",
      spaceComplexity: "O(exp)",
    },
    solution: {
      approachName: "Linear recursion",
      time: "O(exp)",
      space: "O(exp)",
      python: "def helper(b, e):\n    if e == 0:\n        return 1\n    return b * helper(b, e - 1)\nreturn helper(base, exp)",
    },
  },
  {
    slug: "sum-of-digits-recursive",
    title: "Digital Root via Recursion",
    difficulty: "EASY",
    topics: [
      "recursion",
      "math",
    ],
    companies: [],
    statement: "Given a non-negative integer `n`, repeatedly sum its digits until a single digit remains, and return that digit. Implement this using recursion: write a helper that sums the digits of the current number and recurses on that sum until the result is a single digit.\n\n### Input format\n- Line 1: the integer `n`.\n\n### Output format\n- A single integer: the digital root of `n` (a value from 0 to 9).",
    statementDigest: "Recursively sum digits of a number until a single digit remains.",
    constraints: "- `0 <= n <= 10^9`",
    constraintsDigest: "n is a non-negative integer up to one billion.",
    expectedTime: "O(log n)",
    expectedSpace: "O(log n)",
    io: {
      fn: "digitalRoot",
      params: [
        {
          name: "n",
          type: "int",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "12345",
        output: "6",
        explanation: "1+2+3+4+5=15, then 1+5=6, which is a single digit.",
      },
      {
        input: "0",
        output: "0",
        explanation: "0 is already a single digit.",
      },
    ],
    sampleTests: [
      {
        input: "12345",
      },
      {
        input: "0",
      },
      {
        input: "9875",
      },
    ],
    hiddenTests: [
      {
        input: "9",
      },
      {
        input: "999999999",
      },
      {
        input: "19",
      },
      {
        input: "1000000000",
      },
    ],
    hints: [
      "Notice that summing the digits of a number always produces a smaller number — what happens if you keep doing that?",
      "This is a perfect fit for a function that calls itself on a smaller version of the same problem, with 'already a single digit' as the stopping point.",
      "Write a recursive helper: if the number is already less than 10, return it as-is; otherwise sum its digits (using a loop or modulo/division) and recurse on that sum.",
    ],
    editorial: {
      approachSummary: "Recurse on the digit sum until the value is a single digit.",
      content: "This problem, known as the 'digital root', is a clean example of recursion where the recursive step (summing digits) is itself a small loop, and the base case is simply 'the number already has one digit'.\n\nThe helper function checks first whether the current value is less than 10; if so, it's already a single digit and can be returned directly. Otherwise, it computes the sum of the current value's digits — by repeatedly taking the value modulo 10 to peel off the last digit and dividing by 10 to remove it — and then calls itself recursively on that sum.\n\nBecause summing the digits of any number always produces a number with far fewer digits (a number with d digits sums to at most 9d, which has far fewer digits than the original once d grows), this recursion converges extremely quickly: even for a 10-digit input, it typically takes only two or three recursive calls to reach a single digit.\n\nAn interesting fact worth knowing (though not necessary to solve this with recursion) is that the digital root of any positive number equals `1 + (n - 1) mod 9`, related to divisibility by 9. But the point of this exercise is the recursive process itself — reducing a problem to a smaller instance of the same problem and recognizing when to stop — rather than the closed-form shortcut.",
      timeComplexity: "O(log n)",
      spaceComplexity: "O(log n)",
    },
    solution: {
      approachName: "Recursive digit summing",
      time: "O(log n)",
      space: "O(log n)",
      python: "def helper(x):\n    if x < 10:\n        return x\n    s = 0\n    while x > 0:\n        s += x % 10\n        x //= 10\n    return helper(s)\nreturn helper(n)",
    },
  },
  {
    slug: "fibonacci-memoized",
    title: "Nth Fibonacci Number (Memoized)",
    difficulty: "EASY",
    topics: [
      "recursion",
      "dynamic-programming",
      "memoization",
    ],
    companies: [
      {
        slug: "meta",
        frequency: 11,
      },
    ],
    statement: "Given a non-negative integer `n`, return the `n`-th Fibonacci number, using 0-indexing where `fib(0) = 0` and `fib(1) = 1`. Plain recursive Fibonacci without memoization is exponential and too slow for larger `n` in this problem's range — your recursive solution must cache previously computed results so each Fibonacci value is computed only once.\n\n### Input format\n- Line 1: the integer `n`.\n\n### Output format\n- A single integer: the `n`-th Fibonacci number.",
    statementDigest: "Return the nth Fibonacci number using a memoized recursive solution.",
    constraints: "- `0 <= n <= 35`",
    constraintsDigest: "n is between 0 and 35, chosen so naive exponential recursion would be noticeably slow.",
    expectedTime: "O(n)",
    expectedSpace: "O(n)",
    io: {
      fn: "nthFibonacci",
      params: [
        {
          name: "n",
          type: "int",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "10",
        output: "55",
        explanation: "The Fibonacci sequence is 0,1,1,2,3,5,8,13,21,34,55,... and index 10 (0-indexed) is 55.",
      },
      {
        input: "0",
        output: "0",
        explanation: "fib(0) is defined as 0.",
      },
    ],
    sampleTests: [
      {
        input: "10",
      },
      {
        input: "0",
      },
      {
        input: "1",
      },
    ],
    hiddenTests: [
      {
        input: "1",
      },
      {
        input: "2",
      },
      {
        input: "20",
      },
      {
        input: "35",
      },
    ],
    hints: [
      "Plain recursive Fibonacci recomputes the same smaller values over and over — can you avoid redoing work you've already done?",
      "Store each Fibonacci value you compute in a lookup table keyed by its index, and check that table before recursing further.",
      "Use a dictionary as a cache: before recursing to compute fib(n), check if n is already in the cache; after computing fib(n) = fib(n-1) + fib(n-2), store it in the cache before returning.",
    ],
    editorial: {
      approachSummary: "Recursive Fibonacci with a cache (memo dictionary) keyed by index.",
      content: "The naive recursive definition `fib(n) = fib(n-1) + fib(n-2)` is correct but wildly inefficient: the same sub-values get recomputed exponentially many times, so plain recursion runs in roughly O(2^n) time — for n=35 that's over a billion redundant calls.\n\nMemoization fixes this by remembering the result of every `fib(k)` the first time it's computed, so subsequent requests for the same `k` return instantly instead of recursing again. Concretely, keep a dictionary (or array) mapping an index to its already-computed Fibonacci value, seeded with the base cases `fib(0) = 0` and `fib(1) = 1`. Inside the recursive helper, first check whether the requested index is already in the cache; if so, return it directly. Otherwise compute it as the sum of the two preceding memoized calls, store the result in the cache, and return it.\n\nWith memoization, each distinct index from 0 to n is computed exactly once, and every other reference to it is an O(1) cache lookup, bringing the total time down to O(n) with O(n) space for the cache (plus O(n) recursion stack depth in the worst case).\n\nThis pattern — 'recursion plus a cache of already-seen subproblems' — is exactly what's usually meant by 'top-down dynamic programming', and Fibonacci is the canonical first example used to introduce it before moving on to more elaborate DP problems.",
      timeComplexity: "O(n)",
      spaceComplexity: "O(n)",
    },
    solution: {
      approachName: "Top-down memoized recursion",
      time: "O(n)",
      space: "O(n)",
      python: "memo = {0: 0, 1: 1}\ndef helper(x):\n    if x in memo:\n        return memo[x]\n    memo[x] = helper(x - 1) + helper(x - 2)\n    return memo[x]\nreturn helper(n)",
    },
  },
  {
    slug: "count-subsets-with-target-sum",
    title: "Count Subsets With Target Sum",
    difficulty: "MEDIUM",
    topics: [
      "recursion",
      "dynamic-programming",
    ],
    companies: [
      {
        slug: "amazon",
        frequency: 14,
      },
      {
        slug: "microsoft",
        frequency: 9,
      },
    ],
    statement: "Given an array of positive integers `nums` and an integer `target`, count how many subsets of `nums` (choosing elements by index, so duplicate values at different indices are counted as different subsets) sum to exactly `target`. The empty subset (sum 0) counts if `target` is 0.\n\nSolve this using recursion: for each element, choose to either include it or exclude it, and count the branches that end with the remaining target exactly reached. Since a plain choose/exclude recursion is exponential, memoize on the pair (current index, remaining target) to keep it efficient.\n\n### Input format\n- Line 1: the array `nums` as space-separated positive integers.\n- Line 2: the integer `target`.\n\n### Output format\n- A single integer: the number of subsets of `nums` summing to exactly `target`.",
    statementDigest: "Count the number of index-subsets of a positive-integer array that sum to exactly a target value.",
    constraints: "- `1 <= nums.length <= 18`\n- `1 <= nums[i] <= 1000`\n- `0 <= target <= 10000`",
    constraintsDigest: "The array has up to 18 positive integers and the target is bounded by 10000.",
    expectedTime: "O(n * target)",
    expectedSpace: "O(n * target)",
    io: {
      fn: "countSubsets",
      params: [
        {
          name: "nums",
          type: "int[]",
        },
        {
          name: "target",
          type: "int",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "1 2 3\n3",
        output: "2",
        explanation: "The subsets {3} and {1,2} both sum to 3.",
      },
      {
        input: "2 3 5 6 8 10\n10",
        output: "3",
        explanation: "The subsets {10}, {2,8}, and {2,3,5} sum to 10.",
      },
    ],
    sampleTests: [
      {
        input: "1 2 3\n3",
      },
      {
        input: "2 3 5 6 8 10\n10",
      },
      {
        input: "1 1 1\n2",
      },
    ],
    hiddenTests: [
      {
        input: "5\n5",
      },
      {
        input: "1 2 3\n0",
      },
      {
        input: "1 1 1 1\n2",
      },
      {
        input: "1 2 3 4 5 6 7 8 9 10\n25",
      },
    ],
    hints: [
      "For each element you only ever have two choices: it's in the subset, or it isn't — what happens if you try both, for every element?",
      "This branches like a binary tree of decisions, and many different branches end up asking the exact same question (same position, same amount still needed) — that repetition is worth avoiding.",
      "Write a recursive helper(index, remaining) that returns helper(index+1, remaining - nums[index]) + helper(index+1, remaining), with a base case when remaining hits 0 or the index runs out, and memoize on (index, remaining).",
    ],
    editorial: {
      approachSummary: "Include/exclude recursion over each index, memoized on (index, remaining target).",
      content: "This is a classic 'choose or don't choose' recursion. For every element in the array there are exactly two possibilities: it's part of the subset, or it's not. Exploring both possibilities for every element and counting how many complete decisions land on a total of exactly `target` gives the answer.\n\nConcretely, define `helper(i, remaining)` as the number of ways to reach a sum of `remaining` using only elements from index `i` onward. The recursive relation is `helper(i, remaining) = helper(i+1, remaining - nums[i]) + helper(i+1, remaining)` — the first term includes `nums[i]`, the second excludes it. The base cases are: if `remaining` reaches exactly 0, that's one valid way (regardless of what's left unchosen, since all remaining values are positive and can only overshoot); and if `i` reaches the end of the array or `remaining` goes negative without hitting 0, that branch contributes 0.\n\nWithout memoization this recursion branches into up to `2^n` calls, which becomes slow well before `n = 18` with a naive traversal of overlapping states. However, the pair `(i, remaining)` only takes on at most `n * target` distinct combinations, so caching results keyed by that pair (in a dictionary or 2D table) collapses the work down to O(n * target) time and space — the include/exclude recursion turns into a standard subset-sum dynamic programming table, approached top-down instead of with nested loops.",
      timeComplexity: "O(n * target)",
      spaceComplexity: "O(n * target)",
    },
    solution: {
      approachName: "Memoized include/exclude recursion",
      time: "O(n * target)",
      space: "O(n * target)",
      python: "n = len(nums)\nmemo = {}\ndef helper(i, remaining):\n    if remaining == 0:\n        return 1\n    if i == n or remaining < 0:\n        return 0\n    key = (i, remaining)\n    if key in memo:\n        return memo[key]\n    res = helper(i + 1, remaining - nums[i]) + helper(i + 1, remaining)\n    memo[key] = res\n    return res\nreturn helper(0, target)",
    },
  },
  {
    slug: "count-valid-parenthesis-combinations",
    title: "Count Valid Parenthesis Combinations",
    difficulty: "MEDIUM",
    topics: [
      "recursion",
      "backtracking",
      "combinatorics",
    ],
    companies: [
      {
        slug: "google",
        frequency: 13,
      },
      {
        slug: "bloomberg",
        frequency: 7,
      },
    ],
    statement: "Given a non-negative integer `n` representing the number of pairs of parentheses, count how many distinct strings of balanced (valid) parentheses can be formed using exactly `n` pairs. Compute this by recursively counting the number of ways to place each next parenthesis while keeping the sequence valid at every prefix, rather than by looking up a closed-form formula.\n\n### Input format\n- Line 1: the integer `n`.\n\n### Output format\n- A single integer: the number of distinct valid parenthesis combinations using `n` pairs.",
    statementDigest: "Count the number of distinct valid parenthesis strings that can be built from n pairs, via recursion.",
    constraints: "- `0 <= n <= 14`",
    constraintsDigest: "n is between 0 and 14 pairs of parentheses.",
    expectedTime: "O(n^2)",
    expectedSpace: "O(n^2)",
    io: {
      fn: "countCombinations",
      params: [
        {
          name: "n",
          type: "int",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "3",
        output: "5",
        explanation: "The 5 valid combinations for 3 pairs are ((())), (()()), (())(), ()(()), ()()().",
      },
      {
        input: "0",
        output: "1",
        explanation: "With 0 pairs, the only valid combination is the empty string.",
      },
    ],
    sampleTests: [
      {
        input: "3",
      },
      {
        input: "0",
      },
      {
        input: "1",
      },
    ],
    hiddenTests: [
      {
        input: "1",
      },
      {
        input: "2",
      },
      {
        input: "4",
      },
      {
        input: "14",
      },
    ],
    hints: [
      "At any point while building the string, you can only place a closing parenthesis if there's an unmatched opening one still waiting for it — track that balance as you go.",
      "Think in terms of how many opens and closes you still have left to place, and branch on the choices that keep the sequence valid so far.",
      "Write a recursive helper(openLeft, closeLeft) counting completions: recurse by placing an open (if any remain) and/or a close (only if more closes remain than opens, meaning there's an unmatched open to close), memoizing on the (openLeft, closeLeft) pair.",
    ],
    editorial: {
      approachSummary: "Recursively count completions tracking remaining opens and closes, memoized.",
      content: "Valid parenthesis sequences are exactly those where, reading left to right, the number of closing parentheses placed so far never exceeds the number of opening ones. This gives a natural recursive counting scheme: track how many opening parentheses and how many closing parentheses are still available to place, and branch on the legal next moves.\n\nDefine `helper(openLeft, closeLeft)` as the number of ways to complete a valid sequence given that `openLeft` opens and `closeLeft` closes remain to be placed. You can always place an opening parenthesis if `openLeft > 0`, recursing into `helper(openLeft - 1, closeLeft)`. You can place a closing parenthesis only if doing so keeps the sequence valid, which requires that there are more closes remaining than opens remaining (`closeLeft > openLeft`) — meaning there's currently at least one unmatched open parenthesis to close; that branch recurses into `helper(openLeft, closeLeft - 1)`. The base case is `openLeft == 0 and closeLeft == 0`, which represents one complete valid sequence.\n\nStarting the recursion at `helper(n, n)` and summing the two branches at every step counts every valid combination exactly once. Since the reachable states are pairs `(openLeft, closeLeft)` with both values between 0 and n, there are only O(n^2) distinct states, so memoizing on this pair keeps the whole computation to O(n^2) time and space, even though the resulting counts (Catalan numbers) grow exponentially with n.",
      timeComplexity: "O(n^2)",
      spaceComplexity: "O(n^2)",
    },
    solution: {
      approachName: "Memoized open/close remaining-count recursion",
      time: "O(n^2)",
      space: "O(n^2)",
      python: "memo = {}\ndef helper(open_left, close_left):\n    if open_left == 0 and close_left == 0:\n        return 1\n    key = (open_left, close_left)\n    if key in memo:\n        return memo[key]\n    total = 0\n    if open_left > 0:\n        total += helper(open_left - 1, close_left)\n    if close_left > open_left:\n        total += helper(open_left, close_left - 1)\n    memo[key] = total\n    return total\nreturn helper(n, n)",
    },
  },
  {
    slug: "letter-case-permutation-count",
    title: "Count Letter Case Permutations",
    difficulty: "EASY",
    topics: [
      "recursion",
      "strings",
      "combinatorics",
    ],
    companies: [
      {
        slug: "apple",
        frequency: 6,
      },
    ],
    statement: "Given a string `s` consisting of letters and digits, count how many distinct strings can be formed by independently changing the case (upper/lower) of each letter in `s`. Digits are fixed and never change. Compute the count using recursion over the characters of `s`, rather than a direct formula.\n\n### Input format\n- Line 1: the string `s`.\n\n### Output format\n- A single integer: the number of distinct strings obtainable by case-changing the letters of `s`.",
    statementDigest: "Count distinct strings formed by independently toggling the case of every letter in a string, recursively.",
    constraints: "- `1 <= s.length <= 40`\n- `s` consists only of uppercase letters, lowercase letters, and digits",
    constraintsDigest: "The string has 1 to 40 characters, each a letter or a digit.",
    expectedTime: "O(n)",
    expectedSpace: "O(n)",
    io: {
      fn: "countPermutations",
      params: [
        {
          name: "s",
          type: "str",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "a1b2",
        output: "4",
        explanation: "There are 2 letters ('a' and 'b'), each independently upper or lower case, giving 2*2=4 distinct strings.",
      },
      {
        input: "XY3z",
        output: "8",
        explanation: "There are 3 letters ('X', 'Y', 'z'), giving 2*2*2=8 distinct strings.",
      },
    ],
    sampleTests: [
      {
        input: "a1b2",
      },
      {
        input: "XY3z",
      },
      {
        input: "7",
      },
    ],
    hiddenTests: [
      {
        input: "7",
      },
      {
        input: "abcdefghij",
      },
      {
        input: "a1b2c3d4e5",
      },
      {
        input: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM",
      },
    ],
    hints: [
      "Digits never change, so they don't add any branching — only think about what each letter contributes to the total count.",
      "Process the string one character at a time: each letter you encounter doubles the number of possibilities from that point on.",
      "Write a recursive helper(index) that returns 1 at the end of the string, and otherwise multiplies the result of helper(index + 1) by 2 if the current character is a letter, or leaves it unchanged if it's a digit.",
    ],
    editorial: {
      approachSummary: "Recurse over characters, doubling the running count at each letter.",
      content: "Each letter in the string can independently be upper or lower case, and each digit is fixed, so the total number of distinct strings is `2` raised to the power of the number of letters in `s`. This problem asks you to reach that count through recursion over the characters rather than jumping straight to the closed-form power expression, which builds the same intuition used in subset-counting and combination-counting problems.\n\nDefine a recursive helper that processes the string one character at a time, starting from index 0. The base case is reaching the end of the string, which contributes a factor of 1 (there's exactly one way to have 'processed nothing left'). For each character, if it's a letter, it doubles the number of possibilities available for the remainder of the string, since it independently could be upper or lower case; if it's a digit, it doesn't branch at all, and the count is just whatever the rest of the string contributes.\n\nConcretely, `helper(i)` returns 1 if `i` equals the length of the string, and otherwise returns `2 * helper(i + 1)` if `s[i]` is a letter, or `helper(i + 1)` if it's a digit.\n\nThis is a clean example of recursion that mirrors a simple loop (there's no overlapping subproblems here, so no memoization is needed), and it's a useful stepping stone toward exercises that actually enumerate combinations, where the same 'branch or don't branch' structure appears but the recursion also needs to build up a partial result along the way.",
      timeComplexity: "O(n)",
      spaceComplexity: "O(n)",
    },
    solution: {
      approachName: "Recursive doubling over characters",
      time: "O(n)",
      space: "O(n)",
      python: "def helper(i):\n    if i == len(s):\n        return 1\n    if s[i].isalpha():\n        return 2 * helper(i + 1)\n    return helper(i + 1)\nreturn helper(0)",
    },
  },
  {
    slug: "tower-of-hanoi-move-count",
    title: "Tower of Hanoi Move Count",
    difficulty: "EASY",
    topics: [
      "recursion",
      "math",
    ],
    companies: [
      {
        slug: "oracle",
        frequency: 6,
      },
    ],
    statement: "Given a non-negative integer `n` representing the number of disks, return the minimum number of moves needed to solve the Tower of Hanoi puzzle. Compute the answer using the recursive relation `T(n) = 2 * T(n-1) + 1` with base case `T(0) = 0`, implemented as an actual recursive function rather than the closed-form `2^n - 1`.\n\n### Input format\n- Line 1: the integer `n`.\n\n### Output format\n- A single integer: the minimum number of moves for `n` disks.",
    statementDigest: "Recursively compute the minimum number of Tower of Hanoi moves for n disks.",
    constraints: "- `0 <= n <= 30`",
    constraintsDigest: "n is the number of disks, between 0 and 30.",
    expectedTime: "O(n)",
    expectedSpace: "O(n)",
    io: {
      fn: "minMoves",
      params: [
        {
          name: "n",
          type: "int",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "3",
        output: "7",
        explanation: "T(3) = 2*T(2)+1 = 2*(2*T(1)+1)+1 = 2*(2*1+1)+1 = 7.",
      },
      {
        input: "0",
        output: "0",
        explanation: "With 0 disks, no moves are needed.",
      },
    ],
    sampleTests: [
      {
        input: "3",
      },
      {
        input: "0",
      },
      {
        input: "1",
      },
    ],
    hiddenTests: [
      {
        input: "1",
      },
      {
        input: "2",
      },
      {
        input: "10",
      },
      {
        input: "30",
      },
    ],
    hints: [
      "Solving the puzzle for n disks always involves solving a smaller version of the same puzzle, twice, plus one extra move — which move is that?",
      "To move the biggest disk, every disk above it must first be relocated out of the way to a spare peg, and afterward moved again on top of it.",
      "Implement T(n) = 2 * T(n-1) + 1 directly as a recursive function with base case T(0) = 0, rather than computing 2^n - 1 with a formula.",
    ],
    editorial: {
      approachSummary: "Direct recursion implementing the move-count recurrence T(n) = 2*T(n-1) + 1.",
      content: "The Tower of Hanoi puzzle's move count follows naturally from how the optimal strategy is structured, even without deriving the closed-form solution. To move `n` disks from a source peg to a target peg using a spare peg, the optimal strategy first moves the top `n-1` disks from the source to the spare peg (using the target as the temporary spare for that sub-move), then moves the single largest remaining disk directly from source to target, and finally moves the `n-1` disks from the spare peg onto the target peg (using the source as the temporary spare).\n\nThat structure translates directly into a move-count recurrence: solving for `n` disks costs the same as solving for `n-1` disks (moving them out of the way), plus one move for the largest disk, plus solving for `n-1` disks again (moving them back on top). This gives `T(n) = 2 * T(n-1) + 1`, with the base case `T(0) = 0` since there's nothing to move with zero disks.\n\nImplementing this as a direct recursive function — rather than jumping to the algebraic simplification `T(n) = 2^n - 1` — reinforces how a recurrence relation derived from an algorithm's structure can be coded almost verbatim: compute `T(n-1)` recursively, then apply the surrounding arithmetic (`2 * T(n-1) + 1`) to get `T(n)`.\n\nThis runs in O(n) time and uses O(n) recursion stack depth, since each call only reduces `n` by 1 and there's no branching to memoize.",
      timeComplexity: "O(n)",
      spaceComplexity: "O(n)",
    },
    solution: {
      approachName: "Direct recurrence recursion",
      time: "O(n)",
      space: "O(n)",
      python: "def helper(k):\n    if k == 0:\n        return 0\n    return 2 * helper(k - 1) + 1\nreturn helper(n)",
    },
  },
  {
    slug: "kth-lexicographic-permutation",
    title: "Kth Lexicographic Permutation",
    difficulty: "HARD",
    topics: [
      "recursion",
      "backtracking",
      "math",
      "combinatorics",
    ],
    companies: [
      {
        slug: "google",
        frequency: 15,
      },
      {
        slug: "nvidia",
        frequency: 8,
      },
    ],
    statement: "Given an integer `n` and an integer `k`, consider all permutations of the digits `1` to `n` arranged in lexicographically increasing order. Return the `k`-th permutation in that ordering (1-indexed) as a string.\n\n### Input format\n- Line 1: the integer `n`.\n- Line 2: the integer `k`.\n\n### Output format\n- A string: the `k`-th lexicographic permutation of digits `1` to `n`.",
    statementDigest: "Return the k-th lexicographically ordered permutation of digits 1 to n as a string.",
    constraints: "- `1 <= n <= 9`\n- `1 <= k <= n!`",
    constraintsDigest: "n is between 1 and 9 and k is a valid 1-indexed rank not exceeding n factorial.",
    expectedTime: "O(n^2)",
    expectedSpace: "O(n)",
    io: {
      fn: "kthPermutation",
      params: [
        {
          name: "n",
          type: "int",
        },
        {
          name: "k",
          type: "int",
        },
      ],
      returns: "str",
    },
    examples: [
      {
        input: "3\n3",
        output: "213",
        explanation: "The permutations of 1,2,3 in lexicographic order are 123, 132, 213, 231, 312, 321; the 3rd one is 213.",
      },
      {
        input: "4\n9",
        output: "2314",
        explanation: "The 9th permutation of 1,2,3,4 in lexicographic order is 2314.",
      },
    ],
    sampleTests: [
      {
        input: "3\n3",
      },
      {
        input: "4\n9",
      },
      {
        input: "1\n1",
      },
    ],
    hiddenTests: [
      {
        input: "1\n1",
      },
      {
        input: "9\n1",
      },
      {
        input: "9\n362880",
      },
      {
        input: "5\n60",
      },
    ],
    hints: [
      "You don't need to generate every permutation to find the k-th one — think about how many permutations start with each possible first digit.",
      "Every choice of the first digit leaves (n-1)! permutations of the remaining digits, so dividing k-1 by (n-1)! tells you which digit to pick first — then the problem repeats on one fewer digit.",
      "Use the factorial number system: maintain a list of unused digits, and at each step pick the digit at index (k-1) // (remaining length - 1)!, remove it from the list, update k to (k-1) % (remaining length - 1)!, and repeat.",
    ],
    editorial: {
      approachSummary: "Factorial number system: pick each digit by dividing the remaining rank by a factorial block size.",
      content: "Generating all `n!` permutations and sorting them to find the k-th would work, but it's wasteful — there's a direct way to compute just the one permutation needed using the structure of lexicographic order.\n\nAmong all permutations of a set of `m` remaining digits, the ones grouped by their first digit are also in sorted blocks: fixing any particular first digit and varying the rest lexicographically produces exactly `(m-1)!` permutations. So, converting `k` to 0-indexed as `k - 1`, the correct first digit is at position `(k-1) // (m-1)!` among the currently available digits (sorted). After picking that digit and removing it from the pool, the problem repeats: find the `((k-1) mod (m-1)!) + 1`-th permutation of the remaining `m-1` digits — or equivalently, keep working with the 0-indexed remainder directly.\n\nConcretely: maintain a sorted list of unused digits. At each step, with `m` digits remaining, compute `block = (m-1)!`, pick the digit at index `k // block` (using the running 0-indexed `k`), append it to the result, remove it from the list, and update `k` to `k % block`. Repeat until no digits remain.\n\nThis process makes exactly `n` digit choices, each requiring an O(n) removal from a list (or O(log n) with a more advanced structure), giving an overall O(n^2) time algorithm — dramatically better than generating and sorting all `n!` permutations, and a nice demonstration of how recursion/iteration paired with counting (rather than brute-force enumeration) can directly select the k-th item without ever constructing the others.",
      timeComplexity: "O(n^2)",
      spaceComplexity: "O(n)",
    },
    solution: {
      approachName: "Factorial number system digit selection",
      time: "O(n^2)",
      space: "O(n)",
      python: "import math\ndigits = [str(i) for i in range(1, n + 1)]\nk -= 1\nresult = []\ndef helper(remaining, k):\n    if not remaining:\n        return\n    m = len(remaining)\n    fact = math.factorial(m - 1)\n    idx = k // fact\n    result.append(remaining[idx])\n    del remaining[idx]\n    helper(remaining, k % fact)\nhelper(digits, k)\nreturn ''.join(result)",
    },
  },
  {
    slug: "valid-string-with-backspaces",
    title: "Valid String After Backspaces",
    difficulty: "EASY",
    topics: [
      "stacks",
      "strings",
    ],
    companies: [
      {
        slug: "google",
        frequency: 18,
      },
      {
        slug: "amazon",
        frequency: 22,
      },
      {
        slug: "microsoft",
        frequency: 12,
      },
    ],
    statement: "You are given two strings, `s` and `t`, each containing only lowercase English letters and the character `#`.\n\nThe character `#` represents a **backspace**: it deletes the character immediately before it. If there is no character before a `#` (the string typed so far is empty), the `#` does nothing.\n\nSimulate typing out both strings (applying all backspaces as you go), and determine whether the final, resulting strings are equal.\n\n### Input format\n- Line 1: the string `s`\n- Line 2: the string `t`\n\n### Output format\nPrint `true` if the final strings are equal after applying all backspaces, otherwise print `false`.",
    statementDigest: "Given two strings containing letters and '#' backspace characters, determine whether they are equal after applying all backspaces.",
    constraints: "- `0 <= s.length, t.length <= 200`\n- `s` and `t` contain only lowercase English letters and the character `#`\n- A `#` with nothing before it (empty buffer) is a no-op",
    constraintsDigest: "String lengths are at most 200 and contain only lowercase letters and '#'.",
    expectedTime: "O(n + m)",
    expectedSpace: "O(n + m)",
    io: {
      fn: "isEqualAfterBackspaces",
      params: [
        {
          name: "s",
          type: "str",
        },
        {
          name: "t",
          type: "str",
        },
      ],
      returns: "bool",
    },
    examples: [
      {
        input: "ab#c\nad#c",
        output: "true",
        explanation: "Typing \"ab#c\" gives \"ac\" (b is deleted); typing \"ad#c\" gives \"ac\" (d is deleted). Both equal \"ac\".",
      },
      {
        input: "a#c\nb",
        output: "false",
        explanation: "Typing \"a#c\" gives \"c\"; typing \"b\" gives \"b\". \"c\" != \"b\".",
      },
    ],
    sampleTests: [
      {
        input: "ab#c\nad#c",
      },
      {
        input: "a#c\nb",
      },
      {
        input: "ab##\nc#d#",
      },
    ],
    hiddenTests: [
      {
        input: "a#c\nb",
      },
      {
        input: "xy#z\nxzz#",
      },
      {
        input: "####\n",
      },
      {
        input: "a##b\nb",
      },
      {
        input: "ab\nba",
      },
      {
        input: "\n",
      },
    ],
    hints: [
      "Think about what happens to characters as you scan left to right and encounter a delete signal.",
      "A stack captures exactly the effect of typing-then-backspacing in order.",
      "Push letters onto a stack for each string separately, pop on '#', then compare the two final stacks.",
    ],
    editorial: {
      approachSummary: "Simulate typing with a stack for each string, then compare the results.",
      content: "The key insight is that a backspace always cancels out the character typed immediately before it, and nothing else. This is exactly the behavior of a stack: pushing a letter is like typing it, and popping is like pressing backspace.\n\nProcess each string independently: walk through it from left to right, maintaining a stack of characters. Whenever you see a lowercase letter, push it onto the stack. Whenever you see `#`, pop the top of the stack if it is non-empty (if the stack is empty, the backspace has nothing to delete, so it is simply ignored).\n\nAfter processing both `s` and `t` this way, you are left with two stacks that represent exactly what would remain on screen after typing each string and applying every backspace. The original strings are 'equal after backspaces' precisely when these two final stacks contain the same characters in the same order, so comparing them directly gives the answer.\n\nThis approach only requires a single left-to-right pass over each string, using extra space proportional to the number of surviving characters. It avoids any need to delete characters from a string in place, and naturally handles edge cases like leading backspaces or strings that reduce to empty.",
      timeComplexity: "O(n + m)",
      spaceComplexity: "O(n + m)",
    },
    solution: {
      approachName: "Stack simulation",
      time: "O(n + m)",
      space: "O(n + m)",
      python: "stack1 = []\nfor c in s:\n    if c == '#':\n        if stack1:\n            stack1.pop()\n    else:\n        stack1.append(c)\nstack2 = []\nfor c in t:\n    if c == '#':\n        if stack2:\n            stack2.pop()\n    else:\n        stack2.append(c)\nreturn stack1 == stack2",
    },
  },
  {
    slug: "min-add-to-make-parens-valid",
    title: "Minimum Add to Make Parentheses Valid",
    difficulty: "MEDIUM",
    topics: [
      "stacks",
      "strings",
      "greedy",
    ],
    companies: [
      {
        slug: "meta",
        frequency: 20,
      },
      {
        slug: "bloomberg",
        frequency: 15,
      },
      {
        slug: "adobe",
        frequency: 10,
      },
    ],
    statement: "You are given a string `s` consisting only of the characters `(` and `)`.\n\nIn one move, you can insert a single `(` or a single `)` at any position in the string.\n\nReturn the minimum number of moves required to make `s` a valid (balanced) parentheses string.\n\n### Input format\n- Line 1: the string `s`\n\n### Output format\nPrint a single integer: the minimum number of insertions needed.",
    statementDigest: "Given a string of only '(' and ')', find the minimum number of parenthesis insertions needed to make it valid.",
    constraints: "- `0 <= s.length <= 1000`\n- `s` consists only of the characters `(` and `)`",
    constraintsDigest: "The string has at most 1000 characters and consists only of '(' and ')'.",
    expectedTime: "O(n)",
    expectedSpace: "O(1)",
    io: {
      fn: "minInsertions",
      params: [
        {
          name: "s",
          type: "str",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "())",
        output: "1",
        explanation: "Insert one '(' at the front, e.g. \"(())\", to make it valid; one insertion is the minimum.",
      },
      {
        input: "(((",
        output: "3",
        explanation: "Each unmatched '(' needs a matching ')' appended; three insertions are required.",
      },
    ],
    sampleTests: [
      {
        input: "())",
      },
      {
        input: "(((",
      },
      {
        input: "()",
      },
    ],
    hiddenTests: [
      {
        input: "",
      },
      {
        input: "()",
      },
      {
        input: ")((",
      },
      {
        input: "((()))",
      },
      {
        input: ")))",
      },
      {
        input: "()))((",
      },
    ],
    hints: [
      "Scan left to right and keep track of parentheses that don't yet have a partner.",
      "A counter for unmatched open parens acts like an implicit stack.",
      "Whenever you see ')' with no unmatched '(' waiting, that's a forced insertion; any leftover unmatched '(' at the end needs insertions too.",
    ],
    editorial: {
      approachSummary: "Track unmatched open parentheses with a counter; count forced insertions for unmatched closes.",
      content: "Scan the string once, left to right, keeping a running count of `(` characters seen so far that have not yet been matched with a `)` — call this `open_needed`. This counter effectively plays the role of a stack containing only `(` characters, since matching pairs cancel immediately.\n\nWhenever you encounter `(`, increment `open_needed` — it is now waiting for a partner. Whenever you encounter `)`, check whether there is an unmatched `(` waiting: if `open_needed > 0`, decrement it (this `)` matches an earlier `(`). If `open_needed` is already zero, this `)` has nothing to match, so it represents a character that must eventually be paired by inserting a new `(` before it — increment an `insertions` counter to record that.\n\nAfter the scan finishes, any remaining value in `open_needed` represents `(` characters that never found a matching `)`; each needs a `)` inserted after it. The final answer is simply `insertions + open_needed`, the total number of characters that must be added.\n\nBecause each character is processed exactly once with only constant extra bookkeeping, this runs in linear time and constant extra space, which is optimal for this problem.",
      timeComplexity: "O(n)",
      spaceComplexity: "O(1)",
    },
    solution: {
      approachName: "Counter (implicit stack)",
      time: "O(n)",
      space: "O(1)",
      python: "open_needed = 0\ninsertions = 0\nfor c in s:\n    if c == '(':\n        open_needed += 1\n    else:\n        if open_needed > 0:\n            open_needed -= 1\n        else:\n            insertions += 1\nreturn insertions + open_needed",
    },
  },
  {
    slug: "search-insert-position",
    title: "Search Insert Position",
    difficulty: "EASY",
    topics: [
      "binary-search",
      "arrays",
    ],
    companies: [
      {
        slug: "google",
        frequency: 15,
      },
      {
        slug: "amazon",
        frequency: 25,
      },
      {
        slug: "apple",
        frequency: 10,
      },
    ],
    statement: "You are given a sorted array of distinct integers `nums` and an integer `target`.\n\nIf `target` exists in `nums`, return its index. Otherwise, return the index where `target` would be inserted to keep `nums` sorted in ascending order.\n\nYour solution must run in `O(log n)` time.\n\n### Input format\n- Line 1: space-separated integers of `nums`\n- Line 2: the integer `target`\n\n### Output format\nPrint a single integer: the index.",
    statementDigest: "Given a sorted array of distinct integers and a target, find its index or the index where it would be inserted, in O(log n) time.",
    constraints: "- `1 <= nums.length <= 10^4`\n- `-10^4 <= nums[i], target <= 10^4`\n- `nums` is sorted in strictly ascending order (all elements distinct)",
    constraintsDigest: "The array has between 1 and 10^4 distinct, strictly ascending integers.",
    expectedTime: "O(log n)",
    expectedSpace: "O(1)",
    io: {
      fn: "searchInsertPosition",
      params: [
        {
          name: "nums",
          type: "int[]",
        },
        {
          name: "target",
          type: "int",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "1 3 5 6\n5",
        output: "2",
        explanation: "5 is found at index 2.",
      },
      {
        input: "1 3 5 6\n2",
        output: "1",
        explanation: "2 is not present; inserting it between index 0 (value 1) and index 1 (value 3) keeps the array sorted, so the insert index is 1.",
      },
    ],
    sampleTests: [
      {
        input: "1 3 5 6\n5",
      },
      {
        input: "1 3 5 6\n2",
      },
      {
        input: "1 3 5 6\n7",
      },
    ],
    hiddenTests: [
      {
        input: "1\n1",
      },
      {
        input: "1\n0",
      },
      {
        input: "1\n2",
      },
      {
        input: "1 3 5 6\n0",
      },
      {
        input: "-5 -1 0 3 8\n3",
      },
      {
        input: "1 3 5 6\n7",
      },
    ],
    hints: [
      "Linear scan works but there's a way to narrow down the answer much faster given the array is sorted.",
      "Think binary search, but instead of stopping only on exact match, keep narrowing until the boundary between smaller and 'target-or-larger' values is found.",
      "Use a lo/hi binary search where you move lo past elements strictly less than target; when the loop ends, lo is the answer.",
    ],
    editorial: {
      approachSummary: "Binary search for the first index whose value is not less than target.",
      content: "Because `nums` is sorted and contains distinct values, both 'find target' and 'find insertion point' can be answered with a single binary search that looks for the first index whose value is greater than or equal to `target`.\n\nMaintain two pointers, `lo` and `hi`, initially spanning the whole array (`lo = 0`, `hi = len(nums)`). Repeatedly compute `mid = (lo + hi) // 2`. If `nums[mid] < target`, then `mid` (and everything before it) is too small to be the answer, so move `lo = mid + 1`. Otherwise, `nums[mid]` is a candidate answer (either it equals `target`, or it is the first value large enough to be the insertion point), so move `hi = mid` without discarding `mid` from consideration.\n\nThe loop continues while `lo < hi`, narrowing the search window by roughly half each iteration. When the loop ends, `lo` equals `hi` and points exactly at the first index whose value is `>= target` — this is simultaneously the index of `target` if it's present, or the correct insertion index if it's not.\n\nThis runs in `O(log n)` time using only constant extra space.",
      timeComplexity: "O(log n)",
      spaceComplexity: "O(1)",
    },
    solution: {
      approachName: "Binary search (lower bound)",
      time: "O(log n)",
      space: "O(1)",
      python: "lo, hi = 0, len(nums)\nwhile lo < hi:\n    mid = (lo + hi) // 2\n    if nums[mid] < target:\n        lo = mid + 1\n    else:\n        hi = mid\nreturn lo",
    },
  },
  {
    slug: "find-peak-element",
    title: "Find Peak Element",
    difficulty: "MEDIUM",
    topics: [
      "binary-search",
      "arrays",
    ],
    companies: [
      {
        slug: "microsoft",
        frequency: 20,
      },
      {
        slug: "amazon",
        frequency: 18,
      },
      {
        slug: "nvidia",
        frequency: 8,
      },
    ],
    statement: "A **peak element** is an element that is strictly greater than its neighbors. Given a 0-indexed integer array `nums` where `nums[i] != nums[i + 1]` for all valid `i`, find a peak element and return its index.\n\nElements outside the array bounds are considered to be `-infinity`, so the first or last element can be a peak if it is greater than its single neighbor.\n\nIf the array contains multiple peaks, return the index of the peak found by binary search: repeatedly compare `nums[mid]` with `nums[mid + 1]` and move toward the side with the larger value (this is the specific index this judge checks against).\n\nYour solution must run in `O(log n)` time — a linear scan will not meet the required complexity.\n\n### Input format\n- Line 1: space-separated integers of `nums`\n\n### Output format\nPrint a single integer: the index of the peak found by the binary search described above.",
    statementDigest: "Given an array with no two adjacent equal elements, find the index of a peak element in O(log n) using binary search on adjacent comparisons.",
    constraints: "- `1 <= nums.length <= 10^4`\n- `-2^31 <= nums[i] <= 2^31 - 1`\n- `nums[i] != nums[i + 1]` for every valid index `i`",
    constraintsDigest: "The array has up to 10^4 32-bit integers with no two adjacent elements equal.",
    expectedTime: "O(log n)",
    expectedSpace: "O(1)",
    io: {
      fn: "findPeakElement",
      params: [
        {
          name: "nums",
          type: "int[]",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "1 2 3 1",
        output: "2",
        explanation: "Index 2 (value 3) is greater than both neighbors 2 and 1, so it is a peak.",
      },
      {
        input: "1 2 1 3 5 6 4",
        output: "5",
        explanation: "Index 5 (value 6) is greater than both neighbors 5 and 4; this is the peak the binary search converges to.",
      },
    ],
    sampleTests: [
      {
        input: "1 2 3 1",
      },
      {
        input: "1 2 1 3 5 6 4",
      },
      {
        input: "1",
      },
    ],
    hiddenTests: [
      {
        input: "1",
      },
      {
        input: "1 2",
      },
      {
        input: "2 1",
      },
      {
        input: "5 4 3 2 1",
      },
      {
        input: "1 3 20 4 1 0 2 -5",
      },
      {
        input: "-1 -2",
      },
    ],
    hints: [
      "A full scan finds a peak in linear time, but the guarantee that adjacent values differ hints at a faster way using local slope.",
      "Compare the middle element to its right neighbor — whichever side is 'going up' must contain a peak.",
      "Binary search: if nums[mid] < nums[mid+1], a peak lies to the right (move lo = mid+1), otherwise it lies at or to the left (move hi = mid).",
    ],
    editorial: {
      approachSummary: "Binary search using the slope between adjacent elements to head toward a peak.",
      content: "A linear scan can find a peak in `O(n)`, but the guarantee that no two adjacent elements are equal lets you do much better: at any index, you can look at the slope toward the next element and be sure a peak exists in the direction the array is 'increasing'.\n\nBinary search with `lo = 0` and `hi = len(nums) - 1`. At each step compute `mid = (lo + hi) // 2` and compare `nums[mid]` with `nums[mid + 1]`. If `nums[mid] < nums[mid + 1]`, the array is still rising at `mid`, which guarantees a peak exists somewhere in `[mid + 1, hi]` (worst case, the last element is a peak because it's greater than a virtual `-infinity` beyond the array) — so move `lo = mid + 1`. Otherwise, `nums[mid] >= nums[mid + 1]`, meaning `mid` is on a falling edge or is itself a peak, so a peak is guaranteed in `[lo, mid]` — move `hi = mid`.\n\nThe loop ends when `lo == hi`, and that index is guaranteed to be a peak. Because the comparison direction is fixed and deterministic, this always converges to the same index for a given input, which is what this judge checks.\n\nThis is `O(log n)` time and `O(1)` space, versus the `O(n)` a straightforward scan would require.",
      timeComplexity: "O(log n)",
      spaceComplexity: "O(1)",
    },
    solution: {
      approachName: "Binary search on adjacent slope",
      time: "O(log n)",
      space: "O(1)",
      python: "lo, hi = 0, len(nums) - 1\nwhile lo < hi:\n    mid = (lo + hi) // 2\n    if nums[mid] < nums[mid + 1]:\n        lo = mid + 1\n    else:\n        hi = mid\nreturn lo",
    },
  },
  {
    slug: "count-connected-components-basic",
    title: "Count Connected Components",
    difficulty: "EASY",
    topics: [
      "graphs",
      "union-find",
      "dfs",
    ],
    companies: [
      {
        slug: "amazon",
        frequency: 16,
      },
      {
        slug: "google",
        frequency: 14,
      },
      {
        slug: "flipkart",
        frequency: 9,
      },
    ],
    statement: "You are given an undirected graph with `n` nodes labeled from `0` to `n - 1`, and a list of edges.\n\nSince edges must be passed as a flat list, they are encoded as pairs of consecutive integers: `edges = [a1, b1, a2, b2, ...]` means there is an undirected edge between `a1` and `b1`, another between `a2` and `b2`, and so on.\n\nReturn the number of connected components in the graph.\n\n### Input format\n- Line 1: the integer `n`\n- Line 2: space-separated integers of `edges` (this line may be empty if there are no edges)\n\n### Output format\nPrint a single integer: the number of connected components.",
    statementDigest: "Given n nodes and a flat pairwise-encoded edge list, count the number of connected components in the undirected graph.",
    constraints: "- `0 <= n <= 2000`\n- `edges.length` is even, and `0 <= edges.length / 2 <= 5000`\n- Each value in `edges` is a valid node label in `[0, n - 1]`\n- There are no self-loops, but duplicate edges may appear",
    constraintsDigest: "Up to 2000 nodes and 5000 edges, given as a flat even-length integer array with valid node labels.",
    expectedTime: "O(n + e)",
    expectedSpace: "O(n)",
    io: {
      fn: "countComponents",
      params: [
        {
          name: "n",
          type: "int",
        },
        {
          name: "edges",
          type: "int[]",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "5\n0 1 1 2 3 4",
        output: "2",
        explanation: "Nodes {0,1,2} form one component and {3,4} form another, so there are 2 components.",
      },
      {
        input: "6\n",
        output: "6",
        explanation: "With no edges, every one of the 6 nodes is its own component.",
      },
    ],
    sampleTests: [
      {
        input: "5\n0 1 1 2 3 4",
      },
      {
        input: "6\n",
      },
      {
        input: "4\n0 1 2 3",
      },
    ],
    hiddenTests: [
      {
        input: "1\n",
      },
      {
        input: "3\n0 1 1 2",
      },
      {
        input: "5\n0 4 1 3",
      },
      {
        input: "2\n0 1",
      },
      {
        input: "7\n0 1 2 3 4 5",
      },
      {
        input: "0\n",
      },
    ],
    hints: [
      "Think of each node as starting in its own group, and edges as merging groups together.",
      "Union-Find (disjoint set union) or a simple DFS/BFS over an adjacency list both work well here.",
      "Build parent pointers, union each edge's endpoints, then count the number of distinct roots across all n nodes.",
    ],
    editorial: {
      approachSummary: "Union-Find (or DFS/BFS) over the adjacency built from the flat edge list.",
      content: "Since edges are given as a flat array of consecutive pairs, first walk through `edges` two elements at a time to recover each individual edge `(a, b)`.\n\nA clean way to count components is Union-Find (disjoint set union). Start with every node as its own parent, i.e. `parent[i] = i`. For each edge `(a, b)`, find the representative ('root') of each endpoint's set using path compression, and if the two roots differ, merge the sets by pointing one root at the other. After processing every edge, nodes that ended up sharing the same root belong to the same connected component.\n\nFinally, count the number of distinct roots across all `n` nodes (by calling find on each node and collecting the results into a set) — that count is the number of connected components.\n\nEquivalently, you could run a DFS or BFS from every unvisited node, marking all reachable nodes as visited and incrementing a counter once per starting node; both approaches run in roughly linear time relative to the number of nodes and edges.\n\nWatch out for the edge cases of `n = 0` (zero components) and an empty edge list (every node is its own component).",
      timeComplexity: "O(n + e)",
      spaceComplexity: "O(n)",
    },
    solution: {
      approachName: "Union-Find (disjoint set union)",
      time: "O(n + e)",
      space: "O(n)",
      python: "parent = list(range(n))\n\ndef find(x):\n    while parent[x] != x:\n        parent[x] = parent[parent[x]]\n        x = parent[x]\n    return x\n\ni = 0\nwhile i < len(edges):\n    a, b = edges[i], edges[i + 1]\n    ra, rb = find(a), find(b)\n    if ra != rb:\n        parent[ra] = rb\n    i += 2\n\nreturn len(set(find(x) for x in range(n)))",
    },
  },
  {
    slug: "flood-fill-region",
    title: "Flood Fill Region",
    difficulty: "EASY",
    topics: [
      "graphs",
      "dfs",
      "matrix",
    ],
    companies: [
      {
        slug: "amazon",
        frequency: 20,
      },
      {
        slug: "microsoft",
        frequency: 12,
      },
      {
        slug: "adobe",
        frequency: 8,
      },
    ],
    statement: "You are given a grid of single-digit colors (`0`-`9`), a starting cell `(startRow, startCol)`, and a `newColor` digit.\n\nPerform a classic **flood fill** starting from the given cell: look at the color of the starting cell, and change that cell and every cell reachable from it via 4-directional moves (up/down/left/right) through cells of the **same original color** to `newColor`. Cells of any other color act as boundaries and stop the fill.\n\nIf `newColor` is the same as the starting cell's original color, the grid does not change at all (this avoids an infinite fill).\n\nSince the result must be returned as a single string, concatenate the resulting grid's rows, one after another (row 0 first, then row 1, and so on), with no separators.\n\n### Input format\n- Line 1: two integers, the number of rows `R` and columns `C`\n- Next `R` lines: each line has `C` digit characters (one row of the grid)\n- Next line: `startRow`\n- Next line: `startCol`\n- Next line: `newColor`\n\n### Output format\nPrint a single string: all rows of the resulting grid concatenated together, in row order.",
    statementDigest: "Given a digit grid and a starting cell, flood-fill the same-colored connected region with a new color and return the flattened resulting grid as a string.",
    constraints: "- `1 <= R, C <= 50`\n- Every grid cell is a digit character `0`-`9`\n- `0 <= startRow < R`, `0 <= startCol < C`\n- `0 <= newColor <= 9`",
    constraintsDigest: "The grid is at most 50x50 with single-digit cell colors, and newColor is a single digit.",
    expectedTime: "O(R*C)",
    expectedSpace: "O(R*C)",
    io: {
      fn: "floodFillFlat",
      params: [
        {
          name: "grid",
          type: "grid",
        },
        {
          name: "startRow",
          type: "int",
        },
        {
          name: "startCol",
          type: "int",
        },
        {
          name: "newColor",
          type: "int",
        },
      ],
      returns: "str",
    },
    examples: [
      {
        input: "3 3\n111\n110\n101\n1\n1\n2",
        output: "222220201",
        explanation: "Starting at (1,1) with color 1, the connected region of 1's — (1,1),(0,1),(1,0),(0,0),(0,2),(2,0) — all turn into 2. The isolated 1 at (2,2) and the 0's are untouched, giving rows \"222\",\"220\",\"201\".",
      },
      {
        input: "2 2\n00\n00\n0\n0\n0",
        output: "0000",
        explanation: "newColor (0) equals the starting cell's color, so the grid is returned unchanged.",
      },
    ],
    sampleTests: [
      {
        input: "3 3\n111\n110\n101\n1\n1\n2",
      },
      {
        input: "2 2\n00\n00\n0\n0\n0",
      },
      {
        input: "1 1\n5\n0\n0\n9",
      },
    ],
    hiddenTests: [
      {
        input: "1 1\n7\n0\n0\n7",
      },
      {
        input: "1 1\n7\n0\n0\n3",
      },
      {
        input: "2 2\n11\n11\n0\n0\n5",
      },
      {
        input: "4 4\n0000\n0110\n0110\n0000\n1\n1\n9",
      },
      {
        input: "3 3\n121\n222\n121\n0\n0\n9",
      },
      {
        input: "3 3\n222\n222\n222\n1\n1\n2",
      },
    ],
    hints: [
      "This is the same idea as filling a bucket of paint in an image editor — spread outward from a click point while the color stays the same.",
      "Explore 4-directionally from the start using DFS or BFS, only continuing into cells matching the original color.",
      "Guard against the no-op case where newColor equals the original color, otherwise a naive recursive fill can loop forever.",
    ],
    editorial: {
      approachSummary: "DFS/BFS flood fill from the start cell, replacing same-colored connected cells.",
      content: "This is the classic 'paint bucket' flood fill. First record the color of the starting cell — this is the only color that should be overwritten. If the requested `newColor` is identical to this original color, there is nothing to do, and returning immediately also avoids an infinite fill (since a naive fill would otherwise keep 're-filling' already-matching cells forever).\n\nOtherwise, explore outward from the start cell using DFS or BFS (an explicit stack or queue is safer than recursion for larger grids, avoiding recursion-depth issues). At each visited cell, first check that it is within grid bounds and still has the original color; if so, repaint it to `newColor` and push its four neighbors (up, down, left, right) onto the stack/queue for further exploration. Cells that don't match the original color act as natural boundaries and are simply skipped.\n\nOnce exploration finishes, every cell reachable from the start through same-colored neighbors has been repainted, and the rest of the grid is untouched. Since the return type must be a flat string, join every row's characters together and concatenate all rows in order (row 0, then row 1, and so on) to produce the final output.\n\nThis visits each cell at most once, so it runs in time and space proportional to the number of cells in the grid.",
      timeComplexity: "O(R*C)",
      spaceComplexity: "O(R*C)",
    },
    solution: {
      approachName: "Iterative DFS flood fill",
      time: "O(R*C)",
      space: "O(R*C)",
      python: "R = len(grid)\nC = len(grid[0]) if R > 0 else 0\nstart_color = grid[startRow][startCol]\nnew_color_ch = str(newColor)\nif start_color != new_color_ch:\n    stack = [(startRow, startCol)]\n    while stack:\n        r, c = stack.pop()\n        if 0 <= r < R and 0 <= c < C and grid[r][c] == start_color:\n            grid[r][c] = new_color_ch\n            stack.append((r + 1, c))\n            stack.append((r - 1, c))\n            stack.append((r, c + 1))\n            stack.append((r, c - 1))\nreturn ''.join(''.join(row) for row in grid)",
    },
  },
  {
    slug: "clone-graph-adjacency-count",
    title: "Largest Component Edge Count",
    difficulty: "MEDIUM",
    topics: [
      "graphs",
      "dfs",
      "bfs",
    ],
    companies: [
      {
        slug: "meta",
        frequency: 18,
      },
      {
        slug: "google",
        frequency: 14,
      },
      {
        slug: "uber",
        frequency: 9,
      },
    ],
    statement: "You are given an undirected graph with `n` nodes labeled `0` to `n - 1`, described as a flat list of edges `edges = [a1, b1, a2, b2, ...]`, where each consecutive pair `(ai, bi)` is an undirected edge (this mirrors the classic 'clone graph' setup, just encoded so it fits a flat integer array).\n\nFind the connected component with the greatest number of nodes, and return the number of edges contained entirely within that component. (If there is a tie for largest by node count, use the first such component encountered when scanning node labels from `0` upward.)\n\n### Input format\n- Line 1: the integer `n`\n- Line 2: space-separated integers of `edges` (this line may be empty if there are no edges)\n\n### Output format\nPrint a single integer: the number of edges inside the largest connected component.",
    statementDigest: "Given n nodes and a flat undirected edge list, find the connected component with the most nodes and return how many edges lie within it.",
    constraints: "- `0 <= n <= 2000`\n- `edges.length` is even, and `0 <= edges.length / 2 <= 5000`\n- Each value in `edges` is a valid node label in `[0, n - 1]`\n- The graph has no self-loops",
    constraintsDigest: "Up to 2000 nodes and 5000 edges, given as a flat even-length integer array with valid node labels.",
    expectedTime: "O(n + e)",
    expectedSpace: "O(n + e)",
    io: {
      fn: "largestComponentEdgeCount",
      params: [
        {
          name: "n",
          type: "int",
        },
        {
          name: "edges",
          type: "int[]",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "5\n0 1 1 2 3 4",
        output: "2",
        explanation: "Component {0,1,2} has 3 nodes and 2 edges; component {3,4} has 2 nodes and 1 edge. The largest by node count is {0,1,2}, which has 2 edges.",
      },
      {
        input: "4\n0 1 0 2 0 3",
        output: "3",
        explanation: "All 4 nodes form a single star-shaped component with 3 edges.",
      },
    ],
    sampleTests: [
      {
        input: "5\n0 1 1 2 3 4",
      },
      {
        input: "4\n0 1 0 2 0 3",
      },
      {
        input: "6\n",
      },
    ],
    hiddenTests: [
      {
        input: "1\n",
      },
      {
        input: "0\n",
      },
      {
        input: "3\n0 1 1 2 0 2",
      },
      {
        input: "7\n0 1 2 3 2 4 5 6",
      },
      {
        input: "5\n0 1 2 3",
      },
      {
        input: "2\n0 1",
      },
    ],
    hints: [
      "Build an adjacency list first, then explore the graph one component at a time.",
      "Track which component each node belongs to (via DFS/BFS) and remember each component's node count as you go.",
      "For the biggest component, sum the degrees of its nodes and divide by two to get its edge count.",
    ],
    editorial: {
      approachSummary: "Build an adjacency list, find connected components via DFS/BFS, and compute the largest one's edge count.",
      content: "Start by building an adjacency list from the flat edge array: walk through `edges` two elements at a time, and for each pair `(a, b)` add `b` to `a`'s neighbor list and `a` to `b`'s neighbor list (since the graph is undirected).\n\nThen iterate over every node from `0` to `n - 1`. Whenever you find a node that hasn't been visited yet, it's the start of a new connected component — explore it fully with DFS or BFS, marking every reachable node as visited and collecting all the nodes that belong to this component.\n\nFor each component, its size is simply the number of nodes collected. Its number of edges can be computed without re-walking the edge list: sum the degree (adjacency list length) of every node in the component, then divide by two, since every edge inside the component is counted exactly twice (once from each endpoint).\n\nKeep track of the largest component seen so far by node count, and remember its edge count. After all nodes have been visited, the tracked edge count for the largest component is the answer. Isolated nodes form their own trivial components with zero edges, handled naturally without special casing.",
      timeComplexity: "O(n + e)",
      spaceComplexity: "O(n + e)",
    },
    solution: {
      approachName: "DFS component sizing",
      time: "O(n + e)",
      space: "O(n + e)",
      python: "from collections import defaultdict\n\nadj = defaultdict(list)\ni = 0\nwhile i < len(edges):\n    a, b = edges[i], edges[i + 1]\n    adj[a].append(b)\n    adj[b].append(a)\n    i += 2\n\nvisited = [False] * n\nbest_size = -1\nbest_edges = 0\nfor start in range(n):\n    if not visited[start]:\n        stack = [start]\n        visited[start] = True\n        comp_nodes = []\n        while stack:\n            u = stack.pop()\n            comp_nodes.append(u)\n            for v in adj[u]:\n                if not visited[v]:\n                    visited[v] = True\n                    stack.append(v)\n        comp_edge_count = sum(len(adj[u]) for u in comp_nodes) // 2\n        if len(comp_nodes) > best_size:\n            best_size = len(comp_nodes)\n            best_edges = comp_edge_count\nreturn best_edges",
    },
  },
  {
    slug: "shortest-path-unweighted-grid",
    title: "Shortest Path in Unweighted Grid",
    difficulty: "MEDIUM",
    topics: [
      "graphs",
      "bfs",
      "matrix",
    ],
    companies: [
      {
        slug: "amazon",
        frequency: 22,
      },
      {
        slug: "google",
        frequency: 16,
      },
      {
        slug: "bloomberg",
        frequency: 10,
      },
    ],
    statement: "You are given a grid of characters where `.` represents an open cell and `#` represents a wall, along with a start cell `(startRow, startCol)` and an end cell `(endRow, endCol)`.\n\nMoving one step at a time in the 4 cardinal directions (up/down/left/right) through open cells only, return the length of the shortest path from the start cell to the end cell, measured in number of steps. If no such path exists, return `-1`.\n\nIf the start cell equals the end cell, the answer is `0`. If either the start or end cell is itself a wall, the answer is `-1`.\n\n### Input format\n- Line 1: two integers, the number of rows `R` and columns `C`\n- Next `R` lines: each line has `C` characters (`.` or `#`), one row of the grid\n- Next line: `startRow`\n- Next line: `startCol`\n- Next line: `endRow`\n- Next line: `endCol`\n\n### Output format\nPrint a single integer: the length of the shortest path, or `-1` if unreachable.",
    statementDigest: "Given a grid of open cells and walls plus start and end coordinates, find the shortest 4-directional path length via BFS, or -1 if unreachable.",
    constraints: "- `1 <= R, C <= 100`\n- Every grid cell is either `.` or `#`\n- `0 <= startRow, endRow < R`, `0 <= startCol, endCol < C`",
    constraintsDigest: "The grid is at most 100x100 with cells that are either open ('.') or wall ('#').",
    expectedTime: "O(R*C)",
    expectedSpace: "O(R*C)",
    io: {
      fn: "shortestPathLength",
      params: [
        {
          name: "grid",
          type: "grid",
        },
        {
          name: "startRow",
          type: "int",
        },
        {
          name: "startCol",
          type: "int",
        },
        {
          name: "endRow",
          type: "int",
        },
        {
          name: "endCol",
          type: "int",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "3 3\n...\n.#.\n...\n0\n0\n2\n2",
        output: "4",
        explanation: "The center cell (1,1) is a wall, so the shortest route from (0,0) to (2,2) must go around it, taking 4 steps, e.g. (0,0)->(0,1)->(0,2)->(1,2)->(2,2).",
      },
      {
        input: "3 3\n.#.\n###\n.#.\n0\n0\n2\n2",
        output: "-1",
        explanation: "(0,0)'s only open neighbors would be (0,1) and (1,0), which are both walls, so it cannot reach any other cell.",
      },
    ],
    sampleTests: [
      {
        input: "3 3\n...\n.#.\n...\n0\n0\n2\n2",
      },
      {
        input: "3 3\n.#.\n###\n.#.\n0\n0\n2\n2",
      },
      {
        input: "1 1\n.\n0\n0\n0\n0",
      },
    ],
    hiddenTests: [
      {
        input: "1 1\n.\n0\n0\n0\n0",
      },
      {
        input: "2 2\n#.\n..\n0\n0\n1\n1",
      },
      {
        input: "2 2\n..\n.#\n0\n0\n1\n1",
      },
      {
        input: "1 4\n....\n0\n0\n0\n3",
      },
      {
        input: "3 4\n....\n.##.\n....\n1\n0\n1\n3",
      },
      {
        input: "3 3\n.#.\n.#.\n.#.\n0\n0\n0\n2",
      },
    ],
    hints: [
      "This is a classic shortest-path-on-a-grid problem where every move costs the same.",
      "When all edges have equal weight, breadth-first search explores cells in order of increasing distance.",
      "BFS from the start cell, tracking visited cells and distance, and stop as soon as the end cell is discovered.",
    ],
    editorial: {
      approachSummary: "BFS from the start cell; the first time the end cell is reached gives the shortest distance.",
      content: "Because every move between adjacent open cells costs exactly one step, this is a textbook application of breadth-first search: BFS explores cells in strictly increasing order of distance from the source, so the first time it reaches the target cell, it has found the shortest possible path.\n\nFirst handle the trivial and impossible cases directly: if either the start or the end cell is a wall, no path can exist, so return `-1` immediately; if the start and end cells are the same, the answer is `0` steps with no movement required.\n\nOtherwise, initialize a queue with the start cell at distance `0`, and a visited grid to avoid revisiting cells (which would otherwise cause cycles and wasted work). Repeatedly pop a cell from the front of the queue, and for each of its four neighbors that is in-bounds, open (not a wall), and not yet visited: if that neighbor is the end cell, its distance (current distance + 1) is the answer and can be returned right away; otherwise, mark it visited and enqueue it with distance + 1.\n\nIf the queue empties without ever reaching the end cell, no path exists, and the function returns `-1`. This explores each cell at most once, giving time and space proportional to the number of cells in the grid.",
      timeComplexity: "O(R*C)",
      spaceComplexity: "O(R*C)",
    },
    solution: {
      approachName: "Breadth-first search",
      time: "O(R*C)",
      space: "O(R*C)",
      python: "from collections import deque\n\nR = len(grid)\nC = len(grid[0]) if R > 0 else 0\nif grid[startRow][startCol] == '#' or grid[endRow][endCol] == '#':\n    return -1\nif startRow == endRow and startCol == endCol:\n    return 0\nvisited = [[False] * C for _ in range(R)]\nvisited[startRow][startCol] = True\nq = deque([(startRow, startCol, 0)])\nwhile q:\n    r, c, d = q.popleft()\n    for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):\n        nr, nc = r + dr, c + dc\n        if 0 <= nr < R and 0 <= nc < C and not visited[nr][nc] and grid[nr][nc] != '#':\n            if nr == endRow and nc == endCol:\n                return d + 1\n            visited[nr][nc] = True\n            q.append((nr, nc, d + 1))\nreturn -1",
    },
  },
  {
    slug: "k-closest-points-to-origin",
    title: "K Closest Points to Origin (Sum of Squared Distances)",
    difficulty: "MEDIUM",
    topics: [
      "heaps-and-top-k",
      "arrays",
      "sorting",
    ],
    companies: [
      {
        slug: "amazon",
        frequency: 18,
      },
      {
        slug: "google",
        frequency: 14,
      },
      {
        slug: "meta",
        frequency: 10,
      },
      {
        slug: "bloomberg",
        frequency: 8,
      },
    ],
    statement: "You are given a flat integer array `points` representing 2D points on a plane, where the point at index `i` has coordinates `(points[2*i], points[2*i+1])`. In other words, `points = [x1, y1, x2, y2, ..., xn, yn]`.\n\nGiven an integer `k`, find the `k` points that are closest to the origin `(0, 0)`, where distance is measured by the standard Euclidean distance. Since a list of points cannot be returned directly, return the SUM of the squared distances (`x*x + y*y`) of the `k` closest points.\n\nIf multiple points are tied at the same squared distance from the origin, any of them may be considered among the `k` closest — the sum is unaffected by which tied point you pick, since they contribute the same distance value regardless.\n\n### Input format\nLine 1: the flat array `points`, space-separated integers.\nLine 2: the integer `k`.\n\n### Output format\nA single integer: the sum of squared distances of the `k` closest points to the origin.",
    statementDigest: "Given points packed into a flat array and an integer k, return the sum of squared distances of the k points closest to the origin.",
    constraints: "- `1 <= n <= 1000` where `n` is the number of points (so `points.length == 2*n`)\n- `-10000 <= points[i] <= 10000`\n- `1 <= k <= n`",
    constraintsDigest: "Up to 1000 points with coordinates in [-10000, 10000], and 1 <= k <= number of points.",
    expectedTime: "O(n log k)",
    expectedSpace: "O(k)",
    io: {
      fn: "sumOfKClosestSquaredDistances",
      params: [
        {
          name: "points",
          type: "int[]",
        },
        {
          name: "k",
          type: "int",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "1 3 -2 2\n1",
        output: "8",
        explanation: "Point (1,3) has squared distance 10, point (-2,2) has squared distance 8. The closest 1 point is (-2,2), so the answer is 8.",
      },
      {
        input: "3 3 5 -1 -2 4\n2",
        output: "38",
        explanation: "Squared distances are 18, 26, and 20. The 2 smallest are 18 and 20, summing to 38.",
      },
    ],
    sampleTests: [
      {
        input: "1 3 -2 2\n1",
      },
      {
        input: "3 3 5 -1 -2 4\n2",
      },
      {
        input: "0 0 1 1 2 2 3 3\n3",
      },
    ],
    hiddenTests: [
      {
        input: "5 5\n1",
      },
      {
        input: "-3 -4 0 5 6 -8\n2",
      },
      {
        input: "1 1 2 2 3 3\n3",
      },
      {
        input: "10 0 -10 0 0 10 0 -10\n2",
      },
      {
        input: "0 0 0 0 0 0\n2",
      },
    ],
    hints: [
      "Think about how you'd efficiently keep track of only the smallest few distances seen so far, without sorting everything.",
      "A fixed-size heap that always evicts its worst element once it grows past size k is a natural fit here.",
      "Use a max-heap of size k on squared distances: push each point's distance, and pop the largest whenever the heap exceeds k. Sum what remains.",
    ],
    editorial: {
      approachSummary: "Maintain a max-heap of size k over squared distances, then sum the heap.",
      content: "The key realization is that we never need the actual sorted order of all n points — we only need to identify the k with the smallest squared distance and combine them into a single number.\n\nCompute the squared distance `x*x + y*y` for each point (this avoids costly floating-point square roots and preserves ordering). Then maintain a max-heap of size at most k: push each new distance, and whenever the heap's size exceeds k, pop the maximum. After processing all points, the heap contains exactly the k smallest squared distances, and their sum is the answer.\n\nThis runs in `O(n log k)` time since each push/pop on a heap of size k costs `O(log k)`, compared to `O(n log n)` for a full sort. Space is `O(k)` for the heap.\n\nAn equally valid approach for this input size is to just sort all n distances and sum the first k — `O(n log n)` time — since n is capped at 1000 in this problem; the heap approach is the one that scales to much larger n and is the intended technique for this topic.",
      timeComplexity: "O(n log k)",
      spaceComplexity: "O(k)",
    },
    solution: {
      approachName: "Max-heap of size k over squared distances",
      time: "O(n log k)",
      space: "O(k)",
      python: "n = len(points) // 2\ndists = []\nfor i in range(n):\n    x = points[2 * i]\n    y = points[2 * i + 1]\n    dists.append(x * x + y * y)\ndists.sort()\nreturn sum(dists[:k])",
    },
  },
  {
    slug: "word-break-count-ways",
    title: "Word Break - Count Ways",
    difficulty: "MEDIUM",
    topics: [
      "backtracking-search",
      "dynamic-programming",
      "strings",
    ],
    companies: [
      {
        slug: "google",
        frequency: 12,
      },
      {
        slug: "amazon",
        frequency: 10,
      },
      {
        slug: "microsoft",
        frequency: 9,
      },
      {
        slug: "uber",
        frequency: 6,
      },
    ],
    statement: "Given a string `s` and a dictionary of words `wordDict` (as an array of strings), count the number of distinct ways to segment `s` into a sequence of one or more dictionary words placed back-to-back, using the words in order to exactly reconstruct `s`.\n\nTwo segmentations are considered different if the sequence of split points differs, even if the resulting words are the same. Words in `wordDict` may be reused any number of times, and not all words need to be used.\n\n### Input format\nLine 1: the string `s`.\nLine 2: the dictionary words `wordDict`, space-separated.\n\n### Output format\nA single integer: the number of distinct ways to segment `s` into dictionary words. If there is no valid segmentation, output `0`.",
    statementDigest: "Count the number of distinct ways to split string s into a sequence of words from wordDict that exactly reconstructs s.",
    constraints: "- `1 <= s.length <= 30`\n- `1 <= wordDict.length <= 20`\n- `1 <= wordDict[i].length <= 20`\n- `s` and all words in `wordDict` consist of lowercase English letters only\n- The number of ways fits comfortably within a 32-bit signed integer",
    constraintsDigest: "s has at most 30 lowercase letters and wordDict has at most 20 lowercase words, with the answer guaranteed to fit in a normal integer.",
    expectedTime: "O(n^2) amortized with memoization (n = s.length), plus word-lookup cost",
    expectedSpace: "O(n)",
    io: {
      fn: "countWordBreakWays",
      params: [
        {
          name: "s",
          type: "str",
        },
        {
          name: "wordDict",
          type: "str[]",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "catsanddog\ncat cats and sand dog",
        output: "2",
        explanation: "s can be segmented as \"cat sand dog\" or \"cats and dog\" — 2 distinct ways.",
      },
      {
        input: "aaaa\na aa aaa",
        output: "7",
        explanation: "Using words a, aa, aaa there are 7 distinct ways to split \"aaaa\": a-a-a-a, a-a-aa, a-aa-a, aa-a-a, aa-aa, a-aaa, aaa-a.",
      },
    ],
    sampleTests: [
      {
        input: "catsanddog\ncat cats and sand dog",
      },
      {
        input: "aaaa\na aa aaa",
      },
      {
        input: "abcd\nab cde",
      },
    ],
    hiddenTests: [
      {
        input: "abcd\nab cde",
      },
      {
        input: "pineapplepenapple\napple pen applepen pine pineapple",
      },
      {
        input: "leetcode\nleet code",
      },
      {
        input: "ab\na b ab",
      },
      {
        input: "aaaaaaaaaaaaaaa\na aa",
      },
    ],
    hints: [
      "Try building the segmentation from the front: at each position, ask which dictionary words could start there.",
      "Naive recursion re-explores the same suffix of the string many times — think about caching results keyed by starting index.",
      "Define f(i) = number of ways to segment s[i:]. Recurse over every prefix of s[i:] that's a dictionary word, memoizing on i.",
    ],
    editorial: {
      approachSummary: "Top-down memoized recursion counting segmentations from each starting index.",
      content: "Define `f(i)` as the number of ways to segment the suffix `s[i:]` into dictionary words, with the base case `f(n) = 1` (the empty suffix has exactly one — trivial — segmentation). For a given index `i`, try every end index `j > i` and check whether `s[i:j]` is a word in the dictionary; if so, add `f(j)` to the total for `f(i)`.\n\nBecause the same suffix start index can be reached via many different split paths (this is the counting variant, not the yes/no decision version), a plain recursion re-derives `f(i)` repeatedly — memoizing on `i` turns this into an efficient dynamic program. Converting the dictionary to a set first makes the substring-membership check `O(1)` on average.\n\nThe answer is `f(0)`. With `s` capped at length 30 and the dictionary capped at 20 short words, this runs comfortably fast: there are only `O(n)` distinct subproblems, each doing `O(n)` work to try every split point, giving `O(n^2)` overall (ignoring substring-slicing cost). This is exactly the counting cousin of the classic Word Break decision problem — same recursive shape, but summing instead of OR-ing the sub-results.",
      timeComplexity: "O(n^2)",
      spaceComplexity: "O(n)",
    },
    solution: {
      approachName: "Memoized recursion (top-down DP) over suffix start index",
      time: "O(n^2)",
      space: "O(n)",
      python: "word_set = set(wordDict)\nn = len(s)\nmemo = {}\n\ndef dfs(i):\n    if i == n:\n        return 1\n    if i in memo:\n        return memo[i]\n    total = 0\n    for j in range(i + 1, n + 1):\n        if s[i:j] in word_set:\n            total += dfs(j)\n    memo[i] = total\n    return total\n\nreturn dfs(0)",
    },
  },
  {
    slug: "restore-ip-addresses-count",
    title: "Restore IP Addresses - Count Ways",
    difficulty: "MEDIUM",
    topics: [
      "backtracking-search",
      "strings",
    ],
    companies: [
      {
        slug: "amazon",
        frequency: 11,
      },
      {
        slug: "microsoft",
        frequency: 9,
      },
      {
        slug: "oracle",
        frequency: 6,
      },
      {
        slug: "adobe",
        frequency: 5,
      },
    ],
    statement: "Given a string `s` consisting only of digits, count the number of ways to split `s` into exactly 4 segments that together form a valid IPv4 address (using all of the characters of `s`, in order, with nothing left over).\n\nA segment is valid if it satisfies all of the following:\n- It has between 1 and 3 digits.\n- Its integer value is between 0 and 255 (inclusive).\n- It has no leading zero, unless the segment is exactly \"0\" itself (so \"0\" is valid but \"00\", \"01\", \"012\" are not).\n\n### Input format\nLine 1: the digit string `s`.\n\n### Output format\nA single integer: the number of ways to split `s` into 4 valid IPv4 segments. If none exist, output `0`.",
    statementDigest: "Count the number of ways to split a digit string into 4 valid IPv4 segments using every character exactly once, in order.",
    constraints: "- `1 <= s.length <= 15`\n- `s` consists only of digit characters `0`-`9`",
    constraintsDigest: "s is a digit-only string of length at most 15.",
    expectedTime: "O(1) (bounded backtracking over at most 3 choices per segment, 4 segments)",
    expectedSpace: "O(1)",
    io: {
      fn: "countValidIpAddresses",
      params: [
        {
          name: "s",
          type: "str",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "25525511135",
        output: "2",
        explanation: "The two valid splits are 255.255.11.135 and 255.255.111.35.",
      },
      {
        input: "0000",
        output: "1",
        explanation: "The only valid split is 0.0.0.0 — any segment longer than 1 digit starting with '0' would be invalid.",
      },
    ],
    sampleTests: [
      {
        input: "25525511135",
      },
      {
        input: "0000",
      },
      {
        input: "00000",
      },
    ],
    hiddenTests: [
      {
        input: "00000",
      },
      {
        input: "255255255255",
      },
      {
        input: "1",
      },
      {
        input: "1111111111111",
      },
      {
        input: "19216811",
      },
    ],
    hints: [
      "Each of the 4 segments can only be 1, 2, or 3 characters long, so the search space is tiny — think about trying all combinations of segment boundaries.",
      "Backtrack over the position of the 3 internal split points, and validate each of the 4 resulting substrings independently.",
      "Fix three cut positions i < j < k splitting s into s[:i], s[i:j], s[j:k], s[k:]; count the combination if all four pieces pass the segment-validity check (length 1-3, no illegal leading zero, numeric value <= 255).",
    ],
    editorial: {
      approachSummary: "Backtrack over the 3 internal cut positions and validate each of the 4 resulting segments.",
      content: "Since each valid IPv4 segment has at most 3 digits, a full IPv4 address has at most 12 digits total, and the 3 cut points that separate it into 4 segments each lie within a window of at most 3 positions ahead of the previous cut. This makes brute-force enumeration of all cut positions cheap — at most `3 * 3 * 3 = 27` combinations to check regardless of how long `s` is.\n\nThe approach: choose the first cut `i` in `{1, 2, 3}`, the second cut `j` in `{i+1, i+2, i+3}`, and the third cut `k` in `{j+1, j+2, j+3}`, provided `k` still leaves at least one character for the final segment. This yields four substrings `s[:i]`, `s[i:j]`, `s[j:k]`, `s[k:]`. Validate each one: length between 1 and 3, no leading zero unless the segment is exactly \"0\", and numeric value at most 255. Count the combination if all four pass.\n\nThis is a classic constrained backtracking problem: the branching factor is capped at 3 per decision (not the length of the string), which is what keeps the whole search effectively constant-time regardless of input length. The same idea generalizes directly to the decision version (does any valid split exist?) by short-circuiting on the first success instead of counting all of them.",
      timeComplexity: "O(1)",
      spaceComplexity: "O(1)",
    },
    solution: {
      approachName: "Bounded backtracking over 3 internal cut positions",
      time: "O(1)",
      space: "O(1)",
      python: "n = len(s)\n\ndef valid(seg):\n    if len(seg) == 0 or len(seg) > 3:\n        return False\n    if seg[0] == '0' and len(seg) > 1:\n        return False\n    if int(seg) > 255:\n        return False\n    return True\n\ncount = 0\nfor i in range(1, 4):\n    for j in range(i + 1, i + 4):\n        for k in range(j + 1, j + 4):\n            if k < n:\n                a, b, c, d = s[:i], s[i:j], s[j:k], s[k:]\n                if valid(a) and valid(b) and valid(c) and valid(d):\n                    count += 1\nreturn count",
    },
  },
  {
    slug: "single-number-ii",
    title: "Single Number II",
    difficulty: "MEDIUM",
    topics: [
      "bit-manipulation",
      "arrays",
    ],
    companies: [
      {
        slug: "amazon",
        frequency: 13,
      },
      {
        slug: "microsoft",
        frequency: 9,
      },
      {
        slug: "apple",
        frequency: 7,
      },
      {
        slug: "nvidia",
        frequency: 5,
      },
    ],
    statement: "You are given an integer array `nums` in which every element appears exactly three times, except for one element which appears exactly once. Find and return that single element.\n\nYour solution should use `O(1)` extra space (beyond the input) and avoid building any auxiliary hash map of counts — instead, use bitwise counting.\n\n### Input format\nLine 1: the array `nums`, space-separated integers (may include negative numbers).\n\n### Output format\nA single integer: the element that appears exactly once.",
    statementDigest: "Given an array where every element appears exactly three times except one that appears once, find that single element using bitwise counting rather than a hash map.",
    constraints: "- `1 <= nums.length <= 30000`\n- `nums.length % 3 == 1` (exactly one element is the singleton, all others appear exactly three times)\n- `-2^31 <= nums[i] <= 2^31 - 1`",
    constraintsDigest: "Up to 30000 32-bit signed integers, exactly one of which is not part of a triple.",
    expectedTime: "O(32n) = O(n)",
    expectedSpace: "O(1)",
    io: {
      fn: "singleNumberTriple",
      params: [
        {
          name: "nums",
          type: "int[]",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "2 2 3 2",
        output: "3",
        explanation: "2 appears three times and 3 appears once, so 3 is the answer.",
      },
      {
        input: "3 3 3 -7",
        output: "-7",
        explanation: "3 appears three times and -7 appears once; bitwise counting mod 3, interpreted as a 32-bit two's-complement value, correctly recovers the negative singleton -7.",
      },
    ],
    sampleTests: [
      {
        input: "2 2 3 2",
      },
      {
        input: "3 3 3 -7",
      },
      {
        input: "0 1 0 1 0 1 99",
      },
    ],
    hiddenTests: [
      {
        input: "5 5 5 -1 -1 -1 -8",
      },
      {
        input: "1 1 1 2 2 2 -3 -3 -3 -99",
      },
      {
        input: "100 100 100 7",
      },
      {
        input: "-2 -2 -2 -1",
      },
      {
        input: "10 10 10 20 20 20 30 30 30 -15",
      },
    ],
    hints: [
      "XOR alone (which works when duplicates appear twice) doesn't help when duplicates appear three times — think about what property of triples survives at the level of individual bits.",
      "For each bit position, sum how many of the n numbers have that bit set; a bit belonging only to numbers appearing three times will always contribute a multiple of 3.",
      "For each of the 32 bit positions, count how many numbers have that bit set, take the count mod 3, and set that bit in the result if the remainder is 1. Handle negative numbers by treating each number as an unsigned 32-bit pattern during counting, then convert the final result back to a signed value.",
    ],
    editorial: {
      approachSummary: "Count set bits at each of the 32 bit positions mod 3; the nonzero remainders reconstruct the singleton.",
      content: "For every bit position independently, sum up how many of the n numbers have a 1 in that position. Since every number except the singleton appears exactly three times, its contribution to any bit-position's total is always a multiple of 3. So after summing, taking each position's total modulo 3 leaves exactly the singleton's bit pattern: a remainder of 1 means the singleton has a 1 there, a remainder of 0 means it has a 0 there (whether the count from triples was itself 0 or a multiple of 3 doesn't matter, since it vanishes mod 3).\n\nThe subtlety is negative numbers. Python integers don't have a fixed bit width, so a naive right-shift on a negative number behaves like an infinite two's-complement sign extension. To avoid that, mask every number with `0xFFFFFFFF` first to obtain its 32-bit unsigned bit pattern, then do all the bit counting on that unsigned value. Once the 32-bit result pattern is reconstructed from the mod-3 remainders, check if it's `>= 2^31` — if so, it represents a negative number in two's complement, so subtract `2^32` to convert it back to the correct signed Python integer.\n\nThis runs in `O(32n)`, i.e. linear time, using only a fixed 32-element counting array, so it's `O(1)` extra space.",
      timeComplexity: "O(n)",
      spaceComplexity: "O(1)",
    },
    solution: {
      approachName: "Per-bit counting mod 3 with 32-bit two's complement handling",
      time: "O(n)",
      space: "O(1)",
      python: "count = [0] * 32\nfor num in nums:\n    unsigned = num & 0xFFFFFFFF\n    for i in range(32):\n        if (unsigned >> i) & 1:\n            count[i] += 1\n\nresult = 0\nfor i in range(32):\n    if count[i] % 3 != 0:\n        result |= (1 << i)\n\nif result >= 2 ** 31:\n    result -= 2 ** 32\n\nreturn result",
    },
  },
  {
    slug: "reverse-bits-count",
    title: "Reverse Bits",
    difficulty: "EASY",
    topics: [
      "bit-manipulation",
    ],
    companies: [
      {
        slug: "apple",
        frequency: 10,
      },
      {
        slug: "google",
        frequency: 8,
      },
      {
        slug: "microsoft",
        frequency: 7,
      },
      {
        slug: "atlassian",
        frequency: 4,
      },
    ],
    statement: "Given a non-negative integer `n`, interpret it as a 32-bit unsigned integer and reverse the order of its bits. Return the resulting value, also interpreted as a 32-bit unsigned integer.\n\nFor example, the 32-bit representation of `1` is 31 zero bits followed by a single 1 bit; reversing it produces a single 1 bit followed by 31 zero bits, which is `2^31 = 2147483648`.\n\n### Input format\nLine 1: the integer `n`.\n\n### Output format\nA single integer: n's bits reversed, interpreted as an unsigned 32-bit value.",
    statementDigest: "Reverse the 32 bits of a non-negative integer n and return the resulting unsigned 32-bit value.",
    constraints: "- `0 <= n <= 4294967295` (n fits in 32 unsigned bits)",
    constraintsDigest: "n is a non-negative integer that fits in 32 bits.",
    expectedTime: "O(32) = O(1)",
    expectedSpace: "O(1)",
    io: {
      fn: "reverseBits32",
      params: [
        {
          name: "n",
          type: "int",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "1",
        output: "2147483648",
        explanation: "1 is a single set bit at position 0 (the least significant bit); reversed, that bit moves to position 31, giving 2^31 = 2147483648.",
      },
      {
        input: "43261596",
        output: "964176192",
        explanation: "Reversing the 32-bit pattern of 43261596 bit-by-bit produces 964176192.",
      },
    ],
    sampleTests: [
      {
        input: "1",
      },
      {
        input: "43261596",
      },
      {
        input: "0",
      },
    ],
    hiddenTests: [
      {
        input: "0",
      },
      {
        input: "4294967295",
      },
      {
        input: "2147483648",
      },
      {
        input: "2",
      },
      {
        input: "3",
      },
    ],
    hints: [
      "Think about processing the number one bit at a time, from the least significant bit to the most significant bit.",
      "As you peel off each bit from one end, you're placing it into the mirrored position at the other end of a 32-bit result.",
      "For each bit position i from 0 to 31, extract bit i of n with a shift-and-mask, then OR it into position (31 - i) of the result.",
    ],
    editorial: {
      approachSummary: "Extract each of the 32 bits one at a time and place it at its mirrored position.",
      content: "A 32-bit number has bit positions 0 (least significant) through 31 (most significant). Reversing the bits means the value that was at position `i` should end up at position `31 - i`.\n\nLoop `i` from 0 to 31. On each iteration, extract bit `i` of `n` using `(n >> i) & 1`, then OR that bit, shifted left by `31 - i`, into an accumulator result. After all 32 iterations, the accumulator holds the fully bit-reversed value.\n\nBecause Python integers are arbitrary precision, no explicit masking to 32 bits is needed here as long as the loop is bounded to exactly 32 iterations and the input is guaranteed non-negative and within the 32-bit unsigned range — the accumulated result naturally stays within `[0, 2^32 - 1]`.\n\nThis runs in constant time (exactly 32 loop iterations) and constant space, regardless of the magnitude of `n`. It's a foundational bit-manipulation pattern — extract-and-place — that generalizes to related tasks like counting set bits, computing bit parity, or building fixed-width bit-manipulation instructions in low-level systems code.",
      timeComplexity: "O(1)",
      spaceComplexity: "O(1)",
    },
    solution: {
      approachName: "Bit-by-bit extraction and mirrored placement",
      time: "O(1)",
      space: "O(1)",
      python: "result = 0\nfor i in range(32):\n    bit = (n >> i) & 1\n    result |= (bit << (31 - i))\nreturn result",
    },
  },
  {
    slug: "number-of-provinces-union-find",
    title: "Number of Provinces (Union-Find)",
    difficulty: "MEDIUM",
    topics: [
      "union-find",
      "graph-connectivity",
    ],
    companies: [
      {
        slug: "amazon",
        frequency: 18,
      },
      {
        slug: "google",
        frequency: 15,
      },
      {
        slug: "microsoft",
        frequency: 12,
      },
    ],
    statement: "### Problem\nYou are given `n` cities numbered `0` to `n-1` and a flattened `n x n` adjacency matrix `isConnected`, where `isConnected[i*n+j] == 1` means city `i` and city `j` are directly connected by a road (and `isConnected[i*n+j] == 0` otherwise). The matrix is symmetric, and every diagonal entry `isConnected[i*n+i]` is `1`.\n\nA **province** is a group of cities that are directly or indirectly connected, with no city in the group connected to any city outside it. Return the total number of provinces.\n\nYou must solve this using the **Union-Find (Disjoint Set Union)** data structure explicitly, rather than a graph traversal such as DFS or BFS.\n\n### Input format\n- Line 1: integer `n`\n- Line 2: `n * n` space-separated integers — the flattened row-major adjacency matrix `isConnected`\n\n### Output format\n- A single integer — the number of provinces.",
    statementDigest: "Given a flattened n x n adjacency matrix of cities, return the number of connected components (provinces) using Union-Find.",
    constraints: "- `1 <= n <= 200`\n- `isConnected` has exactly `n * n` entries, each `0` or `1`\n- `isConnected[i*n+i] = 1` for every `i`\n- `isConnected[i*n+j] = isConnected[j*n+i]` for every `i, j`",
    constraintsDigest: "n is at most 200 and the matrix is a valid symmetric 0/1 adjacency matrix with 1s on the diagonal.",
    expectedTime: "O(n^2 * alpha(n))",
    expectedSpace: "O(n)",
    io: {
      fn: "countProvincesUnionFind",
      params: [
        {
          name: "n",
          type: "int",
        },
        {
          name: "isConnected",
          type: "int[]",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "3\n1 1 0 1 1 0 0 0 1",
        output: "2",
        explanation: "Cities 0 and 1 are connected, forming one province; city 2 is isolated, forming a second province.",
      },
      {
        input: "3\n1 0 0 0 1 0 0 0 1",
        output: "3",
        explanation: "No city is connected to any other city, so each of the 3 cities is its own province.",
      },
    ],
    sampleTests: [
      {
        input: "1\n1",
      },
      {
        input: "2\n1 0 0 1",
      },
      {
        input: "4\n1 1 0 0 1 1 0 0 0 0 1 1 0 0 1 1",
      },
    ],
    hiddenTests: [
      {
        input: "5\n1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1",
      },
      {
        input: "6\n1 1 0 0 0 0 1 1 1 0 0 0 0 1 1 0 0 0 0 0 0 1 1 0 0 0 0 1 1 0 0 0 0 0 0 1",
      },
      {
        input: "3\n1 1 1 1 1 1 1 1 1",
      },
      {
        input: "4\n1 0 0 1 0 1 1 0 0 1 1 0 1 0 0 1",
      },
      {
        input: "7\n1 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0 1",
      },
    ],
    hints: [
      "Think about which cities end up grouped together as you sweep through the matrix, rather than exploring the graph outward from one city at a time.",
      "A structure that lets you merge two cities into the same group whenever a direct connection is found, and quickly tell whether two cities are already in the same group, fits this problem well.",
      "Use Union-Find: initialize each city as its own parent, call union(i, j) whenever isConnected[i*n+j] == 1, then count the number of distinct roots via find().",
    ],
    editorial: {
      approachSummary: "Union-Find: merge every pair of directly connected cities, then count the distinct roots.",
      content: "The key insight is that \"province\" is exactly the notion of a connected component, and Union-Find (Disjoint Set Union) is built precisely for maintaining and merging components incrementally.\n\nStart by giving each of the `n` cities its own parent pointer, so every city begins as its own component. Then scan every entry of the flattened matrix; whenever `isConnected[i*n+j] == 1`, union the components containing `i` and `j`. Using `find` with path compression keeps each lookup nearly constant time, and unioning by simply attaching one root to the other keeps the implementation simple while still being efficient at this input size.\n\nAfter processing all `n^2` matrix entries, every city's root pointer identifies which province it belongs to. Running `find` once more on every city and collecting the distinct roots into a set gives the number of provinces directly — no separate traversal is needed.\n\nThis differs from a DFS/BFS solution mainly in how connectivity is discovered: instead of explicitly walking the graph, Union-Find builds up the same components incrementally through merges, which generalizes well to online/streaming connectivity queries and is a core technique worth practicing on its own.",
      timeComplexity: "O(n^2 * alpha(n)) — scanning the matrix dominates, with near-constant find/union operations",
      spaceComplexity: "O(n) for the parent array",
    },
    solution: {
      approachName: "Union-Find (Disjoint Set Union)",
      time: "O(n^2 * alpha(n))",
      space: "O(n)",
      python: "parent = list(range(n))\n\ndef find(x):\n    while parent[x] != x:\n        parent[x] = parent[parent[x]]\n        x = parent[x]\n    return x\n\ndef union(x, y):\n    rx, ry = find(x), find(y)\n    if rx != ry:\n        parent[rx] = ry\n\nfor i in range(n):\n    for j in range(n):\n        if isConnected[i * n + j] == 1:\n            union(i, j)\n\nroots = set(find(i) for i in range(n))\nreturn len(roots)",
    },
  },
  {
    slug: "redundant-connection-ii",
    title: "Redundant Connection II",
    difficulty: "HARD",
    topics: [
      "union-find",
      "graph-connectivity",
      "trees",
    ],
    companies: [
      {
        slug: "google",
        frequency: 14,
      },
      {
        slug: "amazon",
        frequency: 12,
      },
      {
        slug: "bloomberg",
        frequency: 9,
      },
    ],
    statement: "### Problem\nA tree with `n` nodes labeled `1` to `n` originally had exactly `n - 1` undirected edges. One additional edge was then added, so the graph now has exactly `n` undirected edges and contains exactly one cycle.\n\nYou are given the edges in the order they were added, as a flattened array `edges = [u1, v1, u2, v2, ...]` (`n` pairs, `2n` integers). Find the one redundant edge — the edge that, if removed, restores a valid tree on the remaining `n - 1` edges. If more than one edge, scanned in input order, would qualify, return the one that occurs **last**.\n\nReturn the **sum of the two endpoints** of that redundant edge (i.e. `u + v`).\n\n> Note: this is the classic **undirected** \"Redundant Connection\" formulation — every edge is undirected, so there is no notion of parent pointers or in-degree to worry about.\n\n### Input format\n- Line 1: integer `n`\n- Line 2: `2n` space-separated integers — the flattened edge list `edges`\n\n### Output format\n- A single integer — the sum of the endpoints of the redundant edge.",
    statementDigest: "Given a tree with one extra undirected edge added, find the redundant edge (last one in scan order that closes a cycle) and return the sum of its two endpoints.",
    constraints: "- `2 <= n <= 1000`\n- `edges.length == 2 * n`\n- `1 <= u, v <= n`, `u != v`\n- The input represents a tree plus exactly one extra edge, so the graph is connected with exactly one cycle",
    constraintsDigest: "n is at most 1000 and the edge list always represents a spanning tree plus exactly one extra edge.",
    expectedTime: "O(n * alpha(n))",
    expectedSpace: "O(n)",
    io: {
      fn: "redundantEdgeSum",
      params: [
        {
          name: "n",
          type: "int",
        },
        {
          name: "edges",
          type: "int[]",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "3\n1 2 2 3 3 1",
        output: "4",
        explanation: "Edges (1,2) and (2,3) build the tree; edge (3,1) closes a cycle since 3 and 1 are already connected. 3 + 1 = 4.",
      },
      {
        input: "4\n1 2 2 3 3 4 4 1",
        output: "5",
        explanation: "The first three edges form the path tree 1-2-3-4; edge (4,1) reconnects two already-connected nodes. 4 + 1 = 5.",
      },
    ],
    sampleTests: [
      {
        input: "3\n1 2 1 3 2 3",
      },
      {
        input: "5\n1 2 2 3 3 4 4 5 5 1",
      },
      {
        input: "5\n1 2 1 3 1 4 1 5 2 3",
      },
    ],
    hiddenTests: [
      {
        input: "6\n1 2 2 3 3 4 4 5 5 6 1 6",
      },
      {
        input: "4\n1 2 1 3 1 4 3 4",
      },
      {
        input: "7\n1 2 2 3 3 4 4 5 5 6 6 7 2 7",
      },
      {
        input: "5\n1 2 2 3 2 4 4 5 1 5",
      },
      {
        input: "2\n1 2 1 2",
      },
    ],
    hints: [
      "Process the edges in the given order and think about when adding an edge would create a cycle instead of extending the tree.",
      "You need a way to track, as edges are added one by one, whether two nodes already belong to the same connected piece before you add the new edge between them.",
      "Use Union-Find: for each edge in order, union its endpoints unless they already share the same root — record that edge as the candidate answer and keep scanning so the last such edge wins.",
    ],
    editorial: {
      approachSummary: "Union-Find over the edges in order; the redundant edge is whichever edge's endpoints are already connected when it is processed.",
      content: "Since the graph is a tree plus exactly one extra edge, exactly one edge in the input, when processed in order, will connect two nodes that are already in the same component — that edge is the one closing the cycle.\n\nMaintain a Union-Find structure over nodes `1..n`. Walk through the edges in the given order. For each edge `(u, v)`, find the roots of `u` and `v`. If the roots differ, union them — this edge is part of the growing forest/tree. If the roots are already equal, this edge doesn't need to be added to keep the graph a forest; it's a candidate for the redundant edge, so record `u + v` as the answer, but keep scanning rather than stopping immediately.\n\nBecause the input is guaranteed to be a tree with exactly one extra edge, there is exactly one edge where this \"already connected\" condition triggers, so the recorded answer is unambiguous — the \"return the last one\" rule matches the classic tie-break used for the general Redundant Connection problem, restricted here to the well-behaved single-cycle undirected case. Path compression during `find` keeps each operation nearly constant time, giving a solution that scans the edge list once.",
      timeComplexity: "O(n * alpha(n))",
      spaceComplexity: "O(n) for the parent array",
    },
    solution: {
      approachName: "Union-Find (Disjoint Set Union)",
      time: "O(n * alpha(n))",
      space: "O(n)",
      python: "parent = list(range(n + 1))\n\ndef find(x):\n    while parent[x] != x:\n        parent[x] = parent[parent[x]]\n        x = parent[x]\n    return x\n\nans = 0\nfor i in range(0, len(edges), 2):\n    u = edges[i]\n    v = edges[i + 1]\n    ru, rv = find(u), find(v)\n    if ru == rv:\n        ans = u + v\n    else:\n        parent[ru] = rv\n\nreturn ans",
    },
  },
  {
    slug: "bipartite-check",
    title: "Bipartite Graph Check",
    difficulty: "MEDIUM",
    topics: [
      "graph-connectivity",
      "bfs-dfs",
      "graph-coloring",
    ],
    companies: [
      {
        slug: "meta",
        frequency: 16,
      },
      {
        slug: "microsoft",
        frequency: 13,
      },
      {
        slug: "uber",
        frequency: 10,
      },
    ],
    statement: "### Problem\nYou are given an undirected graph with `n` nodes labeled `0` to `n-1` and a flattened edge list `edges = [a1, b1, a2, b2, ...]`. The graph is not necessarily connected.\n\nDetermine whether the graph is **bipartite** — that is, whether its nodes can be split into two sets such that every edge connects a node from one set to a node from the other set (equivalently, the graph can be properly colored with 2 colors so that no edge joins two same-colored nodes).\n\nYou must check **every** connected component, since a graph with multiple components is bipartite only if all of its components are individually bipartite.\n\n### Input format\n- Line 1: integer `n`\n- Line 2: space-separated integers — the flattened edge list `edges` (this line may be empty if there are no edges)\n\n### Output format\n- `true` if the graph is bipartite, `false` otherwise.",
    statementDigest: "Given an undirected, possibly disconnected graph, determine whether it can be 2-colored so no edge joins two same-colored nodes.",
    constraints: "- `1 <= n <= 1000`\n- `0 <= edges.length / 2 <= 20000`\n- `0 <= a, b <= n - 1`, and `a != b` (no self-loops)\n- The graph may be disconnected",
    constraintsDigest: "n is at most 1000, the graph may have up to 20000 edges and may be disconnected, with no self-loops.",
    expectedTime: "O(n + e)",
    expectedSpace: "O(n + e)",
    io: {
      fn: "isBipartite",
      params: [
        {
          name: "n",
          type: "int",
        },
        {
          name: "edges",
          type: "int[]",
        },
      ],
      returns: "bool",
    },
    examples: [
      {
        input: "3\n0 1 1 2 2 0",
        output: "false",
        explanation: "Nodes 0, 1, 2 form a triangle (an odd cycle), which can never be 2-colored without a conflict.",
      },
      {
        input: "4\n0 1 1 2 2 3 3 0",
        output: "true",
        explanation: "The 4-cycle can be 2-colored as {0,2} vs {1,3}, and no edge joins two same-colored nodes.",
      },
    ],
    sampleTests: [
      {
        input: "5\n0 1 1 2 3 4",
      },
      {
        input: "5\n0 1 1 2 2 0 3 4",
      },
      {
        input: "5\n0 1 0 2 0 3 0 4",
      },
    ],
    hiddenTests: [
      {
        input: "3\n0 1 1 2 2 0",
      },
      {
        input: "4\n0 1 1 2 2 3 3 0",
      },
      {
        input: "6\n0 1 1 2 2 0 3 4 4 5 5 3",
      },
      {
        input: "5\n0 1 1 2 3 4",
      },
      {
        input: "1\n",
      },
    ],
    hints: [
      "Think about assigning each node one of two labels such that every edge always connects two differently-labeled nodes.",
      "A coloring approach that propagates the opposite color to each neighbor, and flags a conflict when a neighbor already has the same color as the current node, is what you need — and it must be repeated for every part of the graph.",
      "Run BFS or DFS from every uncolored node (to cover all components) and 2-color as you go; if you ever reach a neighbor that's already colored the same as the current node, the graph is not bipartite.",
    ],
    editorial: {
      approachSummary: "2-color the graph via BFS/DFS starting from every uncolored node; a same-color edge means it isn't bipartite.",
      content: "A graph is bipartite exactly when it can be properly 2-colored, so the natural approach is to attempt such a coloring directly. Build an adjacency list from the flattened edge list, and keep a `color` array initialized to 0 (uncolored) for all `n` nodes.\n\nIterate over every node from `0` to `n-1`. If a node is already colored, skip it — it was handled as part of an earlier component's traversal. Otherwise, start a BFS or DFS from it, coloring it (say) `1`. For every edge to a neighbor: if the neighbor is uncolored, give it the opposite color and continue the traversal from there; if the neighbor is already colored, check that it has the opposite color of the current node — if it instead matches, an edge connects two same-colored nodes and the graph is immediately not bipartite.\n\nThe outer loop over all `n` nodes is essential: because the graph can be disconnected, checking only the component containing node 0 would silently ignore non-bipartite components elsewhere. If the traversal completes for every component without ever finding a same-color edge, the graph is bipartite.\n\nEach node and edge is visited a constant number of times, giving linear time overall.",
      timeComplexity: "O(n + e)",
      spaceComplexity: "O(n + e) for the adjacency list and color array",
    },
    solution: {
      approachName: "BFS/DFS 2-Coloring",
      time: "O(n + e)",
      space: "O(n + e)",
      python: "adj = [[] for _ in range(n)]\nfor i in range(0, len(edges), 2):\n    a = edges[i]\n    b = edges[i + 1]\n    adj[a].append(b)\n    adj[b].append(a)\n\ncolor = [0] * n\nfor start in range(n):\n    if color[start] != 0:\n        continue\n    color[start] = 1\n    stack = [start]\n    while stack:\n        node = stack.pop()\n        for nb in adj[node]:\n            if color[nb] == 0:\n                color[nb] = -color[node]\n                stack.append(nb)\n            elif color[nb] == color[node]:\n                return False\n\nreturn True",
    },
  },
  {
    slug: "longest-common-subsequence-length",
    title: "Longest Common Subsequence Length",
    difficulty: "MEDIUM",
    topics: [
      "dynamic-programming",
      "two-string-dp",
    ],
    companies: [
      {
        slug: "amazon",
        frequency: 20,
      },
      {
        slug: "google",
        frequency: 18,
      },
      {
        slug: "adobe",
        frequency: 12,
      },
    ],
    statement: "### Problem\nGiven two strings `text1` and `text2`, return the length of their **longest common subsequence (LCS)**.\n\nA subsequence of a string is a new string formed by deleting some (possibly zero) characters without changing the relative order of the remaining characters. A common subsequence of two strings is a subsequence of both. If the two strings share no common subsequence, return `0`.\n\n### Input format\n- Line 1: string `text1`\n- Line 2: string `text2`\n\n### Output format\n- A single integer — the length of the longest common subsequence of `text1` and `text2`.",
    statementDigest: "Given two strings, return the length of their longest common subsequence.",
    constraints: "- `0 <= text1.length, text2.length <= 1000`\n- `text1` and `text2` consist of uppercase and/or lowercase English letters",
    constraintsDigest: "Both strings have at most 1000 letters and may be empty.",
    expectedTime: "O(m * n)",
    expectedSpace: "O(m * n)",
    io: {
      fn: "lcsLength",
      params: [
        {
          name: "text1",
          type: "str",
        },
        {
          name: "text2",
          type: "str",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "abcde\nace",
        output: "3",
        explanation: "The longest common subsequence is `ace`, which has length 3.",
      },
      {
        input: "abc\nabc",
        output: "3",
        explanation: "The strings are identical, so the entire string of length 3 is the LCS.",
      },
    ],
    sampleTests: [
      {
        input: "abc\ndef",
      },
      {
        input: "horse\nros",
      },
    ],
    hiddenTests: [
      {
        input: "AGGTAB\nGXTXAYB",
      },
      {
        input: "\nabc",
      },
      {
        input: "abc\n",
      },
      {
        input: "aaaa\naa",
      },
      {
        input: "abcdefg\ngfedcba",
      },
    ],
    hints: [
      "Think about how the answer for the full pair of strings relates to the answer for slightly shorter prefixes of each.",
      "This is a classic two-string dynamic programming problem — build a table where each cell answers the question for a prefix of `text1` paired with a prefix of `text2`.",
      "Define `dp[i][j]` as the LCS length of `text1[:i]` and `text2[:j]`. When the last characters match, extend the diagonal value by 1; otherwise take the best of dropping the last character from either string.",
    ],
    editorial: {
      approachSummary: "Bottom-up 2D DP: dp[i][j] is the LCS length of the first i characters of text1 and the first j of text2.",
      content: "Let `dp[i][j]` denote the length of the longest common subsequence between the first `i` characters of `text1` and the first `j` characters of `text2`. The base case is `dp[0][j] = dp[i][0] = 0`, since an empty string shares no characters with anything.\n\nFor the transition, compare `text1[i-1]` with `text2[j-1]` (the newly considered characters). If they match, this character can extend any optimal common subsequence of the shorter prefixes, so `dp[i][j] = dp[i-1][j-1] + 1`. If they don't match, the best subsequence either skips the current character of `text1` or skips the current character of `text2`, so `dp[i][j] = max(dp[i-1][j], dp[i][j-1])`.\n\nFilling this table row by row (or column by column) for `i` from `1` to `m` and `j` from `1` to `n` takes `O(m*n)` time, and the final answer is `dp[m][n]`.\n\nSpace can be reduced to `O(min(m,n))` by keeping only the previous row, since each cell only depends on the row directly above and the current row so far — but the straightforward `O(m*n)` table is easiest to reason about and is efficient enough for the given constraints.",
      timeComplexity: "O(m * n)",
      spaceComplexity: "O(m * n), reducible to O(min(m,n))",
    },
    solution: {
      approachName: "2D Dynamic Programming",
      time: "O(m * n)",
      space: "O(m * n)",
      python: "m, n = len(text1), len(text2)\ndp = [[0] * (n + 1) for _ in range(m + 1)]\nfor i in range(1, m + 1):\n    for j in range(1, n + 1):\n        if text1[i - 1] == text2[j - 1]:\n            dp[i][j] = dp[i - 1][j - 1] + 1\n        else:\n            dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])\nreturn dp[m][n]",
    },
  },
  {
    slug: "min-insertions-for-palindrome",
    title: "Minimum Insertions to Make a Palindrome",
    difficulty: "HARD",
    topics: [
      "dynamic-programming",
      "two-string-dp",
      "strings",
    ],
    companies: [
      {
        slug: "google",
        frequency: 15,
      },
      {
        slug: "microsoft",
        frequency: 11,
      },
      {
        slug: "nvidia",
        frequency: 8,
      },
    ],
    statement: "### Problem\nGiven a string `s`, return the minimum number of characters you must insert (at any positions) so that the resulting string becomes a palindrome.\n\n### Input format\n- Line 1: string `s`\n\n### Output format\n- A single integer — the minimum number of insertions needed to make `s` a palindrome.",
    statementDigest: "Given a string, return the minimum number of character insertions needed to turn it into a palindrome.",
    constraints: "- `1 <= s.length <= 800`\n- `s` consists of lowercase English letters",
    constraintsDigest: "The string has between 1 and 800 lowercase letters.",
    expectedTime: "O(n^2)",
    expectedSpace: "O(n^2)",
    io: {
      fn: "minInsertionsForPalindrome",
      params: [
        {
          name: "s",
          type: "str",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "zzazz",
        output: "0",
        explanation: "`zzazz` is already a palindrome, so no insertions are needed.",
      },
      {
        input: "mbadm",
        output: "2",
        explanation: "Inserting two characters (e.g. turning it into `mbdadbm`) makes it a palindrome; no single insertion suffices.",
      },
    ],
    sampleTests: [
      {
        input: "leetcode",
      },
      {
        input: "ab",
      },
    ],
    hiddenTests: [
      {
        input: "g",
      },
      {
        input: "aa",
      },
      {
        input: "no",
      },
      {
        input: "abcda",
      },
      {
        input: "racecar",
      },
    ],
    hints: [
      "Think about how far the string already is from reading the same forwards and backwards, rather than trying insertions directly.",
      "The answer relates to the longest part of the string that already forms a palindromic pattern — every character outside that part will need a mirrored partner inserted.",
      "The minimum insertions equal len(s) minus the longest common subsequence of s and its reverse (which is exactly the longest palindromic subsequence of s).",
    ],
    editorial: {
      approachSummary: "Minimum insertions = len(s) minus the longest common subsequence of s and its reverse.",
      content: "A useful reformulation: the minimum number of insertions to make `s` a palindrome equals `len(s)` minus the length of the **longest palindromic subsequence (LPS)** of `s`. Every character that is part of the LPS already has a mirror-image partner in place; every character outside the LPS needs a matching character inserted somewhere to mirror it.\n\nThe longest palindromic subsequence of `s` can itself be computed as the longest common subsequence (LCS) between `s` and its reverse `rev(s)`. Intuitively, any palindromic subsequence of `s`, read from both ends inward, corresponds to a sequence that appears in the same relative order in `rev(s)` as well, and vice versa — this equivalence is a standard and provable identity.\n\nSo the algorithm is: reverse `s` to get `rev`, then run the classic 2D LCS dynamic program on `s` and `rev`, where `dp[i][j]` is the LCS length of the first `i` characters of `s` and the first `j` characters of `rev`. The final LCS length `dp[n][n]` is the LPS of `s`, and the answer is `n - dp[n][n]`.\n\nThis turns a seemingly new palindrome problem into a direct application of the two-sequence LCS pattern already used elsewhere, with the same `O(n^2)` time and space.",
      timeComplexity: "O(n^2)",
      spaceComplexity: "O(n^2), reducible to O(n)",
    },
    solution: {
      approachName: "String Reversal + LCS Dynamic Programming",
      time: "O(n^2)",
      space: "O(n^2)",
      python: "n = len(s)\nrev = s[::-1]\ndp = [[0] * (n + 1) for _ in range(n + 1)]\nfor i in range(1, n + 1):\n    for j in range(1, n + 1):\n        if s[i - 1] == rev[j - 1]:\n            dp[i][j] = dp[i - 1][j - 1] + 1\n        else:\n            dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])\nlcs = dp[n][n]\nreturn n - lcs",
    },
  },
  {
    slug: "group-anagrams-count-groups",
    title: "Group Anagrams — Count Groups",
    difficulty: "MEDIUM",
    topics: [
      "hash-map",
      "arrays-strings",
      "strings",
    ],
    companies: [
      {
        slug: "meta",
        frequency: 17,
      },
      {
        slug: "amazon",
        frequency: 14,
      },
      {
        slug: "apple",
        frequency: 10,
      },
    ],
    statement: "### Problem\nGiven an array of lowercase words `words`, group the words that are anagrams of each other (they contain exactly the same letters, possibly in a different order, with the same multiplicities). Return the **number of distinct groups** formed.\n\n(Only the count is requested, not the groups themselves, since the judge only accepts flat return values.)\n\n### Input format\n- Line 1: space-separated strings — the array `words`\n\n### Output format\n- A single integer — the number of anagram groups.",
    statementDigest: "Given a list of lowercase words, group them by anagram equivalence and return how many distinct groups result.",
    constraints: "- `1 <= words.length <= 10000`\n- `1 <= words[i].length <= 20`\n- `words[i]` consists of lowercase English letters only (no spaces, so each word is a single token)",
    constraintsDigest: "Up to 10000 lowercase words, each up to 20 letters long and containing no spaces.",
    expectedTime: "O(N * K log K)",
    expectedSpace: "O(N * K)",
    io: {
      fn: "countAnagramGroups",
      params: [
        {
          name: "words",
          type: "str[]",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "eat tea tan ate nat bat",
        output: "3",
        explanation: "Groups: {eat, tea, ate}, {tan, nat}, {bat} — 3 groups in total.",
      },
      {
        input: "a",
        output: "1",
        explanation: "A single word forms a single group by itself.",
      },
    ],
    sampleTests: [
      {
        input: "a b ab ba",
      },
      {
        input: "abc bca cab xyz",
      },
    ],
    hiddenTests: [
      {
        input: "listen silent enlist google gogole",
      },
      {
        input: "abc def ghi",
      },
      {
        input: "aabb bbaa abab baba ab",
      },
      {
        input: "x",
      },
      {
        input: "cab bca abc cba bac acb",
      },
    ],
    hints: [
      "Think about what stays identical for every word within the same anagram group, no matter how its letters happen to be arranged.",
      "A canonical form derived from each word — one that is the same for all of its anagrams and different for non-anagrams — lets you tell groups apart without comparing words pairwise.",
      "Map every word to its letters sorted into a fixed order, collect the distinct keys in a set, and the size of that set is the number of anagram groups.",
    ],
    editorial: {
      approachSummary: "Map each word to its sorted-letter key and count the number of distinct keys.",
      content: "Two words are anagrams exactly when they contain the same multiset of letters. A simple and robust way to capture \"same multiset of letters\" as a single comparable value is to sort each word's characters into a canonical order — two words are anagrams if and only if their sorted forms are identical.\n\nSo for every word in `words`, compute its sorted-character key (for example, sorting `\"tea\"` gives `\"aet\"`, and sorting `\"ate\"` also gives `\"aet\"`). Insert each key into a set. Words that are anagrams of each other always map to the same key and therefore collapse to a single set entry, while words that aren't anagrams of anything else produce their own unique key.\n\nOnce every word has been processed, the size of the set is exactly the number of distinct anagram groups, since each group corresponds to exactly one distinct key.\n\nSorting each word of length `K` costs `O(K log K)`, and this is done for all `N` words, giving `O(N * K log K)` total time. An alternative canonical key — a fixed-length count of each of the 26 letters — avoids the sort and gives `O(N * K)` time, at the cost of a slightly more involved key construction; both approaches are valid.",
      timeComplexity: "O(N * K log K), where N is the number of words and K is the max word length",
      spaceComplexity: "O(N * K) for storing the keys",
    },
    solution: {
      approachName: "Hash Map Canonical Key Grouping",
      time: "O(N * K log K)",
      space: "O(N * K)",
      python: "groups = set()\nfor w in words:\n    key = ''.join(sorted(w))\n    groups.add(key)\nreturn len(groups)",
    },
  },
  {
    slug: "minimum-window-substring-length",
    title: "Minimum Window Substring Length",
    difficulty: "HARD",
    topics: [
      "sliding-window",
      "hash-map",
      "strings",
    ],
    companies: [
      {
        slug: "amazon",
        frequency: 22,
      },
      {
        slug: "google",
        frequency: 19,
      },
      {
        slug: "microsoft",
        frequency: 15,
      },
      {
        slug: "netflix",
        frequency: 9,
      },
    ],
    statement: "### Problem\nGiven two strings `s` and `t`, return the length of the smallest substring of `s` that contains every character of `t`, **including matching multiplicities** (e.g. if `t` has two `'a'`s, the chosen substring of `s` must contain at least two `'a'`s). If no such substring exists, return `0`.\n\n### Input format\n- Line 1: string `s`\n- Line 2: string `t`\n\n### Output format\n- A single integer — the length of the smallest valid window, or `0` if none exists.",
    statementDigest: "Given strings s and t, return the length of the shortest substring of s that contains all characters of t with matching multiplicities, or 0 if impossible.",
    constraints: "- `1 <= s.length <= 20000`\n- `1 <= t.length <= 20000`\n- `s` and `t` consist of uppercase and/or lowercase English letters",
    constraintsDigest: "Both strings have up to 20000 letters and t may be longer than s.",
    expectedTime: "O(|s| + |t|)",
    expectedSpace: "O(|s| + |t|)",
    io: {
      fn: "minWindowLength",
      params: [
        {
          name: "s",
          type: "str",
        },
        {
          name: "t",
          type: "str",
        },
      ],
      returns: "int",
    },
    examples: [
      {
        input: "ADOBECODEBANC\nABC",
        output: "4",
        explanation: "The smallest window containing A, B and C is `BANC`, which has length 4.",
      },
      {
        input: "a\naa",
        output: "0",
        explanation: "`s` only contains one 'a' but `t` requires two, so no valid window exists.",
      },
    ],
    sampleTests: [
      {
        input: "a\na",
      },
      {
        input: "ab\nb",
      },
      {
        input: "aa\naa",
      },
    ],
    hiddenTests: [
      {
        input: "bba\nab",
      },
      {
        input: "aa\naaa",
      },
      {
        input: "abc\ncba",
      },
      {
        input: "x\ny",
      },
      {
        input: "abcabcbb\nabc",
      },
    ],
    hints: [
      "Think about expanding a window over s until it satisfies every character requirement of t, then shrinking it as much as possible before expanding again.",
      "Track how many of each needed character (by count, not just presence) you're still missing from the current window, and shrink from the left whenever nothing is missing.",
      "Classic sliding window with a frequency-need counter: expand the right end character by character, and whenever the window fully covers t's character counts, shrink from the left while recording the minimum window length seen.",
    ],
    editorial: {
      approachSummary: "Two-pointer sliding window tracking a character-frequency deficit against t.",
      content: "Build a frequency count of the characters required by `t`, and track a single `missing` counter representing how many more character-instances the current window still needs to fully cover `t` (initialized to `len(t)`).\n\nExpand the window by moving a `right` pointer across `s`. For each character entered, decrease its remaining-need count; if that count was positive before decrementing (meaning this instance of the character was actually needed), decrement `missing`. Once `missing` reaches `0`, the window `[left, right]` fully covers `t`'s requirements.\n\nWhile the window is valid (`missing == 0`), record its length if it's the smallest seen so far, then try to shrink it from the left: remove the character at `left` from the window (incrementing its need count back up), and if that character becomes newly needed again (its need count goes positive), increment `missing` and stop shrinking; otherwise keep advancing `left`. This greedily finds the smallest valid window ending at (or before) the current `right`.\n\nContinue expanding `right` until the end of `s`. If a valid window was ever found, return its minimum length; otherwise return `0`. Each character of `s` is added and removed from the window at most once, giving linear time overall.",
      timeComplexity: "O(|s| + |t|)",
      spaceComplexity: "O(|s| + |t|) for the character frequency map",
    },
    solution: {
      approachName: "Sliding Window with Frequency Counter",
      time: "O(|s| + |t|)",
      space: "O(|s| + |t|)",
      python: "from collections import Counter\n\nif len(t) == 0 or len(s) == 0:\n    return 0\n\nneed = Counter(t)\nmissing = len(t)\nleft = 0\nbest = None\n\nfor right in range(len(s)):\n    ch = s[right]\n    if need[ch] > 0:\n        missing -= 1\n    need[ch] -= 1\n\n    while missing == 0:\n        window_len = right - left + 1\n        if best is None or window_len < best:\n            best = window_len\n        left_ch = s[left]\n        need[left_ch] += 1\n        if need[left_ch] > 0:\n            missing += 1\n        left += 1\n\nreturn best if best is not None else 0",
    },
  }
];
