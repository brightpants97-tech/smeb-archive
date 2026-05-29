import { NextResponse } from 'next/server';

const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;
const API_KEY    = process.env.YOUTUBE_API_KEY;

export async function GET() {
  // 최신 50개 가져오기
  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search` +
    `?part=snippet&channelId=${CHANNEL_ID}` +
    `&order=date&type=video&maxResults=50` +
    `&key=${API_KEY}`
  );
  const searchData = await searchRes.json();

  const videoIds = searchData.items
    .map((item: any) => item.id.videoId)
    .join(',');

  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos` +
    `?part=statistics,snippet&id=${videoIds}` +
    `&key=${API_KEY}`
  );
  const statsData = await statsRes.json();

  const videos = statsData.items.map((item: any) => ({
    id:          item.id,
    title:       item.snippet.title,
    thumbnail:   item.snippet.thumbnails.high.url,
    publishedAt: item.snippet.publishedAt,
    views:       parseInt(item.statistics.viewCount),
  }));

  // 날짜순 정렬해서 반환 (최신순)
  videos.sort((a: any, b: any) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return NextResponse.json(videos);
}