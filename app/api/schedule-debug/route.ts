import { NextResponse } from 'next/server';

const SHEET_ID = '1Zm1VOH4rASeczj1mtxXE1pnafBPQb5x9Tak0cwdq8w4';

export async function GET() {
  const sheetName = encodeURIComponent('2026년 6월');
  const results: Record<string, any> = {};

  // 방법 1: Sheets API v4 (YouTube API 키 사용)
  try {
    const key = process.env.YOUTUBE_API_KEY;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('2026년 6월!A1:G20')}?key=${key}`;
    const r = await fetch(url, { cache: 'no-store' });
    const d = await r.json();
    results.sheetsApi = { status: r.status, ok: r.ok, values: d.values?.slice(0, 5), error: d.error?.message };
  } catch (e) { results.sheetsApi = { error: String(e) }; }

  // 방법 2: gviz/tq
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
    const r = await fetch(url, { cache: 'no-store' });
    const text = await r.text();
    results.gviz = { status: r.status, ok: r.ok, preview: text.substring(0, 300) };
  } catch (e) { results.gviz = { error: String(e) }; }

  // 방법 3: CSV export (gid=0, 첫번째 시트)
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&sheet=${sheetName}`;
    const r = await fetch(url, { cache: 'no-store' });
    const text = await r.text();
    results.csv = { status: r.status, ok: r.ok, preview: text.substring(0, 300) };
  } catch (e) { results.csv = { error: String(e) }; }

  return NextResponse.json(results);
}
