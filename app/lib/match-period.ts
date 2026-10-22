// Nexon timestamps are UTC even when the trailing Z is omitted.
export function matchesInCurrentKstMonth<T extends { matchDate: string }>(matches: T[], now = new Date()): T[] {
  const offset = 9 * 60 * 60 * 1000;
  const kst = new Date(now.getTime() + offset);
  const start = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - offset;
  const end = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() + 1, 1) - offset;
  const timestamp = (m: T) => new Date(m.matchDate.endsWith('Z') ? m.matchDate : `${m.matchDate}Z`).getTime();
  return matches.filter(m => timestamp(m) >= start && timestamp(m) < end && timestamp(m) <= now.getTime())
    .sort((a, b) => timestamp(a) - timestamp(b));
}
