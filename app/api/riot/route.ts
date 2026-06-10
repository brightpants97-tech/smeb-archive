import { NextResponse } from 'next/server';

const RIOT_KEY = process.env.RIOT_API_KEY || 'RGAPI-acbac268-fc1d-4371-b1d8-a1f25d792060';

async function getChampionMap() {
  const verRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
  const versions = await verRes.json();
  const version = versions[0];
  const champRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/ko_KR/champion.json`);
  const champData = await champRes.json();
  const map: Record<number, { name: string; image: string }> = {};
  for (const champ of Object.values(champData.data) as any[]) {
    map[parseInt(champ.key)] = { name: champ.name, image: champ.image.full };
  }
  return { map, version };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const parts = name.split('#');
  if (parts.length < 2) return NextResponse.json({ error: '닉네임#태그 형식으로 입력해주세요' }, { status: 400 });
  const [gameName, tagLine] = [parts[0], parts.slice(1).join('#')];

  try {
    // 1. PUUID
    const accountRes = await fetch(
      `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      { headers: { 'X-Riot-Token': RIOT_KEY } }
    );
    if (!accountRes.ok) return NextResponse.json({ error: '소환사를 찾을 수 없어요' }, { status: 404 });
    const account = await accountRes.json();

    // 2. 소환사 정보
    const sumRes = await fetch(
      `https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.puuid}`,
      { headers: { 'X-Riot-Token': RIOT_KEY } }
    );
    const summoner = await sumRes.json();

    // 3. 랭크
    const rankRes = await fetch(
      `https://kr.api.riotgames.com/lol/league/v4/entries/by-summoner/${summoner.id}`,
      { headers: { 'X-Riot-Token': RIOT_KEY } }
    );
    const ranks = await rankRes.json();
    const solo = Array.isArray(ranks) ? ranks.find((r: any) => r.queueType === 'RANKED_SOLO_5x5') : null;

    // 4. 챔피언 숙련도
    const mastRes = await fetch(
      `https://kr.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${account.puuid}/top?count=10`,
      { headers: { 'X-Riot-Token': RIOT_KEY } }
    );
    const masteries = await mastRes.json();

    // 5. 챔피언 이름 매핑
    const { map, version } = await getChampionMap();
    const topChampions = Array.isArray(masteries) ? masteries.map((m: any) => ({
      id: m.championId,
      name: map[m.championId]?.name || '?',
      image: map[m.championId]?.image || '',
      level: m.championLevel,
      points: m.championPoints,
    })) : [];

    return NextResponse.json({
      gameName: account.gameName,
      tagLine: account.tagLine,
      profileIconId: summoner.profileIconId,
      summonerLevel: summoner.summonerLevel,
      rank: solo ? { tier: solo.tier, rank: solo.rank, lp: solo.leaguePoints, wins: solo.wins, losses: solo.losses } : null,
      topChampions,
      version,
    });
  } catch (e) {
    console.error('riot api error:', e);
    return NextResponse.json({ error: '데이터 불러오기 실패' }, { status: 500 });
  }
}
