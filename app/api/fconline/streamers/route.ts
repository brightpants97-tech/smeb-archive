import { NextResponse } from 'next/server';
import { listStreamers, addStreamer, deleteStreamer, hasRedis } from '@/app/lib/fconline-db';

const ADMIN_PASSWORD = process.env.FC_ADMIN_PASSWORD || '';

function checkAuth(request: Request) {
  if (!ADMIN_PASSWORD) return false;
  const pw = request.headers.get('x-admin-password') || '';
  return pw === ADMIN_PASSWORD;
}

export async function GET() {
  try {
    const streamers = await listStreamers();
    return NextResponse.json({ streamers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '조회 실패' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: '비밀번호가 올바르지 않아요.' }, { status: 401 });
  if (!hasRedis) return NextResponse.json({ error: '저장소(Redis)가 연결되어 있지 않아요.' }, { status: 500 });

  try {
    const body = await request.json();
    const fcNickname = String(body.fcNickname || '').trim();
    const displayName = String(body.displayName || '').trim();
    const teamColor = String(body.teamColor || '#E0A62F').trim();
    if (!fcNickname || !displayName) {
      return NextResponse.json({ error: '스트리머명과 FC 온라인 닉네임을 모두 입력해주세요.' }, { status: 400 });
    }
    await addStreamer({ fcNickname, displayName, teamColor, addedAt: Date.now() });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '등록 실패' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: '비밀번호가 올바르지 않아요.' }, { status: 401 });
  if (!hasRedis) return NextResponse.json({ error: '저장소(Redis)가 연결되어 있지 않아요.' }, { status: 500 });

  try {
    const { searchParams } = new URL(request.url);
    const fcNickname = searchParams.get('fcNickname');
    if (!fcNickname) return NextResponse.json({ error: 'fcNickname 파라미터가 필요해요.' }, { status: 400 });
    await deleteStreamer(fcNickname);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '삭제 실패' }, { status: 500 });
  }
}
