import { NextResponse } from 'next/server';

const BJID = process.env.SOOP_BJID;

export async function GET() {
  try {
    const res = await fetch(`https://api-channel.sooplive.com/v1.1/channel/${BJID}/station`, {
      headers: {
        'Referer': 'https://www.sooplive.com/',
        'Origin': 'https://www.sooplive.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
      next: { revalidate: 60 }
    });
    const data = await res.json();
    const station = data.station;
    const activeNo = station?.activeNo;
    const isLive = !!activeNo && activeNo !== 0;

    return NextResponse.json({
      isLive,
      broadcastNo: isLive ? activeNo : null,
      thumbnail: isLive ? `https://liveimg.sooplive.co.kr/m/${activeNo}` : null,
      liveUrl: isLive ? `https://play.sooplive.com/${BJID}/${activeNo}` : null,
      broadStart: station?.broadStart || null,
      profileImage: `https://profile.img.sooplive.com/LOGO/to/${BJID}/${BJID}.jpg`,
    });
  } catch (error) {
    return NextResponse.json({ isLive: false, error: String(error) });
  }
}