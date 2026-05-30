import { NextResponse } from 'next/server';

const BJID = process.env.SOOP_BJID || 'townboy';

export async function GET() {
  try {
    const res = await fetch(
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
    const data = await res.json();
    const station = data.station;

    // activeNo가 0이 아니면 방송 중 (broadcastNo로 사용)
    const activeNo = station?.activeNo;
    const broadcastNo = activeNo && activeNo !== 0 ? String(activeNo) : null;

    return NextResponse.json({
      broadcastNo,
      // 클라이언트에서 liveimg onLoad/onError로 실제 방송 여부를 검증하므로
      // 여기서 isLive는 '방송번호가 있다'는 힌트일 뿐
      broadStart: station?.broadStart || null,
      profileImage: `https://profile.img.sooplive.com/LOGO/to/${BJID}/${BJID}.jpg`,
      liveUrl: broadcastNo
        ? `https://play.sooplive.com/${BJID}/${broadcastNo}`
        : `https://www.sooplive.com/station/${BJID}`,
    });
  } catch (error) {
    return NextResponse.json({
      broadcastNo: null,
      broadStart: null,
      profileImage: `https://profile.img.sooplive.com/LOGO/to/${BJID}/${BJID}.jpg`,
      liveUrl: `https://www.sooplive.com/station/${BJID}`,
      error: String(error),
    });
  }
}
