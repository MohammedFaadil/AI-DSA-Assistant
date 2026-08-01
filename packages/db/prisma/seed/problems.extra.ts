import type { SeedProblem } from './problems.js';

/**
 * Second tranche of problems, filling out the difficulty curve and giving the
 * curriculum enough material per section.
 *
 * Test cases here declare INPUTS ONLY. Expected outputs are derived by executing
 * each reference solution (see verify.ts), which is why this file can be written
 * confidently — there is no hand-computed arithmetic to get wrong.
 */
export const EXTRA_PROBLEMS: SeedProblem[] = [
  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'is-palindrome',
    title: 'Valid Palindrome',
    difficulty: 'EASY',
    topics: ['string', 'two-pointers'],
    companies: [{ slug: 'meta', frequency: 24 }, { slug: 'microsoft', frequency: 14 }],
    statement: `Given a string \`s\`, return \`true\` if it reads the same forwards and backwards, considering **only alphanumeric characters** and ignoring case.

### Input format
Line 1: the string \`s\` (may contain spaces and punctuation).

### Output format
\`true\` or \`false\`.`,
    statementDigest:
      'Return true if s is a palindrome considering only alphanumeric characters, case-insensitively.',
    constraints: `- \`1 <= s.length <= 2 * 10^5\`
- \`s\` consists of printable ASCII characters.`,
    constraintsDigest: 'len <= 2e5, printable ASCII, ignore non-alphanumeric and case.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'isPalindrome', params: [{ name: 's', type: 'str' }], returns: 'bool' },
    examples: [
      {
        input: 'A man, a plan, a canal: Panama',
        output: 'true',
        explanation: 'Stripped and lowercased it becomes "amanaplanacanalpanama".',
      },
      { input: 'race a car', output: 'false', explanation: '"raceacar" is not a palindrome.' },
    ],
    sampleTests: [
      { input: 'A man, a plan, a canal: Panama' },
      { input: 'race a car' },
      { input: 'ab' },
    ],
    hiddenTests: [
      { input: 'a' },
      { input: '.,' },
      { input: '0P' },
      { input: 'Was it a car or a cat I saw?' },
      { input: 'abccba' },
    ],
    hints: [
      'A palindrome is a statement about pairs of characters at mirrored positions. Which pairs do you actually need to compare?',
      'Building a cleaned copy of the string works and costs O(n) space. Can you compare in place instead, skipping characters you do not care about as you go?',
      'Start one index at each end. Advance each past any non-alphanumeric character, compare the two lowercased characters, then step both inward.',
    ],
    editorial: {
      approachSummary: 'Converging pointers that skip characters they do not care about.',
      content: `The straightforward solution filters the string down to alphanumerics, lowercases it, and compares it with its reverse. That is correct and readable, and costs \`O(n)\` extra space.

The in-place version keeps two indices, one at each end. Before each comparison, advance the left index past anything non-alphanumeric and retreat the right index the same way. Then compare the two characters case-insensitively and step both inward.

The subtlety is the inner skip loops must **also** check \`left < right\`. Without that guard, a string of only punctuation walks the pointers past each other and you index out of range — which is exactly what the \`".,"\` test covers.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'Two pointers, in place',
      time: 'O(n)',
      space: 'O(1)',
      python: `left, right = 0, len(s) - 1
while left < right:
    while left < right and not s[left].isalnum():
        left += 1
    while left < right and not s[right].isalnum():
        right -= 1
    if s[left].lower() != s[right].lower():
        return False
    left += 1
    right -= 1
return True`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'single-number',
    title: 'Single Number',
    difficulty: 'EASY',
    topics: ['array', 'math'],
    companies: [{ slug: 'amazon', frequency: 16 }, { slug: 'adobe', frequency: 9 }],
    statement: `Every element in \`nums\` appears **exactly twice** except for one, which appears once. Return that element.

Solve it in linear time using **constant** extra space.

### Input format
Line 1: the array \`nums\`, space-separated.

### Output format
The element that appears only once.`,
    statementDigest:
      'All values in nums appear twice except one; return it in O(n) time and O(1) space.',
    constraints: `- \`1 <= nums.length <= 3 * 10^4\`
- \`nums.length\` is odd
- \`-3 * 10^4 <= nums[i] <= 3 * 10^4\``,
    constraintsDigest: 'odd length <= 3e4, every value paired except one, O(1) space required.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'singleNumber', params: [{ name: 'nums', type: 'int[]' }], returns: 'int' },
    examples: [
      { input: '2 2 1', output: '1', explanation: '2 is paired; 1 is not.' },
      { input: '4 1 2 1 2', output: '4', explanation: 'Only 4 is unpaired.' },
    ],
    sampleTests: [{ input: '2 2 1' }, { input: '4 1 2 1 2' }],
    hiddenTests: [
      { input: '1' },
      { input: '-1 -1 7' },
      { input: '5 3 3 9 9 5 -2' },
      { input: '0 0 -8' },
    ],
    hints: [
      'A hash set works, but the constraints ask for constant space. Is there an operation where combining a value with itself erases it?',
      'You need an operation that is commutative, associative, and where `x` combined with `x` is the identity. Order then stops mattering entirely.',
      'XOR has exactly those properties: `x ^ x == 0` and `x ^ 0 == x`. XOR the whole array together and the pairs cancel out.',
    ],
    editorial: {
      approachSummary: 'XOR the entire array; paired values cancel.',
      content: `A hash set gives the answer in \`O(n)\` time but \`O(n)\` space, which the constraints rule out.

XOR has three properties that make this collapse to one line of state:

- \`x ^ x == 0\` — a pair annihilates itself
- \`x ^ 0 == x\` — the identity
- it is commutative and associative — so the order of the array is irrelevant

XOR every element into an accumulator. Every value that appears twice contributes zero, and the single unpaired value is what remains.

This generalises less well than it looks: if elements could appear *three* times, XOR no longer cancels them and you need per-bit counting modulo 3 instead. Worth knowing the trick has a specific shape.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'XOR accumulator',
      time: 'O(n)',
      space: 'O(1)',
      python: `result = 0
for value in nums:
    result ^= value
return result`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'missing-number',
    title: 'Missing Number',
    difficulty: 'EASY',
    topics: ['array', 'math'],
    companies: [{ slug: 'microsoft', frequency: 13 }, { slug: 'amazon', frequency: 11 }],
    statement: `\`nums\` contains \`n\` distinct numbers drawn from the range \`[0, n]\`, so exactly one value in that range is missing. Return it.

### Input format
Line 1: the array \`nums\`, space-separated.

### Output format
The missing number.`,
    statementDigest:
      'nums holds n distinct values from [0, n]; return the one value in that range that is absent.',
    constraints: `- \`1 <= nums.length <= 10^4\`
- \`0 <= nums[i] <= nums.length\`
- All values in \`nums\` are distinct.`,
    constraintsDigest: 'n <= 1e4, distinct values drawn from [0, n], exactly one missing.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'missingNumber', params: [{ name: 'nums', type: 'int[]' }], returns: 'int' },
    examples: [
      { input: '3 0 1', output: '2', explanation: 'n = 3, so the range is [0,3]; 2 is absent.' },
      { input: '0 1', output: '2', explanation: 'n = 2, so the range is [0,2]; 2 is absent.' },
    ],
    sampleTests: [{ input: '3 0 1' }, { input: '0 1' }],
    hiddenTests: [
      { input: '9 6 4 2 3 5 7 0 1' },
      { input: '0' },
      { input: '1 0 3' },
      { input: '1' },
    ],
    hints: [
      'You know exactly which numbers *should* be present. What does that let you compute before looking at the array at all?',
      'Sorting costs O(n log n) and a seen-set costs O(n) space. Both are more than you need — the answer is a difference between two totals.',
      'The sum of `0..n` is `n(n+1)/2`. Subtract the actual sum of the array and what remains is the missing value.',
    ],
    editorial: {
      approachSummary: 'Compare the expected sum of 0..n with the actual sum.',
      content: `Three approaches worth comparing:

1. **Sort, then scan** for the first index where \`nums[i] != i\`. \`O(n log n)\`.
2. **Hash set** of the values, then test \`0..n\` for membership. \`O(n)\` time, \`O(n)\` space.
3. **Arithmetic.** The numbers \`0..n\` sum to \`n(n+1)/2\` by Gauss's formula. The array is that set with one element removed, so \`expected - actual\` *is* the missing value. \`O(n)\` time, \`O(1)\` space.

XOR works here too — XOR \`0..n\` together with every element of the array and the pairs cancel, leaving the missing value. That version avoids any risk of integer overflow, which matters in fixed-width languages where \`n(n+1)/2\` can exceed the type for large \`n\`.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'Gauss sum difference',
      time: 'O(n)',
      space: 'O(1)',
      python: `n = len(nums)
expected = n * (n + 1) // 2
actual = 0
for value in nums:
    actual += value
return expected - actual`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'majority-element',
    title: 'Majority Element',
    difficulty: 'EASY',
    topics: ['array', 'sorting'],
    companies: [{ slug: 'amazon', frequency: 15 }, { slug: 'apple', frequency: 10 }],
    statement: `Given an array \`nums\` of size \`n\`, return the element that appears **more than \`n/2\` times**. You may assume such an element always exists.

### Input format
Line 1: the array \`nums\`, space-separated.

### Output format
The majority element.`,
    statementDigest:
      'Return the value appearing more than n/2 times in nums; it is guaranteed to exist.',
    constraints: `- \`1 <= nums.length <= 5 * 10^4\`
- \`-10^9 <= nums[i] <= 10^9\`
- A majority element is guaranteed to exist.`,
    constraintsDigest: 'n <= 5e4, a strict majority element is guaranteed.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'majorityElement', params: [{ name: 'nums', type: 'int[]' }], returns: 'int' },
    examples: [
      { input: '3 2 3', output: '3', explanation: '3 appears twice out of three elements.' },
      { input: '2 2 1 1 1 2 2', output: '2', explanation: '2 appears four times out of seven.' },
    ],
    sampleTests: [{ input: '3 2 3' }, { input: '2 2 1 1 1 2 2' }],
    hiddenTests: [
      { input: '1' },
      { input: '-5 -5 -5 2 3' },
      { input: '6 6 6 6 1 2 3' },
      { input: '4 4' },
    ],
    hints: [
      'A strict majority is a very strong guarantee. What happens if you pair up each majority element with one non-majority element and cancel both?',
      'Because the majority element occurs more than every other value combined, it cannot be fully cancelled — something always survives.',
      'Keep a candidate and a counter. On a match increment; on a mismatch decrement; when the counter hits zero adopt the current value as the new candidate.',
    ],
    editorial: {
      approachSummary: "Boyer-Moore voting: pair off and cancel; the majority survives.",
      content: `Counting occurrences in a hash map is \`O(n)\` time and \`O(n)\` space and is a perfectly good answer. Sorting and returning the middle element also works, because a strict majority must cover the midpoint — that is \`O(n log n)\` and constant space.

The Boyer-Moore voting algorithm gets both: \`O(n)\` time, \`O(1)\` space. The intuition is cancellation. Imagine repeatedly removing one majority element together with one non-majority element. Since the majority appears more than \`n/2\` times, it outnumbers *everything else combined*, so it can never be fully cancelled — whatever survives the process is the majority.

Mechanically: hold a candidate and a count. Same value, increment; different value, decrement; count zero, adopt the current value as candidate.

**Important caveat.** This finds the majority element only when one is guaranteed to exist. Given \`[1, 2, 3]\` it happily returns 3, which is not a majority of anything. If existence is not guaranteed, a second pass to verify the candidate's frequency is mandatory.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'Boyer-Moore voting',
      time: 'O(n)',
      space: 'O(1)',
      python: `candidate = nums[0]
count = 0
for value in nums:
    if count == 0:
        candidate = value
        count = 1
    elif value == candidate:
        count += 1
    else:
        count -= 1
return candidate`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'move-zeroes',
    title: 'Move Zeroes',
    difficulty: 'EASY',
    topics: ['array', 'two-pointers'],
    companies: [{ slug: 'meta', frequency: 18 }, { slug: 'bloomberg', frequency: 11 }],
    statement: `Given an array \`nums\`, move every \`0\` to the end while keeping the **relative order** of the non-zero elements.

### Input format
Line 1: the array \`nums\`, space-separated.

### Output format
The rearranged array, space-separated.`,
    statementDigest:
      'Move all zeroes in nums to the end, preserving the relative order of non-zero elements.',
    constraints: `- \`1 <= nums.length <= 10^4\`
- \`-2^31 <= nums[i] <= 2^31 - 1\``,
    constraintsDigest: 'n <= 1e4, preserve relative order of non-zero values.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'moveZeroes', params: [{ name: 'nums', type: 'int[]' }], returns: 'int[]' },
    examples: [
      { input: '0 1 0 3 12', output: '1 3 12 0 0', explanation: 'Non-zero order 1, 3, 12 is kept.' },
      { input: '0', output: '0', explanation: 'Nothing to move.' },
    ],
    sampleTests: [{ input: '0 1 0 3 12' }, { input: '0' }, { input: '1 2 3' }],
    hiddenTests: [
      { input: '0 0 1' },
      { input: '4 0 0 5 0 6' },
      { input: '0 0 0 0' },
      { input: '-1 0 -2' },
    ],
    hints: [
      'The non-zero elements must keep their order. If you wrote them out in order into a fresh array, where would each one land?',
      'You do not need a fresh array. Keep a write position that only advances when you actually write a non-zero value.',
      'Scan with a read index. Every time you see a non-zero, copy it to the write index and advance the write index. Then fill everything from the write index to the end with zeroes.',
    ],
    editorial: {
      approachSummary: 'A write pointer that lags behind the read pointer.',
      content: `The instinct is to swap zeroes toward the back, but that gets fiddly and can disturb the relative order if you are not careful.

The cleaner framing is a **stable partition**. Keep two indices: a read index that visits every position, and a write index that marks where the next non-zero belongs. When the read index finds a non-zero, write it at the write index and advance the write index. Zeroes are simply skipped.

After the pass, every non-zero occupies \`[0, write)\` in its original relative order, and everything from \`write\` to the end must be zero — so fill it.

Two passes over the array, no extra storage, and order is preserved by construction because you never reorder the non-zeroes relative to one another. The same pattern generalises to "move all elements matching a predicate to the end", which is worth recognising.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'Stable partition with a write pointer',
      time: 'O(n)',
      space: 'O(1)',
      python: `result = list(nums)
write = 0
for read in range(len(result)):
    if result[read] != 0:
        result[write] = result[read]
        write += 1
while write < len(result):
    result[write] = 0
    write += 1
return result`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'longest-common-prefix',
    title: 'Longest Common Prefix',
    difficulty: 'EASY',
    topics: ['string'],
    companies: [{ slug: 'amazon', frequency: 14 }, { slug: 'adobe', frequency: 8 }],
    statement: `Given an array of strings \`strs\`, return the longest string that is a prefix of **every** element. If there is no common prefix, return an empty string.

### Input format
Line 1: the words, space-separated.

### Output format
The longest common prefix, or an empty line if there is none.`,
    statementDigest:
      'Return the longest string that prefixes every word in strs, or empty if none exists.',
    constraints: `- \`1 <= strs.length <= 200\`
- \`1 <= strs[i].length <= 200\`
- \`strs[i]\` consists of lowercase English letters.`,
    constraintsDigest: 'up to 200 words of up to 200 lowercase letters each.',
    expectedTime: 'O(n * m)',
    expectedSpace: 'O(1)',
    io: { fn: 'longestCommonPrefix', params: [{ name: 'strs', type: 'str[]' }], returns: 'str' },
    examples: [
      { input: 'flower flow flight', output: 'fl', explanation: 'All three start with "fl".' },
      { input: 'dog racecar car', output: '', explanation: 'No character is shared at position 0.' },
    ],
    sampleTests: [{ input: 'flower flow flight' }, { input: 'dog racecar car' }],
    hiddenTests: [
      { input: 'interspecies interstellar interstate' },
      { input: 'a' },
      { input: 'abc abc abc' },
      { input: 'ab a' },
      { input: 'prefix pre' },
    ],
    hints: [
      'The answer can never be longer than the shortest word. What does that tell you about where to stop?',
      'You can either compare column by column across all words, or start from one word and shrink it until it fits the rest.',
      'Take the first word as a candidate prefix. For each remaining word, chop the last character off the candidate until that word starts with it. If the candidate empties, there is no common prefix.',
    ],
    editorial: {
      approachSummary: 'Shrink a candidate prefix until every word agrees with it.',
      content: `Two clean formulations, both \`O(n × m)\` where \`n\` is the number of words and \`m\` the prefix length:

**Vertical scanning.** Walk position \`0, 1, 2, …\`. At each position, check that every word has the same character there — and that no word has ended. The first disagreement is where the prefix stops. This has a nice property: it exits as early as possible, so it is fast when the common prefix is short.

**Horizontal shrinking.** Take \`strs[0]\` as the candidate. For each subsequent word, trim the candidate's last character until the word starts with it. If the candidate becomes empty, return early.

The edge cases that catch people: a single word (the answer is that word), one word being a strict prefix of another (\`["ab", "a"]\` → \`"a"\`), and the empty result — which must be an empty string, not a crash from trimming past position zero.`,
      timeComplexity: 'O(n * m)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'Horizontal shrinking',
      time: 'O(n * m)',
      space: 'O(1)',
      python: `if not strs:
    return ""
prefix = strs[0]
for word in strs[1:]:
    while not word.startswith(prefix):
        prefix = prefix[:-1]
        if not prefix:
            return ""
return prefix`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'container-with-most-water',
    title: 'Container With Most Water',
    difficulty: 'MEDIUM',
    topics: ['array', 'two-pointers', 'greedy'],
    companies: [{ slug: 'amazon', frequency: 26 }, { slug: 'meta', frequency: 20 }],
    statement: `\`height[i]\` is the height of a vertical line at position \`i\`. Pick two lines so that, together with the x-axis, they hold the most water.

Return that maximum area. The container cannot be tilted.

### Input format
Line 1: the array \`height\`, space-separated.

### Output format
The maximum area.`,
    statementDigest:
      'Choose two vertical lines from height maximising area = min(h[i], h[j]) * (j - i).',
    constraints: `- \`2 <= height.length <= 10^5\`
- \`0 <= height[i] <= 10^4\``,
    constraintsDigest: 'n <= 1e5, non-negative heights, area = min height x width.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'maxArea', params: [{ name: 'height', type: 'int[]' }], returns: 'int' },
    examples: [
      {
        input: '1 8 6 2 5 4 8 3 7',
        output: '49',
        explanation: 'Lines at index 1 and 8: min(8,7) x 7 = 49.',
      },
      { input: '1 1', output: '1', explanation: 'min(1,1) x 1 = 1.' },
    ],
    sampleTests: [{ input: '1 8 6 2 5 4 8 3 7' }, { input: '1 1' }],
    hiddenTests: [
      { input: '4 3 2 1 4' },
      { input: '1 2 1' },
      { input: '2 3 4 5 18 17 6' },
      { input: '0 2' },
      { input: '1 2 4 3' },
    ],
    hints: [
      'The area is decided by the width and by the SHORTER of the two lines. Which of those two do you control by moving a pointer inward?',
      'Start with the widest possible pair. Any move inward loses width, so it can only pay off if it gains height. Which pointer is worth moving?',
      'Move the pointer at the shorter line. Moving the taller one cannot help: the shorter line still caps the height, and the width has shrunk.',
    ],
    editorial: {
      approachSummary: 'Converging pointers, always advancing past the shorter line.',
      content: `Trying every pair is \`O(n²)\` and times out at \`n = 10^5\`.

Start with the widest possible container: the first and last lines. From here, every move inward *loses* width, so it is only worth making if it can gain height.

Now the key argument. Suppose the left line is the shorter of the two. If you move the **right** pointer inward, the width shrinks and the height is still capped by that same short left line — so the area cannot increase. Every container using the current left line has already been bounded by what you just measured. Therefore the left line can be discarded, and moving the left pointer is the only move that can improve on the best so far.

That gives a single pass: compute the area, then advance whichever pointer sits at the shorter line. Ties can go either way — when both lines are equal, both are simultaneously eliminated as candidates.

This is a genuinely instructive greedy proof, and it is worth being able to reconstruct rather than memorise: the correctness comes from showing that the discarded pointer cannot participate in any better solution.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'Two pointers with a greedy discard argument',
      time: 'O(n)',
      space: 'O(1)',
      python: `left, right = 0, len(height) - 1
best = 0
while left < right:
    span = right - left
    shorter = height[left] if height[left] < height[right] else height[right]
    area = span * shorter
    if area > best:
        best = area
    if height[left] < height[right]:
        left += 1
    else:
        right -= 1
return best`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'subarray-sum-equals-k',
    title: 'Subarray Sum Equals K',
    difficulty: 'MEDIUM',
    topics: ['array', 'hash-table', 'prefix-sum'],
    companies: [{ slug: 'meta', frequency: 28 }, { slug: 'google', frequency: 21 }],
    statement: `Given an integer array \`nums\` and an integer \`k\`, return the **number of contiguous subarrays** whose sum equals \`k\`.

Values may be negative, so the running sum is not monotonic.

### Input format
Line 1: the array \`nums\`, space-separated.
Line 2: the integer \`k\`.

### Output format
The count of qualifying subarrays.`,
    statementDigest:
      'Count contiguous subarrays of nums summing to exactly k. Values may be negative.',
    constraints: `- \`1 <= nums.length <= 2 * 10^4\`
- \`-1000 <= nums[i] <= 1000\`
- \`-10^7 <= k <= 10^7\``,
    constraintsDigest: 'n <= 2e4, values may be negative so a sliding window will not work.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(n)',
    io: {
      fn: 'subarraySum',
      params: [{ name: 'nums', type: 'int[]' }, { name: 'k', type: 'int' }],
      returns: 'int',
    },
    examples: [
      { input: '1 1 1\n2', output: '2', explanation: 'The two adjacent pairs both sum to 2.' },
      { input: '1 2 3\n3', output: '2', explanation: '[3] and [1,2] both sum to 3.' },
    ],
    sampleTests: [{ input: '1 1 1\n2' }, { input: '1 2 3\n3' }],
    hiddenTests: [
      { input: '1\n0' },
      { input: '-1 -1 1\n0' },
      { input: '3 4 7 2 -3 1 4 2\n7' },
      { input: '1 -1 0\n0' },
      { input: '0 0 0\n0' },
    ],
    hints: [
      'A sliding window is the usual tool for contiguous ranges, but negatives break it — growing the window can *decrease* the sum. What still works when the running total is not monotonic?',
      'Write the sum of `nums[i..j]` in terms of two prefix sums. What equation must hold between them for that subarray to total k?',
      'sum(i..j) = prefix[j] - prefix[i-1], so you need prefix[i-1] = prefix[j] - k. Keep a map of how many times each prefix sum has occurred and look up `running - k` as you go.',
    ],
    editorial: {
      approachSummary: 'Prefix sums counted in a hash map.',
      content: `**Why the obvious tool fails.** A sliding window relies on the sum growing when you extend right and shrinking when you contract left. With negative numbers that monotonicity is gone, so there is no valid shrink condition. Reaching for a window here is the single most common wrong turn on this problem.

**The reframing.** The sum of \`nums[i..j]\` is \`prefix[j] - prefix[i-1]\`. Setting that equal to \`k\` and rearranging:

\`\`\`
prefix[i-1] = prefix[j] - k
\`\`\`

So at each position \`j\`, the number of subarrays ending at \`j\` with sum \`k\` is exactly the number of earlier prefix sums equal to \`running - k\`. That is a counting question, and a hash map answers it in \`O(1)\`.

**The initialisation that matters.** Seed the map with \`{0: 1}\`. That single entry represents the empty prefix, and it is what allows a subarray starting at index 0 to be counted. Forget it and every answer that should include a prefix-from-the-start is off by one.

Note the map stores *counts*, not positions — the question asks how many subarrays, not which ones, and the same prefix sum can legitimately occur many times.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Prefix sum frequency map',
      time: 'O(n)',
      space: 'O(n)',
      python: `counts = {0: 1}
running = 0
total = 0
for value in nums:
    running += value
    total += counts.get(running - k, 0)
    counts[running] = counts.get(running, 0) + 1
return total`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'kth-largest-element',
    title: 'Kth Largest Element',
    difficulty: 'MEDIUM',
    topics: ['array', 'heap', 'sorting'],
    companies: [{ slug: 'amazon', frequency: 24 }, { slug: 'meta', frequency: 18 }],
    statement: `Return the \`k\`-th largest element in \`nums\`. This is the \`k\`-th largest by **position in sorted order**, not the \`k\`-th distinct value.

### Input format
Line 1: the array \`nums\`, space-separated.
Line 2: the integer \`k\`.

### Output format
The k-th largest element.`,
    statementDigest:
      'Return the kth largest element of nums by sorted position, duplicates counting separately.',
    constraints: `- \`1 <= k <= nums.length <= 10^5\`
- \`-10^4 <= nums[i] <= 10^4\``,
    constraintsDigest: 'n <= 1e5, 1 <= k <= n, duplicates count toward the ordering.',
    expectedTime: 'O(n log k)',
    expectedSpace: 'O(k)',
    io: {
      fn: 'findKthLargest',
      params: [{ name: 'nums', type: 'int[]' }, { name: 'k', type: 'int' }],
      returns: 'int',
    },
    examples: [
      { input: '3 2 1 5 6 4\n2', output: '5', explanation: 'Sorted descending: 6, 5, … so 2nd is 5.' },
      {
        input: '3 2 3 1 2 4 5 5 6\n4',
        output: '4',
        explanation: 'Descending: 6, 5, 5, 4 — duplicates each take a position.',
      },
    ],
    sampleTests: [{ input: '3 2 1 5 6 4\n2' }, { input: '3 2 3 1 2 4 5 5 6\n4' }],
    hiddenTests: [
      { input: '1\n1' },
      { input: '7 6 5 4 3 2 1\n7' },
      { input: '2 1\n2' },
      { input: '-1 -2 -3\n2' },
      { input: '5 5 5 5\n3' },
    ],
    hints: [
      'Sorting the whole array answers it in O(n log n). But you only need one position — how much of the array actually has to be ordered?',
      'If you kept only the k largest values seen so far, the answer would always be the smallest of that set. What structure gives cheap access to its smallest element?',
      'Maintain a min-heap of size k. Push each value, and whenever the heap exceeds k, pop the minimum. The root is then the kth largest.',
    ],
    editorial: {
      approachSummary: 'A min-heap capped at size k.',
      content: `**Sorting** gives the answer immediately at \`O(n log n)\` — and for many real inputs that is the right call, because it is one line and impossible to get wrong.

**The heap.** You never need the whole ordering, only the boundary between the top \`k\` and the rest. Keep a min-heap holding the \`k\` largest values seen so far. Push every element; whenever the heap grows past \`k\`, pop its minimum. At the end the root is the smallest of the \`k\` largest — which is precisely the \`k\`-th largest. That is \`O(n log k)\` time and \`O(k)\` space, a real win when \`k\` is much smaller than \`n\`.

Note the inversion that trips people up: to find the \`k\` **largest** you keep a **min**-heap, because the element you want to evict is the smallest of your current top-k.

**Quickselect** does better still — \`O(n)\` expected time by partitioning around a pivot and recursing only into the side containing the target index. But its worst case is \`O(n²)\` on adversarial pivots, and it destroys the input. The heap is usually the better engineering trade.

The duplicates rule is worth re-reading: with \`[5,5,5,5]\` and \`k = 3\`, the answer is 5. Each copy occupies its own position in sorted order.`,
      timeComplexity: 'O(n log k)',
      spaceComplexity: 'O(k)',
    },
    solution: {
      approachName: 'Size-k min-heap',
      time: 'O(n log k)',
      space: 'O(k)',
      python: `import heapq

heap = []
for value in nums:
    heapq.heappush(heap, value)
    if len(heap) > k:
        heapq.heappop(heap)
return heap[0]`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'house-robber',
    title: 'House Robber',
    difficulty: 'MEDIUM',
    topics: ['array', 'dynamic-programming'],
    companies: [{ slug: 'amazon', frequency: 22 }, { slug: 'adobe', frequency: 12 }],
    statement: `\`nums[i]\` is the money in house \`i\`, arranged in a line. You cannot rob two **adjacent** houses. Return the maximum you can take.

### Input format
Line 1: the array \`nums\`, space-separated.

### Output format
The maximum total.`,
    statementDigest:
      'Maximum sum of a subset of nums with no two adjacent elements chosen.',
    constraints: `- \`1 <= nums.length <= 100\`
- \`0 <= nums[i] <= 400\``,
    constraintsDigest: 'n <= 100, non-negative values, no two adjacent picks allowed.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'rob', params: [{ name: 'nums', type: 'int[]' }], returns: 'int' },
    examples: [
      { input: '1 2 3 1', output: '4', explanation: 'Rob houses 0 and 2: 1 + 3 = 4.' },
      { input: '2 7 9 3 1', output: '12', explanation: 'Rob houses 0, 2 and 4: 2 + 9 + 1 = 12.' },
    ],
    sampleTests: [{ input: '1 2 3 1' }, { input: '2 7 9 3 1' }],
    hiddenTests: [
      { input: '5' },
      { input: '2 1 1 2' },
      { input: '0 0 0' },
      { input: '4 1 2 7 5 3 1' },
      { input: '1 3 1' },
    ],
    hints: [
      'Consider the last house. There are only two possibilities for it, and they are mutually exclusive.',
      'If you rob house i you cannot have robbed i-1, so you add nums[i] to the best answer for the first i-2 houses. If you skip it, you keep the best answer for the first i-1.',
      '`best(i) = max(best(i-1), best(i-2) + nums[i])`. Only two previous values matter, so keep two variables instead of an array.',
    ],
    editorial: {
      approachSummary: 'Rob-or-skip recurrence, compressed to two variables.',
      content: `Greedy fails here, and it is worth seeing why. "Always take the largest remaining house" on \`[2, 1, 1, 2]\` takes a 2, blocks its neighbour, takes the other 2 — total 4, which happens to be right. But on \`[1, 3, 1]\` greedy takes 3 and stops at 3, while the optimum is also... 3. The clean counterexample is \`[2, 7, 9, 3, 1]\`: greedy takes 9, then is blocked from 7 and 3, takes 2 and 1, for 12 — correct by luck. Try \`[4, 1, 2, 7, 5, 3, 1]\` and local choices start diverging from the optimum. The general point is that a local maximum tells you nothing about what it forecloses.

The DP is small. At each house you face exactly one binary decision:

\`\`\`
best(i) = max( best(i-1),            # skip house i
               best(i-2) + nums[i] ) # rob house i
\`\`\`

Skipping keeps whatever was optimal through \`i-1\`. Robbing forces you to have skipped \`i-1\`, so you build on \`best(i-2)\`.

Since \`best(i)\` depends only on the two previous answers, the array collapses to two rolling variables — \`O(n)\` time, \`O(1)\` space. The Python idiom \`prev, cur = cur, max(cur, prev + value)\` performs both updates simultaneously, which avoids the classic bug of overwriting \`prev\` before you have used it.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'Rolling two-variable DP',
      time: 'O(n)',
      space: 'O(1)',
      python: `prev, cur = 0, 0
for value in nums:
    prev, cur = cur, max(cur, prev + value)
return cur`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'longest-consecutive-sequence',
    title: 'Longest Consecutive Sequence',
    difficulty: 'MEDIUM',
    topics: ['array', 'hash-table'],
    companies: [{ slug: 'google', frequency: 25 }, { slug: 'meta', frequency: 19 }],
    statement: `Given an unsorted array \`nums\`, return the length of the longest run of **consecutive integers** it contains. The run does not need to be contiguous in the array.

Aim for \`O(n)\` time.

### Input format
Line 1: the array \`nums\`, space-separated.

### Output format
The length of the longest consecutive run.`,
    statementDigest:
      'Length of the longest set of consecutive integers present in nums, in O(n) time.',
    constraints: `- \`1 <= nums.length <= 10^5\`
- \`-10^9 <= nums[i] <= 10^9\`
- Duplicates may appear.`,
    constraintsDigest: 'n <= 1e5, duplicates allowed, O(n) expected.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(n)',
    io: { fn: 'longestConsecutive', params: [{ name: 'nums', type: 'int[]' }], returns: 'int' },
    examples: [
      {
        input: '100 4 200 1 3 2',
        output: '4',
        explanation: 'The run 1, 2, 3, 4 has length 4.',
      },
      { input: '0 3 7 2 5 8 4 6 0 1', output: '9', explanation: '0 through 8 is present.' },
    ],
    sampleTests: [{ input: '100 4 200 1 3 2' }, { input: '0 3 7 2 5 8 4 6 0 1' }],
    hiddenTests: [
      { input: '1' },
      { input: '1 2 0 1' },
      { input: '9 1 4 7 3 -1 0 5 8 -1 6' },
      { input: '5 5 5' },
      { input: '-3 -2 -1 0' },
    ],
    hints: [
      'Sorting makes this easy but costs O(n log n). If you could test membership instantly, what would you want to ask about each value?',
      'For a value v you can walk upward asking whether v+1, v+2 … are present. Done naively for every value this is O(n²) — so which values are actually worth starting from?',
      'Only start a walk at a value v where `v - 1` is absent, because that is the true beginning of its run. Every element is then visited at most twice overall.',
    ],
    editorial: {
      approachSummary: 'Hash set membership, walking upward only from run starts.',
      content: `Sorting and scanning for adjacent runs is \`O(n log n)\` and completely reasonable. The interesting question is how to reach \`O(n)\`.

Put every value in a hash set so membership is \`O(1)\`. Now for any value \`v\` you could walk \`v+1, v+2, …\` counting how far the run extends. Doing that from every element is \`O(n²)\` in the worst case — on \`[1..n]\` the walk from 1 traverses everything, then the walk from 2 traverses almost everything, and so on.

**The insight that fixes it:** only begin a walk at a value that *starts* a run, that is, a \`v\` where \`v - 1\` is not in the set. Every other value is interior to some run and will be counted by that run's own walk.

Now the total work is linear. Each value is touched once by the outer loop, and once more only as part of the single walk belonging to its run — so \`O(n)\` overall despite the nested loop.

Iterating the **set** rather than the array also handles duplicates for free: \`[5, 5, 5]\` collapses to one element, so the answer is 1 rather than 3.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Hash set with run-start detection',
      time: 'O(n)',
      space: 'O(n)',
      python: `pool = set(nums)
best = 0
for value in pool:
    if value - 1 in pool:
        continue
    length = 1
    while value + length in pool:
        length += 1
    if length > best:
        best = length
return best`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'course-schedule',
    title: 'Course Schedule',
    difficulty: 'MEDIUM',
    topics: ['graph', 'bfs', 'dfs'],
    companies: [{ slug: 'amazon', frequency: 27 }, { slug: 'google', frequency: 20 }],
    statement: `There are \`numCourses\` courses labelled \`0\` to \`numCourses - 1\`. A prerequisite pair \`[a, b]\` means you must take \`b\` before \`a\`.

Return \`true\` if it is possible to finish every course.

### Input format
Line 1: the integer \`numCourses\`.
Line 2: the prerequisite pairs **flattened** into one space-separated list, so \`a1 b1 a2 b2 …\`. May be an empty line if there are no prerequisites.

### Output format
\`true\` or \`false\`.`,
    statementDigest:
      'Given numCourses and flattened prerequisite pairs [a,b] meaning b before a, return true if all courses can be completed (the graph is acyclic).',
    constraints: `- \`1 <= numCourses <= 2000\`
- \`0 <= prerequisite pairs <= 5000\`
- All course labels are valid and pairs are distinct.`,
    constraintsDigest: 'up to 2000 courses and 5000 edges; answer is whether the graph is acyclic.',
    expectedTime: 'O(V + E)',
    expectedSpace: 'O(V + E)',
    io: {
      fn: 'canFinish',
      params: [{ name: 'numCourses', type: 'int' }, { name: 'prereqs', type: 'int[]' }],
      returns: 'bool',
    },
    examples: [
      { input: '2\n1 0', output: 'true', explanation: 'Take 0, then 1.' },
      {
        input: '2\n1 0 0 1',
        output: 'false',
        explanation: 'Each course requires the other — a cycle.',
      },
    ],
    sampleTests: [{ input: '2\n1 0' }, { input: '2\n1 0 0 1' }],
    hiddenTests: [
      { input: '4\n1 0 2 1 3 2' },
      { input: '3\n0 1 1 2 2 0' },
      { input: '1\n' },
      { input: '5\n1 0 2 0 3 1 4 2' },
      { input: '3\n1 0 2 1 0 2' },
    ],
    hints: [
      'Forget scheduling for a moment. Restate the question as a property of a directed graph — what exactly makes it impossible?',
      'It is impossible precisely when there is a cycle. So this is cycle detection on a directed graph, and there are two standard ways to do it.',
      'Kahn: count incoming edges per course, queue everything with zero, and remove nodes one at a time decrementing their neighbours. If you process fewer than numCourses nodes, a cycle blocked you.',
    ],
    editorial: {
      approachSummary: "Kahn's topological sort; a short count means a cycle.",
      content: `The scheduling language hides an ordinary graph question. Model each course as a node and each prerequisite \`[a, b]\` as an edge \`b → a\` ("b enables a"). A valid schedule is a topological order, and a topological order exists **exactly when the graph has no directed cycle**. So this is cycle detection.

**Kahn's algorithm (BFS).** Compute each node's in-degree — how many prerequisites it still needs. Every node with in-degree zero is takeable now, so queue them. Repeatedly pop a node, count it as processed, and decrement the in-degree of everything it enables; anything that reaches zero joins the queue.

If you finish having processed all \`numCourses\` nodes, you found a valid order. If the queue empties early, the remaining nodes all still have unmet prerequisites — and since every one of them is waiting on another that is also waiting, that is a cycle. Comparing the processed count against \`numCourses\` is the whole test.

**DFS with three colours** is the alternative: mark nodes unvisited / in-progress / done, and if DFS ever reaches an in-progress node it has found a back edge, hence a cycle. The two-state version (visited / unvisited) is a classic bug — revisiting a *finished* node is perfectly legal in a DAG, such as a diamond dependency, and flagging it as a cycle produces false negatives.

Both are \`O(V + E)\`. Kahn's has the practical advantage that it hands you the actual ordering, not just a yes/no.`,
      timeComplexity: 'O(V + E)',
      spaceComplexity: 'O(V + E)',
    },
    solution: {
      approachName: "Kahn's topological sort",
      time: 'O(V + E)',
      space: 'O(V + E)',
      python: `from collections import deque

indegree = [0] * numCourses
graph = [[] for _ in range(numCourses)]
for i in range(0, len(prereqs) - 1, 2):
    course = prereqs[i]
    needs = prereqs[i + 1]
    graph[needs].append(course)
    indegree[course] += 1

queue = deque(c for c in range(numCourses) if indegree[c] == 0)
processed = 0
while queue:
    node = queue.popleft()
    processed += 1
    for nxt in graph[node]:
        indegree[nxt] -= 1
        if indegree[nxt] == 0:
            queue.append(nxt)
return processed == numCourses`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'word-break',
    title: 'Word Break',
    difficulty: 'MEDIUM',
    topics: ['string', 'dynamic-programming'],
    companies: [{ slug: 'amazon', frequency: 23 }, { slug: 'google', frequency: 18 }],
    statement: `Given a string \`s\` and a dictionary of words \`wordDict\`, return \`true\` if \`s\` can be segmented into a sequence of one or more dictionary words. Words may be reused.

### Input format
Line 1: the string \`s\`.
Line 2: the dictionary words, space-separated.

### Output format
\`true\` or \`false\`.`,
    statementDigest:
      'Return true if s can be split into a sequence of words from wordDict, with reuse allowed.',
    constraints: `- \`1 <= s.length <= 300\`
- \`1 <= wordDict.length <= 1000\`
- \`1 <= wordDict[i].length <= 20\`
- All strings are lowercase English letters.`,
    constraintsDigest: 'len(s) <= 300, up to 1000 dictionary words, reuse allowed.',
    expectedTime: 'O(n^2 * m)',
    expectedSpace: 'O(n)',
    io: {
      fn: 'wordBreak',
      params: [{ name: 's', type: 'str' }, { name: 'wordDict', type: 'str[]' }],
      returns: 'bool',
    },
    examples: [
      { input: 'leetcode\nleet code', output: 'true', explanation: '"leet" + "code".' },
      {
        input: 'applepenapple\napple pen',
        output: 'true',
        explanation: '"apple" + "pen" + "apple" — reuse is allowed.',
      },
    ],
    sampleTests: [{ input: 'leetcode\nleet code' }, { input: 'applepenapple\napple pen' }],
    hiddenTests: [
      { input: 'catsandog\ncats dog sand and cat' },
      { input: 'a\na' },
      { input: 'aaaaaaa\naaa aaaa' },
      { input: 'abcd\na abc b cd' },
      { input: 'cars\ncar ca rs' },
    ],
    hints: [
      'Greedily taking the longest matching word from the front fails. Find a case where the first split looks right and dooms the rest.',
      'Define a boolean over prefixes: can the first i characters be segmented? How would you compute that from smaller prefixes?',
      '`ok[i]` is true if some `j < i` has `ok[j]` true and `s[j:i]` in the dictionary. Build i upward from 1 and return `ok[n]`.',
    ],
    editorial: {
      approachSummary: 'DP over prefixes: reachability of each split point.',
      content: `**Why greedy fails.** With \`s = "catsandog"\` and \`["cats", "dog", "sand", "and", "cat"]\`, taking the longest prefix match gives \`"cats"\`, leaving \`"andog"\` — which cannot be segmented. Backing up to \`"cat"\` leaves \`"sandog"\`, also dead. The answer is genuinely \`false\` here, but the same shape of trap makes greedy return \`false\` on strings that *are* segmentable, because an early long match can foreclose the only working split.

**The DP.** Let \`ok[i]\` mean "the first \`i\` characters can be segmented". Then:

\`\`\`
ok[0] = True                       # the empty prefix is trivially segmentable
ok[i] = any( ok[j] and s[j:i] in dictionary )  for j in 0..i-1
\`\`\`

Read that as: position \`i\` is reachable if some earlier reachable position \`j\` is followed by a dictionary word ending at \`i\`. Compute \`i\` upward so every \`ok[j]\` is already final, and the answer is \`ok[n]\`.

Put the dictionary in a **set** — the inner check happens \`O(n²)\` times and a list scan there turns an acceptable solution into a slow one.

Complexity is \`O(n² × m)\` where \`m\` is the average word length (from slicing and hashing the substring). A trie over the dictionary improves the inner loop by letting you walk characters once instead of slicing repeatedly, and it is the natural next step if you are asked to return the actual segmentation rather than a boolean.`,
      timeComplexity: 'O(n^2 * m)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Prefix reachability DP',
      time: 'O(n^2 * m)',
      space: 'O(n)',
      python: `words = set(wordDict)
n = len(s)
ok = [False] * (n + 1)
ok[0] = True
for end in range(1, n + 1):
    for start in range(end):
        if ok[start] and s[start:end] in words:
            ok[end] = True
            break
return ok[n]`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    difficulty: 'HARD',
    topics: ['array', 'two-pointers', 'stack'],
    companies: [{ slug: 'amazon', frequency: 31 }, { slug: 'google', frequency: 24 }],
    statement: `\`height[i]\` is the elevation at position \`i\`, each bar one unit wide. Compute how much rain water is trapped after it rains.

### Input format
Line 1: the array \`height\`, space-separated.

### Output format
The total trapped water.`,
    statementDigest:
      'Compute total trapped water above an elevation map; water at i is min(maxLeft, maxRight) - height[i].',
    constraints: `- \`1 <= height.length <= 2 * 10^4\`
- \`0 <= height[i] <= 10^5\``,
    constraintsDigest: 'n <= 2e4, non-negative heights, bars are one unit wide.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    io: { fn: 'trap', params: [{ name: 'height', type: 'int[]' }], returns: 'int' },
    examples: [
      {
        input: '0 1 0 2 1 0 1 3 2 1 2 1',
        output: '6',
        explanation: 'Six units settle in the dips between the taller bars.',
      },
      { input: '4 2 0 3 2 5', output: '9', explanation: 'The basin between 4 and 5 holds nine units.' },
    ],
    sampleTests: [{ input: '0 1 0 2 1 0 1 3 2 1 2 1' }, { input: '4 2 0 3 2 5' }],
    hiddenTests: [
      { input: '1' },
      { input: '3 0 3' },
      { input: '5 4 1 2' },
      { input: '0 0 0' },
      { input: '2 0 2 0 2' },
      { input: '1 2 3 4 5' },
    ],
    hints: [
      'Think about a single position rather than the whole skyline. What determines the depth of water standing at index i?',
      'Water at i rises to `min(tallest to the left, tallest to the right)` and then you subtract the bar itself. Never negative.',
      'Precomputing both maxima costs O(n) space. Instead run two pointers inward tracking leftMax and rightMax, and always advance the side whose maximum is smaller — that side is the one that bounds the water.',
    ],
    editorial: {
      approachSummary: 'Two pointers, always advancing the side with the smaller maximum.',
      content: `**Think locally.** Do not try to identify basins. Ask instead: how much water stands above index \`i\`? The water level there is set by the tallest bar to its left and the tallest to its right — whichever is *shorter* is what the water can rise to, since it spills over the lower side:

\`\`\`
water[i] = max(0, min(maxLeft[i], maxRight[i]) - height[i])
\`\`\`

Summing that over all \`i\` is the answer. The direct implementation precomputes \`maxLeft\` and \`maxRight\` as arrays: \`O(n)\` time and \`O(n)\` space, and it is a completely respectable solution that is much easier to get right.

**Removing the arrays.** Run two pointers from the ends, tracking \`leftMax\` and \`rightMax\` as you go. The trick is knowing which side you are allowed to settle.

Suppose \`leftMax <= rightMax\`. Then for the left pointer's position, the true bounding height is \`leftMax\` — because there is definitely a bar of at least \`rightMax >= leftMax\` somewhere to the right, so the right side cannot be the limiting factor. That means the water at this position is fully determined *now*, without knowing anything more about the right half. Settle it, advance the left pointer, and repeat. Symmetrically when \`rightMax\` is smaller.

That argument is the entire content of the problem, and it is why this is rated Hard despite a six-line solution: the code is short, but justifying that you may commit to a position before scanning the rest is not obvious.

A monotonic stack also solves it in \`O(n)\`, resolving each basin as a decreasing run gets closed out — worth knowing because the same machinery answers the histogram problem.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    solution: {
      approachName: 'Converging pointers with running maxima',
      time: 'O(n)',
      space: 'O(1)',
      python: `if len(height) < 3:
    return 0
left, right = 0, len(height) - 1
left_max, right_max = height[left], height[right]
total = 0
while left < right:
    if left_max <= right_max:
        left += 1
        if height[left] > left_max:
            left_max = height[left]
        else:
            total += left_max - height[left]
    else:
        right -= 1
        if height[right] > right_max:
            right_max = height[right]
        else:
            total += right_max - height[right]
return total`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'edit-distance',
    title: 'Edit Distance',
    difficulty: 'HARD',
    topics: ['string', 'dynamic-programming'],
    companies: [{ slug: 'google', frequency: 22 }, { slug: 'microsoft', frequency: 17 }],
    statement: `Return the minimum number of single-character operations needed to turn \`word1\` into \`word2\`. The permitted operations are **insert**, **delete** and **replace**.

### Input format
Line 1: \`word1\`.
Line 2: \`word2\`.

### Output format
The minimum number of operations.`,
    statementDigest:
      'Minimum insert/delete/replace operations to transform word1 into word2 (Levenshtein distance).',
    constraints: `- \`1 <= word1.length, word2.length <= 500\`
- Both consist of lowercase English letters.`,
    constraintsDigest: 'both strings <= 500 lowercase letters; insert, delete and replace each cost 1.',
    expectedTime: 'O(m * n)',
    expectedSpace: 'O(n)',
    io: {
      fn: 'minDistance',
      params: [{ name: 'word1', type: 'str' }, { name: 'word2', type: 'str' }],
      returns: 'int',
    },
    examples: [
      {
        input: 'horse\nros',
        output: '3',
        explanation: 'horse → rorse (replace h), → rose (delete r), → ros (delete e).',
      },
      { input: 'intention\nexecution', output: '5', explanation: 'Five operations suffice.' },
    ],
    sampleTests: [{ input: 'horse\nros' }, { input: 'intention\nexecution' }],
    hiddenTests: [
      { input: 'a\na' },
      { input: 'abc\nabcd' },
      { input: 'kitten\nsitting' },
      { input: 'abc\nxyz' },
      { input: 'a\nbcdef' },
    ],
    hints: [
      'Look at just the last character of each word. If they match, what have you saved? If they differ, how many distinct choices do you have?',
      'Differing last characters give exactly three options — replace, delete from word1, or insert into word1 — and each reduces the problem to a smaller pair of prefixes.',
      '`d[i][j]` = distance between the first i characters of word1 and the first j of word2. If the characters match, `d[i][j] = d[i-1][j-1]`; otherwise `1 + min(d[i-1][j-1], d[i-1][j], d[i][j-1])`.',
    ],
    editorial: {
      approachSummary: 'Levenshtein DP over prefix pairs, with a rolling row.',
      content: `Define \`d[i][j]\` as the edit distance between the first \`i\` characters of \`word1\` and the first \`j\` of \`word2\`. Reason about the last characters:

- **They match.** Nothing needs doing to align them, so \`d[i][j] = d[i-1][j-1]\`. Note this is free — no operation is spent.
- **They differ.** You have exactly three moves, each costing one operation:
  - **replace** \`word1[i-1]\` with \`word2[j-1]\` → \`d[i-1][j-1]\`
  - **delete** \`word1[i-1]\` → \`d[i-1][j]\`
  - **insert** \`word2[j-1]\` into \`word1\` → \`d[i][j-1]\`

  Take the cheapest and add one.

The base cases carry real meaning: \`d[i][0] = i\` (delete every character) and \`d[0][j] = j\` (insert every character). Getting these wrong is the most common source of off-by-one answers.

Each cell depends only on the row above and the cell to its left, so the full \`(m+1) × (n+1)\` table is unnecessary — keep one row and update it in place, giving \`O(min(m, n))\` space. When you do that, be careful to save the diagonal value before overwriting it, since \`previous[j-1]\` is exactly what the in-place write is about to destroy.

Time is \`O(m × n)\`, which at 500 × 500 is 250,000 cells — trivially fast. The difficulty is entirely in deriving the recurrence, not in performance. The same structure underlies diff tools, spell checkers and sequence alignment in bioinformatics.`,
      timeComplexity: 'O(m * n)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Rolling-row Levenshtein',
      time: 'O(m * n)',
      space: 'O(n)',
      python: `m, n = len(word1), len(word2)
previous = list(range(n + 1))
for i in range(1, m + 1):
    current = [i] + [0] * n
    for j in range(1, n + 1):
        if word1[i - 1] == word2[j - 1]:
            current[j] = previous[j - 1]
        else:
            current[j] = 1 + min(previous[j - 1], previous[j], current[j - 1])
    previous = current
return previous[n]`,
    },
  },

  /* ══════════════════════════════════════════════════════════════════════ */
  {
    slug: 'largest-rectangle-in-histogram',
    title: 'Largest Rectangle In Histogram',
    difficulty: 'HARD',
    topics: ['array', 'stack'],
    companies: [{ slug: 'google', frequency: 19 }, { slug: 'amazon', frequency: 16 }],
    statement: `Given \`heights\` representing a histogram where each bar is one unit wide, return the area of the largest rectangle that fits entirely inside the histogram.

### Input format
Line 1: the array \`heights\`, space-separated.

### Output format
The largest rectangle area.`,
    statementDigest:
      'Largest axis-aligned rectangle fitting inside a histogram of unit-width bars.',
    constraints: `- \`1 <= heights.length <= 10^5\`
- \`0 <= heights[i] <= 10^4\``,
    constraintsDigest: 'n <= 1e5, non-negative bar heights, unit widths.',
    expectedTime: 'O(n)',
    expectedSpace: 'O(n)',
    io: { fn: 'largestRectangleArea', params: [{ name: 'heights', type: 'int[]' }], returns: 'int' },
    examples: [
      {
        input: '2 1 5 6 2 3',
        output: '10',
        explanation: 'Bars 5 and 6 give height 5 over width 2 = 10.',
      },
      { input: '2 4', output: '4', explanation: 'The single bar of height 4.' },
    ],
    sampleTests: [{ input: '2 1 5 6 2 3' }, { input: '2 4' }],
    hiddenTests: [
      { input: '1' },
      { input: '5 4 3 2 1' },
      { input: '1 2 3 4 5' },
      { input: '6 2 5 4 5 1 6' },
      { input: '0 0' },
      { input: '3 3 3 3' },
    ],
    hints: [
      'Every maximal rectangle has some bar as its limiting height. Fix a bar as that height — how far left and right can the rectangle extend?',
      'It extends until it meets a bar strictly shorter than it, on each side. So for each bar you want the nearest strictly-shorter bar to its left and to its right.',
      'A stack of indices with increasing heights gives both. When the incoming bar is shorter than the stack top, the top has just found its right boundary — pop it and the new top is its left boundary.',
    ],
    editorial: {
      approachSummary: 'Monotonic increasing stack; each pop resolves one bar completely.',
      content: `Trying every pair of boundaries is \`O(n²)\`, which fails at \`n = 10^5\`.

**The reframing.** Every maximal rectangle is limited by its shortest bar. So iterate over *which bar is the limiting height*, and for each one ask how wide the rectangle can be. It extends left and right until it hits a bar strictly shorter than itself. Therefore the problem reduces to: for each index, find the nearest strictly-shorter bar on each side — a classic "previous smaller element" / "next smaller element" pair.

**The stack.** Keep a stack of indices whose heights are increasing. Push while heights rise. When the incoming bar is shorter than the bar at the top of the stack, that top bar has just discovered its **right** boundary: the current index. Pop it. Whatever is now on top is, by the increasing invariant, the nearest shorter bar to its **left**. So:

\`\`\`
width = currentIndex - stack.top - 1     (or currentIndex if the stack is empty)
area  = heights[popped] * width
\`\`\`

The \`- 1\` is because both boundaries are exclusive. Getting that wrong is the standard bug, and it shows up as slightly-too-small answers on \`[2,1,5,6,2,3]\`.

**The sentinel.** Appending a virtual bar of height 0 at the end forces every remaining bar to be popped and resolved, which removes the need for a separate drain loop after the main pass. It is a small trick that eliminates a whole class of off-by-one errors.

Each index is pushed once and popped once, so the total work is \`O(n)\` despite the inner while loop. Recognise this machinery: the same stack answers Trapping Rain Water, Next Greater Element, and — with one extra step — Maximal Rectangle in a binary matrix.`,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
    },
    solution: {
      approachName: 'Monotonic stack with a zero sentinel',
      time: 'O(n)',
      space: 'O(n)',
      python: `extended = list(heights) + [0]
stack = []
best = 0
for index, bar in enumerate(extended):
    while stack and extended[stack[-1]] > bar:
        top = stack.pop()
        left = stack[-1] if stack else -1
        width = index - left - 1
        area = extended[top] * width
        if area > best:
            best = area
    stack.append(index)
return best`,
    },
  },
];
