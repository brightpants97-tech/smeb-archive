import { NextResponse } from 'next/server';
import { getSiteIssues, saveSiteIssues, IssueImage } from '@/app/lib/fconline-db';

const ADMIN_PASSWORD = process.env.FC_ADMIN_PASSWORD || '';

export async function GET() {
  try {
    const images = await getSiteIssues();
    return NextResponse.json({ images });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '불러오기에 실패했어요.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const pw = request.headers.get('x-admin-password') || '';
  if (!ADMIN_PASSWORD || pw !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않아요.' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const images = body.images as IssueImage[];
  if (!Array.isArray(images)) {
    return NextResponse.json({ error: 'images 배열이 필요해요.' }, { status: 400 });
  }
  if (images.length > 3) {
    return NextResponse.json({ error: '이미지는 최대 3장까지 등록할 수 있어요.' }, { status: 400 });
  }
  for (const img of images) {
    if (!img.dataUrl || typeof img.dataUrl !== 'string' || !img.dataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: '올바르지 않은 이미지예요.' }, { status: 400 });
    }
    if (img.dataUrl.length > 3_000_000) {
      return NextResponse.json({ error: '이미지 용량이 너무 커요. 더 작은 이미지를 사용해주세요.' }, { status: 400 });
    }
    if (!['auto', 'large', 'medium', 'small'].includes(img.size)) {
      img.size = 'auto';
    }
    const scaleNum = Number(img.scale);
    img.scale = Number.isFinite(scaleNum) ? Math.min(150, Math.max(50, Math.round(scaleNum))) : 100;
    const ALLOWED_POSITIONS = ['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right'];
    if (typeof img.position !== 'string' || !ALLOWED_POSITIONS.includes(img.position)) {
      img.position = 'center';
    }
    if (img.fit !== 'contain') {
      img.fit = 'cover';
    }
  }
  try {
    await saveSiteIssues(images);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '저장에 실패했어요.' }, { status: 500 });
  }
}
