import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { saveMatches, getStreamerByNickname, getStoredMatchesForOpponent, getAllStoredMatches, listStreamers, type StoredMatch } from '@/app/lib/fconline-db';

// ── NEXON Open API (FC 온라인) ──────────────────────────────────────────────
// 문서: https://openapi.nexon.com/ko/game/fconline/
// 인증: 헤더 x-nxopen-api-key
const NEXON_KEY = process.env.NEXON_API_KEY || '';
const BASE = 'https://open.api.nexon.com/fconline/v1';
const SME_NICKNAME = process.env.SMEB_FC_NICKNAME || ''; // 스맵의 FC 온라인 닉네임

// 매치 타입: 40=클래식1on1(스트리머 대결 대부분 여기), 50=공식경기
// 30(리그친선)/60(공식친선)은 실측 결과 거의 안 쓰여서 API 호출량 절약을 위해 제외
const MATCH_TYPES = [40, 50];
// 상대전적 검색 시 뒤져볼 최근 경기 수 (매치타입별로 각각 이만큼 조회함)
// 넥슨 개발단계 키는 하루 1,000건 한도라, 검색 한 번에 match-detail 호출을
// 너무 많이 쓰지 않도록 보수적으로 잡음 (2타입 × 20 = 최대 40건/검색)
const SEARCH_DEPTH = 20;

// 429(rate limit) 응답 시 짧게 기다렸다가 재시도. 개발단계 키는 호출 한도가 낮아서
// 여러 요청이 겹치면 종종 걸림 - 실패를 '없음'으로 오판하지 않도록 재시도로 흡수.
async function nexonFetch(url: string, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url, { headers: { 'x-nxopen-api-key': NEXON_KEY }, cache: 'no-store' });
    if (res.status !== 429) return res;
    if (i < retries) await new Promise(r => setTimeout(r, 150 * (i + 1)));
  }
  return fetch(url, { headers: { 'x-nxopen-api-key': NEXON_KEY }, cache: 'no-store' });
}

async function getOuid(nickname: string): Promise<string | null> {
  const res = await nexonFetch(`${BASE}/id?nickname=${encodeURIComponent(nickname)}`);
  if (res.status === 404) return null; // 진짜로 없는 닉네임
  if (res.status === 429) throw new Error('오늘의 넥슨 API 호출 한도를 다 썼어요. 하루 단위로 초기화되니 내일 다시 시도해주세요.');
  if (!res.ok) throw new Error(`넥슨 API 오류 (${res.status}) - 잠시 후 다시 시도해주세요.`);
  const data = await res.json();
  return data?.ouid || null;
}

async function getMatchIds(ouid: string, matchtype: number, limit: number): Promise<string[]> {
  const res = await nexonFetch(`${BASE}/user/match?ouid=${ouid}&matchtype=${matchtype}&offset=0&limit=${limit}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function getMatchDetail(matchId: string): Promise<any | null> {
  const res = await nexonFetch(`${BASE}/match-detail?matchid=${matchId}`);
  if (!res.ok) return null;
  return res.json();
}

// 선수 고유식별자(spId) → 이름 매핑. 실패해도 페이지가 깨지지 않도록 방어적으로 처리.
let spidCache: Record<string, string> | null = null;
async function getSpidMap(): Promise<Record<string, string>> {
  if (spidCache) return spidCache;
  try {
    const res = await fetch('https://open.api.nexon.com/static/fconline/meta/spid.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('spid fetch failed');
    const list = await res.json();
    const map: Record<string, string> = {};
    for (const p of list) map[String(p.id)] = p.name;
    spidCache = map;
  } catch {
    spidCache = {};
  }
  return spidCache;
}

// matchInfo 배열 안에서 선수 리스트(스쿼드)를 뽑아내는 헬퍼.
// 참가자 객체에 직접 player: [{ spId, spPosition, spGrade, status:{...} }] 형태로 들어있음.
// status에 있는 필드를 최대한 그대로 다 보존해서, 개인 상세 스탯 화면에서 쓸 수 있게 함.
function extractSquad(participant: any, spidMap: Record<string, string>) {
  const raw = participant?.player;
  if (!Array.isArray(raw)) return [];
  return raw.map((p: any) => {
    const spId = String(p.spId ?? '');
    const s = p.status || {};
    return {
      spId,
      name: spidMap[spId] || `선수#${spId || '?'}`,
      position: p.spPosition ?? null,
      grade: p.spGrade ?? null, // 카드 강화등급 (추정)
      stats: {
        rating: s.spRating ?? null,
        goal: s.goal ?? 0,
        assist: s.assist ?? 0,
        shoot: s.shoot ?? 0,
        effectiveShoot: s.effectiveShoot ?? 0,
        passTry: s.passTry ?? 0,
        passSuccess: s.passSuccess ?? 0,
        dribbleTry: s.dribbleTry ?? 0,
        dribbleSuccess: s.dribbleSuccess ?? 0,
        ballPossessionTry: s.ballPossesionTry ?? s.ballPossessionTry ?? 0,
        ballPossessionSuccess: s.ballPossesionSuccess ?? s.ballPossessionSuccess ?? 0,
        aerialTry: s.aerialTry ?? 0,
        aerialSuccess: s.aerialSuccess ?? 0,
        blockTry: s.blockTry ?? 0,
        block: s.block ?? 0,
        tackleTry: s.tackleTry ?? 0,
        tackle: s.tackle ?? 0,
        intercept: s.intercept ?? 0,
        defending: s.defending ?? 0,
        yellowCards: s.yellowCards ?? 0,
        redCards: s.redCards ?? 0,
      },
    };
  });
}

function extractResult(detail: any, matchtype: number) {
  const info = detail?.matchInfo;
  if (!Array.isArray(info) || info.length < 2) return null;
  return { info };
}

// 팀 단위 스탯 - matchDetail/pass/defence의 팀 전체 기록 + 스쿼드 평균(평점) + shootDetail(득점 위치/거리)
// averageRating 필드는 실측 결과 개인 평점과 스케일이 안 맞아서(비정상적으로 낮음) 안 씀
function extractTeamStats(participant: any, squad: any[]) {
  const md = participant?.matchDetail || {};
  const pass = participant?.pass || {};
  const def = participant?.defence || {};
  const shootDetail: any[] = Array.isArray(participant?.shootDetail) ? participant.shootDetail : [];

  let shoot = 0, effShoot = 0;
  let ratingSum = 0, ratingCnt = 0;
  let intercept = 0, dribbleTry = 0, dribbleSuccess = 0, aerialTry = 0, aerialSuccess = 0;
  for (const p of squad) {
    const s = p.stats || {};
    shoot += s.shoot || 0;
    effShoot += s.effectiveShoot || 0;
    intercept += s.intercept || 0;
    dribbleTry += s.dribbleTry || 0;
    dribbleSuccess += s.dribbleSuccess || 0;
    aerialTry += s.aerialTry || 0;
    aerialSuccess += s.aerialSuccess || 0;
    if (typeof s.rating === 'number' && s.rating > 0) { ratingSum += s.rating; ratingCnt++; }
  }

  // 득점 위치 기반 - inPenalty(박스 안 여부)는 검증된 필드라 이걸로 계산, 세부 유형 코드는 불확실해서 사용 안함
  const goals = shootDetail.filter(g => g && typeof g.x === 'number');
  const inBoxGoals = goals.filter(g => g.inPenalty).length;
  const avgGoalDistance = goals.length
    ? +(goals.reduce((sum, g) => sum + Math.abs(1 - g.x) * 105, 0) / goals.length).toFixed(1)
    : null;

  return {
    rating: ratingCnt ? +(ratingSum / ratingCnt).toFixed(2) : null,
    possession: md.possession ?? null,
    cornerKick: md.cornerKick ?? null,
    foul: md.foul ?? null,
    offside: md.offsideCount ?? null,
    systemPause: md.systemPause ?? null,
    yellowCards: md.yellowCards ?? null,
    redCards: md.redCards ?? null,
    shoot, effectiveShoot: effShoot,
    passSuccessRate: pass.passTry ? +((pass.passSuccess / pass.passTry) * 100).toFixed(1) : null,
    passTry: pass.passTry ?? null, passSuccess: pass.passSuccess ?? null,
    dribbleSuccessRate: dribbleTry ? +((dribbleSuccess / dribbleTry) * 100).toFixed(1) : null,
    dribbleTry, dribbleSuccess,
    aerialSuccessRate: aerialTry ? +((aerialSuccess / aerialTry) * 100).toFixed(1) : null,
    aerialTry, aerialSuccess,
    tackleTry: def.tackleTry ?? null, tackleSuccess: def.tackleSuccess ?? null,
    tackleSuccessRate: def.tackleTry ? +((def.tackleSuccess / def.tackleTry) * 100).toFixed(1) : null,
    blockTry: def.blockTry ?? null, blockSuccess: def.blockSuccess ?? null,
    blockSuccessRate: def.blockTry ? +((def.blockSuccess / def.blockTry) * 100).toFixed(1) : null,
    intercept,
    goalCount: goals.length, inBoxGoalRate: goals.length ? +((inBoxGoals / goals.length) * 100).toFixed(1) : null,
    avgGoalDistance,
  };
}
// 매치 목록에서 선수(spId)별 평균 스탯을 집계하고 베스트/배드 선수를 표시
function aggregatePlayerStats(matches: any[], side: 'meSquad' | 'oppSquad') {
  const map = new Map<string, {
    spId: string; name: string; games: number;
    sumRating: number; cntRating: number;
    sumShoot: number; sumEffShoot: number;
    sumPassTry: number; sumPassSuccess: number;
    sumTackle: number; sumBlock: number;
  }>();

  for (const m of matches) {
    const squad = m[side] as any[];
    for (const p of squad || []) {
      if (!p.spId) continue;
      let e = map.get(p.spId);
      if (!e) {
        e = { spId: p.spId, name: p.name, games: 0, sumRating: 0, cntRating: 0, sumShoot: 0, sumEffShoot: 0, sumPassTry: 0, sumPassSuccess: 0, sumTackle: 0, sumBlock: 0 };
        map.set(p.spId, e);
      }
      e.games++;
      const st = p.stats || {};
      // 평점 0은 실제로 출전하지 않은 벤치 멤버인 경우가 많아 평균 계산에서 제외
      if (typeof st.rating === 'number' && st.rating > 0) { e.sumRating += st.rating; e.cntRating++; }
      if (typeof st.shoot === 'number') e.sumShoot += st.shoot;
      if (typeof st.effectiveShoot === 'number') e.sumEffShoot += st.effectiveShoot;
      if (typeof st.passTry === 'number') e.sumPassTry += st.passTry;
      if (typeof st.passSuccess === 'number') e.sumPassSuccess += st.passSuccess;
      if (typeof st.tackle === 'number') e.sumTackle += st.tackle;
      if (typeof st.block === 'number') e.sumBlock += st.block;
    }
  }

  const list = [...map.values()]
    .filter(e => e.cntRating > 0) // 한 번도 실제로 뛴 기록(평점>0)이 없는 벤치 멤버는 제외
    .map(e => ({
    spId: e.spId, name: e.name, games: e.games,
    avgRating: +(e.sumRating / e.cntRating).toFixed(2),
    avgShoot: +(e.sumShoot / e.games).toFixed(1),
    avgEffectiveShoot: +(e.sumEffShoot / e.games).toFixed(1),
    passSuccessRate: e.sumPassTry ? +((e.sumPassSuccess / e.sumPassTry) * 100).toFixed(1) : null,
    avgTackle: +(e.sumTackle / e.games).toFixed(1),
    avgBlock: +(e.sumBlock / e.games).toFixed(1),
    isBest: false, isWorst: false,
  }));

  const withRating = [...list].sort((a, b) => (b.avgRating as number) - (a.avgRating as number));
  if (withRating.length > 1) {
    withRating[0].isBest = true;
    withRating[withRating.length - 1].isWorst = true;
  }
  list.sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1));
  return list;
}

// 최근 경기 상세 스캔 결과를 공유 캐시로 저장 - 상대전적 검색과 '최근 붙었던 상대' 목록이
// 이 하나의 스캔 결과를 같이 재사용해서 넥슨 API 호출을 중복으로 쓰지 않게 함.
const getRecentMatchesRaw = unstable_cache(
  async (meOuid: string) => {
    const results: { matchType: number; detail: any }[] = [];
    for (const matchtype of MATCH_TYPES) {
      const ids = await getMatchIds(meOuid, matchtype, SEARCH_DEPTH);
      const CHUNK = 10;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const details = await Promise.all(chunk.map(getMatchDetail));
        for (const detail of details) {
          if (detail && extractResult(detail, matchtype)) results.push({ matchType: matchtype, detail });
        }
      }
    }
    return results;
  },
  ['fconline-recent-matches'],
  { revalidate: 1800 } // 30분 - 상대 검색/목록이 이 캐시를 공유해서 API 호출을 아낌
);

// 통산 전적을 매번 클릭해서 쌓을 필요 없이, 라이브 스캔 + 저장된 과거 기록을 합쳐서 즉시 계산
function judgeOutcome(participant: any): 'win' | 'lose' | 'draw' | 'unknown' {
  const md = participant?.matchDetail || {};
  const raw = String(md.matchResult ?? '').toLowerCase();
  if (raw.includes('win') || raw.includes('승')) return 'win';
  if (raw.includes('lose') || raw.includes('패')) return 'lose';
  if (raw.includes('draw') || raw.includes('무')) return 'draw';
  return 'unknown';
}

async function fetchOverallLive() {
  if (!SME_NICKNAME) return { win: 0, lose: 0, draw: 0, total: 0 };
  const meOuid = await getOuid(SME_NICKNAME);
  if (!meOuid) return { win: 0, lose: 0, draw: 0, total: 0 };

  const streamers = await listStreamers();
  const registeredNicknames = new Set(streamers.map(s => s.fcNickname));

  const raw = await getRecentMatchesRaw(meOuid);
  const seen = new Set<string>();
  let win = 0, lose = 0, draw = 0;
  for (const { detail } of raw) {
    const id = detail.matchId;
    if (!id || seen.has(id)) continue;
    const me = detail.matchInfo.find((p: any) => p.ouid === meOuid);
    const opp = detail.matchInfo.find((p: any) => p.ouid !== meOuid);
    if (!me || !opp) continue;
    if (!registeredNicknames.has(opp.nickname)) continue; // 등록된 스트리머와의 경기만 집계
    seen.add(id);
    const outcome = judgeOutcome(me);
    if (outcome === 'win') win++; else if (outcome === 'lose') lose++; else if (outcome === 'draw') draw++;
  }
  // 저장소에 남아있는 과거 기록도 - 저장 당시의 상대 닉네임이 지금 기준 등록되어 있으면 포함
  const stored = await getAllStoredMatches(3000).catch(() => []);
  for (const m of stored) {
    if (seen.has(m.matchId)) continue;
    if (!registeredNicknames.has(m.oppNickname)) continue;
    seen.add(m.matchId);
    if (m.outcome === 'win') win++; else if (m.outcome === 'lose') lose++; else if (m.outcome === 'draw') draw++;
  }
  return { win, lose, draw, total: win + lose + draw };
}

// 최근 30경기 - 등록된 스트리머와 붙었던 경기만 (미등록 상대와의 일반 매칭은 제외)
async function fetchRecent30() {
  if (!SME_NICKNAME) return { matches: [] };
  const meOuid = await getOuid(SME_NICKNAME);
  if (!meOuid) return { matches: [] };

  const streamers = await listStreamers();
  const byNickname = new Map(streamers.map(s => [s.fcNickname, s]));

  const raw = await getRecentMatchesRaw(meOuid);
  const rows = raw.map(({ detail }) => {
    const me = detail.matchInfo.find((p: any) => p.ouid === meOuid);
    const opp = detail.matchInfo.find((p: any) => p.ouid !== meOuid);
    if (!me || !opp) return null;
    const s = byNickname.get(opp.nickname);
    if (!s) return null; // 등록 안 된 상대는 제외
    const outcome = judgeOutcome(me);
    const meGoal = me.shoot?.goalTotalDisplay ?? me.shoot?.goalTotal ?? null;
    const oppGoal = opp.shoot?.goalTotalDisplay ?? opp.shoot?.goalTotal ?? null;
    return {
      matchId: detail.matchId, matchDate: detail.matchDate, outcome, meGoal, oppGoal,
      oppNickname: opp.nickname, oppDisplayName: s.displayName, oppProfileImage: s.profileImage || null,
    };
  }).filter(Boolean) as any[];

  rows.sort((a, b) => (a.matchDate < b.matchDate ? 1 : -1));
  return { matches: rows.slice(0, 30) };
}
// - 관리자에 등록된 스트리머만 보여주고(닉네임/이미지 정확도를 위해), 미등록 상대는 목록에서 제외
async function fetchOpponentsList(meNickname: string) {
  const meOuid = await getOuid(meNickname);
  if (!meOuid) return { error: `'${meNickname}' 닉네임을 찾을 수 없어요.` };

  const raw = await getRecentMatchesRaw(meOuid);
  const map = new Map<string, { nickname: string; count: number; lastDate: string }>();

  for (const { detail } of raw) {
    const opp = detail.matchInfo.find((p: any) => p.ouid !== meOuid);
    if (!opp?.nickname) continue;
    const existing = map.get(opp.ouid);
    if (existing) {
      existing.count += 1;
      if (detail.matchDate > existing.lastDate) existing.lastDate = detail.matchDate;
    } else {
      map.set(opp.ouid, { nickname: opp.nickname, count: 1, lastDate: detail.matchDate });
    }
  }

  const allStreamers = await listStreamers();
  const byNickname = new Map(allStreamers.map(s => [s.fcNickname, s]));

  const opponents = [...map.values()]
    .filter(o => byNickname.has(o.nickname)) // 등록된 스트리머만
    .map(o => {
      const s = byNickname.get(o.nickname)!;
      return { nickname: o.nickname, count: o.count, lastDate: o.lastDate, displayName: s.displayName, profileImage: s.profileImage || null, teamColor: s.teamColor };
    })
    .sort((a, b) => (b.count - a.count) || (a.lastDate < b.lastDate ? 1 : -1));

  return { meNickname, opponents, searchedDepth: SEARCH_DEPTH };
}

async function fetchHead2Head(meNickname: string, opponentNickname: string) {
    // 두 조회를 동시에 쏘면 개발단계 키 rate limit에 걸리기 쉬워 순차로 진행
    const meOuid = await getOuid(meNickname);
    if (!meOuid) return { error: `'${meNickname}' 닉네임을 찾을 수 없어요.` };
    const oppOuid = await getOuid(opponentNickname);
    if (!oppOuid) return { error: `'${opponentNickname}' 닉네임을 찾을 수 없어요.` };

    const spidMap = await getSpidMap();
    const raw = await getRecentMatchesRaw(meOuid); // 상대 목록 API와 공유되는 캐시된 스캔 결과

    const matches: any[] = [];

    for (const { matchType, detail } of raw) {
      const info = detail.matchInfo;
      const me = info.find((p: any) => p.ouid === meOuid);
      const opp = info.find((p: any) => p.ouid === oppOuid);
      if (!me || !opp) continue; // 이 경기엔 그 상대가 없었음

      const meDetail = me.matchDetail || {};
      const oppDetail = opp.matchDetail || {};
      const meGoal = me.shoot?.goalTotalDisplay ?? me.shoot?.goalTotal ?? null;
      const oppGoal = opp.shoot?.goalTotalDisplay ?? opp.shoot?.goalTotal ?? null;

      let outcome: 'win' | 'lose' | 'draw' | 'unknown' = 'unknown';
      const rawResult = String(meDetail.matchResult ?? '').toLowerCase();
      if (rawResult.includes('win') || rawResult.includes('승')) outcome = 'win';
      else if (rawResult.includes('lose') || rawResult.includes('패')) outcome = 'lose';
      else if (rawResult.includes('draw') || rawResult.includes('무')) outcome = 'draw';
      else if (typeof meGoal === 'number' && typeof oppGoal === 'number') {
        outcome = meGoal > oppGoal ? 'win' : meGoal < oppGoal ? 'lose' : 'draw';
      }

      const meSquad2 = extractSquad(me, spidMap);
      const oppSquad2 = extractSquad(opp, spidMap);

      // 이 경기 MOTM(최고 평점 선수) 계산 - 양팀 통틀어 최고 평점 1명에게 표시
      let motmSpId: string | null = null;
      let motmRating = -1;
      for (const p of [...meSquad2, ...oppSquad2]) {
        const r = p.stats?.rating;
        if (typeof r === 'number' && r > motmRating) { motmRating = r; motmSpId = p.spId; }
      }
      for (const p of meSquad2) (p as any).isMotm = p.spId === motmSpId;
      for (const p of oppSquad2) (p as any).isMotm = p.spId === motmSpId;

      matches.push({
        matchId: detail.matchId ?? null,
        matchDate: detail.matchDate ?? meDetail.matchDate ?? null,
        matchType,
        outcome,
        meGoal, oppGoal,
        meSquad: meSquad2,
        oppSquad: oppSquad2,
        meTeam: extractTeamStats(me, meSquad2),
        oppTeam: extractTeamStats(opp, oppSquad2),
      });
    }

    matches.sort((a, b) => (a.matchDate < b.matchDate ? 1 : -1));

    // 영구 저장 (DB 연결돼 있으면) - 다음에 조회할 때도 계속 쌓인 기록으로 남게
    if (matches.length > 0) {
      const toStore: StoredMatch[] = matches
        .filter(m => m.matchId && m.matchDate)
        .map(m => ({
          matchId: m.matchId, matchDate: m.matchDate, matchType: m.matchType,
          meOuid, oppOuid, oppNickname: opponentNickname, outcome: m.outcome,
          meGoal: m.meGoal, oppGoal: m.oppGoal, meSquad: m.meSquad, oppSquad: m.oppSquad,
          meTeam: m.meTeam, oppTeam: m.oppTeam,
        }));
      saveMatches(toStore).catch(() => {}); // 저장 실패해도 응답엔 영향 없게
    }

    // 저장소에 쌓여있는 과거 기록과 병합 - 최근 스캔 범위 밖으로 밀려난 오래된 경기도
    // 한 번이라도 저장된 적 있으면 계속 보이도록 함
    const stored = await getStoredMatchesForOpponent(oppOuid).catch(() => []);
    const seenIds = new Set(matches.map(m => m.matchId).filter(Boolean));
    for (const s of stored) {
      if (seenIds.has(s.matchId)) continue;
      seenIds.add(s.matchId);
      matches.push({
        matchId: s.matchId, matchDate: s.matchDate, matchType: s.matchType,
        outcome: s.outcome, meGoal: s.meGoal, oppGoal: s.oppGoal,
        meSquad: s.meSquad, oppSquad: s.oppSquad,
        meTeam: s.meTeam || {}, oppTeam: s.oppTeam || {},
      });
    }
    matches.sort((a, b) => (a.matchDate < b.matchDate ? 1 : -1));

    // 병합된 전체 목록 기준으로 승/무/패 재집계
    let win = 0, lose = 0, draw = 0;
    for (const m of matches) {
      if (m.outcome === 'win') win++;
      else if (m.outcome === 'lose') lose++;
      else if (m.outcome === 'draw') draw++;
    }
    // 팀 평균 스탯 - 매치별로 계산해둔 값들을 평균
    const avgTeam = (side: 'meTeam' | 'oppTeam', key: string) => {
      const vals = matches.map(m => (m as any)[side]?.[key]).filter((v: any) => typeof v === 'number');
      return vals.length ? +(vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(1) : null;
    };
    const sumTeam = (side: 'meTeam' | 'oppTeam', key: string) => {
      const vals = matches.map(m => (m as any)[side]?.[key]).filter((v: any) => typeof v === 'number');
      return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) : 0;
    };
    const buildTeamStats = (side: 'meTeam' | 'oppTeam') => {
      const passTry = sumTeam(side, 'passTry'), passSuccess = sumTeam(side, 'passSuccess');
      const dribbleTry = sumTeam(side, 'dribbleTry'), dribbleSuccess = sumTeam(side, 'dribbleSuccess');
      const aerialTry = sumTeam(side, 'aerialTry'), aerialSuccess = sumTeam(side, 'aerialSuccess');
      const tackleTry = sumTeam(side, 'tackleTry'), tackleSuccess = sumTeam(side, 'tackleSuccess');
      const blockTry = sumTeam(side, 'blockTry'), blockSuccess = sumTeam(side, 'blockSuccess');
      return {
        rating: avgTeam(side, 'rating'),
        shoot: avgTeam(side, 'shoot'),
        effectiveShoot: avgTeam(side, 'effectiveShoot'),
        possession: avgTeam(side, 'possession'),
        cornerKick: avgTeam(side, 'cornerKick'),
        foul: avgTeam(side, 'foul'),
        offside: avgTeam(side, 'offside'),
        systemPause: avgTeam(side, 'systemPause'),
        yellowCards: avgTeam(side, 'yellowCards'),
        redCards: avgTeam(side, 'redCards'),
        intercept: avgTeam(side, 'intercept'),
        avgGoalDistance: avgTeam(side, 'avgGoalDistance'),
        inBoxGoalRate: avgTeam(side, 'inBoxGoalRate'),
        passTry, passSuccess, passSuccessRate: passTry ? +((passSuccess / passTry) * 100).toFixed(1) : null,
        dribbleTry, dribbleSuccess, dribbleSuccessRate: dribbleTry ? +((dribbleSuccess / dribbleTry) * 100).toFixed(1) : null,
        aerialTry, aerialSuccess, aerialSuccessRate: aerialTry ? +((aerialSuccess / aerialTry) * 100).toFixed(1) : null,
        tackleTry, tackleSuccess, tackleSuccessRate: tackleTry ? +((tackleSuccess / tackleTry) * 100).toFixed(1) : null,
        blockTry, blockSuccess, blockSuccessRate: blockTry ? +((blockSuccess / blockTry) * 100).toFixed(1) : null,
      };
    };

    return {
      meNickname, opponentNickname, meOuid, oppOuid,
      summary: { win, lose, draw, total: win + lose + draw },
      teamStats: { me: buildTeamStats('meTeam'), opp: buildTeamStats('oppTeam') },
      playerStats: {
        me: aggregatePlayerStats(matches, 'meSquad'),
        opp: aggregatePlayerStats(matches, 'oppSquad'),
      },
      matches: matches.slice(0, 10), // 화면엔 최근 10경기만 - 전적/스탯 집계는 전체 병합 기록 기준
      searchedDepth: SEARCH_DEPTH,
    };
}

// 성공한 결과만 캐시 (하루 1,000건 제한인 개발단계 키 기준, 같은 상대를 반복 조회해도
// API를 다시 안 쓰도록 넉넉하게 2시간 유지 - 에러 응답은 캐시하지 않음)
const getHead2HeadCached = unstable_cache(
  fetchHead2Head,
  ['fconline-head2head'],
  { revalidate: 7200 }
);

async function getHead2Head(meNickname: string, opponentNickname: string) {
  if (!NEXON_KEY) {
    return { error: 'NEXON_API_KEY가 설정되어 있지 않습니다. Vercel 프로젝트 환경변수에 NEXON_API_KEY를 추가해주세요.' };
  }
  const result = await fetchHead2Head(meNickname, opponentNickname);
  if ((result as any).error) return result; // 에러는 캐시하지 않고 바로 반환
  const cached = await getHead2HeadCached(meNickname, opponentNickname);

  // 스트리머 표시명/팀컬러는 매치 데이터 캐시와 분리해서 매번 최신으로 조회
  // (관리자에서 방금 등록/수정한 정보가 캐시 만료를 안 기다리고 바로 반영되도록)
  const [meStreamer, oppStreamer] = await Promise.all([
    getStreamerByNickname(meNickname).catch(() => null),
    getStreamerByNickname(opponentNickname).catch(() => null),
  ]);

  return {
    ...cached,
    meDisplay: { name: meStreamer?.displayName || meNickname, color: meStreamer?.teamColor || null, profileImage: meStreamer?.profileImage || (process.env.SOOP_BJID ? `https://profile.img.sooplive.com/LOGO/${process.env.SOOP_BJID.slice(0, 2)}/${process.env.SOOP_BJID}/${process.env.SOOP_BJID}.jpg` : null) },
    oppDisplay: { name: oppStreamer?.displayName || opponentNickname, color: oppStreamer?.teamColor || null, profileImage: oppStreamer?.profileImage || null },
  };
}

// 상대 목록도 결과 자체를 캐시해서 페이지 로드 때마다 다시 계산 안 하게 함
// 통산전적은 별도 캐시를 두지 않고 매번 새로 계산 - 내부에서 쓰는 getRecentMatchesRaw가
// 이미 30분 캐시라 넥슨 API 호출 부담은 없고, 페이지 열 때마다 최신 승/무/패로 보이게 함
const getOverallLiveCached = fetchOverallLive;
const getRecent30Cached = unstable_cache(fetchRecent30, ['fconline-recent30'], { revalidate: 600 });

const getOpponentsListCached = unstable_cache(
  fetchOpponentsList,
  ['fconline-opponents-list'],
  { revalidate: 1800 }
);

async function getOpponentsList(meNickname: string) {
  if (!NEXON_KEY) {
    return { error: 'NEXON_API_KEY가 설정되어 있지 않습니다.' };
  }
  return getOpponentsListCached(meNickname);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const opponent = searchParams.get('opponent');
  const me = searchParams.get('me') || SME_NICKNAME;
  const list = searchParams.get('list');
  const overall = searchParams.get('overall');
  const recent30 = searchParams.get('recent30');

  if (!me) return NextResponse.json({ error: '내 닉네임이 설정되어 있지 않아요. SMEB_FC_NICKNAME 환경변수를 추가하거나 me 파라미터를 넘겨주세요.' }, { status: 400 });

  if (recent30) {
    try {
      const data = await getRecent30Cached();
      return NextResponse.json(data);
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || '조회 실패' }, { status: 500 });
    }
  }

  if (overall) {
    try {
      const summary = await getOverallLiveCached();
      return NextResponse.json({ summary });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || '조회 실패' }, { status: 500 });
    }
  }

  if (searchParams.get('rawdebug')) {
    if (!NEXON_KEY) return NextResponse.json({ error: 'no key' }, { status: 500 });
    const meOuid = await getOuid(me);
    if (!meOuid) return NextResponse.json({ error: 'no ouid' }, { status: 404 });
    const raw = await getRecentMatchesRaw(meOuid);
    const p0 = raw[0]?.detail?.matchInfo?.[0]?.player?.[0];
    return NextResponse.json({ playerKeys: p0 ? Object.keys(p0) : null, playerSample: p0 });
  }

  if (list) {
    try {
      const data = await getOpponentsList(me);
      if ((data as any).error) return NextResponse.json(data, { status: 404 });
      return NextResponse.json(data);
    } catch (e: any) {
      return NextResponse.json({ error: '조회 중 오류가 발생했어요: ' + (e?.message || 'unknown') }, { status: 500 });
    }
  }

  if (!opponent) return NextResponse.json({ error: 'opponent 파라미터(상대 닉네임)가 필요해요.' }, { status: 400 });

  try {
    const data = await getHead2Head(me, opponent);
    if ((data as any).error) return NextResponse.json(data, { status: 404 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: '조회 중 오류가 발생했어요: ' + (e?.message || 'unknown') }, { status: 500 });
  }
}
