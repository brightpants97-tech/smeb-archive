import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import RewindClient from './rewind-client';

const VALID_YEARS = [2021, 2022, 2023, 2024, 2025];
const CURRENT_YEAR = 2025;

export async function generateStaticParams() {
  return VALID_YEARS.map(y => ({ year: String(y) }));
}

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }): Promise<Metadata> {
  const { year } = await params;
  return {
    title: `스맵 ${year} 연간 레포트 | SMEB Archive`,
    description: `${year}년 스맵(송경호)과 함께한 365일 총결산.`,
    openGraph: {
      title: `스맵 ${year} 연간 레포트`,
      description: `${year}년 스맵과 함께한 365일 총결산`,
      url: `https://www.smebarchive.xyz/rewind/${year}`,
    },
  };
}

export interface Video {
  id: string; title: string; thumbnail: string;
  publishedAt: string; views: number;
}
export interface MonthData {
  key: string; month: number;
  topYT: Video | null;
  top3: Video[];
  ytCount: number; soopCount: number;
  totalMonthViews: number;
}
export interface RewindStats {
  ytUploads: number; totalViews: number;
  soopBroadcasts: number; broadcastHours: number;
  avgViews: number; peakMonth: MonthData;
}

// ── YouTube 데이터 (연도별 캐시) ──
function getYTVideos(year: number) {
  return unstable_cache(async (): Promise<Video[]> => {
    try {
      const KEY = process.env.YOUTUBE_API_KEY!;
      const CH  = process.env.YOUTUBE_CHANNEL_ID!;
      const afterISO  = `${year}-01-01T00:00:00Z`;
      const beforeISO = `${year}-12-31T23:59:59Z`;

      const chRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${CH}&key=${KEY}`,
        { cache: 'no-store' }
      );
      const chData = await chRes.json();
      const uploadPL = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadPL) return [];

      const allIds: string[] = [];
      let pageToken: string | undefined;
      let done = false;

      do {
        const params = new URLSearchParams({
          part: 'contentDetails', playlistId: uploadPL,
          maxResults: '50', key: KEY,
          ...(pageToken ? { pageToken } : {}),
        });
        const res  = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`, { cache: 'no-store' });
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

      const videos: Video[] = [];
      for (let i = 0; i < allIds.length; i += 50) {
        const ids = allIds.slice(i, i + 50).join(',');
        const res  = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids}&key=${KEY}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        for (const item of data.items || []) {
          videos.push({
            id: item.id,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || '',
            publishedAt: item.snippet.publishedAt,
            views: parseInt(item.statistics?.viewCount || '0'),
          });
        }
      }
      return videos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    } catch (e) {
      console.error(`rewind YT ${year} error:`, e);
      return [];
    }
  }, [`rewind-yt-${year}`], { revalidate: 7200 });
}

// ── SOOP 데이터 (연도별 캐시) ──
function getSOOPVods(year: number) {
  return unstable_cache(async () => {
    const BJID = process.env.SOOP_BJID || 'townboy';
    const all: { id: number; title: string; date: string; views: number; duration: number }[] = [];

    const fetchPage = async (page: number) => {
      try {
        const res = await fetch(
          `https://api-channel.sooplive.com/v1.1/channel/${BJID}/vod/all/streamer?startDate=${year}-01-01&endDate=${year}-12-31&keyword=&orderBy=regDate&perPage=60&page=${page}&field=title,contents,userNick,userId`,
          { headers: { 'Referer': 'https://www.sooplive.com/', 'Origin': 'https://www.sooplive.com', 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
        );
        const data = await res.json();
        return { contents: data.contents || [], totalPages: data.meta?.totalPages || 1 };
      } catch { return { contents: [], totalPages: 1 }; }
    };

    const process = (contents: any[]) => {
      for (const v of contents) {
        if (v.ucc?.fileType !== 'REVIEW') continue;
        const date = v.regDate?.split(' ')[0] || '';
        if (!date.startsWith(String(year))) continue;
        all.push({ id: v.titleNo, title: v.titleName, date, views: v.count?.readCnt || 0, duration: v.ucc?.totalFileDuration || 0 });
      }
    };

    const first = await fetchPage(1);
    process(first.contents);
    let p = 2;
    while (p <= first.totalPages) {
      const chunk = Array.from({ length: Math.min(10, first.totalPages - p + 1) }, (_, i) => p + i);
      const results = await Promise.all(chunk.map(fetchPage));
      results.forEach(r => process(r.contents));
      p += 10;
    }
    return all;
  }, [`rewind-soop-${year}`], { revalidate: 7200 });
}

export default async function RewindPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearStr } = await params;
  const year = parseInt(yearStr);

  if (!VALID_YEARS.includes(year)) notFound();

  const [ytVideos, soopVods] = await Promise.all([
    getYTVideos(year)(),
    getSOOPVods(year)(),
  ]);

  // 월별 데이터
  const monthlyData: MonthData[] = Array.from({ length: 12 }, (_, i) => {
    const m   = String(i + 1).padStart(2, '0');
    const key = `${year}-${m}`;
    const ytM    = ytVideos.filter(v => v.publishedAt.startsWith(key)).sort((a, b) => b.views - a.views);
    const soopM  = soopVods.filter(v => v.date.startsWith(key)).sort((a, b) => b.views - a.views);
    return {
      key, month: i + 1,
      topYT: ytM[0] || null,
      top3: ytM.slice(0, 3),
      ytCount: ytM.length,
      soopCount: soopM.length,
      totalMonthViews: ytM.reduce((s, v) => s + v.views, 0),
    };
  });

  const top10      = [...ytVideos].sort((a, b) => b.views - a.views).slice(0, 10);
  const peak       = monthlyData.reduce((b, m) => (m.ytCount + m.soopCount > b.ytCount + b.soopCount ? m : b), monthlyData[0]);
  const totalViews = ytVideos.reduce((s, v) => s + v.views, 0);

  const stats: RewindStats = {
    ytUploads:      ytVideos.length,
    totalViews,
    soopBroadcasts: soopVods.length,
    broadcastHours: Math.round(soopVods.reduce((s, v) => s + (v.duration || 0), 0) / 3600000),
    avgViews:       ytVideos.length > 0 ? Math.round(totalViews / ytVideos.length) : 0,
    peakMonth:      peak,
  };

  return (
    <RewindClient
      year={year}
      validYears={VALID_YEARS}
      stats={stats}
      monthlyData={monthlyData}
      top10={top10}
    />
  );
}
