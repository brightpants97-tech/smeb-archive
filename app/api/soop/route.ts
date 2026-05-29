import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

const BJID = process.env.SOOP_BJID;

async function fetchPage(page: number) {
  try {
    const res = await fetch(
      `https://api-channel.sooplive.com/v1.1/channel/${BJID}/vod/all/streamer?startDate=&endDate=&keyword=&orderBy=regDate&perPage=60&page=${page}&field=title,contents,userNick,userId`,
      {
        headers: {
          'Referer': 'https://www.sooplive.com/',
          'Origin': 'https://www.sooplive.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        cache: 'no-store'
      }
    );
    const data = await res.json();
    return { contents: data.contents || [], totalPages: data.meta?.totalPages || 1 };
  } catch {
    return { contents: [], totalPages: 1 };
  }
}

const getAllVods = unstable_cache(
  async () => {
    const allReviews: any[] = [];

    const first = await fetchPage(1);
    const totalPages = first.totalPages;
    if (!first.contents.length) return { vods: [], months: [] };

    // 1페이지 데이터 처리
    for (const v of first.contents) {
      if (v.ucc?.fileType !== 'REVIEW') continue;
      allReviews.push({
        id: v.titleNo,
        title: v.titleName,
        thumb: v.ucc?.thumb || '',
        date: v.regDate?.split(' ')[0] || '',
        views: v.count?.readCnt || 0,
        duration: v.ucc?.totalFileDuration || 0,
      });
    }

    // 나머지 페이지 10개씩 병렬 처리
    const CHUNK = 10;
    let currentPage = 2;
    while (currentPage <= totalPages) {
      const pages = Array.from(
        { length: Math.min(CHUNK, totalPages - currentPage + 1) },
        (_, i) => currentPage + i
      );
      const results = await Promise.all(pages.map(p => fetchPage(p)));
      for (const { contents } of results) {
        for (const v of contents) {
          if (v.ucc?.fileType !== 'REVIEW') continue;
          allReviews.push({
            id: v.titleNo,
            title: v.titleName,
            thumb: v.ucc?.thumb || '',
            date: v.regDate?.split(' ')[0] || '',
            views: v.count?.readCnt || 0,
            duration: v.ucc?.totalFileDuration || 0,
          });
        }
      }
      currentPage += CHUNK;
    }

    const years = [...new Set(allReviews.map(v => v.date.substring(0, 4)))].sort();
    const months: string[] = [];
    years.forEach(y => {
      for (let mo = 1; mo <= 12; mo++) {
        months.push(`${y}-${String(mo).padStart(2, '0')}`);
      }
    });

    return { vods: allReviews, months };
  },
  ['soop-streamer-vods-v1'],
  { revalidate: 3600 }
);

export async function GET() {
  try {
    const data = await getAllVods();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}