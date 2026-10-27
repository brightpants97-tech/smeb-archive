import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSource, normalizeId, filterMessages, exportCsv, parseTime, vodChunks } from '../app/lib/chat-inspector.ts';
import * as shared from '../app/lib/chat-inspector.ts';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Compile only the server module for unit testing; replace its framework cache wrapper.
const ts = require('typescript');
const serverCode = ts.transpileModule(readFileSync(new URL('../app/lib/soop-chat-server.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const serverModule = { exports: {} };
new Function('require', 'module', 'exports', serverCode)(name => name === './chat-inspector' ? shared : name === 'next/cache' ? { unstable_cache: fn => fn } : require(name), serverModule, serverModule.exports);
const { parseVodXml } = serverModule.exports;

test('accept only canonical SOOP player URLs, reject arbitrary origins and ports', () => {
  assert.equal(parseSource('https://vod.sooplive.com/player/210511423').id, '210511423');
  assert.throws(() => parseSource('https://play.sooplive.com/townboy/298032215#'));
  for (const url of ['https://www.sooplive.com/my/favorite', 'https://play.sooplive.com.evil.com/a/1', 'http://127.0.0.1/x', 'https://user@vod.sooplive.com/player/1', 'https://vod.sooplive.com:8888/player/1']) assert.throws(() => parseSource(url));
});

test('group ID variants, retain nickname history, filter inclusive time range', () => {
  assert.equal(normalizeId('tester(2)'), 'tester');
  assert.equal(parseTime('01:02:03'), 3723); assert.equal(parseTime('02:03'), 123); assert.ok(Number.isNaN(parseTime('01:99')));
  const message = { key: 'test', userId: 'tester', rawUserId: 'tester', nickname: '닉네임', message: '안녕하세요', kind: 'chat', seconds: 42, timestamp: '2026-10-22T09:00:00Z', timeBasis: 'estimated' };
  const rows = [message, { ...message, key: 'test2', nickname: '변경된닉네임', seconds: 50 }];
  assert.equal(filterMessages(rows, { query: '', userId: 'tester', from: null, to: null, kind: 'all' }).length, 2);
  assert.equal(filterMessages(rows, { query: '안녕', userId: '', from: 45, to: 60, kind: 'chat' }).length, 1);
  assert.equal(filterMessages(rows, { query: '', userId: '', from: 50, to: 50, kind: 'chat' }).length, 1);
});

test('escape multiline CSV and neutralize spreadsheet formulas', () => {
  const message = { key: 'test', userId: 'tester', rawUserId: 'tester', nickname: '닉네임', message: '=HYPERLINK("x")\nsecond line', kind: 'chat', seconds: 42, timestamp: null, timeBasis: 'unknown' };
  const csv = exportCsv([message]);
  assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes('"\'=HYPERLINK(""x"")\nsecond line"'));
});

test('cover final 300-second boundary and preserve repeated identical messages', () => {
  const source = { id: '1', files: [{ index: 0, offset: 0, duration: 600, startedAt: '2026-10-22T09:00:00Z' }, { index: 1, offset: 600, duration: 300, startedAt: '2026-10-22T09:10:05Z' }] };
  assert.deepEqual(vodChunks(source.files).map(c => c.key), ['0:0', '0:300', '0:600', '1:0', '1:300']);
  const row = '<chat><u>test(2)</u><n><![CDATA[닉네임]]></n><m><![CDATA[안녕 <script>]]></m><t>300.000</t></chat>';
  const xml = `<root>${row}${row}<ogq><s>other</s><sn>이름</sn><gid>abc</gid><sid>1</sid><t>300.000</t></ogq><fanclub><u>other</u><t>300</t></fanclub></root>`;
  assert.equal(parseVodXml(xml, source, 0, 0).length, 0);
  const rows = parseVodXml(xml, source, 1, 300);
  assert.equal(rows.length, 3); assert.notEqual(rows[0].key, rows[1].key);
  assert.equal(rows[0].seconds, 900); assert.equal(rows[0].timestamp, '2026-10-22T09:15:05.000Z');
  assert.equal(rows[0].message, '안녕 <script>'); assert.equal(rows[0].userId, 'test');
  assert.equal(rows[2].kind, 'emoticon'); assert.equal(rows[2].userId, 'other');
  assert.throws(() => parseVodXml('<html>error</html>', source, 0, 0));
  assert.deepEqual(parseVodXml('<root/>', source, 0, 0), []);
});

