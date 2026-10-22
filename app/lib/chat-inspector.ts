export type ChatMessage = {
  key: string;
  userId: string;
  rawUserId: string;
  nickname: string;
  message: string;
  kind: 'chat' | 'emoticon' | 'event';
  seconds: number;
  timestamp: string | null;
  timeBasis: 'received' | 'estimated' | 'unknown';
};

export type VodFile = { index: number; duration: number; offset: number; startedAt: string | null };
export type ChatSource = {
  type: 'vod' | 'live';
  id: string;
  url: string;
  title: string;
  streamerId: string;
  nickname: string;
  duration: number;
  files?: VodFile[];
  socketUrl?: string;
  chatNo?: string;
};

export function parseSource(input: string): { type: 'vod' | 'live'; id: string; streamerId?: string; url: string } {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error('SOOP 생방송 또는 다시보기 주소를 입력해 주세요.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('https://로 시작하는 SOOP 주소만 지원합니다.');
  const matchVod = url.pathname.match(/^\/player\/(\d+)\/?$/);
  if (['vod.sooplive.com', 'vod.sooplive.co.kr'].includes(url.hostname) && matchVod) {
    return { type: 'vod', id: matchVod[1], url: `https://vod.sooplive.com/player/${matchVod[1]}` };
  }
  const matchLive = url.pathname.match(/^\/([a-zA-Z0-9_]+)\/(\d+)\/?$/);
  if (['play.sooplive.com', 'play.sooplive.co.kr'].includes(url.hostname) && matchLive) {
    return { type: 'live', id: matchLive[2], streamerId: matchLive[1], url: `https://play.sooplive.com/${matchLive[1]}/${matchLive[2]}` };
  }
  throw new Error('즐겨찾기 목록이 아닌 개별 생방송(play.sooplive.com/아이디/번호) 또는 다시보기 주소를 넣어 주세요.');
}

export function normalizeId(value: string) { return value.replace(/\(\d+\)$/, ''); }

export function formatTime(seconds: number) {
  const n = Math.max(0, Math.floor(seconds));
  return [Math.floor(n / 3600), Math.floor(n / 60) % 60, n % 60].map(v => String(v).padStart(2, '0')).join(':');
}

export function parseTime(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d{1,4}:\d{2}(?::\d{2})?$/.test(value)) return NaN;
  const parts = value.split(':').map(Number);
  if (parts.slice(1).some(v => v > 59)) return NaN;
  return parts.reduce((a, b) => a * 60 + b, 0);
}

export function filterMessages(messages: ChatMessage[], filter: { query: string; userId: string; from: number | null; to: number | null; kind: string }) {
  const q = filter.query.trim().toLocaleLowerCase();
  return messages.filter(m => (!q || `${m.userId}\n${m.nickname}\n${m.message}`.toLocaleLowerCase().includes(q)) &&
    (!filter.userId || m.userId === filter.userId) && (filter.from === null || m.seconds >= filter.from) &&
    (filter.to === null || m.seconds <= filter.to) && (filter.kind === 'all' || m.kind === filter.kind));
}

export function exportCsv(messages: ChatMessage[]) {
  const cell = (value: string) => '"' + (/^[=+\-@\t\r\n]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"';
  const headers = ['아이디', '원본 아이디', '닉네임', '채팅 내용', '종류', '영상/수집 경과 시간', '초', '시각(ISO 8601)', '시각 기준'];
  return '\uFEFF' + [headers, ...messages.map(m => [m.userId, m.rawUserId, m.nickname, m.message, m.kind, formatTime(m.seconds), String(m.seconds), m.timestamp || '', m.timeBasis])].map(row => row.map(cell).join(',')).join('\r\n');
}

export function makePacket(code: string, body: string) {
  return '\x1b\x09' + code + new TextEncoder().encode(body).length.toString().padStart(6, '0') + '00' + body;
}

/** Lengths in SOOP frames count UTF-8 bytes, not JavaScript characters. */
export class PacketDecoder {
  private pending = new Uint8Array(0);
  push(chunk: Uint8Array): { code: string; fields: string[] }[] {
    const bytes = new Uint8Array(this.pending.length + chunk.length);
    bytes.set(this.pending); bytes.set(chunk, this.pending.length);
    const packets = []; let offset = 0;
    while (bytes.length - offset >= 14) {
      if (bytes[offset] !== 27 || bytes[offset + 1] !== 9) throw new Error('SOOP 채팅 형식이 변경되었습니다.');
      const header = new TextDecoder().decode(bytes.subarray(offset + 2, offset + 14));
      if (!/^\d{12}$/.test(header)) throw new Error('채팅 헤더를 읽을 수 없습니다.');
      const length = Number(header.slice(4, 10));
      if (length > 2_000_000) throw new Error('채팅 패킷이 너무 큽니다.');
      if (bytes.length - offset < 14 + length) break;
      packets.push({ code: header.slice(0, 4), fields: new TextDecoder().decode(bytes.subarray(offset + 14, offset + 14 + length)).split('\x0c') });
      offset += 14 + length;
    }
    this.pending = bytes.slice(offset);
    return packets;
  }
}

export function liveMessage(code: string, f: string[], key: string, seconds: number, timestamp: string): ChatMessage | null {
  let rawUserId = '', nickname = '', message = '', kind: ChatMessage['kind'] = 'chat';
  if (code === '0005') { rawUserId = f[2]; nickname = f[6]; message = f[1]; }
  else if (code === '0109') { rawUserId = f[6]; nickname = f[7]; message = `[이모티콘 ${f[3]}/${f[4]}]`; kind = 'emoticon'; }
  else return null;
  if (!rawUserId || !nickname || message === undefined) return null;
  return { key, userId: normalizeId(rawUserId), rawUserId, nickname, message, kind, seconds, timestamp, timeBasis: 'received' };
}
