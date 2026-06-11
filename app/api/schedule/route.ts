import { NextResponse } from 'next/server';

const PUB_ID = '2PACX-1vTaVpnVjcIITgQKdNZ2Vojdx7Ik78OviKKLh_-6wWvremg5U0A_-JI0XNONOm7UrXIpWTzWO3Uqs98V';
const SRC_ID = '1Zm1VOH4rASeczj1mtxXE1pnafBPQb5x9Tak0cwdq8w4';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year  = parseInt(searchParams.get('year')  || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

  const sheetName = `${year}년 ${month}월`;

  // 방법 1: 게시된 CSV (가장 안정적)
  try {
    const url = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?output=csv&sheet=${encodeURIComponent(sheetName)}`;
    const res  = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      const events = parseCSV(text);
      return NextResponse.json({ year, month, events, method: 'published-csv' });
    }
    console.error('published csv status:', res.status);
  } catch (e) { console.error('csv error:', e); }

  // 방법 2: gviz (원본 ID)
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SRC_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    const res  = await fetch(url, { cache: 'no-store' });
    const text = await res.text();
    if (res.ok && text.includes('setResponse')) {
      const json = JSON.parse(text.replace(/^[\s\S]*?google\.visualization\.Query\.setResponse\(/, '').replace(/\);?\s*$/, ''));
      const events = parseGvizRows(json?.table?.rows ?? []);
      return NextResponse.json({ year, month, events, method: 'gviz' });
    }
  } catch (e) { console.error('gviz error:', e); }

  return NextResponse.json({ year, month, events: [], error: '데이터를 불러오지 못했어요' });
}

function parseCSV(csv: string) {
  const events: { date: number; text: string }[] = [];
  const lines = csv.split('\n').map(l => {
    const cols: string[] = [];
    let cur = '', inQ = false;
    for (const ch of l) {
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  });

  const isDateRow = (row: string[]) =>
    row.slice(0, 7).some(v => /^\d{1,2}$/.test(v.trim()) && parseInt(v) >= 1 && parseInt(v) <= 31);

  let i = 0;
  while (i < lines.length) {
    const row = lines[i];
    if (isDateRow(row)) {
      const dateCols: { date: number; col: number }[] = [];
      for (let c = 0; c < 7; c++) {
        const v = (row[c] || '').trim();
        if (/^\d{1,2}$/.test(v) && parseInt(v) >= 1 && parseInt(v) <= 31)
          dateCols.push({ date: parseInt(v), col: c });
      }
      const texts: string[][] = Array.from({ length: 7 }, () => []);
      for (let off = 1; off <= 2; off++) {
        const erow = lines[i + off] || [];
        if (isDateRow(erow)) break;
        for (let c = 0; c < 7; c++) {
          const t = (erow[c] || '').trim();
          if (t) texts[c].push(t);
        }
      }
      for (const { date, col } of dateCols) {
        const text = texts[col].filter(Boolean).join(' / ');
        if (text) events.push({ date, text });
      }
    }
    i++;
  }
  return events;
}

function parseGvizRows(rows: any[]) {
  const events: { date: number; text: string }[] = [];
  const getVal = (row: any, c: number) => {
    const cell = row?.c?.[c];
    if (!cell || cell.v == null) return '';
    return cell.f !== undefined && cell.f !== null ? String(cell.f) : String(cell.v);
  };
  const isDate = (row: any) => {
    let n = 0;
    for (let c = 0; c < 7; c++) { const v = row?.c?.[c]?.v; if (typeof v === 'number' && v >= 1 && v <= 31) n++; }
    return n >= 1;
  };
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (isDate(row)) {
      const dc: { date: number; col: number }[] = [];
      for (let c = 0; c < 7; c++) { const v = row?.c?.[c]?.v; if (typeof v === 'number' && v >= 1 && v <= 31) dc.push({ date: v, col: c }); }
      const tx: string[][] = Array.from({ length: 7 }, () => []);
      for (let off = 1; off <= 2; off++) {
        const er = rows[i + off];
        if (!er || isDate(er)) break;
        for (let c = 0; c < 7; c++) { const t = getVal(er, c).trim(); if (t && t !== '\u200b') tx[c].push(t); }
      }
      for (const { date, col } of dc) { const t = tx[col].filter(Boolean).join(' / '); if (t) events.push({ date, text: t }); }
    }
    i++;
  }
  return events;
}
