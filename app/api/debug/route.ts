import { NextResponse } from 'next/server';

const BJID = process.env.SOOP_BJID || 'townboy';

export async function GET() {
  try {
    const pageRes = await fetch(`https://www.sooplive.com/station/${BJID}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      cache: 'no-store',
    });
    const status = pageRes.status;
    const html = await pageRes.text();
    const snippet = html.substring(0, 3000);
    const liveimgMatches = html.match(/liveimg[^"'\s]{1,80}/g)?.slice(0, 5) || [];
    const broadMatches = html.match(/294[0-9]{6}/g)?.slice(0, 5) || [];
    return NextResponse.json({ status, liveimgMatches, broadMatches, snippet });
  } catch (error) {
    return NextResponse.json({ error: String(error) });
  }
}
