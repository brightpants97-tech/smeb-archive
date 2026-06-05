import { unstable_cache } from 'next/cache';
import type { Metadata } from 'next';
import RewindClient from './rewind-client';

export const metadata: Metadata = {
  title: '스맵 2025 연간 레포트 | SMEB Archive',
  description: '2025년 스맵(송경호)과 함께한 365일 총결산. 유튜브 TOP10, 월별 하이라이트, 방송 기록 총정리.',
  openGraph: {
    title: '스맵 2025 연간 레포트',
    description: '2025년 스맵과 함께한 365일 총결산',
    url: 'https://www.smebarchive.xyz/rewind/2025',
  },
};

const YEAR = 2025;

export interface Video {
  id: string; title: string; thumbnail: string;
  publishedAt: string; views: number;
}
export interface Vod {
  id: number; title: string; thumb: string;
  date: string; views: number; duration: number;
}
export interface MonthData {
  key: string; month: number;
  topYT: Video | null;
  ytCount: number; soopCount: number;
  totalMonthViews: number;
}
export interface RewindStats {
  ytUploads: number; totalViews: number;
  soopBroadcasts: number; broadcastHours: number;
  activeMonths: number; peakMonth: MonthData;
}

// ── YouTube 데이터 ──
const getYTVideos = unstable_cache(async (): Promise<Video[]> => {
  try {
    const KEY = process.env.YOUTUBE_API_KEY!;
    const CH  = process.env.YOUTUBE_CHANNEL_ID!;
    const cutoffISO = `${YEAR - 1}-12-31T23:59:59Z`;

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
        if (pub && pub < cutoffISO) { done = true; break; }
        if (pub.startsWith(String(YEAR))) allIds.push(vid);
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
    console.error('rewind YT error:', e);
    return [];
  }
}, [`rewind-yt-${YEAR}`], { revalidate: 7200 });

// ── SOOP 데이터 ──
const getSOOPVods = unstable_cache(async (): Promise<Vod[]> => {
  const BJID = process.env.SOOP_BJID || 'townboy';
  const all: Vod[] = [];

  const fetchPage = async (page: number) => {
    try {
      const res = await fetch(
        `https://api-channel.sooplive.com/v1.1/channel/${BJID}/vod/all/streamer?startDate=${YEAR}-01-01&endDate=${YEAR}-12-31&keyword=&orderBy=regDate&perPage=60&page=${page}&field=title,contents,userNick,userId`,
        { headers: { 'Referer': 'https://www.sooplive.com/', 'Origin': 'https://www.sooplive.com', 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
      );
      const data = await res.json();
      return { contents: data.contents || [], totalPages: data.meta?.totalPages || 1 };
    } catch { return { contents: [], totalPages: 1 }; }
  };

  const processContents = (contents: any[]) => {
    for (const v of contents) {
      if (v.ucc?.fileType !== 'REVIEW') continue;
      const date = v.regDate?.split(' ')[0] || '';
      if (!date.startsWith(String(YEAR))) continue;
      all.push({ id: v.titleNo, title: v.titleName, thumb: v.ucc?.thumb || '', date, views: v.count?.readCnt || 0, duration: v.ucc?.totalFileDuration || 0 });
    }
  };

  const first = await fetchPage(1);
  processContents(first.contents);
  let p = 2;
  while (p <= first.totalPages) {
    const chunk = Array.from({ length: Math.min(10, first.totalPages - p + 1) }, (_, i) => p + i);
    const results = await Promise.all(chunk.map(fetchPage));
    results.forEach(r => processContents(r.contents));
    p += 10;
  }
  return all;
}, [`rewind-soop-${YEAR}`], { revalidate: 7200 });

export default async function RewindPage() {
  const [ytVideos, soopVods] = await Promise.all([getYTVideos(), getSOOPVods()]);

  // 월별 데이터
  const monthlyData: MonthData[] = Array.from({ length: 12 }, (_, i) => {
    const m   = String(i + 1).padStart(2, '0');
    const key = `${YEAR}-${m}`;
    const ytM    = ytVideos.filter(v => v.publishedAt.startsWith(key)).sort((a, b) => b.views - a.views);
    const soopM  = soopVods.filter(v => v.date.startsWith(key)).sort((a, b) => b.views - a.views);
    return {
      key, month: i + 1,
      topYT: ytM[0] || null,
      ytCount: ytM.length,
      soopCount: soopM.length,
      totalMonthViews: ytM.reduce((s, v) => s + v.views, 0),
    };
  });

  const top10   = [...ytVideos].sort((a, b) => b.views - a.views).slice(0, 10);
  const active  = monthlyData.filter(m => m.ytCount > 0 || m.soopCount > 0);
  const peak    = monthlyData.reduce((b, m) => (m.ytCount + m.soopCount > b.ytCount + b.soopCount ? m : b), monthlyData[0]);

  const stats: RewindStats = {
    ytUploads:      ytVideos.length,
    totalViews:     ytVideos.reduce((s, v) => s + v.views, 0),
    soopBroadcasts: soopVods.length,
    broadcastHours: Math.round(soopVods.reduce((s, v) => s + (v.duration || 0), 0) / 3600000),
    activeMonths:   active.length,
    peakMonth:      peak,
  };

  return <RewindClient year={YEAR} stats={stats} monthlyData={monthlyData} top10={top10} />;
}
