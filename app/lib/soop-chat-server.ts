import { load } from 'cheerio';
import { unstable_cache } from 'next/cache';
import { normalizeId, parseSource, type ChatMessage, type ChatSource } from './chat-inspector';

const HEADERS = { 'User-Agent': 'Mozilla/5.0', Referer: 'https://vod.sooplive.com/', Origin: 'https://vod.sooplive.com' };
export class SourceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

async function upstream(url: string, init: RequestInit = {}) {
  try {
    const response = await fetch(url, { ...init, headers: { ...HEADERS, ...init.headers }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error();
    const reader = response.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 8_000_000) { await reader.cancel(); throw new SourceError('채팅 응답이 너무 큽니다. 구간을 다시 시도해 주세요.', 502); }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch (error) {
    if (error instanceof SourceError) throw error;
    throw new SourceError('SOOP에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', 502);
  }
}

type RawFile = { duration: number; chat?: string; file_start?: string; file_info_key: string; hide?: string };
type VodData = { title: string; bj_id: string; user_nick?: string; files: RawFile[] };

const vodData = unstable_cache(async (id: string): Promise<VodData> => {
  const result = JSON.parse(await upstream('https://api.m.sooplive.com/station/video/a/view', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ nTitleNo: id, nApiLevel: '11' }).toString(),
  }));
  if (result.result !== 1 || !Array.isArray(result.data?.files)) {
    throw new SourceError('이 다시보기를 가져올 수 없습니다. 삭제·비공개·로그인 제한 여부를 SOOP에서 확인해 주세요.', 403);
  }
  return result.data;
}, ['chat-inspector-vod-v1'], { revalidate: 30 });

function startedAt(value?: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value.replace(' ', 'T') + '+09:00');
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export async function getVodSource(id: string): Promise<ChatSource> {
  if (!/^\d{1,15}$/.test(id)) throw new SourceError('올바른 다시보기 번호가 아닙니다.');
  const data = await vodData(id); let offset = 0;
  const files = data.files.map((file, index) => {
    const duration = Number(file.duration) / 1000;
    if (!Number.isFinite(duration) || duration < 0) throw new SourceError('영상 길이를 확인할 수 없습니다.', 502);
    const value = { index, duration, offset, startedAt: startedAt(file.file_start) }; offset += duration; return value;
  });
  return { type: 'vod', id, url: `https://vod.sooplive.com/player/${id}`, title: data.title, streamerId: data.bj_id, nickname: data.user_nick || data.bj_id, duration: offset, files };
}

export async function getSource(input: string): Promise<ChatSource> {
  let source: ReturnType<typeof parseSource>;
  try { source = parseSource(input); } catch (e) { throw new SourceError((e as Error).message); }
  if (source.type === 'vod') return getVodSource(source.id);
  const result = JSON.parse(await upstream('https://live.sooplive.com/afreeca/player_live_api.php', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: source.url, Origin: 'https://play.sooplive.com' },
    body: new URLSearchParams({ bid: source.streamerId!, bno: source.id, type: 'live', pwd: '', player_type: 'html5', stream_type: 'common', quality: 'HD', mode: 'landing', from_api: '0' }).toString(),
  }));
  const c = result.CHANNEL;
  if (!c || Number(c.RESULT) !== 1 || c.BSTATUS !== 'BROADING') throw new SourceError('방송이 종료되었거나 공개 채팅에 연결할 수 없습니다. 현재 생방송 주소를 확인해 주세요.', 409);
  if (String(c.BNO) !== source.id || c.BJID !== source.streamerId) throw new SourceError('현재 방송 번호가 입력한 주소와 다릅니다. SOOP에서 새 생방송 주소를 복사해 주세요.', 409);
  if (c.BPWD === 'Y' || Number(c.GRADE) > 0) throw new SourceError('비밀번호·성인 인증이 필요한 방송은 이 도구에서 지원하지 않습니다.', 403);
  const host = String(c.CHDOMAIN), port = Number(c.CHPT) + 1;
  if (!/^chat-[a-z0-9-]+\.sooplive\.(com|co\.kr)$/i.test(host) || port < 1 || port > 65535 || !/^\d+$/.test(String(c.CHATNO))) throw new SourceError('채팅 서버 주소를 확인할 수 없습니다.', 502);
  return { ...source, streamerId: source.streamerId!, title: c.TITLE, nickname: c.BJNICK, duration: Number(c.BTIME) || 0, socketUrl: `wss://${host}:${port}/Websocket/${source.streamerId}`, chatNo: String(c.CHATNO) };
}

export function parseVodXml(xml: string, source: ChatSource, fileIndex: number, chunkStart: number): ChatMessage[] {
  if (!/<root[\s>]/.test(xml) || !/<\/root\s*>/.test(xml)) throw new SourceError('SOOP이 정상 채팅 파일을 반환하지 않았습니다.', 502);
  const $ = load(xml, { xml: true }); const file = source.files![fileIndex]; const messages: ChatMessage[] = [];
  $('root').children().each((index, element) => {
    const node = $(element), tag = element.type === 'tag' ? element.name : '';
    const timeText = node.children('t').text(); const seconds = Number(timeText);
    if (!timeText || !Number.isFinite(seconds) || seconds < chunkStart || seconds >= chunkStart + 300 || seconds > file.duration) return;
    // Membership/system events without text are not chat messages. Keep text-bearing donations too.
    const rawUserId = node.children(tag === 'ogq' ? 's' : 'u').text();
    const nickname = node.children(tag === 'ogq' ? 'sn' : 'n').text();
    const message = tag === 'ogq' ? `[이모티콘 ${node.children('gid').text()}/${node.children('sid').text()}]` : node.children('m').text();
    if (!rawUserId || !message) return;
    messages.push({ key: `${source.id}:${fileIndex}:${chunkStart}:${index}`, rawUserId, userId: normalizeId(rawUserId), nickname, message,
      kind: tag === 'chat' ? 'chat' : tag === 'ogq' ? 'emoticon' : 'event', seconds: file.offset + seconds,
      timestamp: file.startedAt ? new Date(new Date(file.startedAt).getTime() + seconds * 1000).toISOString() : null,
      timeBasis: file.startedAt ? 'estimated' : 'unknown' });
  });
  return messages;
}

export async function getVodChunk(id: string, fileIndex: number, start: number) {
  const source = await getVodSource(id);
  if (!Number.isInteger(fileIndex) || fileIndex < 0 || !source.files?.[fileIndex] || !Number.isInteger(start) || start < 0 || start % 300 !== 0 || start > source.files[fileIndex].duration) throw new SourceError('유효하지 않은 채팅 구간입니다.');
  const raw = (await vodData(id)).files[fileIndex];
  if (raw.hide === 'Y' || !raw.chat) throw new SourceError('이 영상 구간에 공개된 채팅 파일이 없습니다.', 404);
  const url = new URL(raw.chat);
  const validHost = /^(videoimg|vod-[a-z0-9-]+)\.sooplive\.(com|co\.kr)$/.test(url.hostname);
  if (url.protocol !== 'https:' || !validHost || url.port || url.username || url.password || !(url.pathname === '/php/ChatLoadSplit.php' || url.pathname.endsWith('_c.xml'))) throw new SourceError('지원하지 않는 채팅 파일 주소입니다.', 502);
  url.searchParams.set('startTime', String(start));
  const xml = await upstream(url.toString());
  return { messages: parseVodXml(xml, source, fileIndex, start) };
}
