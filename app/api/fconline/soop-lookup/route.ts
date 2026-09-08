import { NextResponse } from 'next/server';

// SOOP(sooplive.com) 방송국 아이디로 실제 활동명 + 프로필 이미지를 조회.
// 관리자 페이지에서 스트리머 등록할 때 정확한 이름/이미지를 자동으로 채우는 용도.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bjid = (searchParams.get('bjid') || '').trim();
  if (!bjid) return NextResponse.json({ error: 'bjid 파라미터가 필요해요.' }, { status: 400 });

  try {
    const res = await fetch(`https://api-channel.sooplive.com/v1.1/channel/${encodeURIComponent(bjid)}/station`, {
      headers: {
        'Referer': 'https://www.sooplive.com/',
        'Origin': 'https://www.sooplive.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ error: `SOOP에서 '${bjid}' 방송국을 찾을 수 없어요.` }, { status: 404 });

    const data = await res.json();
    const s = data?.station;
    if (!s?.userNick) return NextResponse.json({ error: `SOOP에서 '${bjid}' 방송국을 찾을 수 없어요.` }, { status: 404 });

    return NextResponse.json({
      displayName: s.userNick,
      profileImage: s.profileImage || null,
      bjid,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'SOOP 조회 중 오류가 발생했어요: ' + (e?.message || 'unknown') }, { status: 500 });
  }
}
