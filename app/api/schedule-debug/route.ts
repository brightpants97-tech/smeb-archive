import { NextResponse } from 'next/server';

const PUB_ID = '2PACX-1vTaVpnVjcIITgQKdNZ2Vojdx7Ik78OviKKLh_-6wWvremg5U0A_-JI0XNONOm7UrXIpWTzWO3Uqs98V';
const SRC_ID = '1Zm1VOH4rASeczj1mtxXE1pnafBPQb5x9Tak0cwdq8w4';

export async function GET() {
  const results: Record<string, any> = {};

  // pubhtml 전체 소스에서 gid 목록 추출
  try {
    const url = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pubhtml`;
    const r = await fetch(url, { cache: 'no-store' });
    const text = await r.text();
    // gid= 패턴 추출
    const gidMatches = [...text.matchAll(/gid=(\d+)/g)].map(m => m[1]);
    const uniqueGids = [...new Set(gidMatches)];
    results['pubhtml_gids'] = { count: uniqueGids.length, gids: uniqueGids.slice(0, 50) };
    results['pubhtml_length'] = text.length;
    // 시트 탭 이름 추출
    const tabMatches = [...text.matchAll(/data-sheet-id="(\d+)"[^>]*>([^<]+)</g)].map(m => ({gid: m[1], name: m[2]}));
    results['tabs'] = tabMatches.slice(0, 30);
    // 가이드용 excerpt
    const gidIdx = text.indexOf('gid=');
    if (gidIdx >= 0) results['pubhtml_excerpt'] = text.substring(gidIdx - 50, gidIdx + 200);
  } catch(e) { results['pubhtml'] = { error: String(e) }; }

  // 구버전 Sheets v3 API (공개 시트 워크시트 목록)
  try {
    const url = `https://spreadsheets.google.com/feeds/worksheets/${SRC_ID}/public/full?alt=json`;
    const r = await fetch(url, { cache: 'no-store' });
    const d = await r.json();
    const sheets = d.feed?.entry?.map((e: any) => ({
      title: e.title.$t,
      id: e.id.$t,
      gid: e.link?.find((l: any) => l.rel === 'http://schemas.google.com/visualization/2008#visualizationApi')?.href?.match(/gid=(\d+)/)?.[1]
    }));
    results['sheetsV3'] = { count: sheets?.length, sheets: sheets?.slice(0, 10) };
  } catch(e) { results['sheetsV3'] = { error: String(e) }; }

  return NextResponse.json(results);
}
