import { NextResponse } from 'next/server';

// 스프레드시트 ID (공개 보기 권한 공유 링크 기준)
const SHEET_ID = '1Zm1VOH4rASeczj1mtxXE1pnafBPQb5x9Tak0cwdq8w4';

// 카테고리 목록
const CATS = ['방송','개인일정','개인 일정','휴일','선택취소','선택 취소'];
const isCat    = (t: string) => CATS.some(c => c.replace(/\s/g,'') === t.replace(/\s/g,''));
const isCancel = (t: string) => t.replace(/\s/g,'') === '선택취소';

// 셀 값이 실제 콘텐츠인지 확인 (zero-width space, non-breaking space 등 제거)
const isReal = (v: string) => v && !/^[\u200b\u00a0\u200c\u200d\ufeff\s]+$/.test(v);

// RFC4180 CSV 파서 (Ctrl+Enter 멀티라인 지원)
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      row.push(cur); cur = '';
    } else if (ch === '\n' && !inQ) {
      row.push(cur); cur = '';
      rows.push(row); row = [];
    } else if (ch !== '\r') {
      cur += ch;
    }
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

// 날짜 패턴 추출: "10일 소통데이", "10. 소통데이", "10) 소통데이"
function extractDatePrefix(text: string): { date: number; text: string } | null {
  const firstLine = text.split('\n')[0];
  const m = firstLine.match(/^(\d{1,2})\s*[일\.\)\]]\s*(.+)$/);
  if (m) {
    const d = parseInt(m[1]);
    if (d >= 1 && d <= 31) return { date: d, text: m[2].trim() };
  }
  return null;
}

// 달력 파싱
// 구조: Row N = 날짜행, Row N+1 = 이벤트행, Row N+2 = 빈행 spacer
function parseCalendar(rows: string[][]): { date: number; category: string | null; texts: string[] }[] {
  const events: { date: number; category: string | null; texts: string[] }[] = [];

  const isDateRow = (row: string[]) => {
    const nums = row.slice(0, 7).filter(v => /^\d{1,2}$/.test(v.trim()) && parseInt(v) >= 1 && parseInt(v) <= 31);
    return nums.length >= 2; // 날짜 숫자가 2개 이상 = 날짜행 (텍스트에 "1","2" 단독 입력과 구별)
  };

  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (!isDateRow(row)) { i++; continue; }

    // 날짜 → 컬럼 인덱스 맵
    const dateColMap: Record<number, number> = {};
    for (let c = 0; c < 7; c++) {
      const v = (row[c] ?? '').trim();
      if (/^\d{1,2}$/.test(v) && parseInt(v) >= 1 && parseInt(v) <= 31)
        dateColMap[parseInt(v)] = c;
    }
    const weekDates = Object.keys(dateColMap).map(Number);

    // 이벤트 수집: 날짜행 이후 최대 4행
    // Row N+1: 드롭다운(카테고리), Row N+2~4: 자유텍스트 1~3
    const cellTexts: string[][] = Array.from({ length: 7 }, () => []);
    for (let off = 1; off <= 4; off++) {
      const erow = rows[i + off] ?? [];
      if (isDateRow(erow)) break;
      for (let c = 0; c < 7; c++) {
        const raw = (erow[c] ?? '');
        if (!isReal(raw)) continue;
        // Ctrl+Enter 멀티라인 분리
        const lines = raw.split('\n')
          .map(l => l.trim())
          .filter(l => isReal(l));
        cellTexts[c].push(...lines);
      }
    }

    // 컬럼별 이벤트 매핑
    const dateEvMap: Record<number, { cat: string | null; txts: string[] }> = {};

    // 정상 컬럼 매핑
    for (let c = 0; c < 7; c++) {
      if (cellTexts[c].length === 0) continue;
      const date = weekDates.find(d => dateColMap[d] === c);
      if (!date) continue;
      if (!dateEvMap[date]) dateEvMap[date] = { cat: null, txts: [] };
      for (const t of cellTexts[c]) {
        if (isCancel(t)) continue;
        if (isCat(t)) dateEvMap[date].cat = t;
        else dateEvMap[date].txts.push(t);
      }
    }

    // 병합셀 처리: col 0에만 텍스트 있고, 나머지 비어있고, col 0에 실제 날짜가 없을 때
    const col0HasDate = weekDates.some(d => dateColMap[d] === 0);
    const onlyCol0 = !col0HasDate && cellTexts[0].length > 0 && cellTexts.slice(1).every(t => t.length === 0);
    if (onlyCol0) {
      for (const item of cellTexts[0]) {
        if (isCancel(item)) continue;
        const ex = extractDatePrefix(item);
        if (ex && weekDates.includes(ex.date)) {
          // "N일 텍스트" 형식 → 해당 날짜에
          if (!dateEvMap[ex.date]) dateEvMap[ex.date] = { cat: null, txts: [] };
          if (isCat(ex.text)) dateEvMap[ex.date].cat = ex.text;
          else dateEvMap[ex.date].txts.push(ex.text);
        } else if (isCat(item)) {
          // 카테고리만 → 주 첫날에
          const d = weekDates[0];
          if (!dateEvMap[d]) dateEvMap[d] = { cat: null, txts: [] };
          dateEvMap[d].cat = item;
        } else {
          // 날짜 특정 불가 → 주 첫날에 ⚠️
          const d = weekDates[0];
          if (!dateEvMap[d]) dateEvMap[d] = { cat: null, txts: [] };
          dateEvMap[d].txts.push('⚠️ ' + item);
        }
      }
    }

    for (const [ds, ev] of Object.entries(dateEvMap)) {
      if (ev.cat || ev.txts.length) events.push({ date: parseInt(ds), category: ev.cat, texts: ev.txts });
    }

    i++;
  }
  return events;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year  = parseInt(searchParams.get('year')  || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const raw   = searchParams.get('raw') === 'true';

  const sheetName = `${year}년 ${month}월`;

  try {
    // gid 하드코딩 없이 시트 '이름'으로 직접 조회 (월별 GID 관리가 필요 없어짐)
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent(sheetName)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ year, month, events: [], error: `HTTP ${res.status} (시트 "${sheetName}" 없음)` });

    const text = await res.text();

    // gviz는 시트를 못 찾으면 200을 반환하면서 에러 HTML/JSON을 줄 수 있어 별도 체크
    if (text.includes('Invalid query') || text.startsWith('<HTML') || text.startsWith('<!DOCTYPE')) {
      return NextResponse.json({ year, month, events: [], error: `시트 "${sheetName}"를 찾을 수 없음` });
    }

    const rows = parseCSV(text);

    if (raw) {
      const annotated = rows
        .map((r, idx) => ({ i: idx, cells: r }))
        .filter(r => r.cells.some(c => isReal(c)));
      return NextResponse.json({ total: rows.length, rows: annotated });
    }

    const events = parseCalendar(rows);
    return NextResponse.json({ year, month, events, sheetName });
  } catch (e) {
    return NextResponse.json({ year, month, events: [], error: String(e) });
  }
}
