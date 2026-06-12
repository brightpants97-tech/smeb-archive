import { NextResponse } from 'next/server';

const PUB_ID = '2PACX-1vTaVpnVjcIITgQKdNZ2Vojdx7Ik78OviKKLh_-6wWvremg5U0A_-JI0XNONOm7UrXIpWTzWO3Uqs98V';
const SRC_ID = '1Zm1VOH4rASeczj1mtxXE1pnafBPQb5x9Tak0cwdq8w4';

const CATEGORIES = ['방송', '개인일정', '휴일', '선택취소'];

let gidCache: Record<string, number> | null = null;

async function getGidMap(): Promise<Record<string, number>> {
  if (gidCache) return gidCache;
  const map: Record<string, number> = {};

  try {
    const r = await fetch(`https://spreadsheets.google.com/feeds/worksheets/${SRC_ID}/public/full?alt=json`, { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      for (const e of d.feed?.entry ?? []) {
        const title: string = e.title?.$t ?? '';
        const vizLink = e.link?.find((l: any) => l.rel?.includes('visualizationApi'));
        const gidMatch = vizLink?.href?.match(/gid=(\d+)/);
        if (title && gidMatch) map[title] = parseInt(gidMatch[1]);
      }
    }
  } catch {}

  if (!Object.keys(map).length) {
    try {
      const r = await fetch(`https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pubhtml`, { cache: 'no-store' });
      if (r.ok) {
        const text = await r.text();
        const re = /gid=(\d+)[^>]*>\s*(\d{4}년\s*\d{1,2}월)/g;
        let m;
        while ((m = re.exec(text)) !== null) map[m[2].replace(/\s+/, ' ')] = parseInt(m[1]);
      }
    } catch {}
  }

  map['2026년 6월'] = 202606; // fallback
  gidCache = map;
  return map;
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
        const category = all.find(t => CATEGORIES.includes(t)) ?? null;
        const text = all.filter(t => !CATEGORIES.includes(t)).join(' / ');
        // 선택취소는 무시
        if (category !== '선택취소' && (category || text)) {
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
