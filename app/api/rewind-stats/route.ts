import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

const KEY  = () => process.env.YOUTUBE_API_KEY!;
const CH   = () => process.env.YOUTUBE_CHANNEL_ID!;

const fetchYearStats = unstable_cache(
  async (year: number) => {
    try {
      const afterISO  = `${year}-01-01T00:00:00Z`;
      const beforeISO = `${year}-12-31T23:59:59Z`;

      const chRes  = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${CH()}&key=${KEY()}`,
        { next: { revalidate: 86400 } }
      );
      const chData = await chRes.json();
      const uploadPL = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadPL) return null;

      const allIds: string[] = [];
      let pageToken: string | undefined;
      let done = false;

      do {
        const p = new URLSearchParams({
          part: 'contentDetails', playlistId: uploadPL,
          maxResults: '50', key: KEY(),
          ...(pageToken ? { pageToken } : {}),
        });
        const res  = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?${p}`,
          { next: { revalidate: 86400 } }
        );
        const data = await res.json();
        for (const item of data.items || []) {
          const vid = item.contentDetails?.videoId;
          const pub = item.contentDetails?.videoPublishedAt || '';
          if (!vid) continue;
          if (pub && pub < afterISO) { done = true; break; }
          if (pub >= afterISO && pub <= beforeISO) allIds.push(vid);
        }
        pageToken = done ? undefined : data.nextPageToken;
      } while (pageToken);

      let totalViews = 0;
      const monthly = Array(12).fill(0);

      for (let i = 0; i < allIds.length; i += 50) {
        const ids = allIds.slice(i, i + 50).join(',');
        const res  = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids}&key=${KEY()}`,
          { next: { revalidate: 86400 } }
        );
        const data = await res.json();
        for (const item of data.items || []) {
          const views = parseInt(item.statistics?.viewCount || '0');
          const month = new Date(item.snippet.publishedAt).getMonth();
          totalViews += views;
          monthly[month] += views;
        }
      }

      return {
        year,
        totalViews,
        ytUploads: allIds.length,
        avgViews: allIds.length > 0 ? Math.round(totalViews / allIds.length) : 0,
        monthlyViews: monthly,
      };
    } catch (e) {
      console.error('rewind-stats error:', e);
      return null;
    }
  },
  ['rewind-year-stats'],
  { revalidate: 86400 }
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
  const stats = await fetchYearStats(year);
  if (!stats) return NextResponse.json({ error: 'fetch failed' }, { status: 500 });
  return NextResponse.json(stats);
}
