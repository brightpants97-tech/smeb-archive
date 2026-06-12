import { NextResponse } from 'next/server';

const PUB_ID = '2PACX-1vTaVpnVjcIITgQKdNZ2Vojdx7Ik78OviKKLh_-6wWvremg5U0A_-JI0XNONOm7UrXIpWTzWO3Uqs98V';
const SRC_ID = '1Zm1VOH4rASeczj1mtxXE1pnafBPQb5x9Tak0cwdq8w4';

// ── GID 캐시 (메모리) ──
let gidCache: Record<string, number> | null = null;

async function getGidMap(): Promise<Record<string, number>> {
  if (gidCache) return gidCache;

  const map: Record<string, number> = {};

  // 방법 1: Sheets v3 API (공개 시트 워크시트 목록)
  try {
    const url = `https://spreadsheets.google.com/feeds/worksheets/${SRC_ID}/public/full?alt=json`;
    const r = await fetch(url, { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      const entries = d.feed?.entry ?? [];
      for (const e of entries) {
        const title: string = e.title?.$t ?? '';
        const vizLink = e.link?.find((l: any) => l.rel?.includes('visualizationApi'));
        const gidMatch = vizLink?.href?.match(/gid=(\d+)/);
        if (title && gidMatch) map[title] = parseInt(gidMatch[1]);
      }
      if (Object.keys(map).length > 0) {
        gidCache = map;
        return map;
      }
    }
  } catch (e) { console.error('v3 api error:', e); }

  // 방법 2: pubhtml에서 gid 추출
  try {
    const url = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pubhtml`;
    const r = await fetch(url, { cache: 'no-store' });
    if (r.ok) {
      const text = await r.text();
      // "2026년 6월" 패턴과 gid= 패턴 매칭
      const sheetPattern = /gid=(\d+)[^>]*>\s*(\d{4}년\s*\d{1,2}월)/g;
      let m;
      while ((m = sheetPattern.exec(text)) !== null) {
        map[m[2].replace(/\s+/, ' ')] = parseInt(m[1]);
      }
      if (Object.keys(map).length > 0) {
        gidCache = map;
        return map;
      }
    }
  } catch (e) { console.error('pubhtml error:', e); }

  // 방법 3: 알려진 GID로 주변 달 역산
  // gid=202606 = 2026년 6월 (확인된 값)
  map['2026년 6월'] = 202606;
  gidCache = map;
  return map;
}

async function fetchByGid(gid: number): Promise<string[][]> {
  // 1차: 게시된 CSV
  try {
    const url = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?output=csv&gid=${gid}`;
    const r = await fetch(url, { cache: 'no-store' });
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
  } catch (e) { console.error('csv error:', e); }

  // 2차: gviz
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SRC_ID}/gviz/tq?tqx=out:json&gid=${gid}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (r.ok) {
      const text = await r.text();
      const json = JSON.parse(text.replace(/^[\s\S]*?google\.visualization\.Query\.setResponse\(/, '').replace(/\);?\s*$/, ''));
      const rows = json?.table?.rows ?? [];
      return rows.map((row: any) =>
        (row.c ?? []).map((c: any) => c?.f !== undefined && c?.f !== null ? String(c.f) : c?.v !== null && c?.v !== undefined ? String(c.v) : '')
      );
    }
  } catch (e) { console.error('gviz error:', e); }

  return [];
}

function parseCalendar(lines: string[][]): { date: number; text: string }[] {
  const events: { date: number; text: string }[] = [];

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
      const texts: string[][] = Array.from({ length: 7 }, () => []);
      for (let off = 1; off <= 2; off++) {
        const erow = lines[i + off] ?? [];
        if (isDateRow(erow)) break;
        for (let c = 0; c < 7; c++) {
          const t = (erow[c] ?? '').trim();
          if (t && !/^[\u200b\u00a0]$/.test(t)) texts[c].push(t);
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year  = parseInt(searchParams.get('year')  || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

  const sheetName = `${year}년 ${month}월`;

  const gidMap = await getGidMap();
  const gid = gidMap[sheetName];

  if (!gid) {
    return NextResponse.json({
      year, month, events: [],
      error: `${sheetName} 시트의 GID를 찾을 수 없어요. 현재 알려진 시트: ${Object.keys(gidMap).join(', ')}`,
    });
  }

  const lines = await fetchByGid(gid);
  const events = parseCalendar(lines);

  return NextResponse.json({ year, month, events, gid, sheetName });
}
