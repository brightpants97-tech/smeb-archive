import { NextResponse } from 'next/server';

const ADMIN_PASSWORD = process.env.FC_ADMIN_PASSWORD || '';

export async function POST(request: Request) {
  if (!ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'FC_ADMIN_PASSWORD 환경변수가 설정되어 있지 않아요.' }, { status: 500 });
  }
  const body = await request.json().catch(() => ({}));
  const password = String(body.password || '');
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않아요.' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
