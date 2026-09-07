import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

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

// matchInfo 배열 안에서 선수 리스트(스쿼드)를 뽑아내는 헬�퍼.
// 참가자 객체에 직접 player: [{ spId, spPosition, spGrade, status:{...} }] 형태로 들어있음.
function extractSquad(participant: any, spidMap: Record<string, string>) {
  const raw = participant?.player;
  if (!Array.isArray(raw)) return [];
  return raw.map((p: any) => {
    const spId = String(p.spId ?? '');
    return {
      spId,
      name: spidMap[spId] || `선수#${spId || '?'}`,
      position: p.spPosition ?? null,
      status: null,
      grade: p.spGrade ?? null,
    };
  });
}

function extractResult(detail: any, matchtype: number) {
  const info = detail?.matchInfo;
  if (!Array.isArray(info) || info.length < 2) return null;
  return { info };
}

async function fetchHead2Head(meNickname: string, opponentNickname: string) {
    // 두 조회를 동시에 쏘면 개발단계 키 rate limit에 걸리기 쉬워 순차로 진행
    const meOuid = await getOuid(meNickname);
    if (!meOuid) return { error: `'${meNickname}' 닉네임을 찾을 수 없어요.` };
    const oppOuid = await getOuid(opponentNickname);
    if (!oppOuid) return { error: `'${opponentNickname}' 닉네임을 찾을 수 없어요.` };

    const spidMap = await getSpidMap();

    const matches: any[] = [];
    let win = 0, lose = 0, draw = 0;

    for (const matchtype of MATCH_TYPES) {
      const ids = await getMatchIds(meOuid, matchtype, SEARCH_DEPTH);

      // match-detail 호출을 너무 한꺼번에 몰아치지 않도록 어느 정도 나눠서 처리
      const CHUNK = 10;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const details = await Promise.all(chunk.map(getMatchDetail));

        for (const detail of details) {
          if (!detail) continue;
          const result = extractResult(detail, matchtype);
          if (!result) continue;

          const me = result.info.find((p: any) => p.ouid === meOuid);
          const opp = result.info.find((p: any) => p.ouid === oppOuid);
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
            matchType: matchtype,
            outcome,
            meGoal, oppGoal,
            meSquad: extractSquad(me, spidMap),
            oppSquad: extractSquad(opp, spidMap),
          });
        }
      }
    }

    matches.sort((a, b) => (a.matchDate < b.matchDate ? 1 : -1));

    return {
      meNickname, opponentNickname, meOuid, oppOuid,
      summary: { win, lose, draw, total: win + lose + draw },
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
  return getHead2HeadCached(meNickname, opponentNickname);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const opponent = searchParams.get('opponent');
  const me = searchParams.get('me') || SME_NICKNAME;

  if (!opponent) return NextResponse.json({ error: 'opponent 파라미터(상대 닉네임)가 필요해요.' }, { status: 400 });
  if (!me) return NextResponse.json({ error: '내 닉네임이 설정되어 있지 않아요. SMEB_FC_NICKNAME 환경변수를 추가하거나 me 파라미터를 넘겨주세요.' }, { status: 400 });

  try {
    const data = await getHead2Head(me, opponent);
    if ((data as any).error) return NextResponse.json(data, { status: 404 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: '조회 중 오류가 발생했어요: ' + (e?.message || 'unknown') }, { status: 500 });
  }
}
