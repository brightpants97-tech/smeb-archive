import { NextResponse } from 'next/server';

const SHEET_ID = '1Zm1VOH4rASeczj1mtxXE1pnafBPQb5x9Tak0cwdq8w4';
const API_KEY  = process.env.YOUTUBE_API_KEY!;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year  = parseInt(searchParams.get('year')  || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

  const sheetName = `${year}년 ${month}월`;
  const range     = encodeURIComponent(`${sheetName}!A1:G50`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;

  try {
    const res  = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    if (!res.ok || !data.values) {
      console.error('Sheets API error:', data);
      return NextResponse.json({ year, month, events: [], error: data.error?.message || 'fetch failed' });
    }

    const rows: string[][] = data.values;

    // 달력 구조 파싱
    // 행 구조: [A행=헤더] [B행=연월] [C행=요일] [날짜행] [이벤트행] [빈행] [날짜행] ...
    // 날짜행: 1~31 숫자, 이벤트행: 텍스트
    const events: { date: number; text: string }[] = [];

    const isDateRow = (row: string[]) => {
      const nums = row.slice(0, 7).filter(v => /^\d{1,2}$/.test((v||'').trim()) && parseInt(v) >= 1 && parseInt(v) <= 31);
      return nums.length >= 1;
    };

    let i = 0;
    while (i < rows.length) {
      const row = rows[i] || [];
      if (isDateRow(row)) {
        // 날짜 컬럼 매핑
        const dateCols: { date: number; col: number }[] = [];
        for (let c = 0; c < 7; c++) {
          const v = (row[c] || '').trim();
          if (/^\d{1,2}$/.test(v) && parseInt(v) >= 1 && parseInt(v) <= 31) {
            dateCols.push({ date: parseInt(v), col: c });
          }
        }

        // 다음 1~2행에서 이벤트 텍스트 수집
        const eventTexts: string[][] = Array.from({ length: 7 }, () => []);
        for (let offset = 1; offset <= 2; offset++) {
          const erow = rows[i + offset] || [];
          if (isDateRow(erow)) break;
          for (let c = 0; c < 7; c++) {
            const t = (erow[c] || '').trim();
            if (t && t !== '\u200b') eventTexts[c].push(t);
          }
        }

        for (const { date, col } of dateCols) {
          const text = eventTexts[col].filter(Boolean).join(' / ');
          if (text) events.push({ date, text });
        }
        i++;
      } else {
        i++;
      }
    }

    return NextResponse.json({ year, month, events });
  } catch (e) {
    console.error('schedule error:', e);
    return NextResponse.json({ year, month, events: [], error: String(e) });
  }
}
