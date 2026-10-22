import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSource, PacketDecoder, makePacket, liveMessage, normalizeId, filterMessages, exportCsv, parseTime } from '../app/lib/chat-inspector.ts';

test('accept only canonical SOOP player URLs, reject arbitrary origins and ports', () => {
  assert.equal(parseSource('https://vod.sooplive.com/player/210511423').id, '210511423');
  assert.equal(parseSource('https://play.sooplive.com/townboy/298032215#').streamerId, 'townboy');
  for (const url of ['https://www.sooplive.com/my/favorite', 'https://play.sooplive.com.evil.com/a/1', 'http://127.0.0.1/x', 'https://user@vod.sooplive.com/player/1', 'https://vod.sooplive.com:8888/player/1']) assert.throws(() => parseSource(url));
});

test('decode fragmented and coalesced UTF-8 frames without corrupting Korean/emoji', () => {
  const body = '\x0c안녕하세요 👋\x0ctester(2)\x0c\x0c\x0c\x0c닉네임\x0c';
  const frame = new TextEncoder().encode(makePacket('0005', body));
  const decoder = new PacketDecoder();
  assert.deepEqual(decoder.push(frame.slice(0, 20)), []);
  const rest = new Uint8Array(frame.length - 20 + frame.length); rest.set(frame.slice(20)); rest.set(frame, frame.length - 20);
  const packets = decoder.push(rest); assert.equal(packets.length, 2);
  const message = liveMessage(packets[0].code, packets[0].fields, 'test', 42, '2026-10-22T09:00:00Z');
  assert.equal(message.message, '안녕하세요 👋'); assert.equal(message.nickname, '닉네임'); assert.equal(message.userId, 'tester');
});

test('group ID variants, retain nickname history, filter inclusive time range', () => {
  assert.equal(normalizeId('tester(2)'), 'tester');
  assert.equal(parseTime('01:02:03'), 3723); assert.equal(parseTime('02:03'), 123); assert.ok(Number.isNaN(parseTime('01:99')));
  const message = liveMessage('0005', ['', '안녕하세요', 'tester', '', '', '', '닉네임'], 'test', 42, '2026-10-22T09:00:00Z');
  const rows = [message, { ...message, key: 'test2', nickname: '변경된닉네임', seconds: 50 }];
  assert.equal(filterMessages(rows, { query: '', userId: 'tester', from: null, to: null, kind: 'all' }).length, 2);
  assert.equal(filterMessages(rows, { query: '안녕', userId: '', from: 45, to: 60, kind: 'chat' }).length, 1);
  assert.equal(filterMessages(rows, { query: '', userId: '', from: 50, to: 50, kind: 'chat' }).length, 1);
});

test('escape multiline CSV and neutralize spreadsheet formulas; exclude whispers', () => {
  const message = liveMessage('0005', ['', '=HYPERLINK("x")\nsecond line', 'tester', '', '', '', '닉네임'], 'test', 42, '');
  const csv = exportCsv([message]);
  assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes('"\'=HYPERLINK(""x"")\nsecond line"'));
  assert.equal(liveMessage('0006', ['private'], 'x', 0, ''), null);
});

