import { NextResponse } from 'next/server';

const BJID = process.env.SOOP_BJID || 'townboy';

export async function GET() {
  const debug: Record<string, unknown> = {};

  // 1. www.sooplive.com 직접 fetch 시도
  try {
    const r = await fetch(`https://www.sooplive.com/station/${BJID}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': 'https://www.sooplive.com/',
      },
      cache: 'no-store',
    });
    const html = await r.text();
    debug.status = r.status;
    debug.htmlLen = html.length;
    const m = html.match(/liveimg\.sooplive\.com\/[a-z]+\/(\d{8,})/) ||
              html.match(/play\.sooplive\.com\/${BJID}\/(\d{8,})/);
    debug.broadcastNo = m?.[1] ?? null;
    debug.sample = html.substring(0, 300);
  } catch (e) {
    debug.fetchError = String(e);
  }

  // 2. broadStart용 station API
  let broadStart: string | null = null;
  try {
    const st = await fetch(`https://api-channel.sooplive.com/v1.1/channel/${BJID}/station`, {
      headers: {
        'Referer': 'https://www.sooplive.com/',
        'Origin': 'https://www.sooplive.com',
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });
    const d = await st.json();
    broadStart = d.station?.broadStart ?? null;
  } catch {}

  const broadcastNo = debug.broadcastNo as string | null;

  return NextResponse.json({
    broadcastNo,
    isLive: !!broadcastNo,
    thumbnail: broadcastNo ? `https://liveimg.sooplive.co.kr/m/${broadcastNo}` : null,
    liveUrl: broadcastNo
      ? `https://play.sooplive.com/${BJID}/${broadcastNo}`
      : `https://www.sooplive.com/station/${BJID}`,
    broadStart,
    profileImage: `https://profile.img.sooplive.com/LOGO/to/${BJID}/${BJID}.jpg`,
    _debug: debug,
  });
}
