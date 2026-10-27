import type { ChatMessage } from './chat-inspector';

export const PROVIDERS = {
  gemini: { label: 'Gemini', model: 'gemini-3.5-flash-lite' },
  openai: { label: 'ChatGPT · OpenAI', model: 'gpt-4.1-mini' },
} as const;
export type Provider = keyof typeof PROVIDERS;
export type Verdict = 'review' | 'uncertain' | 'clear';
export type AiDecision = { id: string; verdict: Verdict; category: string; reason: string };
export type ReviewEntry = {
  ai?: Omit<AiDecision, 'id'> & { provider: Provider; model: string; criteria: string; at: string };
  decision: 'pending' | 'confirmed' | 'dismissed';
  note: string;
};
export type ReviewState = {
  entries: Record<string, ReviewEntry>;
  lastRun?: { provider: Provider; criteria: string; total: number; completed: number; status: 'running' | 'complete' | 'stopped' | 'failed'; at: string };
};
export type ReviewRow = { id: string; speaker: string; seconds: number; text: string; target: boolean };
export type ReviewBatch = { rows: ReviewRow[]; keys: Record<string, string> };
export const DEFAULT_CRITERIA = '욕설·인신공격, 상대를 비하하는 조롱, 반복적인 분쟁 유도, 도배를 검토해 주세요. 단순한 경기 비판이나 의견 차이, 친근한 농담은 맥락을 확인하고 구분해 주세요.';
export const MAX_TARGETS = 20;
export const MAX_ROWS = 100;
export const MAX_TEXT = 4000;
export const MAX_BATCH_CHARS = 90000;

/** Send stable speaker aliases and adjacent context, retaining original identity only locally. */
export function reviewBatches(all: ChatMessage[], selected: ChatMessage[]): ReviewBatch[] {
  const ordered = [...all].sort((a, b) => a.seconds - b.seconds || a.key.localeCompare(b.key));
  const targets = new Set(selected.filter(m => m.kind !== 'emoticon').map(m => m.key));
  const speakers = new Map<string, string>();
  const rows = ordered.map((m, index) => {
    if (!speakers.has(m.userId)) speakers.set(m.userId, `user${speakers.size + 1}`);
    return { id: `m${index}`, speaker: speakers.get(m.userId)!, seconds: m.seconds, text: m.message, target: false };
  });
  const indices = ordered.flatMap((m, i) => targets.has(m.key) ? [i] : []);
  const batches: ReviewBatch[] = [];
  let pending: number[] = [];
  function make(items: number[]) {
    const included = new Set<number>();
    for (const index of items) for (let i = Math.max(0, index - 2); i <= Math.min(rows.length - 1, index + 2); i++) included.add(i);
    const marked = new Set(items);
    const batchRows = [...included].sort((a, b) => a - b).map(i => ({ ...rows[i], target: marked.has(i) }));
    return { rows: batchRows, keys: Object.fromEntries(items.map(i => [rows[i].id, ordered[i].key])) };
  }
  for (const index of indices) {
    const candidate = make([...pending, index]);
    if (pending.length && (pending.length >= MAX_TARGETS || JSON.stringify(candidate.rows).length > MAX_BATCH_CHARS)) {
      batches.push(make(pending)); pending = [];
    }
    pending.push(index);
    const single = make(pending);
    if (single.rows.some(row => row.text.length > MAX_TEXT) || JSON.stringify(single.rows).length > MAX_BATCH_CHARS) {
      throw new Error('너무 긴 발언이 포함되어 있습니다. 해당 발언은 직접 검토하고 시간 구간을 좁혀 다시 시도해 주세요.');
    }
  }
  if (pending.length) batches.push(make(pending));
  return batches;
}

export function validateDecisions(value: unknown, targetIds: string[]): AiDecision[] {
  const root = value as { decisions?: unknown } | null;
  if (!root || !Array.isArray(root.decisions) || root.decisions.length !== targetIds.length) throw new Error('AI가 모든 발언의 검수 결과를 반환하지 않았습니다.');
  const allowed = new Set(targetIds), seen = new Set<string>();
  const result: AiDecision[] = [];
  for (const item of root.decisions) {
    if (!item || typeof item !== 'object') throw new Error('AI 결과 형식이 올바르지 않습니다.');
    const { id, verdict, category, reason } = item;
    if (typeof id !== 'string' || !allowed.has(id) || seen.has(id) || !['review', 'uncertain', 'clear'].includes(verdict) ||
        typeof category !== 'string' || category.length > 80 || typeof reason !== 'string' || !reason.trim() || reason.length > 1200) {
      throw new Error('AI 결과를 원문과 대조하지 못했습니다. 해당 구간은 검수 완료로 처리하지 않습니다.');
    }
    seen.add(id); result.push({ id, verdict, category, reason });
  }
  return result;
}

export const REVIEW_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { decisions: { type: 'array', items: {
    type: 'object', additionalProperties: false,
    properties: { id: { type: 'string' }, verdict: { type: 'string', enum: ['review', 'uncertain', 'clear'] }, category: { type: 'string' }, reason: { type: 'string' } },
    required: ['id', 'verdict', 'category', 'reason'],
  } } }, required: ['decisions'],
};

export function reviewCsv(messages: ChatMessage[], entries: ReviewState['entries']) {
  const cell = (value: string) => '"' + (/^[=+\-@\t\r\n]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"';
  const verdicts = { review: '검토 필요', uncertain: '맥락 부족', clear: '지적 없음' };
  const decisions = { pending: '미확정', confirmed: '문제 있음', dismissed: '문제 없음' };
  const rows = messages.filter(m => entries[m.key]).map(m => {
    const entry = entries[m.key];
    return [m.userId, m.nickname, String(m.seconds), m.timestamp || '', m.message, entry.ai ? verdicts[entry.ai.verdict] : '', entry.ai?.category || '', entry.ai?.reason || '', decisions[entry.decision], entry.note, entry.ai?.model || '', entry.ai?.criteria || '', entry.ai?.at || ''];
  });
  return '\uFEFF' + [['아이디', '닉네임', '영상 시간(초)', '추정 시각', '원문', 'AI 의견', '유형', 'AI 이유', '검수자 판단', '메모', '모델', '검수 기준', 'AI 검수 시각'], ...rows].map(row => row.map(cell).join(',')).join('\r\n');
}
