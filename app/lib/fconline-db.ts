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
    const ts = new Date(m.matchDate).getTime() || Date.now();
    pipeline.set(`fc:match:${m.matchId}`, m);
    pipeline.zadd('fc:matches:all', { score: ts, member: m.matchId });
    pipeline.zadd(`fc:matches:opp:${m.oppOuid}`, { score: ts, member: m.matchId });
  }
  await pipeline.exec();
}

export async function getStoredMatchesForOpponent(oppOuid: string): Promise<StoredMatch[]> {
  if (!hasRedis) return [];
  const ids = await redis.zrange<string[]>(`fc:matches:opp:${oppOuid}`, 0, -1, { rev: true });
  if (!ids || ids.length === 0) return [];
  const pipeline = redis.pipeline();
  for (const id of ids) pipeline.get(`fc:match:${id}`);
  const results = await pipeline.exec<StoredMatch[]>();
  return (results || []).filter(Boolean) as StoredMatch[];
}

export async function getAllStoredMatches(limit = 500): Promise<StoredMatch[]> {
  if (!hasRedis) return [];
  const ids = await redis.zrange<string[]>('fc:matches:all', 0, limit - 1, { rev: true });
  if (!ids || ids.length === 0) return [];
  const pipeline = redis.pipeline();
  for (const id of ids) pipeline.get(`fc:match:${id}`);
  const results = await pipeline.exec<StoredMatch[]>();
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

// 저장된 매치 중 가장 최근 날짜 - 증분 스캔의 기준점(이 날짜 이후만 새로 확인하면 됨)
export async function getLatestStoredMatchDate(): Promise<string | null> {
  if (!hasRedis) return null;
  const top = await redis.zrange<string[]>('fc:matches:all', 0, 0, { rev: true });
  if (!top || top.length === 0) return null;
  const match = await redis.get<StoredMatch>(`fc:match:${top[0]}`);
  return match?.matchDate || null;
}
