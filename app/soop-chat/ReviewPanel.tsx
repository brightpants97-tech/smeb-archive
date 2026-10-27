'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatTime, type ChatMessage } from '../lib/chat-inspector';
import { DEFAULT_CRITERIA, PROVIDERS, CONTEXT_OPTIONS, contextLabel, contextBounds, matchesReview, planReview, reviewCsv, validateDecisions, type Provider, type ReviewEntry, type ReviewState } from '../lib/chat-review';
import ReviewUsers from './ReviewUsers';
import styles from './chat.module.css';

type Props = { messages: ChatMessage[]; filtered: ChatMessage[]; state?: ReviewState; onChange: (state: ReviewState) => void; disabled: boolean; onRunningChange: (running: boolean) => void; onUser: (id: string) => void };
const verdictLabel = { review: '���� �ʿ�', uncertain: '�ƶ� ����', clear: '���� ����' };
const decisionLabel = { pending: '��Ȯ��', confirmed: '���� ����', dismissed: '���� ����' };

export default function ReviewPanel({ messages, filtered, state, onChange, disabled, onRunningChange, onUser }: Props) {
  const [provider, setProvider] = useState<Provider>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);
  const [contextSeconds, setContextSeconds] = useState(state?.lastRun?.contextSeconds ?? 30);
  const [maxMessages, setMaxMessages] = useState('500');
  const [maxRequests, setMaxRequests] = useState('25');
  const [reviewUserId, setReviewUserId] = useState('');
  const [contextPage, setContextPage] = useState(1);
  const [onlyNew, setOnlyNew] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [resultFilter, setResultFilter] = useState('attention');
  const [page, setPage] = useState(1);
  const [focusedKey, setFocusedKey] = useState('');
  const [scope, setScope] = useState('filtered');
  const [review, setReview] = useState<ReviewState>(state || { entries: {} });
  const current = useRef(review);
  const control = useRef<AbortController | null>(null);
  const contextPanel = useRef<HTMLElement | null>(null);
  const controlsPanel = useRef<HTMLDivElement | null>(null);
  const mounted = useRef(true);
  const runningRef = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; control.current?.abort(); }; }, []);
  useEffect(() => {
    if (!running) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [running]);
  useEffect(() => {
    if (focusedKey) { contextPanel.current?.focus({ preventScroll: true }); contextPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }, [focusedKey]);
  function save(next: ReviewState) {
    current.current = next; setReview(next); onChange(next);
  }
  const candidates = useMemo(() => scope === 'user' ? messages.filter(m => m.userId === reviewUserId) : scope === 'all' ? messages : filtered, [scope, messages, filtered, reviewUserId]);
  const targets = useMemo(() => candidates.filter(m => m.kind !== 'emoticon' && (!onlyNew || !matchesReview(review.entries[m.key], provider, criteria, contextSeconds))), [candidates, onlyNew, review.entries, provider, criteria, contextSeconds]);
  const plans = useMemo(() => {
    function build(preview: boolean) {
      try { return { ...planReview(messages, targets, { contextSeconds, maxMessages: Number(maxMessages), maxRequests: Number(maxRequests), preview }), error: '' }; }
      catch (e) { return { batches: [], count: 0, eligible: targets.length, remaining: targets.length, limitedContexts: 0, error: (e as Error).message }; }
    }
    return { preview: build(true), limited: build(false) };
  }, [messages, targets, contextSeconds, maxMessages, maxRequests]);
  const plan = plans.limited;
  const ordered = useMemo(() => [...messages].sort((a, b) => a.seconds - b.seconds || a.key.localeCompare(b.key)), [messages]);
  const resultRows = useMemo(() => ordered.filter(m => {
    if (reviewUserId && m.userId !== reviewUserId) return false;
    const entry = review.entries[m.key]; if (!entry) return false;
    if (resultFilter === 'all') return true;
    if (resultFilter === 'attention') return entry.decision === 'pending' && entry.ai?.verdict !== 'clear';
    if (resultFilter === 'uncertain') return entry.ai?.verdict === 'uncertain';
    return entry.decision === resultFilter;
  }), [ordered, review.entries, resultFilter, reviewUserId]);
  const pageCount = Math.max(1, Math.ceil(resultRows.length / 20));
  const currentPage = Math.min(page, pageCount);
  const focusedIndex = ordered.findIndex(m => m.key === focusedKey);
  const focused = ordered[focusedIndex];
  const [contextStart, contextEnd] = contextBounds(ordered, focusedIndex, contextSeconds);
  const context = ordered.slice(contextStart, contextEnd);
  const contextPageCount = Math.max(1, Math.ceil(context.length / 50));
  const currentContextPage = Math.min(contextPage, contextPageCount);
  function openContext(key: string) {
    edit(key, {}); setFocusedKey(key);
    const index = ordered.findIndex(m => m.key === key);
    const [start] = contextBounds(ordered, index, contextSeconds);
    setContextPage(Math.floor((index - start) / 50) + 1);
    if (key === focusedKey) contextPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  const counts = Object.values(review.entries).reduce((acc, entry) => ({
    reviewed: acc.reviewed + (entry.ai ? 1 : 0),
    attention: acc.attention + (entry.decision === 'pending' && entry.ai?.verdict !== 'clear' ? 1 : 0),
    confirmed: acc.confirmed + (entry.decision === 'confirmed' ? 1 : 0),
  }), { reviewed: 0, attention: 0, confirmed: 0 });

  async function run(mode: 'preview' | 'limited') {
    const selectedPlan = plans[mode];
    if (runningRef.current || disabled || !apiKey.trim() || !criteria.trim() || !selectedPlan.batches.length) return;
    runningRef.current = true;
    const controller = new AbortController(); control.current = controller;
    const batches = selectedPlan.batches, windowSeconds = contextSeconds, key = apiKey.trim(), rule = criteria.trim(), chosen = provider;
    const total = batches.reduce((n, batch) => n + Object.keys(batch.keys).length, 0);
    const at = new Date().toISOString();
    setRunning(true); onRunningChange(true); setError('');
    save({ ...current.current, lastRun: { provider: chosen, criteria: rule, total, completed: 0, status: 'running', at, mode, contextSeconds: windowSeconds, eligible: selectedPlan.eligible, plannedRequests: batches.length, attemptedRequests: 0, maxMessages: Number(maxMessages), maxRequests: Number(maxRequests) } });
    try {
      for (const batch of batches) {
        if (controller.signal.aborted) break;
        save({ ...current.current, lastRun: { ...current.current.lastRun!, attemptedRequests: (current.current.lastRun!.attemptedRequests || 0) + 1 } });
        const response = await fetch('/api/chat-inspector/review', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: chosen, apiKey: key, criteria: rule, rows: batch.rows, contextSeconds: windowSeconds, contextLimited: batch.contextLimited }), signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'AI �˼��� �����߽��ϴ�.');
        const decisions = validateDecisions(data, Object.keys(batch.keys));
        if (!mounted.current || controller.signal.aborted) return;
        const entries = { ...current.current.entries };
        for (const item of decisions) {
          const messageKey = batch.keys[item.id];
          const previous = entries[messageKey] || { decision: 'pending', note: '' };
          entries[messageKey] = { ...previous, ai: { verdict: item.verdict, category: item.category, reason: item.reason, provider: chosen, model: PROVIDERS[chosen].model, criteria: rule, at, context: batch.contexts[item.id] } };
        }
        save({ entries, lastRun: { ...current.current.lastRun!, completed: current.current.lastRun!.completed + decisions.length } });
      }
      save({ ...current.current, lastRun: { ...current.current.lastRun!, status: controller.signal.aborted ? 'stopped' : 'complete' } });
    } catch (e) {
      if (mounted.current) {
        if (!controller.signal.aborted) setError((e as Error).message);
        save({ ...current.current, lastRun: { ...current.current.lastRun!, status: controller.signal.aborted ? 'stopped' : 'failed' } });
      }
    } finally {
      runningRef.current = false;
      if (mounted.current) {
        if (controller.signal.aborted && current.current.lastRun?.status === 'running') save({ ...current.current, lastRun: { ...current.current.lastRun, status: 'stopped' } });
        setRunning(false); onRunningChange(false);
      }
    }
  }
  function edit(key: string, changes: Partial<ReviewEntry>) {
    const entry = current.current.entries[key] || { decision: 'pending', note: '' };
    save({ ...current.current, entries: { ...current.current.entries, [key]: { ...entry, ...changes } } });
  }
  function download() {
    const url = URL.createObjectURL(new Blob([reviewCsv(ordered, review.entries)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'SOOP_�߾�_�˼�.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className={styles.reviewPanel} aria-labelledby="review-title">
    <div ref={controlsPanel} className={styles.reviewHeading}><div><p className={styles.eyebrow}>AI ASSISTED REVIEW</p><h2 id="review-title">�߾� �˼�</h2><p>AI�� ������ �߾��� ã��, ���� �Ǵ��� ���� ����ϴ�.</p></div><span className={styles.version}>Gemini / ChatGPT</span></div>
    <div className={styles.reviewSettings}>
      <label>AI ������<select value={provider} disabled={running} onChange={e => { setProvider(e.target.value as Provider); setApiKey(''); }}>{Object.entries(PROVIDERS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select><small>{PROVIDERS[provider].model}</small></label>
      <label>API Ű<input type="password" autoComplete="off" spellCheck={false} value={apiKey} disabled={running} onChange={e => setApiKey(e.target.value)} placeholder="������ �������� Ű �Է�" /><small>�� ������ �޸𸮿����� ��� �� ���� �� �� <button type="button" disabled={running || !apiKey} onClick={() => setApiKey('')}>Ű �����</button></small></label>
      <label>�˼� ����<select value={scope} disabled={running} onChange={e => setScope(e.target.value)}><option value="filtered">���� �˻� ��� ({filtered.length.toLocaleString()}��)</option><option value="all">������ ��ü ({messages.length.toLocaleString()}��)</option><option value="user" disabled={!reviewUserId}>������ ���̵� {reviewUserId || '(�Ʒ����� ����)'}</option></select><small>�� �˻�â���� ���̵𡤳��롤�ð��� ���� �� �ֽ��ϴ�.</small></label>
    </div>
    <div className={styles.reviewSettingsExtra}>
      <label>��ȭ �ƶ�<select aria-label="��ȭ �ƶ� ����" value={contextSeconds} disabled={running} onChange={e => { setContextSeconds(Number(e.target.value)); setContextPage(1); }}>{CONTEXT_OPTIONS.map(value => <option key={value} value={value}>{contextLabel(value)}</option>)}</select><small>�˻����� ���ܵ� �ٸ� ������� ��ȭ�� �����մϴ�.</small></label>
      <label>����� �ִ� �߾� ��<input aria-label="����� �ִ� �߾� ��" type="number" min={1} max={5000} value={maxMessages} disabled={running} onChange={e => setMaxMessages(e.target.value)} /><small>1~5,000�� �� �̸� �˼��� �ִ� 50��</small></label>
      <label>����� �ִ� ��û ��<input aria-label="����� �ִ� ��û ��" type="number" min={1} max={200} value={maxRequests} disabled={running} onChange={e => setMaxRequests(e.target.value)} /><small>1~200ȸ �� ������ ��û�� �����մϴ�.</small></label>
    </div>
    <label className={styles.criteria}>�˼� ����<textarea value={criteria} maxLength={2000} rows={3} disabled={running} onChange={e => setCriteria(e.target.value)} /><small>{criteria.length} / 2,000��</small></label>
    <div className={styles.reviewActions}><label><input type="checkbox" checked={onlyNew} disabled={running} onChange={e => setOnlyNew(e.target.checked)} /> ���� AI�����ء��ƶ����� �Ϸ��� �߾� �ǳʶٱ�</label>{running ? <button className={styles.stop} onClick={() => control.current?.abort()}>�˼� ����</button> : <div className={styles.runButtons}><button className={styles.primary} disabled={disabled || !apiKey.trim() || !criteria.trim() || !plans.preview.count} onClick={() => void run('preview')}>{plans.preview.count.toLocaleString()}�� �̸� �˼� ��</button><button disabled={disabled || !apiKey.trim() || !criteria.trim() || !plan.count} onClick={() => void run('limited')}>���� �� {plan.count.toLocaleString()}�� �˼�</button></div>}</div>
    <div className={styles.runPlan} aria-label="���� �� �˼� ��ȹ"><b>���� �� Ȯ�� �� ��� {targets.length.toLocaleString()}��</b><p>�̸� �˼�: {plans.preview.count.toLocaleString()}�� / {plans.preview.batches.length}ȸ ��û �� ���� ��� {plans.preview.remaining.toLocaleString()}��</p><p>���� �� �˼�: {plan.count.toLocaleString()}�� / {plan.batches.length}ȸ ��û �� ���� ��� {plan.remaining.toLocaleString()}��</p><small>�ð��� �պκк��� �˼��մϴ�. �̸� �˼��� ���� AI ��û�̸�, ����� Ȯ���� �� ���� ���� ������ �����ϼ���. �� ���� �� ���� �����ϴ� ���������� �����մϴ�.</small></div>
    <p className={styles.reviewHelp}>���� �� ������ �߾�� {contextLabel(contextSeconds)} ��ȭ�� {PROVIDERS[provider].label}�� �����մϴ�. ���̵𡤴г��� �ʵ�� �ӽ� �̸����� �ٲߴϴ�. ������ ���� �̸��� ���Ե˴ϴ�. �̸�Ƽ���� �˼� ��󿡼� �����մϴ�.</p>
    {(plan.limitedContexts > 0 || plans.preview.limitedContexts > 0) && <p className={styles.contextWarning} role="status">�ƶ� �Ϻ� ����: �̸� �˼� {plans.preview.limitedContexts}�� / ���� �� �˼� {plan.limitedContexts}�� �߾�. ��û�� 100�� �޽������뷮 �ѵ� �ȿ��� ����� ��ȭ�� �켱 �����մϴ�. ���� ���δ� AI�� �˸��� ����� ����մϴ�.</p>}
    <p className={styles.reviewHelp}>������ API ���ᰡ �߻��� �� �ֽ��ϴ�. ��û ���� �ݾ� ������ �ƴϸ� �ƶ��� ����� �Է·��� �þ�ϴ�. ChatGPT��Gemini �� ������ ������ API Ű�� �ʿ��մϴ�. <a href={provider === 'gemini' ? 'https://aistudio.google.com/api-keys' : 'https://platform.openai.com/api-keys'} target="_blank" rel="noreferrer">API Ű ���� ��</a></p>
    {(error || plan.error) && <p className={styles.error} role="alert">{error || plan.error}</p>}
    {review.lastRun && <div className={styles.reviewProgress} role="status"><span>{running ? 'AI �˼� ��' : review.lastRun.status === 'complete' ? '��ȹ�� ���� �˼� �Ϸ�' : review.lastRun.completed ? '�˼� �ߴ� �� �Ϸ��� ����� �����˴ϴ�' : '�˼� �ߴ� �� �Ϸ�� �߾� ����'} �� {review.lastRun.completed.toLocaleString()} / {review.lastRun.total.toLocaleString()}��</span><progress value={review.lastRun.completed} max={review.lastRun.total} aria-label="AI �˼� �����" />{review.lastRun.plannedRequests !== undefined && <small>{review.lastRun.mode === 'preview' ? '�̸� �˼�' : '���� �� �˼�'} �� {contextLabel(review.lastRun.contextSeconds ?? 0)} �� ��û {review.lastRun.attemptedRequests || 0} / {review.lastRun.plannedRequests}ȸ �� ���� ��� ��� {review.lastRun.eligible?.toLocaleString()}�� �� {review.lastRun.total.toLocaleString()}���� ��ȹ�߽��ϴ�.</small>}</div>}
    <div className={styles.reviewSummary}><span>AI �˼� <b>{counts.reviewed.toLocaleString()}</b></span><span>���� ��� <b>{counts.attention.toLocaleString()}</b></span><span>���� ���� Ȯ�� <b>{counts.confirmed.toLocaleString()}</b></span><button disabled={!Object.keys(review.entries).length} onClick={download}>�� �˼� ��� CSV</button></div>
    <ReviewUsers messages={ordered} entries={review.entries} selectedId={reviewUserId} onSelect={id => { setReviewUserId(id); setPage(1); if (!id && scope === 'user') setScope('filtered'); }} onContext={openContext} onScope={() => { setScope('user'); controlsPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} onSearch={onUser} running={running} />
    <div className={styles.reviewToolbar}><label>�˼� ���<select value={resultFilter} onChange={e => { setResultFilter(e.target.value); setPage(1); }}><option value="attention">���� ���</option><option value="uncertain">�ƶ� ����</option><option value="confirmed">���� ���� Ȯ��</option><option value="dismissed">���� ���� Ȯ��</option><option value="all">��� �˼� ���</option></select></label><span>{resultRows.length.toLocaleString()}�� �� {reviewUserId ? `${reviewUserId}�� �˼� ���` : '�˻� ���ǰ� ������ ��ü �˼� ��� ǥ��'}</span></div>
    <div className={styles.reviewResults}>
      {!resultRows.length ? <p className={styles.reviewEmpty}>{counts.reviewed ? '�� ���ǿ� �´� �˼� ����� �����ϴ�. AI�� ������ ��� ���� ������ Ȯ���� ���� �ƴմϴ�.' : 'ä���� ������ �� AI�� ������ �˼��� �����ϼ���. �Ʒ����� ������ ��� ���� ������ ���� �ֽ��ϴ�.'}</p> : resultRows.slice((currentPage - 1) * 20, currentPage * 20).map(m => {
        const entry = review.entries[m.key];
        return <article key={m.key} className={styles.reviewCard}><div className={styles.reviewCardTop}><span className={styles.time}>{formatTime(m.seconds)}</span><button className={styles.userButton} onClick={() => { setReviewUserId(m.userId); setPage(1); }}>{m.nickname} <small>{m.userId}</small></button><span className={styles.reviewTag}>{entry.ai ? verdictLabel[entry.ai.verdict] : '���� ����'} �� {decisionLabel[entry.decision]}</span></div><p className={styles.reviewQuote}>{m.message}</p>{entry.ai && <p className={styles.reviewReason}><b>{entry.ai.category || 'AI �ǰ�'}</b> �� {entry.ai.reason}<small>{PROVIDERS[entry.ai.provider].label} �� {entry.ai.model} �� {contextLabel(entry.ai.context?.seconds ?? 0)}{entry.ai.context && ` �� ���� �� ${entry.ai.context.available}�� �� ${entry.ai.context.included}�� ����`}</small></p>}<div className={styles.reviewCardActions}><button onClick={() => openContext(m.key)}>�յ� ��ȭ���޸�</button>{(['confirmed', 'dismissed', 'pending'] as const).map(value => <button key={value} aria-pressed={entry.decision === value} onClick={() => edit(m.key, { decision: value })}>{decisionLabel[value]}</button>)}</div>{entry.note && <p className={styles.reviewHelp}>�޸�: {entry.note}</p>}</article>;
      })}
    </div>
    {pageCount > 1 && <div className={styles.pagination}><span>�������� 20��</span><div><button aria-label="�˼� ���� ������" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>��</button><span>{currentPage} / {pageCount}</span><button aria-label="�˼� ���� ������" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>��</button></div></div>}
    <details className={styles.manualReview}><summary>�������� ���� ������ �߾� ������</summary><p>���� �˻� ����� ù 100���Դϴ�. �˻�� �ð� �������� ���� �ּ���.</p>{filtered.slice(0, 100).map(m => <button key={m.key} onClick={() => openContext(m.key)}><time>{formatTime(m.seconds)}</time><b>{m.nickname}</b><span>{m.message}</span><small>����</small></button>)}</details>
    {focused && <section ref={contextPanel} tabIndex={-1} className={styles.contextPanel} aria-label="���� �߾��� �յ� ��ȭ"><div className={styles.tableTop}><h3>{contextLabel(contextSeconds)} ��ȭ �� {context.length.toLocaleString()}��</h3><button onClick={() => setFocusedKey('')}>�ݱ�</button></div><div className={styles.contextRows}>{context.slice((currentContextPage - 1) * 50, currentContextPage * 50).map(m => <div key={m.key} className={m.key === focusedKey ? styles.contextSelected : ''}><time>{formatTime(m.seconds)}</time><span><b>{m.nickname}</b> <small>{m.userId}</small><p>{m.message}</p></span></div>)}</div><div className={styles.pagination}><span>���� ������ �߾�: {formatTime(focused.seconds)}</span><div><button disabled={currentContextPage <= 1} onClick={() => setContextPage(currentContextPage - 1)} aria-label="�ƶ� ���� ������">��</button><span>{currentContextPage} / {contextPageCount}</span><button disabled={currentContextPage >= contextPageCount} onClick={() => setContextPage(currentContextPage + 1)} aria-label="�ƶ� ���� ������">��</button></div></div><p className={styles.reviewHelp}>���� ������ �ƶ� ������ ���� ��ü�� �������� 50���� ǥ���մϴ�. AI�� ���� �ѵ��� �Ϻ� ��ȭ�� ������ �� ������ ���������� ���� �ʽ��ϴ�.</p>{review.entries[focusedKey]?.ai && <p className={styles.reviewHelp}>�� �߾��� �˼� ����: {review.entries[focusedKey].ai?.criteria} �� ��� �ƶ�: {contextLabel(review.entries[focusedKey].ai?.context?.seconds ?? 0)}{review.entries[focusedKey].ai?.context && ` �� ${review.entries[focusedKey].ai!.context!.available}�� �� ${review.entries[focusedKey].ai!.context!.included}�� ����`}</p>}<label className={styles.criteria}>�˼� �޸�<textarea rows={2} maxLength={2000} value={review.entries[focusedKey]?.note || ''} onChange={e => edit(focusedKey, { note: e.target.value })} /></label><div className={styles.reviewCardActions}>{(['confirmed', 'dismissed', 'pending'] as const).map(value => <button key={value} aria-pressed={review.entries[focusedKey]?.decision === value} onClick={() => edit(focusedKey, { decision: value })}>{decisionLabel[value]}</button>)}<button onClick={() => onUser(focused.userId)}>�� ���̵��� ��� �߾� ����</button></div></section>}
    <p className={styles.reviewHelp}>�˼� ����� �޸�� �� �������� �ٽú��� ��Ͽ� ����˴ϴ�. ��˼��ϸ� AI �ǰ߸� ���ŵǸ� ���� ���� �Ǵܰ� �޸�� �����˴ϴ�.</p>
  </section>;
}
