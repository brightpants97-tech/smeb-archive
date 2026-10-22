import { NextResponse } from 'next/server';
import { listStreamers, addStreamer, updateStreamer, deleteStreamer, hasRedis } from '@/app/lib/fconline-db';

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
    const profileImage = body.profileImage ? String(body.profileImage).trim() : null;
    if (!fcNickname || !displayName) {
      return NextResponse.json({ error: '스트리머명과 FC 온라인 닉네임을 모두 입력해주세요.' }, { status: 400 });
    }
    await addStreamer({ fcNickname, displayName, teamColor, profileImage, addedAt: Date.now() });

    // 등록하자마자 이 상대와의 전적을 미리 한번 조회해서 저장해둠 (플랫폼 상관없이 바로 목록/최근30경기에 뜨도록)
    // 서버리스 환경에서 응답 후 바로 끊기지 않도록 완료까지 기다림 (몇 초 걸릴 수 있음)
    let seeded = true;
    try {
      const origin = new URL(request.url).origin;
      await fetch(`${origin}/api/fconline/head2head?opponent=${encodeURIComponent(fcNickname)}`, { cache: 'no-store' });
    } catch {
      seeded = false;
    }

    return NextResponse.json({ ok: true, seeded });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '등록 실패' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: '비밀번호가 올바르지 않아요.' }, { status: 401 });
  if (!hasRedis) return NextResponse.json({ error: '저장소(Redis)가 연결되어 있지 않아요.' }, { status: 500 });
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '올바른 수정 정보를 보내주세요.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: '올바른 수정 정보를 보내주세요.' }, { status: 400 });
  const originalNickname = typeof body.originalNickname === 'string' ? body.originalNickname.trim() : '';
  const fcNickname = typeof body.fcNickname === 'string' ? body.fcNickname.trim() : '';
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const teamColor = typeof body.teamColor === 'string' ? body.teamColor.trim() : '';
  const profileImage = typeof body.profileImage === 'string' ? body.profileImage.trim() || null : null;
  if (!originalNickname || !fcNickname || !displayName) return NextResponse.json({ error: '스트리머명과 FC 온라인 닉네임을 모두 입력해주세요.' }, { status: 400 });
  if (!/^#[0-9a-f]{6}$/i.test(teamColor)) return NextResponse.json({ error: '올바른 팀컬러를 선택해주세요.' }, { status: 400 });
  if (profileImage) {
    try {
      const url = new URL(profileImage);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid image URL');
    } catch {
      return NextResponse.json({ error: '프로필 이미지는 http 또는 https 주소를 입력해주세요.' }, { status: 400 });
    }
  }
  try {
    const result = await updateStreamer(originalNickname, { fcNickname, displayName, teamColor, profileImage });
    if (result === 0) return NextResponse.json({ error: '수정할 스트리머가 없어요. 목록을 새로고침해주세요.' }, { status: 404 });
    if (result === -1) return NextResponse.json({ error: '이미 다른 스트리머에게 등록된 FC 닉네임이에요.' }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '수정 내용을 저장하지 못했어요. 다시 시도해주세요.' }, { status: 500 });
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
