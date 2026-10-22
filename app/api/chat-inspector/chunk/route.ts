import { getVodChunk, SourceError } from '@/app/lib/soop-chat-server';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams;
    if (!p.has('file') || !p.has('start')) throw new SourceError('구간 정보가 필요합니다.');
    return Response.json(await getVodChunk(p.get('id') || '', Number(p.get('file')), Number(p.get('start'))), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json({ error: e instanceof SourceError ? e.message : '채팅 구간을 가져오지 못했습니다. 다시 시도해 주세요.' }, { status: e instanceof SourceError ? e.status : 502 });
  }
}
