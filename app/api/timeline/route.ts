import { NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const ADMIN_PASSWORD = process.env.TIMELINE_ADMIN_PASSWORD || '';
const REPO_OWNER = 'brightpants97-tech';
const REPO_NAME = 'smeb-archive';
const FILE_PATH = 'public/timeline-data.json';
const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;

function checkAuth(request: Request): boolean {
  const pw = request.headers.get('x-admin-password') || '';
  return ADMIN_PASSWORD !== '' && pw === ADMIN_PASSWORD;
}

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않아요.' }, { status: 401 });
  }
  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GITHUB_TOKEN이 설정되어 있지 않아요.' }, { status: 500 });
  }
  const res = await fetch(GITHUB_API, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `GitHub API 오류: ${res.status} ${text}` }, { status: 502 });
  }
  const json = await res.json();
  const content = Buffer.from(json.content, 'base64').toString('utf-8');
  const data = JSON.parse(content);
  return NextResponse.json({ data, sha: json.sha });
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않아요.' }, { status: 401 });
  }
  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GITHUB_TOKEN이 설정되어 있지 않아요.' }, { status: 500 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body.data !== 'object' || typeof body.sha !== 'string') {
    return NextResponse.json({ error: '잘못된 요청 형식이에요.' }, { status: 400 });
  }
  const newContent = Buffer.from(
    JSON.stringify(body.data, null, 2) + '\n'
  ).toString('base64');
  const res = await fetch(GITHUB_API, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'chore: update timeline-data.json via admin UI',
      content: newContent,
      sha: body.sha,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `GitHub API 오류: ${res.status} ${text}` }, { status: 502 });
  }
  const json = await res.json();
  return NextResponse.json({ ok: true, sha: json.content.sha });
}
