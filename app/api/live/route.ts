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
          'Accept': 'application/json',
        },
        cache: 'no-store',
      }
    );
    const data = await res.json();
    const station = data.station;

    return NextResponse.json({
      broadStart: station?.broadStart ?? null,
      profileImage: `https://profile.img.sooplive.com/LOGO/to/${BJID}/${BJID}.jpg`,
    });
  } catch (error) {
    return NextResponse.json({
      broadStart: null,
      profileImage: `https://profile.img.sooplive.com/LOGO/to/${BJID}/${BJID}.jpg`,
      error: String(error),
    });
  }
}
