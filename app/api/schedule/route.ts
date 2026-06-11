import { NextResponse } from 'next/server';

const SHEET_ID = '1Zm1VOH4rASeczj1mtxXE1pnafBPQb5x9Tak0cwdq8w4';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year  = parseInt(searchParams.get('year')  || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

  const sheetName = `${year}년 ${month}월`;

  // 방법 1: gviz/tq (웹에 게시된 시트에서 작동)
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    const res  = await fetch(url, { cache: 'no-store' });
    const text = await res.text();

    if (res.ok && text.includes('setResponse')) {
      const json = JSON.parse(text.replace(/^[\s\S]*?google\.visualization\.Query\.setResponse\(/, '').replace(/\);?\s*$/, ''));
      const rows = json?.table?.rows ?? [];
      const events = parseCalendarRows(rows, 'gviz');
      return NextResponse.json({ year, month, events, method: 'gviz' });
    }
  } catch (e) { console.error('gviz failed:', e); }

  // 방법 2: CSV export
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`;
    const res  = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      const events = parseCSV(text);
      return NextResponse.json({ year, month, events, method: 'csv' });
    }
  } catch (e) { console.error('csv failed:', e); }

  return NextResponse.json({ year, month, events: [], error: '시트 데이터를 불러올 수 없어요' });
}

// gviz 파싱
function parseCalendarRows(rows: any[], _type: string) {
  const events: { date: number; text: string }[] = [];

  const getCellVal = (row: any, col: number) => {
    const cell = row?.c?.[col];
    if (!cell || cell.v === null || cell.v === undefined) return '';
    return cell.f !== undefined && cell.f !== null ? String(cell.f) : String(cell.v);
  };

  const isDateRow = (row: any) => {
    let cnt = 0;
    for (let c = 0; c < 7; c++) {
      const v = row?.c?.[c]?.v;
      if (typeof v === 'number' && v >= 1 && v <= 31) cnt++;
    }
    return cnt >= 1;
  };

  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (isDateRow(row)) {
      const dateCols: { date: number; col: number }[] = [];
      for (let c = 0; c < 7; c++) {
        const v = row?.c?.[c]?.v;
        if (typeof v === 'number' && v >= 1 && v <= 31) dateCols.push({ date: v, col: c });
      }
      const eventTexts: string[][] = Array.from({ length: 7 }, () => []);
      for (let offset = 1; offset <= 2; offset++) {
        const erow = rows[i + offset];
        if (!erow || isDateRow(erow)) break;
        for (let c = 0; c < 7; c++) {
          const t = getCellVal(erow, c).trim();
          if (t && t !== '\u200b' && t !== '\u00a0') eventTexts[c].push(t);
        }
      }
      for (const { date, col } of dateCols) {
        const text = eventTexts[col].filter(Boolean).join(' / ');
        if (text) events.push({ date, text });
      }
    }
    i++;
  }
  return events;
}

// CSV 파싱 (fallback)
function parseCSV(csv: string) {
  const events: { date: number; text: string }[] = [];
  const lines = csv.split('\n').map(l => l.split(',').map(c => c.replace(/^"|"$/g, '').trim()));

  const isDateRow = (row: string[]) =>
    row.slice(0, 7).some(v => /^\d{1,2}$/.test(v) && parseInt(v) >= 1 && parseInt(v) <= 31);

  let i = 0;
  while (i < lines.length) {
    const row = lines[i];
    if (isDateRow(row)) {
      const dateCols: { date: number; col: number }[] = [];
      for (let c = 0; c < 7; c++) {
        const v = row[c]?.trim();
        if (/^\d{1,2}$/.test(v) && parseInt(v) >= 1 && parseInt(v) <= 31) dateCols.push({ date: parseInt(v), col: c });
      }
      const eventTexts: string[][] = Array.from({ length: 7 }, () => []);
      for (let offset = 1; offset <= 2; offset++) {
        const erow = lines[i + offset] || [];
        if (isDateRow(erow)) break;
        for (let c = 0; c < 7; c++) {
          const t = (erow[c] || '').trim();
          if (t) eventTexts[c].push(t);
        }
      }
      for (const { date, col } of dateCols) {
        const text = eventTexts[col].filter(Boolean).join(' / ');
        if (text) events.push({ date, text });
      }
    }
    i++;
  }
  return events;
}
