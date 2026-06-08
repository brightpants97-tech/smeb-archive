import { NextRequest, NextResponse } from 'next/server';

const KEY  = process.env.RIOT_API_KEY!;
const KR   = 'https://kr.api.riotgames.com';
const ASIA = 'https://asia.api.riotgames.com';

const TIER_KO: Record<string, string> = {
  IRON: '아이언', BRONZE: '브론즈', SILVER: '실버',
  GOLD: '골드', PLATINUM: '플래티넘', EMERALD: '에메랄드',
  DIAMOND: '다이아몬드', MASTER: '마스터',
  GRANDMASTER: '그랜드마스터', CHALLENGER: '챌린저',
};
const RANK_KO: Record<string, string> = { I:'1', II:'2', III:'3', IV:'4' };
const TOP_TIER = ['MASTER', 'GRANDMASTER', 'CHALLENGER'];

async function riotFetch(url: string) {
  const sep = url.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${sep}api_key=${KEY.trim()}`);
  if (!res.ok) throw { status: res.status };
  return res.json();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name')?.trim();
  const tag  = searchParams.get('tag')?.trim();

  if (!name || !tag) {
    return NextResponse.json({ error: '소환사명과 태그를 입력해주세요.' }, { status: 400 });
  }

  if (!KEY) {
    return NextResponse.json({ error: 'API 키가 설정되지 않았어요. 관리자에게 문의해주세요.' }, { status: 500 });
  }

  // 디버그용 (임시)
  if (name === 'debug') {
    // Riot API 직접 호출 테스트
    const testUrl = `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Faker/KR1?api_key=${KEY}`;
    const testRes = await fetch(testUrl);
    const testBody = await testRes.text();
    return NextResponse.json({ 
      keyStart: KEY.substring(0, 12), keyLen: KEY.length,
      riotStatus: testRes.status,
      riotBody: testBody.substring(0, 200)
    });
  }

  try {
    // 1) PUUID
    const account = await riotFetch(
      `${ASIA}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
    );

    // 2) 소환사 정보
    const summoner = await riotFetch(
      `${KR}/lol/summoner/v4/summoners/by-puuid/${account.puuid}`
    );

    // 3) 랭크 정보
    const entries: any[] = await riotFetch(
      `${KR}/lol/league/v4/entries/by-summoner/${summoner.id}`
    );

    const solo  = entries.find(e => e.queueType === 'RANKED_SOLO_5x5') ?? null;
    const flex  = entries.find(e => e.queueType === 'RANKED_FLEX_SR')  ?? null;

    const format = (e: any) => {
      if (!e) return null;
      const tierKo = TIER_KO[e.tier] ?? e.tier;
      const rankKo = TOP_TIER.includes(e.tier) ? '' : RANK_KO[e.rank] ?? e.rank;
      const total  = e.wins + e.losses;
      const wr     = total > 0 ? Math.round((e.wins / total) * 100) : 0;
      return {
        tier:    e.tier,
        tierKo,
        rank:    rankKo,
        lp:      e.leaguePoints,
        wins:    e.wins,
        losses:  e.losses,
        wr,
        display: `${tierKo}${rankKo ? ` ${rankKo}` : ''} ${e.leaguePoints}LP`,
      };
    };

    return NextResponse.json({
      name: account.gameName,
      tag:  account.tagLine,
      level: summoner.summonerLevel,
      solo:  format(solo),
      flex:  format(flex),
    });

  } catch (e: any) {
    const s = e?.status;
    if (s === 404) return NextResponse.json({ error: '소환사를 찾을 수 없어요. 라이엇 ID를 확인해주세요.' }, { status: 404 });
    if (s === 401) return NextResponse.json({ error: 'API 키 인증 실패 (401). 키를 다시 확인해주세요.' }, { status: 401 });
    if (s === 403) return NextResponse.json({ error: 'API 키가 만료됐어요. Riot 개발자 페이지에서 키를 갱신해주세요.' }, { status: 403 });
    if (s === 429) return NextResponse.json({ error: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.' }, { status: 429 });
    return NextResponse.json({ error: `조회 오류 (${s ?? 'unknown'}) - 잠시 후 다시 시도해주세요.` }, { status: 500 });
  }
}
