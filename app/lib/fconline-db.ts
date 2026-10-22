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
  previousNicknames?: string[];
}

export function indexStreamersByNickname(streamers: StreamerEntry[]) {
  const index = new Map<string, StreamerEntry>();
  for (const streamer of streamers) {
    for (const nickname of streamer.previousNicknames || []) index.set(nickname, streamer);
  }
  for (const streamer of streamers) index.set(streamer.fcNickname, streamer);
  return index;
}

export async function listStreamers(): Promise<StreamerEntry[]> {
  if (!hasRedis) return [];
  const all = await redis.hgetall<Record<string, StreamerEntry>>('fc:streamers');
  if (!all) return [];
  return Object.values(all).sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'));
}

export async function getStreamerRevision(): Promise<number> {
  if (!hasRedis) return 0;
  return await redis.get<number>('fc:streamers:revision') || 0;
}

export async function getStreamerByNickname(fcNickname: string): Promise<StreamerEntry | null> {
  if (!hasRedis) return null;
  const entry = await redis.hget<StreamerEntry>('fc:streamers', fcNickname);
  return entry || indexStreamersByNickname(await listStreamers()).get(fcNickname) || null;
}

// Rename the registration atomically and retain aliases used by historical matches.
// Return 0 for a missing entry, -1 for a nickname owned by another registration.
export async function updateStreamer(originalNickname: string, fields: Omit<StreamerEntry, 'addedAt' | 'previousNicknames'>): Promise<number> {
  if (!hasRedis) throw new Error('저장소가 연결되어 있지 않아요.');
  return redis.eval<string[], number>(`
    local raw = redis.call('HGET', KEYS[1], ARGV[1])
    if not raw then return 0 end
    local old = cjson.decode(raw)
    local updated = cjson.decode(ARGV[2])
    if updated.fcNickname ~= ARGV[1] then
      local all = redis.call('HGETALL', KEYS[1])
      for i = 1, #all, 2 do
        if all[i] ~= ARGV[1] then
          local other = cjson.decode(all[i + 1])
          if all[i] == updated.fcNickname then return -1 end
          for _, alias in ipairs(other.previousNicknames or {}) do
            if alias == updated.fcNickname then return -1 end
          end
        end
      end
    end
    local aliases = {}
    for _, alias in ipairs(old.previousNicknames or {}) do
      if alias ~= updated.fcNickname and alias ~= ARGV[1] then table.insert(aliases, alias) end
    end
    if updated.fcNickname ~= ARGV[1] then table.insert(aliases, ARGV[1]) end
    old.fcNickname = updated.fcNickname
    old.displayName = updated.displayName
    old.teamColor = updated.teamColor
    old.profileImage = updated.profileImage
    old.previousNicknames = nil
    if #aliases > 0 then old.previousNicknames = aliases end
    redis.call('HSET', KEYS[1], updated.fcNickname, cjson.encode(old))
    if updated.fcNickname ~= ARGV[1] then redis.call('HDEL', KEYS[1], ARGV[1]) end
    redis.call('INCR', KEYS[2])
    return 1
  `, ['fc:streamers', 'fc:streamers:revision'], [originalNickname, JSON.stringify(fields)]);
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
  size: 'auto' | 'large' | 'medium' | 'small'; // 기본 크기 (장수에 따른 자동 배치 기준)
  scale?: number; // 50~150(%), 기본 크기에 추가로 곱해지는 배율. 관리자가 직접 스케일 조절
  position?: string; // CSS object-position 값 (예: 'center', 'top left'). 이미지가 잘릴 때 보여줄 위치
  fit?: 'cover' | 'contain'; // cover: 꽉 채우고 잘림 허용(기본) / contain: 여백을 채워서 전체 내용을 다 보여줌
  link?: string; // 이미지 클릭 시 이동할 링크(선택). 있으면 확대 대신 새 탭으로 이동
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
