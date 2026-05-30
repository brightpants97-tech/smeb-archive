import { NextResponse } from 'next/server';

const BJID = process.env.SOOP_BJID || 'townboy';

export async function GET(request: Request) {
  try {
    const host = request.headers.get('host') || 'smeb-archive.vercel.app';
    const proto = host.includes('localhost') ? 'http' : 'https';

    // next.config.ts의 rewrite 규칙을 통해 SOOP 방송국 페이지를 서버에서 가져옴
    // /api/soop-station → https://www.sooplive.com/station/{BJID}
    const pageRes = await fetch(`${proto}://${host}/api/soop-station`, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    const html = await pageRes.text();

    // liveimg URL에서 broadcastNo 추출
    const m = html.match(/liveimg\.sooplive\.com\/[a-z]+\/(\d{8,})/) ||
              html.match(/play\.sooplive\.com\/${BJID}\/(\d{8,})/);
    const broadcastNo = m?.[1] ?? null;

    // broadStart는 station API에서 가져옴 (접근 가능)
    let broadStart: string | null = null;
    try {
      const stRes = await fetch(
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
      const stData = await stRes.json();
      broadStart = stData.station?.broadStart ?? null;
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
