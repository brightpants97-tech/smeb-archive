import { NextResponse } from 'next/server';

const BJID = process.env.SOOP_BJID || 'townboy';

export async function GET() {
  try {
    // play.sooplive.com/townboy 로 fetch하면
    // 방송 중 → /townboy/294421491 로 리다이렉트
    // 방송 끝 → /townboy/null 로 리다이렉트
    // 최종 URL에서 숫자만 추출하면 broadcastNo
    const res = await fetch(`https://play.sooplive.com/${BJID}`, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      cache: 'no-store',
    });

    const finalUrl = res.url;
    const match = finalUrl.match(/\/(\d{8,})$/);
    const broadcastNo = match ? match[1] : null;

    let broadStart: string | null = null;
    try {
      const st = await fetch(
        `https://api-channel.sooplive.com/v1.1/channel/${BJID}/station`,
        {
          headers: {
            'Referer': 'https://www.sooplive.com/',
            'Origin': 'https://www.sooplive.com',
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json',
          },
          cache: 'no-store',
        }
      );
      const d = await st.json();
      broadStart = d.station?.broadStart ?? null;
    } catch {}

    return NextResponse.json({
      broadcastNo,
      isLive: !!broadcastNo,
      thumbnail: broadcastNo ? `https://liveimg.sooplive.co.kr/m/${broadcastNo}` : null,
      liveUrl: broadcastNo
        ? `https://play.sooplive.com/${BJID}/${broadcastNo}`
        : `https://www.sooplive.com/station/${BJID}`,
      broadStart,
      profileImage: `https://profile.img.sooplive.com/LOGO/to/${BJID}/${BJID}.jpg`,
      _debug: { finalUrl },
    });
  } catch (error) {
    return NextResponse.json({
      broadcastNo: null,
      isLive: false,
      thumbnail: null,
      liveUrl: `https://www.sooplive.com/station/${BJID}`,
      broadStart: null,
      profileImage: `https://profile.img.sooplive.com/LOGO/to/${BJID}/${BJID}.jpg`,
      error: String(error),
    });
  }
}
