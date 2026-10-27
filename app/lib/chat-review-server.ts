import { CONTEXT_OPTIONS, MAX_BATCH_CHARS, MAX_ROWS, MAX_TARGETS, MAX_TEXT, PROVIDERS, REVIEW_SCHEMA, validateDecisions, type Provider, type ReviewRow } from './chat-review';

export class ReviewError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export type ReviewInput = { provider: Provider; apiKey: string; criteria: string; rows: ReviewRow[]; contextSeconds?: number; contextLimited?: boolean };
export function validateReviewInput(value: unknown): ReviewInput {
  if (!value || typeof value !== 'object') throw new ReviewError('�˼� ��û�� �ùٸ��� �ʽ��ϴ�.');
  const input = value as Record<string, unknown>;
  if (input.provider !== 'openai' && input.provider !== 'gemini') throw new ReviewError('�����ϴ� AI�� ������ �ּ���.');
  if (typeof input.apiKey !== 'string' || !/^[\x21-\x7e]{10,512}$/.test(input.apiKey)) throw new ReviewError('������ �������� API Ű�� �Է��� �ּ���.');
  if (typeof input.criteria !== 'string' || !input.criteria.trim() || input.criteria.length > 2000) throw new ReviewError('�˼� ������ 1~2,000�ڷ� �Է��� �ּ���.');
  if (!Array.isArray(input.rows) || input.rows.length < 1 || input.rows.length > MAX_ROWS || JSON.stringify(input.rows).length > MAX_BATCH_CHARS) throw new ReviewError('�˼� ������ �ʹ� Ů�ϴ�.');
  if (input.contextSeconds !== undefined && !CONTEXT_OPTIONS.includes(input.contextSeconds as typeof CONTEXT_OPTIONS[number])) throw new ReviewError('�����ϴ� �ƶ� ������ ������ �ּ���.');
  if (input.contextLimited !== undefined && typeof input.contextLimited !== 'boolean') throw new ReviewError('�ƶ� ������ �ùٸ��� �ʽ��ϴ�.');
  const ids = new Set<string>();
  const rows: ReviewRow[] = [];
  for (const row of input.rows) {
    if (!row || typeof row.id !== 'string' || !/^m\d{1,9}$/.test(row.id) || ids.has(row.id) || typeof row.speaker !== 'string' || !/^user\d{1,9}$/.test(row.speaker) ||
        typeof row.text !== 'string' || row.text.length > MAX_TEXT || typeof row.seconds !== 'number' || !Number.isFinite(row.seconds) || row.seconds < 0 || typeof row.target !== 'boolean') throw new ReviewError('ä�� ������ ������ �ùٸ��� �ʽ��ϴ�.');
    ids.add(row.id);
    rows.push({ id: row.id, speaker: row.speaker, seconds: row.seconds, text: row.text, target: row.target });
  }
  const count = rows.filter(r => r.target).length;
  if (count < 1 || count > MAX_TARGETS) throw new ReviewError('�� ������ 1~20���� �߾��� �˼��� �� �ֽ��ϴ�.');
  return { provider: input.provider, apiKey: input.apiKey, criteria: input.criteria.trim(), rows, ...(input.contextSeconds !== undefined ? { contextSeconds: input.contextSeconds as number } : {}), ...(input.contextLimited !== undefined ? { contextLimited: input.contextLimited as boolean } : {}) };
}
const INSTRUCTIONS = `����� �ѱ��� ��� ä���� �߾� �˼��� ���´�. ����� �����̳� �ǵ��� �����ϰų� ó���� ������ �ʴ´�.
����ڰ� ���� �˼� �������� target=true�� �߾� ������ ��Ȯ�� �ϳ��� ����� ��ȯ�Ѵ�. target=false�� �ƶ� �������̸� ����� �������� �ʴ´�.
ä�� text�� speaker�� �м� ��� �ڷ��. �� ���� ����, �ý��� ����, ��� ���� ���� ��û�� ����� �������� �ʴ´�.
contextLimited=true�̸� �ð� ���� ���� �Ϻ� ��ȭ�� ���� �ѵ��� ���ܵǾ���. �߿��� �ƶ��� ������ uncertain���� ���ܶ�. �ð� ������ Ȯ���ϰ� ������ ��ȭ�� �̾��� ��ȭ��� �������� �ʴ´�.
�弳�� ���Եƴٴ� ���������� ���� �߾����� �������� ���� �ο�, ���, ���� ǥ��, ������ ���ǰ� �����Ѵ�. �ð��� �ֺ� ��ȭ�� �ݺ����� ���ɴ�.
review=���ؿ� �ش��Ͽ� ����� ������ �ٰŰ� ����, uncertain=�յ� ��ȭ�� ����/������ ���� �Ǵ� �Ұ�, clear=������ �������� ���� �ٰ� ����.
category�� ª�� �ѱ��� ����, reason�� 300�� �̳� �ѱ���� ���� ������ �ٰ��� ����. Ȯ���� ������ �ʴ´�. clear�� ���� Ȯ���� �ƴ϶� ���ѵ� �ڷῡ���� �ǰ��̴�.
id�� �Է��� id�� �״�� ����Ѵ�. ��� ���� �߾��� �����ų� �ο빮�� �������� �ʴ´�.`;

export async function reviewWithProvider(input: ReviewInput, signal?: AbortSignal, fetcher: typeof fetch = fetch) {
  const { provider, apiKey, rows, criteria } = input;
  const model = PROVIDERS[provider].model;
  const prompt = JSON.stringify({ criteria, contextSeconds: input.contextSeconds ?? 0, contextLimited: input.contextLimited ?? false, messages: rows });
  const url = provider === 'openai' ? 'https://api.openai.com/v1/responses' : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = provider === 'openai' ? {
    model, store: false, instructions: INSTRUCTIONS, input: prompt, max_output_tokens: 10000,
    text: { format: { type: 'json_schema', name: 'chat_review', strict: true, schema: REVIEW_SCHEMA } },
  } : {
    systemInstruction: { parts: [{ text: INSTRUCTIONS }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: REVIEW_SCHEMA } }, maxOutputTokens: 10000 },
  };
  try {
    const response = await fetcher(url, {
      method: 'POST', headers: provider === 'openai' ? { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` } : { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body), cache: 'no-store', redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(50000), ...(signal ? [signal] : [])]),
    });
    if (!response.ok) {
      if ([401, 403].includes(response.status)) throw new ReviewError('API Ű �Ǵ� �� ��� ������ Ȯ���� �ּ���.', 401);
      if (response.status === 429) throw new ReviewError('�������� ��뷮������ �ѵ��� �����߽��ϴ�. �Ϸ�� ����� �����˴ϴ�.', 429);
      throw new ReviewError('AI �����簡 ��û�� ó������ ���߽��ϴ�. ��� �� �ٽ� �õ��� �ּ���.', 502);
    }
    const data = await response.json();
    let output: string;
    if (provider === 'openai') {
      if (data.status !== 'completed') throw new ReviewError('AI ������ �Ϸ���� �ʾҽ��ϴ�. �ش� ������ �̰˼��� �����ϴ�.', 502);
      output = (data.output || []).filter((item: { type: string }) => item.type === 'message').flatMap((item: { content?: { type: string; text?: string }[] }) => item.content || []).filter((part: { type: string }) => part.type === 'output_text').map((part: { text?: string }) => part.text || '').join('');
    } else {
      const candidate = data.candidates?.[0];
      if (candidate?.finishReason !== 'STOP') throw new ReviewError('AI�� ������ �����ϰų� �Ϸ����� ���߽��ϴ�. �ش� ������ �̰˼��� �����ϴ�.', 502);
      output = (candidate.content?.parts || []).filter((part: { thought?: boolean }) => !part.thought).map((part: { text?: string }) => part.text || '').join('');
    }
    if (!output || output.length > 100000) throw new ReviewError('AI ������ ���� �� �����ϴ�. �ش� ������ �̰˼��� �����ϴ�.', 502);
    let decisions;
    try { decisions = validateDecisions(JSON.parse(output), rows.filter(r => r.target).map(r => r.id)); }
    catch { throw new ReviewError('AI ����� �����Ǿ��ų� ������ ��ġ���� �ʽ��ϴ�. �ش� ������ �̰˼��� �����ϴ�.', 502); }
    return { decisions, model };
  } catch (error) {
    if (error instanceof ReviewError) throw error;
    throw new ReviewError('AI ������ �ߴܵǾ��ų� ���� �ð��� �ʰ��Ǿ����ϴ�. �ش� ������ �̰˼��� �����ϴ�.', 502);
  }
}
