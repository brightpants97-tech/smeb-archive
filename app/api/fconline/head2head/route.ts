import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { saveMatches, getStreamerByNickname, getOverallSummary, type StoredMatch } from '@/app/lib/fconline-db';

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
      status: null,
      grade: p.spGrade ?? null,
      stats: {
        rating: s.spRating ?? null,
        shoot: s.shoot ?? null,
        effectiveShoot: s.effectiveShoot ?? null,
        passTry: s.passTry ?? null,
        passSuccess: s.passSuccess ?? null,
        tackleTry: s.tackleTry ?? null,
        tackle: s.tackle ?? null,
        block: s.block ?? null,
        intercept: s.intercept ?? null,
      },
    };
  });
}

function extractResult(detail: any, matchtype: number) {
  const info = detail?.matchInfo;
  if (!Array.isArray(info) || info.length < 2) return null;
  return { info };
}

// 팀 단위 스탯 (점유율/코너킥) - 필드가 없을 수도 있어 방어적으로 여러 후보 키를 시도
function extractTeamStats(participant: any) {
  const md = participant?.matchDetail || {};
  return {
    possession: md.possession ?? md.ballPossession ?? null,
    cornerKick: md.cornerKick ?? md.corner ?? null,
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

// 최근 스캔된 경기들에서 me를 뺀 상대들을 뽑아 등장 횟수/최근 날짜로 집계
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

  const opponents = [...map.values()].sort((a, b) => (b.count - a.count) || (a.lastDate < b.lastDate ? 1 : -1));
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
    let win = 0, lose = 0, draw = 0;

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
      if (outcome === 'win') win++;
      else if (outcome === 'lose') lose++;
      else if (outcome === 'draw') draw++;

      matches.push({
        matchId: detail.matchId ?? null,
        matchDate: detail.matchDate ?? meDetail.matchDate ?? null,
        matchType,
        outcome,
        meGoal, oppGoal,
        meTeam: extractTeamStats(me),
        oppTeam: extractTeamStats(opp),
        meSquad: extractSquad(me, spidMap),
        oppSquad: extractSquad(opp, spidMap),
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
        }));
      saveMatches(toStore).catch(() => {}); // 저장 실패해도 응답엔 영향 없게
    }

    // 팀 평균 점유율/코너킥 (필드 존재할 때만)
    const avgTeam = (side: 'meTeam' | 'oppTeam', key: 'possession' | 'cornerKick') => {
      const vals = matches.map(m => m[side]?.[key]).filter((v: any) => typeof v === 'number');
      return vals.length ? +(vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(1) : null;
    };

    return {
      meNickname, opponentNickname, meOuid, oppOuid,
      summary: { win, lose, draw, total: win + lose + draw },
      teamStats: {
        me: { possession: avgTeam('meTeam', 'possession'), cornerKick: avgTeam('meTeam', 'cornerKick') },
        opp: { possession: avgTeam('oppTeam', 'possession'), cornerKick: avgTeam('oppTeam', 'cornerKick') },
      },
      playerStats: {
        me: aggregatePlayerStats(matches, 'meSquad'),
        opp: aggregatePlayerStats(matches, 'oppSquad'),
      },
      matches,
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
    meDisplay: { name: meStreamer?.displayName || meNickname, color: meStreamer?.teamColor || null },
    oppDisplay: { name: oppStreamer?.displayName || opponentNickname, color: oppStreamer?.teamColor || null },
  };
}

// 상대 목록도 결과 자체를 캐시해서 페이지 로드 때마다 다시 계산 안 하게 함
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

  if (!me) return NextResponse.json({ error: '내 닉네임이 설정되어 있지 않아요. SMEB_FC_NICKNAME 환경변수를 추가하거나 me 파라미터를 넘겨주세요.' }, { status: 400 });

  if (overall) {
    try {
      const summary = await getOverallSummary();
      return NextResponse.json({ summary: summary || { win: 0, lose: 0, draw: 0, total: 0 } });
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
