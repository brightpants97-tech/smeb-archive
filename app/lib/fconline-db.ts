import { Redis } from '@upstash/redis';

// Vercel의 Upstash 통합이 만들어준 환경변수 이름 그대로 사용
const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

export const hasRedis = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

// ── 스트리머 등록 관리 ──────────────────────────────────────────────────────
// Redis Hash: fc:streamers  { [fcNickname]: JSON.stringify({displayName, teamColor, addedAt}) }
export interface StreamerEntry {
  fcNickname: string;
  displayName: string;
  teamColor: string; // hex color, 예: '#EB701A'
  profileImage?: string | null; // SOOP 방송국 프로필 이미지 URL
  addedAt: number;
}

export async function listStreamers(): Promise<StreamerEntry[]> {
  if (!hasRedis) return [];
  const all = await redis.hgetall<Record<string, StreamerEntry>>('fc:streamers');
  if (!all) return [];
  return Object.values(all).sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'));
}

export async function getStreamerByNickname(fcNickname: string): Promise<StreamerEntry | null> {
  if (!hasRedis) return null;
  const entry = await redis.hget<StreamerEntry>('fc:streamers', fcNickname);
  return entry || null;
}

export async function addStreamer(entry: StreamerEntry) {
  if (!hasRedis) throw new Error('저장소가 연결되어 있지 않아요.');
  await redis.hset('fc:streamers', { [entry.fcNickname]: entry });
}

export async function deleteStreamer(fcNickname: string) {
  if (!hasRedis) throw new Error('저장소가 연결되어 있지 않아요.');
  await redis.hdel('fc:streamers', fcNickname);
}

// ── 경기 영구 저장 ──────────────────────────────────────────────────────────
// fc:match:{matchId}          = JSON (파싱된 경기 요약 - 결과/스코어/스쿼드/스탯)
// fc:matches:all              = ZSET matchId -> matchDate(timestamp), 전체 경기 인덱스
// fc:matches:opp:{oppOuid}    = ZSET matchId -> matchDate(timestamp), 상대별 경기 인덱스
export interface StoredMatch {
  matchId: string;
  matchDate: string;
  matchType: number;
  meOuid: string;
  oppOuid: string;
  oppNickname: string;
  outcome: 'win' | 'lose' | 'draw' | 'unknown';
  meGoal: number | null;
  oppGoal: number | null;
  meSquad: any[];
  oppSquad: any[];
  meTeam?: any;
  oppTeam?: any;
}

export async function saveMatches(matches: StoredMatch[]) {
  if (!hasRedis || matches.length === 0) return;
  const pipeline = redis.pipeline();
  for (const m of matches) {
    // 넥슨 matchDate는 UTC0인데 'Z'가 없어서 그대로 파싱하면 서버 타임존에 따라 어긋날 수 있어 명시적으로 UTC 처리
    const iso = m.matchDate.endsWith('Z') ? m.matchDate : m.matchDate + 'Z';
    const ts = new Date(iso).getTime() || Date.now();
    pipeline.set(`fc:match:${m.matchId}`, m);
    pipeline.zadd('fc:matches:all', { score: ts, member: m.matchId });
    pipeline.zadd(`fc:matches:opp:${m.oppOuid}`, { score: ts, member: m.matchId });
    // 매치타입별 최신 시각을 정확히 추적하기 위한 별도 인덱스 - 이게 없으면 특정 타입(예: 공식경기)에
    // 더 최근 경기가 있을 때, 다른 타입(클래식1on1)의 아직 저장 안 된 오래된 경기를 증분스캔이
    // "이미 저장된 범위"로 착각해 통째로 건너뛰는 버그가 있었음
    pipeline.zadd(`fc:matches:type:${m.matchType}`, { score: ts, member: m.matchId });
  }
  await pipeline.exec();
}

export async function getStoredMatchesForOpponent(oppOuid: string): Promise<StoredMatch[]> {
  if (!hasRedis) return [];
  const ids = await redis.zrange<string[]>(`fc:matches:opp:${oppOuid}`, 0, -1, { rev: true });
  if (!ids || ids.length === 0) return [];
  const keys = ids.map(id => `fc:match:${id}`);
  const results = await redis.mget<StoredMatch[]>(...keys);
  return (results || []).filter(Boolean) as StoredMatch[];
}

export async function getAllStoredMatches(limit = 500): Promise<StoredMatch[]> {
  if (!hasRedis) return [];
  const ids = await redis.zrange<string[]>('fc:matches:all', 0, limit - 1, { rev: true });
  if (!ids || ids.length === 0) return [];
  // 예전엔 pipeline으로 매치마다 개별 get을 했는데, Upstash는 pipeline 안의 명령어도
  // 하나하나 과금 대상으로 카운트해서 (244경기 조회에 245개 명령 소모) 월 요청 한도를
  // 순식간에 다 써버리는 문제가 있었음. mget은 여러 키를 한 번에 가져오는 단일 명령이라
  // 같은 조회를 1개 명령으로 처리해서 비용을 수백 배 절감함
  const keys = ids.map(id => `fc:match:${id}`);
  const results = await redis.mget<StoredMatch[]>(...keys);
  return (results || []).filter(Boolean) as StoredMatch[];
}

export async function getOverallSummary() {
  if (!hasRedis) return null;
  const total = await redis.zcard('fc:matches:all');
  if (!total) return { win: 0, lose: 0, draw: 0, total: 0 };
  const matches = await getAllStoredMatches(2000);
  let win = 0, lose = 0, draw = 0;
  for (const m of matches) {
    if (m.outcome === 'win') win++;
    else if (m.outcome === 'lose') lose++;
    else if (m.outcome === 'draw') draw++;
  }
  return { win, lose, draw, total: matches.length };
}

// 최근 저장된 매치 중 가장 최근 날짜 - 증분 스캔의 기준점(이 날짜 이후만 새로 확인하면 됨)
export async function getLatestStoredMatchDate(matchtype?: number): Promise<string | null> {
  if (!hasRedis) return null;
  const key = matchtype != null ? `fc:matches:type:${matchtype}` : 'fc:matches:all';
  const top = await redis.zrange<string[]>(key, 0, 0, { rev: true });
  if (!top || top.length === 0) return null;
  const match = await redis.get<StoredMatch>(`fc:match:${top[0]}`);
  return match?.matchDate || null;
}

// ── 메인페이지 "최근 이슈" 이미지 ────────────────────────────────────────────
// Redis String: site:issues = JSON.stringify({ images: IssueImage[], updatedAt })
export interface IssueImage {
  dataUrl: string;
  size: 'auto' | 'large' | 'medium' | 'small';
  caption?: string;
}

export async function getSiteIssues(): Promise<IssueImage[]> {
  if (!hasRedis) return [];
  const data = await redis.get<{ images: IssueImage[] }>('site:issues');
  return data?.images || [];
}

export async function saveSiteIssues(images: IssueImage[]) {
  if (!hasRedis) throw new Error('저장소가 연결되어 있지 않아요.');
  await redis.set('site:issues', { images, updatedAt: Date.now() });
}

// ── 스캔 진행률 (통산전적 최신화 중 % 표시용) ────────────────────────────────
export async function setScanProgress(done: number, total: number) {
  if (!hasRedis) return;
  await redis.set('fc:scan:progress', { done, total, updatedAt: Date.now() }, { ex: 120 });
}

export async function clearScanProgress() {
  if (!hasRedis) return;
  await redis.del('fc:scan:progress');
}

export async function getScanProgress(): Promise<{ done: number; total: number; updatedAt: number } | null> {
  if (!hasRedis) return null;
  return await redis.get('fc:scan:progress');
}
