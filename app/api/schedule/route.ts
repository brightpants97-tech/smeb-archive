import { NextResponse } from 'next/server';

const PUB_ID = '2PACX-1vTaVpnVjcIITgQKdNZ2Vojdx7Ik78OviKKLh_-6wWvremg5U0A_-JI0XNONOm7UrXIpWTzWO3Uqs98V';

const GID_MAP: Record<string, number> = {
  '2026년 1월':202601,'2026년 2월':202602,'2026년 3월':202603,
  '2026년 4월':202604,'2026년 5월':202605,'2026년 6월':202606,
  '2026년 7월':202607,'2026년 8월':202608,'2026년 9월':202609,
  '2026년 10월':202610,'2026년 11월':202611,'2026년 12월':202612,
  '2027년 1월':916286495,'2027년 2월':281248381,'2027년 3월':176728639,
  '2027년 4월':63389854,'2027년 5월':588668077,'2027년 6월':1057643753,
  '2027년 7월':179275070,'2027년 8월':816793490,'2027년 9월':1607656807,
  '2027년 10월':1450126795,'2027년 11월':1950433908,'2027년 12월':673368685,
};

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
function parseCalendar(rows: string[][]): { date: number; category: string | null; text: string }[] {
  const events: { date: number; category: string | null; text: string }[] = [];

  const isDateRow = (row: string[]) =>
    row.slice(0, 7).some(v => /^\d{1,2}$/.test(v.trim()) && parseInt(v) >= 1 && parseInt(v) <= 31);

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

    // 이벤트 수집: 날짜행 바로 아래 1행 (Row N+1)
    // 추가로 Row N+2도 확인 (spacer가 비어있으면 break, 내용 있으면 추가)
    const cellTexts: string[][] = Array.from({ length: 7 }, () => []);
    for (let off = 1; off <= 2; off++) {
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
    const dateEvMap: Record<number, { cat: string | null; texts: string[] }> = {};

    // 정상 컬럼 매핑
    for (let c = 0; c < 7; c++) {
      if (cellTexts[c].length === 0) continue;
      const date = weekDates.find(d => dateColMap[d] === c);
      if (!date) continue;
      if (!dateEvMap[date]) dateEvMap[date] = { cat: null, texts: [] };
      for (const t of cellTexts[c]) {
        if (isCancel(t)) continue;
        if (isCat(t)) dateEvMap[date].cat = t;
        else dateEvMap[date].texts.push(t);
      }
    }

    // 병합셀 처리: col 0에만 텍스트 있고 나머지 비어있을 때
    const onlyCol0 = cellTexts[0].length > 0 && cellTexts.slice(1).every(t => t.length === 0);
    if (onlyCol0) {
      for (const item of cellTexts[0]) {
        if (isCancel(item)) continue;
        const ex = extractDatePrefix(item);
        if (ex && weekDates.includes(ex.date)) {
          // "N일 텍스트" 형식 → 해당 날짜에
          if (!dateEvMap[ex.date]) dateEvMap[ex.date] = { cat: null, texts: [] };
          if (isCat(ex.text)) dateEvMap[ex.date].cat = ex.text;
          else dateEvMap[ex.date].texts.push(ex.text);
        } else if (isCat(item)) {
          // 카테고리만 → 주 첫날에
          const d = weekDates[0];
          if (!dateEvMap[d]) dateEvMap[d] = { cat: null, texts: [] };
          dateEvMap[d].cat = item;
        } else {
          // 날짜 특정 불가 → 주 첫날에 ⚠️
          const d = weekDates[0];
          if (!dateEvMap[d]) dateEvMap[d] = { cat: null, texts: [] };
          dateEvMap[d].texts.push('⚠️ ' + item);
        }
      }
    }

    for (const [ds, ev] of Object.entries(dateEvMap)) {
      const text = ev.texts.join(' / ');
      if (ev.cat || text) events.push({ date: parseInt(ds), category: ev.cat, text });
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
  const gid = GID_MAP[sheetName];

  if (!gid) {
    return NextResponse.json({ year, month, events: [], error: `${sheetName} 시트 없음` });
  }

  try {
    const url = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?output=csv&gid=${gid}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ year, month, events: [], error: `HTTP ${res.status}` });

    const text = await res.text();
    const rows = parseCSV(text);

    if (raw) {
      const annotated = rows
        .map((r, idx) => ({ i: idx, cells: r }))
        .filter(r => r.cells.some(c => isReal(c)));
      return NextResponse.json({ total: rows.length, rows: annotated });
    }

    const events = parseCalendar(rows);
    return NextResponse.json({ year, month, events, gid });
  } catch (e) {
    return NextResponse.json({ year, month, events: [], error: String(e) });
  }
}
