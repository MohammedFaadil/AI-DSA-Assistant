/**
 * End-to-end smoke test against the running stack.
 * node e2e.mjs
 */
const API = 'http://127.0.0.1:4000';
let token = null;
let cookie = '';

async function call(path, { method = 'GET', body, raw = false } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  if (raw) return { status: res.status, text };
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

const ok = (label, cond, extra = '') =>
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);

// 1. Auth
let r = await call('/v1/auth/login', {
  method: 'POST',
  body: { email: 'demo@aidsamentor.dev', password: 'Demo123!' },
});
token = r.data.accessToken;
ok('login', r.status === 200, `user=${r.data.user.username} role=${r.data.user.role}`);

// 2. Problem list
r = await call('/v1/problems?pageSize=50');
ok('problem list', r.status === 200, `${r.data.total} problems`);

// 3. Filtering
r = await call('/v1/problems?difficulty=MEDIUM&topics=dynamic-programming');
ok('filter difficulty+topic', r.status === 200, `${r.data.items.length} match`);

// 4. Detail
r = await call('/v1/problems/two-sum');
const problem = r.data;
ok('problem detail', r.status === 200, `${problem.title} · ${problem.sampleTests.length} sample tests`);
ok('hidden tests are not exposed', !JSON.stringify(problem).includes('-3 4 3 90'));

// The demo account persists between runs, so assertions that depend on
// progress state must account for a problem that is already solved.
const alreadySolved = problem.userStatus === 'SOLVED';

// 5. Hint content is withheld for every level that has not been unlocked
r = await call('/v1/problems/two-sum/hints');
ok(
  'locked hints withhold content',
  r.data.hints.every((h) => h.unlocked || h.content === null),
  `${r.data.hints.filter((h) => h.unlocked).length}/3 unlocked, nextLevel=${r.data.nextLevel}`,
);

// 6. Editorial is gated until solved
r = await call('/v1/problems/two-sum/editorial');
ok(
  alreadySolved ? 'editorial open (already solved)' : 'editorial gated until solved',
  alreadySolved ? r.status === 200 : r.status === 403,
  `http=${r.status}${r.data?.error?.code ? ' code=' + r.data.error.code : ''}`,
);

// 7. Starter code
r = await call('/v1/problems/two-sum/starter-code?language=PYTHON');
const starter = r.data.code;
ok('starter code', starter.includes('def twoSum'), `${starter.split('\n').length} lines`);

// 8. Workspace session (this is what warms the AI service)
r = await call('/v1/workspace/sessions', {
  method: 'POST',
  body: { problemId: problem.id, language: 'PYTHON', assistMode: 'MODERATE' },
});
const session = r.data;
ok('workspace session', r.status === 201, `id=${session.id?.slice(0, 8)}`);

// 9. Submit a deliberately BRUTE-FORCE solution: correct but O(n^2)
const bruteForce = starter.replace(
  '    # Write your code here\n    pass',
  `    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []`,
);
ok('built brute-force submission', bruteForce.includes('for j in range'));

r = await call('/v1/executions', {
  method: 'POST',
  body: {
    problemId: problem.id,
    sessionId: session.id,
    language: 'PYTHON',
    code: bruteForce,
    mode: 'SUBMIT',
  },
});
ok('execution accepted', r.status === 202, `${r.data.totalTests} tests queued`);
const executionId = r.data.executionId;

// 10. Poll to completion
let result = null;
for (let i = 0; i < 40; i++) {
  await new Promise((res) => setTimeout(res, 700));
  const poll = await call(`/v1/executions/${executionId}`);
  if (poll.data.status === 'COMPLETED' || poll.data.status === 'FAILED') {
    result = poll.data;
    break;
  }
}
ok(
  'judge verdict',
  result?.verdict === 'ACCEPTED',
  `${result?.verdict} ${result?.passedTests}/${result?.totalTests} in ${result?.runtimeMs}ms`,
);

const hidden = result?.results.filter((t) => t.hidden) ?? [];
ok(
  'hidden test payloads redacted',
  hidden.length > 0 && hidden.every((t) => t.input === null && t.expectedOutput === null),
  `${hidden.length} hidden tests, all redacted`,
);

// 11. Editorial now unlocked
r = await call('/v1/problems/two-sum/editorial');
ok('editorial unlocked after solve', r.status === 200);

// 12. Progress updated
r = await call('/v1/progress/overview');
ok('progress recorded', r.data.totalSolved >= 1, `solved=${r.data.totalSolved} xp=${r.data.xp}`);

r = await call('/v1/progress/topics');
ok('topic mastery updated', r.data.items.length > 0,
  r.data.items.map((t) => `${t.slug}:${t.mastery}`).join(' '));

// 13. Achievements
r = await call('/v1/achievements');
const earned = r.data.items.filter((b) => b.earnedAt);
ok('badge awarded', earned.length > 0, earned.map((b) => b.slug).join(', '));

// 14. The mentor — Stage 2 with no provider configured
r = await call('/v1/ai/chat', {
  method: 'POST',
  body: {
    problemId: problem.id,
    sessionId: session.id,
    content: 'Is my approach fast enough for the constraints?',
    language: 'PYTHON',
    code: bruteForce,
  },
});
ok('mentor responded', r.status === 200, `agent=${r.data.agent} fallback=${r.data.fallbackUsed}`);
for (const block of r.data.blocks ?? []) {
  const text = block.content ?? block.explanation ?? block.message ?? '';
  console.log(`      [${block.type}] ${String(text).slice(0, 150)}`);
}

// 15. Conversation persisted
r = await call(`/v1/ai/conversations/${problem.id}`);
ok('conversation persisted', r.data.messages.length >= 2, `${r.data.messages.length} messages`);

// 16. Hint ladder
r = await call('/v1/problems/two-sum/hints/1/unlock', { method: 'POST' });
ok('hint 1 unlocked', r.status === 200, `"${r.data.content.slice(0, 70)}…"`);
ok('hint 1 does not name the technique',
  !/hash (map|table)|dictionary/i.test(r.data.content));

// 17. Leaderboard
r = await call('/v1/leaderboard');
ok('leaderboard', r.status === 200, `${r.data.items.length} ranked`);

// 18. Rate limiting headers present
const limited = await call('/v1/executions/quota');
ok('execution quota endpoint', limited.status === 200,
  `${limited.data.remaining}/${limited.data.limit} left, provider=${limited.data.provider}`);

// 19. Auth is actually enforced
const saved = token;
token = null;
r = await call('/v1/progress/overview');
ok('unauthenticated request rejected', r.status === 401, `code=${r.data?.error?.code}`);
token = saved;

// 20. Validation is enforced
r = await call('/v1/executions', {
  method: 'POST',
  body: { problemId: problem.id, language: 'BRAINFUCK', code: 'x', mode: 'RUN' },
});
ok('invalid language rejected', r.status === 400, `code=${r.data?.error?.code}`);

process.exit(0);
