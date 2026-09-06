import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

// ── NEXON Open API (FC 온라인) ──────────────────────────────────────────────
// 문서: https://openapi.nexon.com/ko/game/fconline/
// 인증: 헤더 x-nxopen-api-key
const NEXON_KEY = process.env.NEXON_API_KEY || '';
const BASE = 'https://open.api.nexon.com/fconline/v1';
const SME_NICKNAME = process.env.SMEB_FC_NICKNAME || ''; // 스맵의 FC 온라인 닉네임

// 매치 타입: 50 = 공식경기(랭크). 필요하면 다른 타입도 추가로 조회 가능.
const MATCH_TYPES = [50];
// 상대전적 검색 시 뒤져볼 최근 경기 수 (너무 크게 잡으면 API 호출량이 급증함)
const SEARCH_DEPTH = 100;

function nexonFetch(url: string) {
  return fetch(url, { headers: { 'x-nxopen-api-key': NEXON_KEY }, cache: 'no-store' });
}

async function getOuid(nickname: string): Promise<string | null> {
  const res = await nexonFetch(`${BASE}/id?nickname=${encodeURIComponent(nickname)}`);
  if (!res.ok) return null;
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
    const res = await fetch('https://static.api.nexon.co.kr/fifaonline4/latest/spid.json', { cache: 'no-store' });
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

// matchInfo 배열 안에서 선수 리스트(스쿼드)를 최대한 유연하게 뽑아내는 헬퍼.
// 넥슨 API 응답 필드명이 문서 버전에 따라 조금씩 다르게 보고되는 경우가 있어
// 몇 가지 후보 키를 다 시도해본다.
function extractSquad(participant: any, spidMap: Record<string, string>) {
  const raw = participant?.player || participant?.players || participant?.playerInfo || [];
  if (!Array.isArray(raw)) return [];
  return raw.map((p: any) => {
    const spId = String(p.spId ?? p.spid ?? p.pid ?? '');
    return {
      spId,
      name: spidMap[spId] || `선수#${spId || '?'}`,
      position: p.spPosition ?? p.position ?? p.pos ?? null,
      status: p.status ?? null, // 선발/교체 등
      grade: p.spGrade ?? p.grade ?? p.rating ?? null,
    };
  });
}

function extractResult(detail: any, matchtype: number) {
  const info = detail?.matchInfo;
  if (!Array.isArray(info) || info.length < 2) return null;
  return { info };
}

const getHead2Head = unstable_cache(
  async (meNickname: string, opponentNickname: string) => {
    if (!NEXON_KEY) {
      return { error: 'NEXON_API_KEY가 설정되어 있지 않습니다. Vercel 프로젝트 환경변수에 NEXON_API_KEY를 추가해주세요.' };
    }

    const [meOuid, oppOuid] = await Promise.all([getOuid(meNickname), getOuid(opponentNickname)]);
    if (!meOuid) return { error: `'${meNickname}' 닉네임을 찾을 수 없어요.` };
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
          const meGoal = meDetail.matchScore ?? meDetail.goal ?? meDetail.shootTotal ?? null;
          const oppGoal = oppDetail.matchScore ?? oppDetail.goal ?? oppDetail.shootTotal ?? null;

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
  },
  ['fconline-head2head'],
  { revalidate: 600 } // 10분 - 새 경기가 반영되는 주기
);

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
