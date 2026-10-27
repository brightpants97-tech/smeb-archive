import { ReviewError, reviewWithProvider, validateReviewInput } from '@/app/lib/chat-review-server';
export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) throw new ReviewError('이 사이트에서 검수를 실행해 주세요.', 403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ReviewError('JSON 요청이 필요합니다.', 415);
    const reader = request.body?.getReader();
    if (!reader) throw new ReviewError('검수 내용이 없습니다.');
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 350000) { await reader.cancel(); throw new ReviewError('검수 요청이 너무 큽니다.', 413); }
      chunks.push(value);
    }
    let value;
    try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new ReviewError('검수 요청을 읽을 수 없습니다.'); }
    // BYOK only: never fall back to the site's shared API keys on this public endpoint.
    const input = validateReviewInput(value);
    return Response.json(await reviewWithProvider(input, request.signal), { headers });
  } catch (error) {
    return Response.json({ error: error instanceof ReviewError ? error.message : '검수를 완료하지 못했습니다.' }, { status: error instanceof ReviewError ? error.status : 500, headers });
  }
}
