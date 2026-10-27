import type { ChatMessage } from './chat-inspector';

export const PROVIDERS = {
  gemini: { label: 'Gemini', model: 'gemini-3.5-flash-lite' },
  openai: { label: 'ChatGPT �� OpenAI', model: 'gpt-4.1-mini' },
} as const;
export type Provider = keyof typeof PROVIDERS;
export type Verdict = 'review' | 'uncertain' | 'clear';
export type AiDecision = { id: string; verdict: Verdict; category: string; reason: string };
export type ReviewEntry = {
  ai?: Omit<AiDecision, 'id'> & { provider: Provider; model: string; criteria: string; at: string; context?: ReviewContext };
  decision: 'pending' | 'confirmed' | 'dismissed';
  note: string;
};
export type ReviewState = {
  entries: Record<string, ReviewEntry>;
  lastRun?: { provider: Provider; criteria: string; total: number; completed: number; status: 'running' | 'complete' | 'stopped' | 'failed'; at: string; mode?: 'preview' | 'limited'; contextSeconds?: number; eligible?: number; plannedRequests?: number; attemptedRequests?: number; maxMessages?: number; maxRequests?: number };
};
export type ReviewRow = { id: string; speaker: string; seconds: number; text: string; target: boolean };
export type ReviewContext = { seconds: number; available: number; included: number; from: number; to: number };
export type ReviewBatch = { rows: ReviewRow[]; keys: Record<string, string>; contexts: Record<string, ReviewContext>; contextLimited: boolean };
export const CONTEXT_OPTIONS = [0, 30, 60, 120] as const;
export function contextLabel(seconds: number) { return seconds === 0 ? '�յ� 2��' : `���� ${seconds}��`; }
export const DEFAULT_CRITERIA = '�弳���νŰ���, ��븦 �����ϴ� ����, �ݺ����� ���� ����, ���踦 ������ �ּ���. �ܼ��� ��� �����̳� �ǰ� ����, ģ���� ����� �ƶ��� Ȯ���ϰ� ������ �ּ���.';
export const MAX_TARGETS = 20;
export const MAX_ROWS = 100;
export const MAX_TEXT = 4000;
export const MAX_BATCH_CHARS = 90000;

/** Inclusive time window in the full conversation, independent of search/user filters. */
export function contextBounds(ordered: ChatMessage[], index: number, seconds: number): [number, number] {
  if (!CONTEXT_OPTIONS.includes(seconds as typeof CONTEXT_OPTIONS[number])) throw new Error('�����ϴ� �ƶ� ������ ������ �ּ���.');
  if (index < 0 || index >= ordered.length) return [0, 0];
  if (!seconds) return [Math.max(0, index - 2), Math.min(ordered.length, index + 3)];
  const start = ordered[index].seconds - seconds, end = ordered[index].seconds + seconds;
  function bound(value: number, inclusive: boolean) {
    let low = 0, high = ordered.length;
    while (low < high) { const mid = (low + high) >>> 1; if (ordered[mid].seconds < value || (inclusive && ordered[mid].seconds === value)) low = mid + 1; else high = mid; }
    return low;
  }
  return [bound(start, false), bound(end, true)];
}

/** Keep targets intact; cap dense context by proximity and disclose every omission. */
export function reviewBatches(all: ChatMessage[], selected: ChatMessage[], contextSeconds = 0): ReviewBatch[] {
  const ordered = [...all].sort((a, b) => a.seconds - b.seconds || a.key.localeCompare(b.key));
  const targets = new Set(selected.filter(m => m.kind !== 'emoticon').map(m => m.key));
  const speakers = new Map<string, string>();
  const rows = ordered.map((m, index) => {
    if (!speakers.has(m.userId)) speakers.set(m.userId, `user${speakers.size + 1}`);
    return { id: `m${index}`, speaker: speakers.get(m.userId)!, seconds: m.seconds, text: m.message, target: false };
  });
  const rowSizes = rows.map(row => JSON.stringify(row).length + 1);
  const indices = ordered.flatMap((m, i) => targets.has(m.key) ? [i] : []);
  const windows = new Map<number, { indices: number[]; available: number }>();
  for (const index of indices) {
    if (rows[index].text.length > MAX_TEXT) throw new Error('4,000�ڸ� �Ѵ� �߾��� ���� �����ϰ� �ð� ������ ���� �ٽ� �õ��� �ּ���.');
    const [start, end] = contextBounds(ordered, index, contextSeconds);
    const nearby = Array.from({ length: end - start }, (_, i) => start + i).filter(i => i !== index).sort((a, b) => Math.abs(rows[a].seconds - rows[index].seconds) - Math.abs(rows[b].seconds - rows[index].seconds) || Math.abs(a - index) - Math.abs(b - index) || a - b);
    const kept = [index]; let size = rowSizes[index] + 2;
    for (const i of nearby) {
      if (kept.length >= MAX_ROWS) break;
      if (rows[i].text.length > MAX_TEXT || size + rowSizes[i] > MAX_BATCH_CHARS) continue;
      kept.push(i); size += rowSizes[i];
    }
    windows.set(index, { indices: kept, available: end - start });
  }
  function make(items: number[]): ReviewBatch {
    const included = new Set(items.flatMap(i => windows.get(i)!.indices));
    const marked = new Set(items);
    const batchRows = [...included].sort((a, b) => a - b).map(i => ({ ...rows[i], target: marked.has(i) }));
    const contexts = Object.fromEntries(items.map(i => {
      const [start, end] = contextBounds(ordered, i, contextSeconds);
      const count = [...included].filter(j => j >= start && j < end).length;
      return [rows[i].id, { seconds: contextSeconds, available: windows.get(i)!.available, included: count, from: ordered[start].seconds, to: ordered[end - 1].seconds }];
    }));
    return { rows: batchRows, keys: Object.fromEntries(items.map(i => [rows[i].id, ordered[i].key])), contexts, contextLimited: Object.values(contexts).some(c => c.included < c.available) };
  }
  const batches: ReviewBatch[] = []; let pending: number[] = [];
  for (const index of indices) {
    const candidate = make([...pending, index]);
    if (pending.length && (pending.length >= MAX_TARGETS || candidate.rows.length > MAX_ROWS || JSON.stringify(candidate.rows).length > MAX_BATCH_CHARS)) {
      batches.push(make(pending)); pending = [];
    }
    pending.push(index);
  }
  if (pending.length) batches.push(make(pending));
  return batches;
}

export function matchesReview(entry: ReviewEntry | undefined, provider: Provider, criteria: string, contextSeconds: number) {
  return Boolean(entry?.ai && entry.ai.provider === provider && entry.ai.model === PROVIDERS[provider].model && entry.ai.criteria === criteria.trim() && (entry.ai.context?.seconds ?? 0) === contextSeconds);
}
export function planReview(all: ChatMessage[], targets: ChatMessage[], options: { contextSeconds: number; maxMessages: number; maxRequests: number; preview: boolean }) {
  if (!Number.isInteger(options.maxMessages) || options.maxMessages < 1 || options.maxMessages > 5000 || !Number.isInteger(options.maxRequests) || options.maxRequests < 1 || options.maxRequests > 200) throw new Error('�ִ� �߾��� 1~5,000��, �ִ� ��û�� 1~200ȸ�� �Է��� �ּ���.');
  const eligible = [...targets].filter(m => m.kind !== 'emoticon').sort((a, b) => a.seconds - b.seconds || a.key.localeCompare(b.key));
  const selected = eligible.slice(0, Math.min(options.maxMessages, options.preview ? 50 : 5000));
  const batches = reviewBatches(all, selected, options.contextSeconds).slice(0, options.maxRequests);
  const count = batches.reduce((n, batch) => n + Object.keys(batch.keys).length, 0);
  return { batches, count, eligible: eligible.length, remaining: eligible.length - count, limitedContexts: batches.reduce((n, batch) => n + Object.values(batch.contexts).filter(c => c.included < c.available).length, 0) };
}

export function reviewUsers(messages: ChatMessage[], entries: ReviewState['entries']) {
  const users = new Map<string, { userId: string; nickname: string; nicknames: string[]; total: number; reviewed: number; attention: number; confirmed: number; dismissed: number; latest: number }>();
  for (const m of messages) {
    let user = users.get(m.userId);
    if (!user) { user = { userId: m.userId, nickname: m.nickname, nicknames: [], total: 0, reviewed: 0, attention: 0, confirmed: 0, dismissed: 0, latest: -1 }; users.set(m.userId, user); }
    user.total++;
    if (!user.nicknames.includes(m.nickname)) user.nicknames.push(m.nickname);
    if (m.seconds >= user.latest) { user.nickname = m.nickname; user.latest = m.seconds; }
    const entry = entries[m.key];
    if (entry?.ai) user.reviewed++;
    if (entry?.decision === 'pending' && entry.ai?.verdict !== 'clear') user.attention++;
    if (entry?.decision === 'confirmed') user.confirmed++;
    if (entry?.decision === 'dismissed') user.dismissed++;
  }
  return [...users.values()].sort((a, b) => b.attention - a.attention || b.total - a.total || a.userId.localeCompare(b.userId));
}

export function validateDecisions(value: unknown, targetIds: string[]): AiDecision[] {
  const root = value as { decisions?: unknown } | null;
  if (!root || !Array.isArray(root.decisions) || root.decisions.length !== targetIds.length) throw new Error('AI�� ��� �߾��� �˼� ����� ��ȯ���� �ʾҽ��ϴ�.');
  const allowed = new Set(targetIds), seen = new Set<string>();
  const result: AiDecision[] = [];
  for (const item of root.decisions) {
    if (!item || typeof item !== 'object') throw new Error('AI ��� ������ �ùٸ��� �ʽ��ϴ�.');
    const { id, verdict, category, reason } = item;
    if (typeof id !== 'string' || !allowed.has(id) || seen.has(id) || !['review', 'uncertain', 'clear'].includes(verdict) ||
        typeof category !== 'string' || category.length > 80 || typeof reason !== 'string' || !reason.trim() || reason.length > 1200) {
      throw new Error('AI ����� ������ �������� ���߽��ϴ�. �ش� ������ �˼� �Ϸ�� ó������ �ʽ��ϴ�.');
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
  const verdicts = { review: '���� �ʿ�', uncertain: '�ƶ� ����', clear: '���� ����' };
  const decisions = { pending: '��Ȯ��', confirmed: '���� ����', dismissed: '���� ����' };
  const rows = messages.filter(m => entries[m.key]).map(m => {
    const entry = entries[m.key];
    return [m.userId, m.nickname, String(m.seconds), m.timestamp || '', m.message, entry.ai ? verdicts[entry.ai.verdict] : '', entry.ai?.category || '', entry.ai?.reason || '', decisions[entry.decision], entry.note, entry.ai?.model || '', entry.ai?.criteria || '', entry.ai?.at || '', entry.ai ? contextLabel(entry.ai.context?.seconds ?? 0) : '', entry.ai?.context ? String(entry.ai.context.included) : '', entry.ai?.context ? String(entry.ai.context.available) : ''];
  });
  return '\uFEFF' + [['���̵�', '�г���', '���� �ð�(��)', '���� �ð�', '����', 'AI �ǰ�', '����', 'AI ����', '�˼��� �Ǵ�', '�޸�', '��', '�˼� ����', 'AI �˼� �ð�', 'AI �ƶ� ����', '������ �ƶ� �޽���', '���� �� �ƶ� �޽���'], ...rows].map(row => row.map(cell).join(',')).join('\r\n');
}
