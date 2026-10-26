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
