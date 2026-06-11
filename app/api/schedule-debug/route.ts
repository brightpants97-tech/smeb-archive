import { NextResponse } from 'next/server';

const SRC_ID = '1Zm1VOH4rASeczj1mtxXE1pnafBPQb5x9Tak0cwdq8w4';
const PUB_ID = '2PACX-1vTaVpnVjcIITgQKdNZ2Vojdx7Ik78OviKKLh_-6wWvremg5U0A_-JI0XNONOm7UrXIpWTzWO3Uqs98V';

export async function GET() {
  const results: Record<string, any> = {};

  // gviz: 인코딩 없이 sheet 이름 그대로
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SRC_ID}/gviz/tq?tqx=out:json&sheet=2026${encodeURIComponent('년')}+6${encodeURIComponent('월')}`;
    const r = await fetch(url, { cache: 'no-store' });
    const text = await r.text();
    const m = text.match(/"reqId":"0","status":"([^"]+)"/);
    const colMatch = text.match(/"label":"([^"]*)".*?"label":"([^"]*)"/);
    results['gviz_plus'] = { status: r.status, sheetStatus: m?.[1], preview: text.substring(50, 250) };
  } catch(e) { results['gviz_plus'] = { error: String(e) }; }

  // gviz: 완전 raw (한국어 그대로)
  try {
    const sheetRaw = '2026년 6월';
    const url = 'https://docs.google.com/spreadsheets/d/' + SRC_ID + '/gviz/tq?tqx=out:json&sheet=' + sheetRaw;
    const r = await fetch(url, { cache: 'no-store' });
    const text = await r.text();
    results['gviz_raw'] = { status: r.status, preview: text.substring(50, 250) };
  } catch(e) { results['gviz_raw'] = { error: String(e) }; }

  // gviz: gid=202606 (12월 시트 - 알고 있는 GID)
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SRC_ID}/gviz/tq?tqx=out:json&gid=202606`;
    const r = await fetch(url, { cache: 'no-store' });
    const text = await r.text();
    results['gviz_gid202606'] = { status: r.status, preview: text.substring(50, 300) };
  } catch(e) { results['gviz_gid202606'] = { error: String(e) }; }

  // gviz: gid=0 (첫번째 시트)
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SRC_ID}/gviz/tq?tqx=out:json&gid=0`;
    const r = await fetch(url, { cache: 'no-store' });
    const text = await r.text();
    results['gviz_gid0'] = { status: r.status, preview: text.substring(50, 300) };
  } catch(e) { results['gviz_gid0'] = { error: String(e) }; }

  // gviz: 잘못된 시트명 → 에러에 GID 목록 포함되는지 확인
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SRC_ID}/gviz/tq?tqx=out:json&sheet=INVALID_SHEET_NAME`;
    const r = await fetch(url, { cache: 'no-store' });
    const text = await r.text();
    results['gviz_invalid'] = { status: r.status, preview: text.substring(0, 500) };
  } catch(e) { results['gviz_invalid'] = { error: String(e) }; }

  // pub CSV: gid=202606
  try {
    const url = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?output=csv&gid=202606`;
    const r = await fetch(url, { cache: 'no-store' });
    const text = await r.text();
    results['csv_gid202606'] = { status: r.status, preview: text.substring(0, 200) };
  } catch(e) { results['csv_gid202606'] = { error: String(e) }; }

  return NextResponse.json(results);
}
