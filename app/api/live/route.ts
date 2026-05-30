import { NextResponse } from 'next/server';

const BJID = process.env.SOOP_BJID || 'townboy';

export async function GET() {
  try {
    const res = await fetch(`https://api-channel.sooplive.com/v1.1/channel/${BJID}/station`, {
      headers: {
        'Referer': 'https://www.sooplive.com/',
        'Origin': 'https://www.sooplive.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
      cache: 'no-store'
    });
    const data = await res.json();
    const station = data.station;

    // activeNo가 0이 아닌 값이면 방송 중 (= activeNo 자체가 broadcastNo)
    const activeNo = station?.activeNo;
    const isLive = !!activeNo && activeNo !== 0;
    const broadcastNo = isLive ? String(activeNo) : null;

    return NextResponse.json({
      isLive,
      broadcastNo,
      thumbnail: broadcastNo
        ? `https://liveimg.sooplive.co.kr/m/${broadcastNo}`
        : null,
      liveUrl: broadcastNo
        ? `https://play.sooplive.com/${BJID}/${broadcastNo}`
        : `https://www.sooplive.com/station/${BJID}`,
      broadStart: station?.broadStart || null,
      profileImage: `https://profile.img.sooplive.com/LOGO/to/${BJID}/${BJID}.jpg`,
    });
  } catch (error) {
    return NextResponse.json({ isLive: false, error: String(error) });
  }
}
