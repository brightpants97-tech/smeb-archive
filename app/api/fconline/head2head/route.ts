import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { saveMatches, getStreamerByNickname, getAllStoredMatches, getLatestStoredMatchDate, setScanProgress, clearScanProgress, getScanProgress, listStreamers, type StoredMatch } from '@/app/lib/fconline-db';

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
// 서비스 단계 키로 전환되어 호출 한도가 넉넉해져서, 특정 상대와 실제 맞붙은 경기를
// 더 많이 집계할 수 있도록 20→50으로 확대 (2타입 × 50 = 최대 100건/검색)
const SEARCH_DEPTH = 50;

// 이 날짜 이전 경기는 전적/스탯 집계에서 전부 제외 (2026-08-10부터 집계 시작)
const DATA_CUTOFF = '2026-08-10T00:00:00';
const isAfterCutoff = (dateStr: string | null | undefined) => !!dateStr && dateStr >= DATA_CUTOFF;

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

async function getMatchIds(ouid: string, matchtype: number, limit: number, offset = 0): Promise<string[]> {
  const res = await nexonFetch(`${BASE}/user/match?ouid=${ouid}&matchtype=${matchtype}&offset=${offset}&limit=${limit}`);
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
    spId: string; name: string; games: number; position: number | null;
    sumRating: number; cntRating: number;
    sumShoot: number; sumEffShoot: number; sumGoal: number; sumAssist: number;
    sumPassTry: number; sumPassSuccess: number;
    sumDribbleTry: number; sumDribbleSuccess: number;
    sumBallTry: number; sumBallSuccess: number;
    sumAerialTry: number; sumAerialSuccess: number;
    sumYellow: number; sumRed: number;
    sumIntercept: number; sumDefending: number;
    sumBlockTry: number; sumBlock: number;
    sumTackleTry: number; sumTackle: number;
  }>();

  for (const m of matches) {
    const squad = m[side] as any[];
    for (const p of squad || []) {
      if (!p.spId) continue;
      let e = map.get(p.spId);
      if (!e) {
        e = {
          spId: p.spId, name: p.name, games: 0, position: null, sumRating: 0, cntRating: 0,
          sumShoot: 0, sumEffShoot: 0, sumGoal: 0, sumAssist: 0, sumPassTry: 0, sumPassSuccess: 0,
          sumDribbleTry: 0, sumDribbleSuccess: 0, sumBallTry: 0, sumBallSuccess: 0,
          sumAerialTry: 0, sumAerialSuccess: 0, sumYellow: 0, sumRed: 0,
          sumIntercept: 0, sumDefending: 0, sumBlockTry: 0, sumBlock: 0, sumTackleTry: 0, sumTackle: 0,
        };
        map.set(p.spId, e);
      }
      e.games++;
      // 대표 포지션은 실제로 출전(핏치 포지션이 있는)한 가장 최근 경기 기준으로 갱신
      if (typeof p.position === 'number') e.position = p.position;
      const st = p.stats || {};
      // 평점 0은 실제로 출전하지 않은 벤치 멤버인 경우가 많아 평균 계산에서 제외
      if (typeof st.rating === 'number' && st.rating > 0) { e.sumRating += st.rating; e.cntRating++; }
      if (typeof st.shoot === 'number') e.sumShoot += st.shoot;
      if (typeof st.effectiveShoot === 'number') e.sumEffShoot += st.effectiveShoot;
      if (typeof st.goal === 'number') e.sumGoal += st.goal;
      if (typeof st.assist === 'number') e.sumAssist += st.assist;
      if (typeof st.passTry === 'number') e.sumPassTry += st.passTry;
      if (typeof st.passSuccess === 'number') e.sumPassSuccess += st.passSuccess;
      if (typeof st.dribbleTry === 'number') e.sumDribbleTry += st.dribbleTry;
      if (typeof st.dribbleSuccess === 'number') e.sumDribbleSuccess += st.dribbleSuccess;
      if (typeof st.ballPossessionTry === 'number') e.sumBallTry += st.ballPossessionTry;
      if (typeof st.ballPossessionSuccess === 'number') e.sumBallSuccess += st.ballPossessionSuccess;
      if (typeof st.aerialTry === 'number') e.sumAerialTry += st.aerialTry;
      if (typeof st.aerialSuccess === 'number') e.sumAerialSuccess += st.aerialSuccess;
      if (typeof st.yellowCards === 'number') e.sumYellow += st.yellowCards;
      if (typeof st.redCards === 'number') e.sumRed += st.redCards;
      if (typeof st.intercept === 'number') e.sumIntercept += st.intercept;
      if (typeof st.defending === 'number') e.sumDefending += st.defending;
      if (typeof st.blockTry === 'number') e.sumBlockTry += st.blockTry;
      if (typeof st.block === 'number') e.sumBlock += st.block;
      if (typeof st.tackleTry === 'number') e.sumTackleTry += st.tackleTry;
      if (typeof st.tackle === 'number') e.sumTackle += st.tackle;
    }
  }

  // 가장 최근 경기(matches[0], 이미 최신순 정렬되어 들어옴)에 실제로 출전(평점>0)한 선수들 -
  // 이 사람들이 '현재 스쿼드'로 최상위에 노출되고, best/worst도 이 그룹 안에서만 뽑음
  const latestMatch = matches[0];
  const currentSquadIds = new Set<string>();
  if (latestMatch) {
    const squad = latestMatch[side] as any[];
    for (const p of squad || []) {
      const r = p.stats?.rating;
      if (p.spId && typeof r === 'number' && r > 0) currentSquadIds.add(p.spId);
    }
  }

  const round1 = (n: number) => +n.toFixed(1);

  const list = [...map.values()]
    .filter(e => e.cntRating > 0) // 한 번도 실제로 뛴 기록(평점>0)이 없는 벤치 멤버는 제외
    .map(e => {
      const shootAcc = e.sumShoot ? +((e.sumEffShoot / e.sumShoot) * 100).toFixed(1) : null;
      return {
        spId: e.spId, name: e.name, games: e.games, position: e.position,
        avgRating: +(e.sumRating / e.cntRating).toFixed(2),
        avgShoot: round1(e.sumShoot / e.games),
        avgEffectiveShoot: round1(e.sumEffShoot / e.games),
        avgMissedShoot: round1((e.sumShoot - e.sumEffShoot) / e.games),
        shootAccuracy: shootAcc,
        avgGoal: round1(e.sumGoal / e.games),
        avgAssist: round1(e.sumAssist / e.games),
        passSuccessRate: e.sumPassTry ? +((e.sumPassSuccess / e.sumPassTry) * 100).toFixed(1) : null,
        avgPassTry: round1(e.sumPassTry / e.games),
        avgPassSuccess: round1(e.sumPassSuccess / e.games),
        avgDribbleTry: round1(e.sumDribbleTry / e.games),
        avgDribbleSuccess: round1(e.sumDribbleSuccess / e.games),
        avgBallTry: round1(e.sumBallTry / e.games),
        avgBallSuccess: round1(e.sumBallSuccess / e.games),
        avgAerialTry: round1(e.sumAerialTry / e.games),
        avgAerialSuccess: round1(e.sumAerialSuccess / e.games),
        avgYellow: round1(e.sumYellow / e.games),
        avgRed: round1(e.sumRed / e.games),
        avgIntercept: round1(e.sumIntercept / e.games),
        avgDefending: round1(e.sumDefending / e.games),
        avgBlockTry: round1(e.sumBlockTry / e.games),
        avgBlock: round1(e.sumBlock / e.games),
        avgTackleTry: round1(e.sumTackleTry / e.games),
        avgTackle: round1(e.sumTackle / e.games),
        isBest: false, isWorst: false,
        isCurrentSquad: currentSquadIds.has(e.spId),
      };
    });

  // best/worst는 '현재(가장 최근 경기) 스쿼드' 안에서만 선정
  const currentGroup = list.filter(p => p.isCurrentSquad);
  const withRating = [...currentGroup].sort((a, b) => (b.avgRating as number) - (a.avgRating as number));
  if (withRating.length > 1) {
    withRating[0].isBest = true;
    withRating[withRating.length - 1].isWorst = true;
  }

  // 정렬: 현재 스쿼드가 항상 위, 그 안에서/이전 선수 그룹 안에서는 각각 평점순
  list.sort((a, b) => {
    if (a.isCurrentSquad !== b.isCurrentSquad) return a.isCurrentSquad ? -1 : 1;
    return (b.avgRating ?? -1) - (a.avgRating ?? -1);
  });
  return list;
}

// 최근 경기 스캔 - Redis에 이미 저장된 매치는 재사용하고, 그 이후에 새로 생긴 경기만
// 라이브로 추가 확인하는 증분(incremental) 방식. unstable_cache가 이 배포 환경에서
// 안정적으로 캐시 히트를 안 해서(매번 재계산), 이미 구축된 Redis를 캐시 겸 영구저장소로 사용.
// 최초 1회만 DATA_CUTOFF(8/10)까지 전체를 긁고, 이후엔 "저장된 것 이후"만 빠르게 확인함.
const PAGE_SIZE = 30;
const MAX_PAGES_PER_TYPE = 12; // 안전장치: 타입당 최대 360경기까지만 (무한 스캔 방지)

async function scanNewMatches(meOuid: string, sinceDate: string): Promise<StoredMatch[]> {
  const spidMap = await getSpidMap();
  const found: StoredMatch[] = [];
  const TOTAL_PAGES_ESTIMATE = MATCH_TYPES.length * MAX_PAGES_PER_TYPE; // 진행률 계산용 이론적 최대치
  let pagesDone = 0;
  await setScanProgress(0, TOTAL_PAGES_ESTIMATE).catch(() => {});

  for (const matchtype of MATCH_TYPES) {
    let offset = 0;
    for (let page = 0; page < MAX_PAGES_PER_TYPE; page++) {
      const ids = await getMatchIds(meOuid, matchtype, PAGE_SIZE, offset);
      if (ids.length === 0) break;
      offset += ids.length;

      const CHUNK = 10;
      let hitBoundary = false;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const details = await Promise.all(chunk.map(getMatchDetail));
        for (const detail of details) {
          if (!detail) continue;
          if (!detail.matchDate || detail.matchDate <= sinceDate) { hitBoundary = true; continue; }
          const info = detail.matchInfo;
          if (!Array.isArray(info) || info.length < 2) continue;
          const me = info.find((p: any) => p.ouid === meOuid);
          const opp = info.find((p: any) => p.ouid !== meOuid);
          if (!me || !opp || !detail.matchId) continue;

          const meSquad = extractSquad(me, spidMap);
          const oppSquad = extractSquad(opp, spidMap);

          // 이 경기 MOTM(최고 평점 선수) 계산 - 양팀 통틀어 최고 평점 1명에게 표시
          let motmSpId: string | null = null, motmRating = -1;
          for (const p of [...meSquad, ...oppSquad]) {
            const r = p.stats?.rating;
            if (typeof r === 'number' && r > motmRating) { motmRating = r; motmSpId = p.spId; }
          }
          for (const p of meSquad) (p as any).isMotm = p.spId === motmSpId;
          for (const p of oppSquad) (p as any).isMotm = p.spId === motmSpId;

          const outcome = judgeOutcome(me);
          const meGoal = me.shoot?.goalTotalDisplay ?? me.shoot?.goalTotal ?? null;
          const oppGoal = opp.shoot?.goalTotalDisplay ?? opp.shoot?.goalTotal ?? null;

          found.push({
            matchId: detail.matchId, matchDate: detail.matchDate, matchType: matchtype,
            meOuid, oppOuid: opp.ouid, oppNickname: opp.nickname, outcome,
            meGoal, oppGoal, meSquad, oppSquad,
            meTeam: extractTeamStats(me, meSquad), oppTeam: extractTeamStats(opp, oppSquad),
          });
        }
      }
      pagesDone++;
      setScanProgress(pagesDone, TOTAL_PAGES_ESTIMATE).catch(() => {}); // 완료를 기다리지 않고 진행률만 갱신
      if (hitBoundary || ids.length < PAGE_SIZE) break; // 저장된 지점 도달했거나 더 이상 페이지 없음
    }
  }
  await clearScanProgress().catch(() => {}); // 끝났으니 진행률 표시 종료(폴링 쪽에서 100%로 처리)
  return found;
}

async function getRecentMatchesRaw(meOuid: string): Promise<StoredMatch[]> {
  const latestStored = await getLatestStoredMatchDate();
  const since = latestStored && latestStored > DATA_CUTOFF ? latestStored : DATA_CUTOFF;

  const newMatches = await scanNewMatches(meOuid, since);
  if (newMatches.length > 0) await saveMatches(newMatches).catch(() => {});

  // 방금 저장한 것까지 포함해서 저장소 전체(기준일 이후)를 반환 - 이후 4개 집계 함수가 공용으로 재사용
  const all = await getAllStoredMatches(3000);
  return all.filter(m => isAfterCutoff(m.matchDate) && m.meOuid === meOuid);
}

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

  const raw = await getRecentMatchesRaw(meOuid); // 이미 기준일 이후, me 소유 전체 (Redis 기반)
  let win = 0, lose = 0, draw = 0;
  for (const m of raw) {
    if (!registeredNicknames.has(m.oppNickname)) continue; // 등록된 스트리머와의 경기만 집계
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
  const rows = raw
    .filter(m => byNickname.has(m.oppNickname))
    .map(m => {
      const s = byNickname.get(m.oppNickname)!;
      return {
        matchId: m.matchId, matchDate: m.matchDate, outcome: m.outcome, meGoal: m.meGoal, oppGoal: m.oppGoal,
        oppNickname: m.oppNickname, oppDisplayName: s.displayName, oppProfileImage: s.profileImage || null,
      };
    });

  rows.sort((a, b) => (a.matchDate < b.matchDate ? 1 : -1));
  return { matches: rows.slice(0, 30) };
}

// - 관리자에 등록된 스트리머만 보여주고(닉네임/이미지 정확도를 위해), 미등록 상대는 목록에서 제외
async function fetchOpponentsList(meNickname: string) {
  const meOuid = await getOuid(meNickname);
  if (!meOuid) return { error: `'${meNickname}' 닉네임을 찾을 수 없어요.` };

  const raw = await getRecentMatchesRaw(meOuid);
  const map = new Map<string, { nickname: string; meWin: number; meDraw: number; meLose: number; lastDate: string }>();
  for (const m of raw) {
    const existing = map.get(m.oppOuid);
    // 화면엔 스맵 관점(내가 이겼으면 승)으로 보여줌 - 정렬만 상대방 승률 기준으로 별도 계산
    const meWin = m.outcome === 'win' ? 1 : 0;
    const meLose = m.outcome === 'lose' ? 1 : 0;
    const meDraw = m.outcome === 'draw' ? 1 : 0;
    if (existing) {
      existing.meWin += meWin; existing.meDraw += meDraw; existing.meLose += meLose;
      if (m.matchDate > existing.lastDate) existing.lastDate = m.matchDate;
    } else {
      map.set(m.oppOuid, { nickname: m.oppNickname, meWin, meDraw, meLose, lastDate: m.matchDate });
    }
  }

  const allStreamers = await listStreamers();
  const byNickname = new Map(allStreamers.map(s => [s.fcNickname, s]));

  const opponents = [...map.values()]
    .filter(o => byNickname.has(o.nickname)) // 등록된 스트리머만
    .map(o => {
      const s = byNickname.get(o.nickname)!;
      const total = o.meWin + o.meDraw + o.meLose;
      const oppWinRate = total ? o.meLose / total : 0; // 정렬용: 상대방(스맵이 아닌) 기준 승률 = 나의 패배 비율
      return {
        nickname: o.nickname, win: o.meWin, draw: o.meDraw, lose: o.meLose, total, oppWinRate,
        lastDate: o.lastDate, displayName: s.displayName, profileImage: s.profileImage || null, teamColor: s.teamColor,
      };
    })
    .sort((a, b) => (b.total - a.total) || (b.oppWinRate - a.oppWinRate)); // 전적 수(경기 수) 많은 순

  return { meNickname, opponents, searchedDepth: SEARCH_DEPTH };
}

async function fetchHead2Head(meNickname: string, opponentNickname: string) {
    const meOuid = await getOuid(meNickname);
    if (!meOuid) return { error: `'${meNickname}' 닉네임을 찾을 수 없어요.` };
    const oppOuid = await getOuid(opponentNickname);
    if (!oppOuid) return { error: `'${opponentNickname}' 닉네임을 찾을 수 없어요.` };

    const raw = await getRecentMatchesRaw(meOuid); // 이미 기준일 이후 전체 (Redis 기반, 증분 스캔)
    const matches: any[] = raw
      .filter(m => m.oppOuid === oppOuid)
      .map(m => ({
        matchId: m.matchId, matchDate: m.matchDate, matchType: m.matchType, outcome: m.outcome,
        meGoal: m.meGoal, oppGoal: m.oppGoal, meSquad: m.meSquad, oppSquad: m.oppSquad,
        meTeam: m.meTeam || {}, oppTeam: m.oppTeam || {},
      }));
    matches.sort((a, b) => (a.matchDate < b.matchDate ? 1 : -1));

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
      matches, // 이제 전체(8/10~오늘) 병합 기록을 다 보여줌 - 인위적으로 자르지 않음
      searchedDepth: SEARCH_DEPTH,
      dataSince: DATA_CUTOFF,
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
    meDisplay: { name: '스맵', color: meStreamer?.teamColor || null, profileImage: meStreamer?.profileImage || (process.env.SOOP_BJID ? `https://profile.img.sooplive.com/LOGO/${process.env.SOOP_BJID.slice(0, 2)}/${process.env.SOOP_BJID}/${process.env.SOOP_BJID}.jpg` : null) },
    oppDisplay: { name: oppStreamer?.displayName || opponentNickname, color: oppStreamer?.teamColor || null, profileImage: oppStreamer?.profileImage || null },
  };
}

// 상대목록/최근30경기/통산전적 모두 별도 캐시 없이 매번 새로 계산 - 내부에서 쓰는
// getRecentMatchesRaw가 이미 30분 캐시라 넥슨 API 호출 부담은 없고, 관리자에서 스트리머를
// 새로 등록/삭제하면 바로 다음 새로고침에 반영되도록 함
const getOverallLiveCached = fetchOverallLive;
const getRecent30Cached = fetchRecent30;
const getOpponentsListCached = fetchOpponentsList;

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
  const progress = searchParams.get('progress');

  if (progress) {
    const p = await getScanProgress().catch(() => null);
    if (!p) return NextResponse.json({ percent: 100, done: true });
    const percent = p.total > 0 ? Math.min(99, Math.round((p.done / p.total) * 100)) : 0;
    return NextResponse.json({ percent, done: false, doneCount: p.done, total: p.total });
  }

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
