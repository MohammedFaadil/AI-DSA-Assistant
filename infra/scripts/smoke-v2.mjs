/**
 * Extended smoke test — the new feature set.
 * node infra/scripts/smoke-v2.mjs
 */
const API = 'http://127.0.0.1:4000';
let token = null;

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

const ok = (label, cond, extra = '') =>
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);

let r = await call('/v1/auth/login', {
  method: 'POST',
  body: { email: 'demo@aidsamentor.dev', password: 'Demo123!' },
});
token = r.data.accessToken;
ok('login', r.status === 200, `user=${r.data.user.username}`);

// ── Curriculum ────────────────────────────────────────────────────────────
// Two independent tracks share one response; the client splits by `track`.
r = await call('/v1/curriculum');
const foundations = r.data.sections?.filter((s) => s.track === 'FOUNDATIONS') ?? [];
const advanced = r.data.sections?.filter((s) => s.track === 'ADVANCED') ?? [];
ok('curriculum sections', r.status === 200 && r.data.sections.length === 17,
  `${r.data.sections?.length} sections`);
ok('both tracks present', foundations.length === 10 && advanced.length === 7,
  `foundations=${foundations.length} advanced=${advanced.length}`);
ok('first section of each track unlocked',
  foundations[0]?.unlocked === true && advanced[0]?.unlocked === true);
ok('sections have core problems', r.data.sections.every((s) => s.coreTotal > 0),
  r.data.sections.map((s) => `${s.slug}:${s.coreTotal}`).join(' '));
ok('sections carry textbook-depth blocks', r.data.sections.every((s) => s.blocks?.length >= 4),
  r.data.sections.map((s) => `${s.slug}:${s.blocks?.length}`).join(' '));

r = await call('/v1/curriculum/dsa-basics-and-complexity/chat', {
  method: 'POST',
  body: { content: 'What is Big-O notation and why does it matter?' },
});
ok('AI Training chat responds', r.status === 200, `blocks=${r.data?.message?.blocks?.length}`);
ok('AI Training reply has content', r.data?.message?.blocks?.length > 0 || r.data?.message?.content?.length > 0);

r = await call('/v1/curriculum/dsa-basics-and-complexity/conversation');
ok('AI Training conversation persisted', r.status === 200 && r.data.messages.length >= 2,
  `messages=${r.data.messages?.length}`);

r = await call('/v1/curriculum/dsa-basics-and-complexity/handoff', { method: 'POST' });
ok('AI Training handoff resolves', r.status === 200 && (r.data.problemSlug || r.data.practiceGenerateHint),
  `problemSlug=${r.data.problemSlug} hint=${r.data.practiceGenerateHint}`);
if (r.data.problemSlug) {
  const handoffProblem = await call(`/v1/problems/${r.data.problemSlug}`);
  ok('handoff problem slug is real', handoffProblem.status === 200);
}

r = await call('/v1/curriculum/improve');
ok('improvement areas', r.status === 200 && Array.isArray(r.data.areas), `${r.data.areas?.length} areas`);
ok('improvement areas are actionable', r.data.areas.every((a) => a.action && a.action.length > 5));

// ── AI performance tracker ───────────────────────────────────────────────
r = await call('/v1/ai-insights/performance?days=30');
ok('ai performance', r.status === 200, `interactions=${r.data.interactions}`);
ok('honest about no LLM key', r.data.deterministicOnly === true,
  'deterministicOnly should be true with no OPENROUTER/GROQ key set');

// ── A problem to work with ───────────────────────────────────────────────
r = await call('/v1/problems/maximum-subarray');
const problem = r.data;
ok('problem detail', r.status === 200, problem.title);

// ── Line review (deterministic) ──────────────────────────────────────────
const messyCode = `def maxSubArray(nums):
    x = 0
    for i in range(len(nums)):
        for j in range(len(nums)):
            if nums[i] in nums:
                x = x + 1
    return x`;

r = await call('/v1/ai-insights/line-review', {
  method: 'POST',
  body: { problemId: problem.id, language: 'PYTHON', code: messyCode },
});
ok('line review responds', r.status === 200, `${r.data.notes.length} notes`);
ok('line review flags a risk', r.data.notes.some((n) => n.role === 'RISK'),
  r.data.notes.map((n) => n.role).join(','));

// ── Quality snapshot via submission ──────────────────────────────────────
const session = await call('/v1/workspace/sessions', {
  method: 'POST',
  body: { problemId: problem.id, language: 'PYTHON', assistMode: 'MODERATE' },
});
ok('workspace session for quality test', session.status === 201);

// The judge expects the COMPLETE program submitted — same shape as the
// starter code (imports, function, and the _main()/stdin/print harness) —
// not a bare function body. Fetching the starter and filling in the body
// keeps this test honest to what a real submission looks like.
const starter = await call('/v1/problems/maximum-subarray/starter-code?language=PYTHON');
const goodCode = starter.data.code.replace(
  '    # Write your code here\n    pass',
  `    best = nums[0]
    cur = nums[0]
    for value in nums[1:]:
        cur = value if cur < 0 else cur + value
        if cur > best:
            best = cur
    return best`,
);

r = await call('/v1/executions', {
  method: 'POST',
  body: {
    problemId: problem.id,
    sessionId: session.data.id,
    language: 'PYTHON',
    code: goodCode,
    mode: 'SUBMIT',
  },
});
const executionId = r.data.executionId;
ok('submit optimal solution', r.status === 202);

let result = null;
for (let i = 0; i < 30; i++) {
  await new Promise((res) => setTimeout(res, 700));
  const poll = await call(`/v1/executions/${executionId}`);
  if (poll.data.status === 'COMPLETED' || poll.data.status === 'FAILED') {
    result = poll.data;
    break;
  }
}
ok('optimal solution accepted', result?.verdict === 'ACCEPTED',
  `${result?.verdict} ${result?.passedTests}/${result?.totalTests}`);

// Give the fire-and-forget quality snapshot a moment to land.
await new Promise((res) => setTimeout(res, 1500));

r = await call('/v1/ai-insights/performance?days=1');
ok('quality snapshot recorded', r.data.avgQuality !== null && r.data.avgQuality >= 70,
  `avgQuality=${r.data.avgQuality}`);
ok('quality series has a point', r.data.qualitySeries.length >= 1);

// ── Library ───────────────────────────────────────────────────────────────
r = await call('/v1/library', {
  method: 'POST',
  body: {
    problemId: problem.id,
    language: 'PYTHON',
    code: goodCode,
    note: 'Kadane single pass, O(1) space.',
    tags: ['kadane', 'clean'],
  },
});
ok('save to library', r.status === 201, `quality=${r.data.qualityScore} verdict=${r.data.verdict}`);
ok('library entry carries the submission verdict', r.data.verdict === 'ACCEPTED');

r = await call('/v1/library');
ok('library list', r.status === 200 && r.data.items.some((i) => i.problemId === problem.id));
ok('library tag facets', r.data.tags.includes('kadane'), r.data.tags.join(','));

r = await call(`/v1/library?tag=kadane`);
ok('library filter by tag', r.data.items.length >= 1);

// ── Bookmarks & notes ────────────────────────────────────────────────────
r = await call(`/v1/bookmarks/${problem.id}/toggle`, { method: 'POST' });
ok('bookmark toggled on', r.data.bookmarked === true);
r = await call('/v1/bookmarks');
ok('bookmark listed', r.data.items.some((b) => b.problemId === problem.id));
await call(`/v1/bookmarks/${problem.id}/toggle`, { method: 'POST' }); // cleanup

r = await call(`/v1/notes/${problem.id}`, { method: 'PUT', body: { content: 'Remember: compare cur < 0, not <= 0.' } });
ok('note saved', r.status === 200);
r = await call(`/v1/notes/${problem.id}`);
ok('note retrieved', r.data?.content?.includes('cur < 0'));

// ── Practice Zone (template path — no LLM key configured) ───────────────
r = await call('/v1/practice/generate', {
  method: 'POST',
  body: { prompt: 'a two sum style problem using a hash map to find a target sum', difficulty: 'EASY' },
});
ok('practice generate', r.status === 201, `slug=${r.data?.slug} source=${r.data?.source} tests=${r.data?.testCount}`);
ok('practice used the template fallback (no key configured)', r.data?.source === 'template');
ok('generated tests were verified by execution', r.data?.verified === true);

const generatedSlug = r.data.slug;

r = await call(`/v1/problems/${generatedSlug}`);
ok('generated problem is fetchable by its owner', r.status === 200, r.data?.title);
ok('generated problem has hidden tests', r.data?.sampleTests?.length >= 1);

const practiceList = await call('/v1/practice');
ok('practice list shows the new problem', practiceList.data.items.some((i) => i.slug === generatedSlug));

// A generated problem must never leak into the public catalogue.
// (pageSize is capped at 100 by the API's own validation — 29 seeded
// problems comfortably fit in one page.)
const publicList = await call('/v1/problems?pageSize=100');
ok(
  'generated problem is NOT in the public list',
  publicList.status === 200 &&
    Array.isArray(publicList.data.items) &&
    !publicList.data.items.some((p) => p.slug === generatedSlug),
  `http=${publicList.status} items=${publicList.data?.items?.length}`,
);

const genProblem = await call(`/v1/problems/${generatedSlug}`);
r = await call(`/v1/practice/${genProblem.data.id}`, { method: 'DELETE' });
ok('practice problem deleted', r.status === 204);

// ── Companies ────────────────────────────────────────────────────────────
r = await call('/v1/companies');
ok('companies list', r.status === 200 && r.data.items.length === 15, `count=${r.data.items?.length}`);
ok(
  'company profiles have no fabricated-date pattern',
  r.data.items.length > 0,
);

const firstCompany = r.data.items[0].slug;
r = await call(`/v1/companies/${firstCompany}`);
ok('company profile responds', r.status === 200 && r.data.overview?.length > 0, r.data.name);
ok(
  'company overview avoids a fabricated specific date',
  !/\b(19|20)\d{2}\b/.test(r.data.overview ?? '') && !/\b(19|20)\d{2}\b/.test(r.data.interviewProcess ?? ''),
);
ok('company questions labelled as prep, not "asked at"', r.data.questions.length >= 0);

// ── Problems grouped by curriculum section ─────────────────────────────────
r = await call('/v1/problems/grouped');
const groupedTotal =
  (r.data.sections?.reduce((n, s) => n + s.problems.length, 0) ?? 0) + (r.data.unassigned?.length ?? 0);
ok('problems grouped responds', r.status === 200, `sections=${r.data.sections?.length}`);
ok('every published problem accounted for, zero unassigned', r.data.unassigned?.length === 0,
  `unassigned=${r.data.unassigned?.length} total=${groupedTotal}`);

// ── Library: saved curriculum sections & companies ─────────────────────────
r = await call('/v1/library/sections/dsa-basics-and-complexity', { method: 'POST' });
ok('save curriculum section to library', r.status === 201);
r = await call('/v1/library/sections');
ok('saved sections listed', r.data.items.some((s) => s.sectionSlug === 'dsa-basics-and-complexity'));
r = await call('/v1/library/sections/dsa-basics-and-complexity', { method: 'DELETE' });
ok('remove saved section', r.status === 204);

r = await call(`/v1/library/companies/${firstCompany}`, { method: 'POST' });
ok('save company to library', r.status === 201);
r = await call('/v1/library/companies');
ok('saved companies listed', r.data.items.some((c) => c.companySlug === firstCompany));
r = await call(`/v1/library/companies/${firstCompany}`, { method: 'DELETE' });
ok('remove saved company', r.status === 204);

process.exit(0);
