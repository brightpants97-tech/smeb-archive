import { getSource, SourceError } from '@/app/lib/soop-chat-server';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function GET(request: Request) {
  try {
    const url = new URL(request.url).searchParams.get('url') || '';
    if (url.length > 500) throw new SourceError('주소가 너무 깁니다.');
    return Response.json(await getSource(url), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json({ error: e instanceof SourceError ? e.message : 'SOOP 응답을 읽을 수 없습니다. 잠시 후 다시 시도해 주세요.' }, { status: e instanceof SourceError ? e.status : 502 });
  }
}
