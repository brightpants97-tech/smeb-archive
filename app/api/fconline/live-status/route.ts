import { NextResponse } from 'next/server';
import { listStreamers } from '@/app/lib/fconline-db';

// 등록된 스트리머들의 프로필 이미지 URL에서 SOOP BJ ID를 추출
// 형태: https://profile.img.sooplive.com/LOGO/{prefix}/{bjid}/{bjid}.jpg
function extractBjid(profileImage: string | null | undefined): string | null {
  if (!profileImage) return null;
  const m = profileImage.match(/\/LOGO\/[^/]+\/([^/]+)\//);
  return m ? m[1] : null;
}

async function checkLive(bjid: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api-channel.sooplive.com/v1.1/channel/${bjid}/station`, {
      headers: {
        Referer: 'https://www.sooplive.com/',
        Origin: 'https://www.sooplive.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.station?.broadStart;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const streamers = await listStreamers();
    const withBjid = streamers
      .map(s => ({ ...s, bjid: extractBjid(s.profileImage) }))
      .filter(s => s.bjid);

    const CHUNK = 10; // 넥슨/SOOP과 무관하게 자체 API지만, 한 번에 너무 많이 쏘지 않도록 청크 처리
    const liveList: any[] = [];
    for (let i = 0; i < withBjid.length; i += CHUNK) {
      const chunk = withBjid.slice(i, i + CHUNK);
      const results = await Promise.all(chunk.map(s => checkLive(s.bjid!)));
      results.forEach((isLive, idx) => {
        if (isLive) {
          const s = chunk[idx];
          liveList.push({ fcNickname: s.fcNickname, displayName: s.displayName, profileImage: s.profileImage, teamColor: s.teamColor });
        }
      });
    }

    return NextResponse.json({ live: liveList });
  } catch (e: any) {
    return NextResponse.json({ live: [], error: e?.message || '조회 실패' });
  }
}
