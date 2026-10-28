import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as shared from '../app/lib/chat-review.ts';
const { reviewBatches, validateDecisions, reviewCsv } = shared;
const require = createRequire(import.meta.url), ts = require('typescript');
function moduleAt(path, imports) {
  const output = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', output)(name => imports[name] || require(name), mod, mod.exports);
  return mod.exports;
}
const server = moduleAt('../app/lib/chat-review-server.ts', { './chat-review': shared });
const route = moduleAt('../app/api/chat-inspector/review/route.ts', { '@/app/lib/chat-review-server': server });
const message = (index, user = 'real-id') => ({ key: `source:0:${index}`, userId: user, rawUserId: user, nickname: '실제닉네임', message: `발언 ${index}`, kind: 'chat', seconds: index, timestamp: null, timeBasis: 'unknown' });
const rows = Array.from({ length: 65 }, (_, i) => message(i, i % 2 ? 'another-real-id' : 'real-id'));
const input = { provider: 'openai', apiKey: 'test-key-not-real', criteria: '인신공격 검토', rows: [{ id: 'm1', speaker: 'user1', text: '테스트 발언', seconds: 10, target: true }] };
const decision = { id: 'm1', verdict: 'uncertain', category: '맥락 부족', reason: '대화 맥락이 더 필요합니다.' };

test('batch every target exactly once, preserve adjacent unfiltered context and aliases', () => {
  const batches = reviewBatches(rows, rows);
  const keys = batches.flatMap(batch => Object.values(batch.keys));
  assert.equal(keys.length, rows.length); assert.equal(new Set(keys).size, rows.length);
  for (const batch of batches) {
    assert.ok(batch.rows.filter(r => r.target).length <= 20);
    assert.ok(batch.rows.length <= 100);
    assert.ok(!JSON.stringify(batch).includes('real-id')); assert.ok(!JSON.stringify(batch).includes('실제닉네임'));
  }
  const selected = reviewBatches(rows, [rows[20], rows[64]])[0];
  assert.deepEqual(selected.rows.map(r => r.id), ['m18', 'm19', 'm20', 'm21', 'm22', 'm62', 'm63', 'm64']);
  assert.deepEqual(selected.rows.filter(r => r.target).map(r => r.id), ['m20', 'm64']);
  assert.equal(selected.rows[0].speaker, batches[0].rows[0].speaker);
  assert.deepEqual(reviewBatches(rows, []), []);
  assert.deepEqual(reviewBatches([{ ...rows[0], kind: 'emoticon' }], [{ ...rows[0], kind: 'emoticon' }]), []);
});

test('split long batches without truncating text; reject oversized individual text', () => {
  const long = Array.from({ length: 30 }, (_, i) => ({ ...message(i), message: '가'.repeat(3900) }));
  const batches = reviewBatches(long, long);
  assert.equal(batches.flatMap(b => Object.keys(b.keys)).length, 30);
  for (const batch of batches) { assert.ok(JSON.stringify(batch.rows).length <= 90000); assert.ok(batch.rows.every(r => r.text.length === 3900)); }
  assert.throws(() => reviewBatches([{ ...message(0), message: '가'.repeat(4001) }], [message(0)]));
});

test('reject incomplete, duplicate, invented and malformed decisions', () => {
  assert.deepEqual(validateDecisions({ decisions: [decision] }, ['m1']), [decision]);
  for (const values of [[], [decision, decision], [{ ...decision, id: 'm9' }], [{ ...decision, reason: '' }], [{ ...decision, verdict: 'ban' }]]) assert.throws(() => validateDecisions({ decisions: values }, ['m1']));
  assert.throws(() => validateDecisions({ decisions: [decision, decision] }, ['m1', 'm2']));
});

test('validate credentials, limits, speaker aliases, duplicate IDs and targets before calling provider', () => {
  assert.deepEqual(server.validateReviewInput(input), input);
  for (const change of [{ provider: 'custom-host' }, { apiKey: '' }, { apiKey: 'test\nkeyinjection' }, { criteria: '' }, { rows: [] }, { rows: [input.rows[0], input.rows[0]] }, { rows: [{ ...input.rows[0], speaker: 'real-id' }] }, { rows: [{ ...input.rows[0], target: false }] }]) assert.throws(() => server.validateReviewInput({ ...input, ...change }));
});

test('OpenAI adapter sends structured output, disables storage and parses completed response', async () => {
  const result = await server.reviewWithProvider(input, undefined, async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer test-key-not-real');
    const body = JSON.parse(options.body); assert.equal(body.store, false); assert.equal(body.text.format.strict, true);
    assert.ok(body.instructions.includes('절대로 실행하지 않는다')); assert.equal(JSON.parse(body.input).criteria, input.criteria);
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ decisions: [decision] }) }] }] });
  });
  assert.equal(result.decisions[0].id, 'm1'); assert.equal(result.model, shared.PROVIDERS.openai.model);
});

test('Gemini adapter uses header key, fixed model and JSON schema without URL credentials', async () => {
  const result = await server.reviewWithProvider({ ...input, provider: 'gemini' }, undefined, async (url, options) => {
    assert.equal(url, `https://generativelanguage.googleapis.com/v1beta/models/${shared.PROVIDERS.gemini.model}:generateContent`);
    assert.equal(options.headers['x-goog-api-key'], input.apiKey); assert.ok(!url.includes(input.apiKey));
    const body = JSON.parse(options.body); assert.deepEqual(body.generationConfig.responseFormat.text.schema, shared.REVIEW_SCHEMA);
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ decisions: [decision] }) }] } }] });
  });
  assert.equal(result.decisions[0].verdict, 'uncertain');
});

test('provider failures do not leak raw upstream messages or pretend to be completed', async () => {
  for (const status of [401, 429, 500]) await assert.rejects(() => server.reviewWithProvider(input, undefined, async () => new Response(input.apiKey, { status })), error => !error.message.includes(input.apiKey));
  for (const data of [{ status: 'incomplete' }, { status: 'completed', output: [] }, { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ decisions: [] }) }] }] }]) await assert.rejects(() => server.reviewWithProvider(input, undefined, async () => Response.json(data)));
  await assert.rejects(() => server.reviewWithProvider({ ...input, provider: 'gemini' }, undefined, async () => Response.json({ candidates: [{ finishReason: 'SAFETY' }] })));
});

test('public route rejects missing key, cross-origin, wrong content type and oversized payload', async () => {
  const request = (body, headers = {}) => new Request('https://site.test/api/chat-inspector/review', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  assert.equal((await route.POST(request({ ...input, apiKey: '' }))).status, 400);
  assert.equal((await route.POST(request(input, { origin: 'https://evil.test' }))).status, 403);
  assert.equal((await route.POST(request(input, { 'Content-Type': 'text/plain' }))).status, 415);
  const large = await route.POST(request({ data: 'x'.repeat(350001) }));
  assert.equal(large.status, 413); assert.equal(large.headers.get('cache-control'), 'no-store');
});

test('review export preserves original evidence and separate human judgment, neutralizes formulas', () => {
  const row = { ...message(0), message: '=HYPERLINK("bad")\n원문' };
  const csv = reviewCsv([row], { [row.key]: { ai: { ...decision, provider: 'openai', model: 'gpt-4.1-mini', criteria: '기준', at: 'now' }, decision: 'dismissed', note: '+검토 메모' } });
  assert.ok(csv.includes('"real-id"')); assert.ok(csv.includes('"문제 없음"')); assert.ok(csv.includes('"\'=HYPERLINK(""bad"")\n원문"')); assert.ok(csv.includes('"\'+검토 메모"'));
});

test('time context includes exact boundaries and other users, but excludes distant messages', () => {
  const all = [0, 10, 39.9, 40, 70, 70.1, 200].map((t, i) => ({ ...message(i, i % 2 ? 'other' : 'selected'), seconds: t }));
  assert.deepEqual(shared.contextBounds(all, 3, 30), [1, 5]);
  const batch = reviewBatches(all, [all[3]], 30)[0];
  assert.deepEqual(batch.rows.map(r => r.seconds), [10, 39.9, 40, 70]);
  assert.equal(batch.rows.filter(r => r.target).length, 1);
  assert.equal(batch.contextLimited, false);
  assert.equal(batch.contexts.m3.seconds, 30);
  assert.deepEqual(shared.contextBounds(all, -1, 30), [0, 0]);
  assert.throws(() => shared.contextBounds(all, 0, 45));
});

test('dense context stays within row and character limits, never loses targets, and discloses omissions', () => {
  const dense = Array.from({ length: 220 }, (_, i) => ({ ...message(i), seconds: i / 10 }));
  const batches = reviewBatches(dense, [dense[100], dense[180]], 60);
  assert.deepEqual(batches.flatMap(b => Object.values(b.keys)), [dense[100].key, dense[180].key]);
  for (const batch of batches) {
    assert.ok(batch.rows.length <= shared.MAX_ROWS);
    assert.ok(JSON.stringify(batch.rows).length <= shared.MAX_BATCH_CHARS);
    assert.equal(batch.contextLimited, true);
    for (const [id, context] of Object.entries(batch.contexts)) {
      assert.ok(batch.rows.find(r => r.id === id && r.target));
      assert.equal(context.available, 220); assert.ok(context.included < context.available);
    }
  }
  const long = dense.map(m => ({ ...m, message: '가'.repeat(3900) }));
  const batch = reviewBatches(long, [long[100]], 60)[0];
  assert.ok(JSON.stringify(batch.rows).length <= shared.MAX_BATCH_CHARS);
  assert.ok(batch.contexts.m100.included < 100);
  assert.ok(batch.rows.every(r => r.text.length === 3900));
});

test('sample is at most 50 and both message and request budgets are enforced before execution', () => {
  const sparse = Array.from({ length: 130 }, (_, i) => ({ ...message(i), seconds: i * 1000 }));
  const config = { contextSeconds: 30, maxMessages: 500, maxRequests: 25, preview: true };
  const sample = shared.planReview(sparse, sparse, config);
  assert.equal(sample.count, 50); assert.equal(sample.remaining, 80); assert.equal(sample.batches.length, 3);
  const limited = shared.planReview(sparse, sparse, { ...config, preview: false, maxMessages: 35, maxRequests: 1 });
  assert.equal(limited.count, 20); assert.equal(limited.batches.length, 1); assert.equal(limited.remaining, 110);
  const small = shared.planReview(sparse, sparse, { ...config, maxMessages: 7 });
  assert.equal(small.count, 7);
  for (const opts of [{ maxMessages: 0 }, { maxRequests: 0 }, { maxRequests: 201 }, { maxMessages: 1.5 }, { maxMessages: NaN }]) assert.throws(() => shared.planReview(sparse, sparse, { ...config, ...opts }));
});

test('dense windows respect request budget even when fewer than 20 targets fit each request', () => {
  const dense = Array.from({ length: 200 }, (_, i) => ({ ...message(i), seconds: i / 10 }));
  const plan = shared.planReview(dense, dense.slice(50, 150), { contextSeconds: 60, maxMessages: 100, maxRequests: 2, preview: false });
  assert.ok(plan.batches.length <= 2); assert.ok(plan.count < 100); assert.equal(plan.remaining, 100 - plan.count);
  assert.ok(plan.limitedContexts > 0);
});

test('reuse results only for the same provider, model, rule and context; preserve legacy contexts', () => {
  const legacy = { decision: 'confirmed', note: '사람 메모', ai: { ...decision, provider: 'openai', model: shared.PROVIDERS.openai.model, criteria: '기준', at: 'now' } };
  assert.equal(shared.matchesReview(legacy, 'openai', '기준 ', 0), true);
  assert.equal(shared.matchesReview(legacy, 'openai', '기준', 30), false);
  const current = { ...legacy, ai: { ...legacy.ai, context: { seconds: 30, included: 10, available: 10, from: 0, to: 30 } } };
  assert.equal(shared.matchesReview(current, 'openai', '기준', 30), true);
  assert.equal(shared.matchesReview(current, 'gemini', '기준', 30), false);
  assert.equal(shared.matchesReview(current, 'openai', '다른 기준', 30), false);
  assert.equal(shared.matchesReview({ ...current, ai: { ...current.ai, model: 'old' } }, 'openai', '기준', 30), false);
  assert.equal(current.decision, 'confirmed'); assert.equal(current.note, '사람 메모');
});

test('group by stable ID, retain nickname history and keep human judgments separate from AI flags', () => {
  const all = [message(0, 'a'), { ...message(1, 'a'), nickname: '변경 이름' }, message(2, 'b'), message(3, 'b'), message(4, 'b')];
  const entries = {
    [all[0].key]: { decision: 'dismissed', note: '', ai: { ...decision, verdict: 'review' } },
    [all[1].key]: { decision: 'pending', note: '', ai: { ...decision, verdict: 'uncertain' } },
    [all[2].key]: { decision: 'confirmed', note: '직접 검토' },
    [all[3].key]: { decision: 'pending', note: '', ai: { ...decision, verdict: 'clear' } },
  };
  const users = shared.reviewUsers(all, entries);
  assert.equal(users.length, 2); assert.equal(users[0].userId, 'a');
  assert.equal(users[0].nickname, '변경 이름'); assert.equal(users[0].nicknames.length, 2);
  assert.equal(users[0].attention, 1); assert.equal(users[0].reviewed, 2); assert.equal(users[0].dismissed, 1);
  assert.equal(users[1].total, 3); assert.equal(users[1].attention, 0); assert.equal(users[1].reviewed, 1); assert.equal(users[1].confirmed, 1);
});

test('provider receives bounded context metadata and rejects invalid window metadata', async () => {
  const extended = { ...input, contextSeconds: 60, contextLimited: true };
  assert.deepEqual(server.validateReviewInput(extended), extended);
  assert.throws(() => server.validateReviewInput({ ...extended, contextSeconds: 45 }));
  assert.throws(() => server.validateReviewInput({ ...extended, contextLimited: 'false' }));
  await server.reviewWithProvider(extended, undefined, async (url, options) => {
    const prompt = JSON.parse(JSON.parse(options.body).input);
    assert.equal(prompt.contextSeconds, 60); assert.equal(prompt.contextLimited, true);
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ decisions: [decision] }) }] }] });
  });
});


test('Gemini invalid-key HTTP 400 is diagnosed as authentication failure, without leaking provider text', async () => {
  let requests = 0;
  await assert.rejects(() => server.reviewWithProvider({ ...input, provider: 'gemini' }, undefined, async () => {
    requests++;
    return Response.json({ error: { code: 400, status: 'INVALID_ARGUMENT', message: `API key not valid. ${input.apiKey}`, details: [{ reason: 'API_KEY_INVALID' }] } }, { status: 400 });
  }), error => error.status === 401 && error.message.includes('KEY_INVALID (HTTP 400)') && !error.message.includes(input.apiKey));
  assert.equal(requests, 1);
});

test('provider rejection distinguishes permanent request, access, model, billing and transient failures', async () => {
  const cases = [
    [400, { status: 'INVALID_ARGUMENT', message: 'Unknown name responseFormat' }, 'REQUEST_REJECTED', 502],
    [403, { status: 'PERMISSION_DENIED' }, 'ACCESS_DENIED', 403],
    [403, { message: 'Your API key was reported as leaked.' }, 'KEY_BLOCKED', 403],
    [404, { status: 'NOT_FOUND' }, 'MODEL_UNAVAILABLE', 502],
    [400, { status: 'FAILED_PRECONDITION', message: 'Free tier is not available in your country. Please enable billing.' }, 'BILLING_OR_QUOTA', 429],
    [402, {}, 'BILLING_OR_QUOTA', 429],
    [429, { code: 'insufficient_quota' }, 'BILLING_OR_QUOTA', 429],
    [429, { status: 'RESOURCE_EXHAUSTED' }, 'RATE_OR_QUOTA_LIMIT', 429],
    [413, {}, 'REQUEST_TOO_LARGE', 413],
    [503, {}, 'PROVIDER_UNAVAILABLE', 502],
    [504, {}, 'PROVIDER_TIMEOUT', 504],
  ];
  for (const [status, detail, code, expected] of cases) {
    let calls = 0;
    await assert.rejects(() => server.reviewWithProvider(input, undefined, async () => {
      calls++;
      return Response.json({ error: { message: input.apiKey, ...detail } }, { status });
    }), error => error.status === expected && error.message.includes(code) && error.message.includes(`HTTP ${status}`) && !error.message.includes(input.apiKey));
    assert.equal(calls, 1);
  }
});

test('non-JSON and malformed provider errors stay safe and retain their HTTP diagnosis', async () => {
  for (const body of [input.apiKey, 'null', '{"error":null}', '{"error":{"message":42,"details":[null,42]}}']) {
    await assert.rejects(() => server.reviewWithProvider(input, undefined, async () => new Response(body, { status: 400 })), error => error.message.includes('REQUEST_REJECTED (HTTP 400)') && !error.message.includes(input.apiKey));
  }
});
