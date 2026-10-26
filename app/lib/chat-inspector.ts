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
  type: 'vod';
  id: string;
  url: string;
  title: string;
  streamerId: string;
  nickname: string;
  duration: number;
  files: VodFile[];
};

export function vodChunks(files: VodFile[]) {
  return files.flatMap(file => Array.from({ length: Math.floor(file.duration / 300) + 1 }, (_, index) => ({ file: file.index, start: index * 300, key: `${file.index}:${index * 300}` })));
}

export function parseSource(input: string): { type: 'vod'; id: string; url: string } {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error('SOOP 다시보기 주소를 입력해 주세요.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('https://로 시작하는 SOOP 주소만 지원합니다.');
  const matchVod = url.pathname.match(/^\/player\/(\d+)\/?$/);
  if (['vod.sooplive.com', 'vod.sooplive.co.kr'].includes(url.hostname) && matchVod) {
    return { type: 'vod', id: matchVod[1], url: `https://vod.sooplive.com/player/${matchVod[1]}` };
  }
  throw new Error('개별 다시보기 주소(vod.sooplive.com/player/번호)를 입력해 주세요.');
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
  const headers = ['아이디', '원본 아이디', '닉네임', '채팅 내용', '종류', '영상 시간', '초', '시각(ISO 8601)', '시각 기준'];
  return '\uFEFF' + [headers, ...messages.map(m => [m.userId, m.rawUserId, m.nickname, m.message, m.kind, formatTime(m.seconds), String(m.seconds), m.timestamp || '', m.timeBasis])].map(row => row.map(cell).join(',')).join('\r\n');
}
