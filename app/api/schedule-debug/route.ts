import { NextResponse } from 'next/server';
const PUB_ID = '2PACX-1vTaVpnVjcIITgQKdNZ2Vojdx7Ik78OviKKLh_-6wWvremg5U0A_-JI0XNONOm7UrXIpWTzWO3Uqs98V';

function parseCSVText(text: string): string[][] {
  const results: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) { row.push(cur); cur = ''; }
    else if (ch === '\n' && !inQ) { row.push(cur); cur = ''; results.push(row); row = []; }
    else if (ch !== '\r') { cur += ch; }
  }
  if (cur || row.length) { row.push(cur); results.push(row); }
  return results;
}

export async function GET() {
  const url = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?output=csv&gid=202606`;
  const r = await fetch(url, { cache: 'no-store' });
  const text = await r.text();
  const rows = parseCSVText(text);
  // 각 행을 인덱스와 함께 반환 (빈 행 제외)
  const annotated = rows.map((row, i) => ({
    i,
    cells: row,
    hasText: row.some(c => c.trim() && !/^\s*$/.test(c))
  })).filter(r => r.hasText);
  return NextResponse.json({ total: rows.length, rows: annotated });
}
