export interface SeedTopic {
  slug: string;
  name: string;
  description: string;
  parent?: string;
  order: number;
}

export const TOPICS: SeedTopic[] = [
  { slug: 'array', name: 'Array', description: 'Contiguous indexed collections — the substrate of most DSA problems.', order: 1 },
  { slug: 'string', name: 'String', description: 'Character sequences, parsing and transformation.', order: 2 },
  { slug: 'hash-table', name: 'Hash Table', description: 'Constant-time lookup by key; the single biggest lever for turning O(n²) into O(n).', order: 3 },
  { slug: 'two-pointers', name: 'Two Pointers', description: 'Two indices moving under an invariant.', order: 4 },
  { slug: 'sliding-window', name: 'Sliding Window', description: 'A contiguous range with an incrementally maintained aggregate.', parent: 'two-pointers', order: 5 },
  { slug: 'stack', name: 'Stack', description: 'LIFO structure for nesting, matching and monotonic scans.', order: 6 },
  { slug: 'queue', name: 'Queue', description: 'FIFO structure; the engine of BFS.', order: 7 },
  { slug: 'binary-search', name: 'Binary Search', description: 'Halving a search space that carries a monotone predicate.', order: 8 },
  { slug: 'sorting', name: 'Sorting', description: 'Ordering as a preprocessing step.', order: 9 },
  { slug: 'prefix-sum', name: 'Prefix Sum', description: 'Precomputed cumulative aggregates for O(1) range queries.', parent: 'array', order: 10 },
  { slug: 'recursion', name: 'Recursion', description: 'Self-referential decomposition.', order: 11 },
  { slug: 'dynamic-programming', name: 'Dynamic Programming', description: 'Overlapping subproblems plus optimal substructure.', order: 12 },
  { slug: 'greedy', name: 'Greedy', description: 'Locally optimal choices that provably compose.', order: 13 },
  { slug: 'backtracking', name: 'Backtracking', description: 'Systematic search with pruning.', parent: 'recursion', order: 14 },
  { slug: 'graph', name: 'Graph', description: 'Nodes and edges; traversal, connectivity, shortest paths.', order: 15 },
  { slug: 'dfs', name: 'Depth-First Search', description: 'Go deep before wide; stack or recursion.', parent: 'graph', order: 16 },
  { slug: 'bfs', name: 'Breadth-First Search', description: 'Level order; shortest path in unweighted graphs.', parent: 'graph', order: 17 },
  { slug: 'union-find', name: 'Union Find', description: 'Disjoint set union with path compression.', parent: 'graph', order: 18 },
  { slug: 'tree', name: 'Tree', description: 'Acyclic connected graphs; traversals and properties.', order: 19 },
  { slug: 'heap', name: 'Heap', description: 'Priority queues for top-k and scheduling.', order: 20 },
  { slug: 'linked-list', name: 'Linked List', description: 'Pointer-based sequences.', order: 21 },
  { slug: 'matrix', name: 'Matrix', description: '2D grids; traversal and transformation.', parent: 'array', order: 22 },
  { slug: 'math', name: 'Math', description: 'Number theory, combinatorics and arithmetic reasoning.', order: 23 },
  { slug: 'bit-manipulation', name: 'Bit Manipulation', description: 'Reasoning about numbers at the bit level — XOR tricks, masks, and popcount.', order: 24 },
];

export interface SeedCompany {
  slug: string;
  name: string;
}

export const COMPANIES: SeedCompany[] = [
  { slug: 'google', name: 'Google' },
  { slug: 'amazon', name: 'Amazon' },
  { slug: 'microsoft', name: 'Microsoft' },
  { slug: 'meta', name: 'Meta' },
  { slug: 'apple', name: 'Apple' },
  { slug: 'netflix', name: 'Netflix' },
  { slug: 'uber', name: 'Uber' },
  { slug: 'adobe', name: 'Adobe' },
  { slug: 'bloomberg', name: 'Bloomberg' },
  { slug: 'atlassian', name: 'Atlassian' },
  { slug: 'oracle', name: 'Oracle' },
  { slug: 'salesforce', name: 'Salesforce' },
  { slug: 'nvidia', name: 'Nvidia' },
  { slug: 'flipkart', name: 'Flipkart' },
  { slug: 'goldman-sachs', name: 'Goldman Sachs' },
];

export interface SeedBadge {
  slug: string;
  name: string;
  description: string;
  icon: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  criteria: Record<string, unknown>;
  xpReward: number;
}

export const BADGES: SeedBadge[] = [
  {
    slug: 'first-blood',
    name: 'First Blood',
    description: 'Solve your first problem.',
    icon: 'Sparkles',
    tier: 'BRONZE',
    criteria: { type: 'solve_count', threshold: 1 },
    xpReward: 50,
  },
  {
    slug: 'ten-down',
    name: 'Ten Down',
    description: 'Solve 10 problems.',
    icon: 'Target',
    tier: 'BRONZE',
    criteria: { type: 'solve_count', threshold: 10 },
    xpReward: 100,
  },
  {
    slug: 'half-century',
    name: 'Half Century',
    description: 'Solve 50 problems.',
    icon: 'Trophy',
    tier: 'SILVER',
    criteria: { type: 'solve_count', threshold: 50 },
    xpReward: 400,
  },
  {
    slug: 'hard-mode',
    name: 'Hard Mode',
    description: 'Solve 10 Hard problems.',
    icon: 'Flame',
    tier: 'GOLD',
    criteria: { type: 'solve_count', difficulty: 'HARD', threshold: 10 },
    xpReward: 600,
  },
  {
    slug: 'unassisted',
    name: 'Unassisted',
    description: 'Solve 5 problems without unlocking a single hint.',
    icon: 'Brain',
    tier: 'SILVER',
    criteria: { type: 'no_hint_solves', threshold: 5 },
    xpReward: 300,
  },
  {
    slug: 'optimiser',
    name: 'Optimiser',
    description: 'Improve a brute-force submission to the expected complexity 10 times.',
    icon: 'Gauge',
    tier: 'GOLD',
    criteria: { type: 'complexity_improvements', threshold: 10 },
    xpReward: 500,
  },
  {
    slug: 'week-streak',
    name: 'Consistent',
    description: 'Maintain a 7-day streak.',
    icon: 'CalendarCheck',
    tier: 'BRONZE',
    criteria: { type: 'streak', threshold: 7 },
    xpReward: 150,
  },
  {
    slug: 'month-streak',
    name: 'Relentless',
    description: 'Maintain a 30-day streak.',
    icon: 'CalendarHeart',
    tier: 'PLATINUM',
    criteria: { type: 'streak', threshold: 30 },
    xpReward: 1000,
  },
  {
    slug: 'polyglot',
    name: 'Polyglot',
    description: 'Solve problems in 4 different languages.',
    icon: 'Languages',
    tier: 'SILVER',
    criteria: { type: 'languages_used', threshold: 4 },
    xpReward: 250,
  },
  {
    slug: 'first-try',
    name: 'One Shot',
    description: 'Get 10 problems accepted on the first submission.',
    icon: 'Crosshair',
    tier: 'GOLD',
    criteria: { type: 'first_attempt_solves', threshold: 10 },
    xpReward: 500,
  },
];
