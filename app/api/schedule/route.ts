import { NextResponse } from 'next/server';

const SHEET_ID = '1Zm1VOH4rASeczj1mtxXE1pnafBPQb5x9Tak0cwdq8w4';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year  = parseInt(searchParams.get('year')  || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

  const sheetName = encodeURIComponent(`${year}년 ${month}월`);
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheetName}`;

  try {
    const res  = await fetch(url, { next: { revalidate: 300 } });
    const text = await res.text();

    // gviz 응답에서 JSON 파싱 (앞뒤 래퍼 제거)
    const json = JSON.parse(text.replace(/^.*?google\.visualization\.Query\.setResponse\(/, '').replace(/\);?\s*$/, ''));
    const rows = json?.table?.rows ?? [];

    // 달력 구조 파싱
    // 행 구조: [헤더행] [날짜행] [이벤트행] [이벤트행] [날짜행] [이벤트행] [이벤트행] ...
    // 날짜행: 0~31 숫자값, 이벤트행: 텍스트
    const events: { date: number; text: string }[] = [];

    const getCellVal = (row: any, col: number) => {
      const cell = row?.c?.[col];
      if (!cell || cell.v === null || cell.v === undefined) return '';
      return cell.f || String(cell.v);
    };

    const isDateRow = (row: any) => {
      let numCount = 0;
      for (let c = 0; c < 7; c++) {
        const v = row?.c?.[c]?.v;
        if (typeof v === 'number' && v >= 1 && v <= 31) numCount++;
      }
      return numCount >= 1;
    };

    let i = 0;
    while (i < rows.length) {
      const row = rows[i];
      if (isDateRow(row)) {
        // 날짜 행: 7컬럼에서 날짜와 대응하는 컬럼 인덱스 매핑
        const dateCols: { date: number; col: number }[] = [];
        for (let c = 0; c < 7; c++) {
          const v = row?.c?.[c]?.v;
          if (typeof v === 'number' && v >= 1 && v <= 31) {
            dateCols.push({ date: v, col: c });
          }
        }
        // 다음 1~2 행에서 이벤트 텍스트 수집
        const eventTexts: string[][] = Array.from({ length: 7 }, () => []);
        for (let offset = 1; offset <= 2; offset++) {
          const erow = rows[i + offset];
          if (!erow || isDateRow(erow)) break;
          for (let c = 0; c < 7; c++) {
            const t = getCellVal(erow, c).trim();
            if (t && t !== '​') eventTexts[c].push(t);
          }
        }
        for (const { date, col } of dateCols) {
          const text = eventTexts[col].join(' / ');
          if (text) events.push({ date, text });
        }
        i++;
      } else {
        i++;
      }
    }

    return NextResponse.json({ year, month, events });
  } catch (e) {
    console.error('schedule fetch error:', e);
    return NextResponse.json({ year, month, events: [], error: 'fetch failed' });
  }
}
