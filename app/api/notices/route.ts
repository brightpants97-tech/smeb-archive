import { NextResponse } from 'next/server';

const BJID = process.env.SOOP_BJID || 'townboy';

export async function GET() {
  try {
    const res = await fetch(
      `https://api-channel.sooplive.com/v1.1/channel/${BJID}/post?perPage=5&page=1&postType=NOTICE`,
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
    const notices = (data.contents || []).slice(0, 3).map((n: any) => {
      const rawSummary = (n.contents || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      // titleName이 '공지'처럼 카테고리명이면 summary 첫 문장을 제목으로 사용
      const title = (n.titleName && n.titleName !== '공지' && n.titleName.length > 2)
        ? n.titleName
        : rawSummary.split(/[.!?\n]/)[0].trim().slice(0, 40) || n.titleName;
      return {
        id: n.titleNo,
        title,
        summary: rawSummary.slice(0, 120),
        date: n.regDate?.split(' ')[0] || '',
        likes: n.count?.likeCnt || 0,
        comments: n.count?.commentCnt || 0,
        url: `https://www.sooplive.com/station/${BJID}/post/${n.titleNo}`,
      };
    });
    return NextResponse.json({ notices });
  } catch (error) {
    return NextResponse.json({ notices: [], error: String(error) });
  }
}
