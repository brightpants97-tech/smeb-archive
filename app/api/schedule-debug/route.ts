import { NextResponse } from 'next/server';

const SHEET_ID = '1Zm1VOH4rASeczj1mtxXE1pnafBPQb5x9Tak0cwdq8w4';

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sheet = searchParams.get('sheet') || '2026년 6월';

  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent(sheet)}`;
  const r = await fetch(url, { cache: 'no-store' });
  const text = await r.text();
  const rows = parseCSVText(text);
  const annotated = rows.map((row, i) => ({
    i,
    cells: row,
    hasText: row.some(c => c.trim() && !/^\s*$/.test(c))
  })).filter(r => r.hasText);
  return NextResponse.json({ sheet, status: r.status, total: rows.length, rows: annotated });
}
