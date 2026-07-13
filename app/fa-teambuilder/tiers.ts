// LoL 멸망전 FA 페이지(bjmatchfa.sooplive.com)의 실제 등급 체계
// 높은 순서대로 정렬 — 인덱스가 작을수록 상위 등급
export const TIER_ORDER = [
    'Transcended',
    'God',
    'Legendary',
    'Unique',
    'SSR',
    'SR',
    'R',
    'S+',
    'S',
    'S-',
    'A+',
    'A',
    'A-',
    'B+',
    'B',
    'B-',
    'C+',
    'C',
    'C-',
    'D+',
    'D',
    'D-',
    'E+',
    'E',
    'E-',
    'F+',
    'F',
    'F-',
  ] as const;

export type Tier = typeof TIER_ORDER[number];

export function tierRank(tier: string): number {
    const idx = TIER_ORDER.indexOf(tier as Tier);
    return idx === -1 ? TIER_ORDER.length : idx;
}

export function tierAtLeast(a: string, b: string): boolean {
    return tierRank(a) <= tierRank(b);
}

export function tierColor(tier: string): string {
    const rank = tierRank(tier);
    const t = Math.min(1, rank / (TIER_ORDER.length - 1));
    const hue = 300 - t * 300;
    const sat = 72;
    const light = 50 + (1 - t) * 6;
    return `hsl(${hue.toFixed(0)}, ${sat}%, ${light.toFixed(0)}%)`;
}
