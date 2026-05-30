import { NextResponse } from 'next/server';

const BJID = process.env.SOOP_BJID || 'townboy';

export async function GET() {
  try {
    // 1. station API로 방송 중 여부 확인
    const stationRes = await fetch(`https://api-channel.sooplive.com/v1.1/channel/${BJID}/station`, {
      headers: {
        'Referer': 'https://www.sooplive.com/',
        'Origin': 'https://www.sooplive.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
      cache: 'no-store'
    });
    const data = await stationRes.json();
    const station = data.station;
    const isLive = !!station?.activeNo && station.activeNo !== 0;

    if (!isLive) {
      return NextResponse.json({
        isLive: false,
        broadcastNo: null,
        thumbnail: null,
        liveUrl: null,
        broadStart: station?.broadStart || null,
        profileImage: `https://profile.img.sooplive.com/LOGO/to/${BJID}/${BJID}.jpg`,
      });
    }

    // 2. 방송 중이면 방송국 페이지에서 실제 broadcastNo 파싱
    let broadcastNo: string | null = null;
    try {
      const pageRes = await fetch(`https://www.sooplive.com/station/${BJID}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        cache: 'no-store'
      });
      const html = await pageRes.text();
      const match = html.match(new RegExp(`play\\.sooplive\\.com/${BJID}/(\\d+)`));
      if (match) broadcastNo = match[1];
    } catch {}

    return NextResponse.json({
      isLive: true,
      broadcastNo,
      thumbnail: broadcastNo ? `https://liveimg.sooplive.co.kr/m/${broadcastNo}` : null,
      liveUrl: broadcastNo ? `https://play.sooplive.com/${BJID}/${broadcastNo}` : `https://www.sooplive.com/station/${BJID}`,
      broadStart: station?.broadStart || null,
      profileImage: `https://profile.img.sooplive.com/LOGO/to/${BJID}/${BJID}.jpg`,
    });
  } catch (error) {
    return NextResponse.json({ isLive: false, error: String(error) });
  }
}
