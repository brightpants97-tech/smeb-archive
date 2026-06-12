import { NextResponse } from 'next/server';

const PUB_ID = '2PACX-1vTaVpnVjcIITgQKdNZ2Vojdx7Ik78OviKKLh_-6wWvremg5U0A_-JI0XNONOm7UrXIpWTzWO3Uqs98V';
const SRC_ID = '1Zm1VOH4rASeczj1mtxXE1pnafBPQb5x9Tak0cwdq8w4';

// RFC4180 완전한 CSV 파서 (멀티라인 셀 지원)
function parseCSVText(text: string): string[][] {
  const results: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      row.push(cur.trim()); cur = '';
    } else if ((ch === '\n' || (ch === '\r' && text[i+1] === '\n')) && !inQ) {
      if (ch === '\r') i++;
      row.push(cur.trim()); cur = '';
      results.push(row); row = [];
    } else if (ch !== '\r') {
      cur += ch;
    }
  }
  if (cur.trim() || row.length > 0) { row.push(cur.trim()); results.push(row); }
  return results;
}

const CATEGORIES = ['방송', '개인일정', '개인 일정', '휴일', '선택취소', '선택 취소'];

let gidCache: Record<string, number> | null = null;

// 완전한 GID 맵 (pubhtml에서 추출 확인)
const HARDCODED_GID_MAP: Record<string, number> = {
  '2026년 1월':202601,'2026년 2월':202602,'2026년 3월':202603,
  '2026년 4월':202604,'2026년 5월':202605,'2026년 6월':202606,
  '2026년 7월':202607,'2026년 8월':202608,'2026년 9월':202609,
  '2026년 10월':202610,'2026년 11월':202611,'2026년 12월':202612,
  '2027년 1월':916286495,'2027년 2월':281248381,'2027년 3월':176728639,
  '2027년 4월':63389854,'2027년 5월':588668077,'2027년 6월':1057643753,
  '2027년 7월':179275070,'2027년 8월':816793490,'2027년 9월':1607656807,
  '2027년 10월':1450126795,'2027년 11월':1950433908,'2027년 12월':673368685,
};

async function getGidMap(): Promise<Record<string, number>> {
  return HARDCODED_GID_MAP;
}

async function fetchByGid(gid: number): Promise<string[][]> {
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?output=csv&gid=${gid}`, { cache: 'no-store' });
    if (r.ok) {
      const text = await r.text();
      return text.split('\n').map(l => {
        const cols: string[] = []; let cur = '', inQ = false;
        for (const ch of l) {
          if (ch === '"') inQ = !inQ;
          else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
          else cur += ch;
        }
        cols.push(cur.replace(/\r/, '').trim());
        return cols;
      });
    }
  } catch {}
  return [];
}

function parseCalendar(lines: string[][]): { date: number; category: string | null; text: string }[] {
  const events: { date: number; category: string | null; text: string }[] = [];
  const isDateRow = (row: string[]) =>
    row.slice(0, 7).some(v => /^\d{1,2}$/.test(v.trim()) && parseInt(v) >= 1 && parseInt(v) <= 31);

  let i = 0;
  while (i < lines.length) {
    const row = lines[i];
    if (isDateRow(row)) {
      const dateCols: { date: number; col: number }[] = [];
      for (let c = 0; c < 7; c++) {
        const v = (row[c] ?? '').trim();
        if (/^\d{1,2}$/.test(v) && parseInt(v) >= 1 && parseInt(v) <= 31)
          dateCols.push({ date: parseInt(v), col: c });
      }

      // 날짜행 아래 최대 3행에서 텍스트 수집
      const cellTexts: string[][] = Array.from({ length: 7 }, () => []);
      for (let off = 1; off <= 3; off++) {
        const erow = lines[i + off] ?? [];
        if (isDateRow(erow)) break;
        for (let c = 0; c < 7; c++) {
          const t = (erow[c] ?? '').trim();
          if (t && !/^[\u200b\u00a0\s]$/.test(t)) cellTexts[c].push(t);
        }
      }

      for (const { date, col } of dateCols) {
        const all = cellTexts[col].filter(Boolean);
        const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();
        const isCategory = (t: string) => CATEGORIES.some(c => normalize(c) === normalize(t));
        const isCancel   = (t: string) => normalize(t) === '선택취소';
        const category = all.find(t => isCategory(t) && !isCancel(t)) ?? null;
        const text = all.filter(t => !isCategory(t) && !isCancel(t)).join(' / ');
        if (category || text) {
          events.push({ date, category, text });
        }
      }
    }
    i++;
  }
  return events;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year  = parseInt(searchParams.get('year')  || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

  const sheetName = `${year}년 ${month}월`;
  const gidMap = await getGidMap();
  const gid = gidMap[sheetName];

  if (!gid) {
    return NextResponse.json({ year, month, events: [], error: `${sheetName} GID 없음. 알려진 시트: ${Object.keys(gidMap).join(', ')}` });
  }

  const lines = await fetchByGid(gid);
  const events = parseCalendar(lines);
  return NextResponse.json({ year, month, events, gid });
}
