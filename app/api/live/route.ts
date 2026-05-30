import { NextResponse } from 'next/server';

const BJID = process.env.SOOP_BJID || 'townboy';

export async function GET() {
  try {
    // 1차: station API로 기본 정보 가져오기
    const stationRes = await fetch(
      `https://api-channel.sooplive.com/v1.1/channel/${BJID}/station`,
      {
        headers: {
          'Referer': 'https://www.sooplive.com/',
          'Origin': 'https://www.sooplive.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
        },
        cache: 'no-store',
      }
    );
    const stationData = await stationRes.json();
    const station = stationData.station;
    const profileImage = `https://profile.img.sooplive.com/LOGO/to/${BJID}/${BJID}.jpg`;

    // 2차: 방송국 페이지 HTML에서 liveimg URL 파싱 (broadcastNo 추출)
    let broadcastNo: string | null = null;
    try {
      const pageRes = await fetch(`https://www.sooplive.com/station/${BJID}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
        cache: 'no-store',
      });
      const html = await pageRes.text();

      // liveimg.sooplive.com/h/{broadcastNo}.webp 또는 liveimg.sooplive.co.kr/m/{broadcastNo}
      const match =
        html.match(/liveimg\.sooplive\.com\/h\/(\d+)/) ||
        html.match(/liveimg\.sooplive\.co\.kr\/[a-z]+\/(\d+)/);

      if (match) {
        broadcastNo = match[1];
      }
    } catch {}

    const isLive = !!broadcastNo;

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
      profileImage,
    });
  } catch (error) {
    return NextResponse.json({ isLive: false, error: String(error) });
  }
}
