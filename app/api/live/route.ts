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

    // 방송 중이면 stbbs API로 broadcastNo 가져오기
    let broadcastNo: string | null = null;
    try {
      const broadRes = await fetch(
        `https://stbbs.sooplive.com/api/get_broadcast_list.php?szBjId=${BJID}&nLimit=1`,
        {
          headers: {
            'Referer': 'https://www.sooplive.com/',
            'Origin': 'https://www.sooplive.com',
            'User-Agent': 'Mozilla/5.0',
          },
          cache: 'no-store'
        }
      );
      const broadData = await broadRes.json();
      const broadList = broadData?.data?.broad_list || broadData?.broad_list || [];
      if (broadList.length > 0) {
        broadcastNo = String(broadList[0].broad_no || broadList[0].broadNo || '');
      }
    } catch {}

    return NextResponse.json({
      isLive: true,
      broadcastNo,
      thumbnail: broadcastNo ? `https://liveimg.sooplive.co.kr/m/${broadcastNo}` : null,
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
