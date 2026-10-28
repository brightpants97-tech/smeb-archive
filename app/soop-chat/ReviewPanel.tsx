'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatTime, type ChatMessage } from '../lib/chat-inspector';
import { DEFAULT_CRITERIA, PROVIDERS, CONTEXT_OPTIONS, contextLabel, contextBounds, matchesReview, planReview, reviewCsv, validateDecisions, type Provider, type ReviewEntry, type ReviewState } from '../lib/chat-review';
import ReviewUsers from './ReviewUsers';
import styles from './chat.module.css';

type Props = { messages: ChatMessage[]; filtered: ChatMessage[]; state?: ReviewState; onChange: (state: ReviewState) => void; disabled: boolean; onRunningChange: (running: boolean) => void; onUser: (id: string) => void };
const verdictLabel = { review: '검토 필요', uncertain: '맥락 부족', clear: '지적 없음' };
const decisionLabel = { pending: '미확정', confirmed: '문제 있음', dismissed: '문제 없음' };

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
        if (!response.ok) throw new Error(data.error || 'AI 검수에 실패했습니다.');
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
    const a = document.createElement('a'); a.href = url; a.download = 'SOOP_발언_검수.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className={styles.reviewPanel} aria-labelledby="review-title">
    <div ref={controlsPanel} className={styles.reviewHeading}><div><p className={styles.eyebrow}>AI ASSISTED REVIEW</p><h2 id="review-title">발언 검수</h2><p>AI가 검토할 발언을 찾고, 최종 판단은 직접 남깁니다.</p></div><span className={styles.version}>Gemini / ChatGPT</span></div>
    <div className={styles.reviewSettings}>
      <label>AI 제공사<select value={provider} disabled={running} onChange={e => { setProvider(e.target.value as Provider); setApiKey(''); }}>{Object.entries(PROVIDERS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select><small>{PROVIDERS[provider].model}</small></label>
      <label>API 키<input type="password" autoComplete="off" spellCheck={false} value={apiKey} disabled={running} onChange={e => setApiKey(e.target.value)} placeholder="선택한 제공사의 키 입력" /><small>이 페이지 메모리에서만 사용 · 저장 안 함 <button type="button" disabled={running || !apiKey} onClick={() => setApiKey('')}>키 지우기</button></small></label>
      <label>검수 범위<select value={scope} disabled={running} onChange={e => setScope(e.target.value)}><option value="filtered">현재 검색 결과 ({filtered.length.toLocaleString()}개)</option><option value="all">가져온 전체 ({messages.length.toLocaleString()}개)</option><option value="user" disabled={!reviewUserId}>선택한 아이디 {reviewUserId || '(아래에서 선택)'}</option></select><small>위 검색창에서 아이디·내용·시간을 좁힐 수 있습니다.</small></label>
    </div>
    <div className={styles.reviewSettingsExtra}>
      <label>대화 맥락<select aria-label="대화 맥락 범위" value={contextSeconds} disabled={running} onChange={e => { setContextSeconds(Number(e.target.value)); setContextPage(1); }}>{CONTEXT_OPTIONS.map(value => <option key={value} value={value}>{contextLabel(value)}</option>)}</select><small>검색에서 제외된 다른 사용자의 대화도 참고합니다.</small></label>
      <label>실행당 최대 발언 수<input aria-label="실행당 최대 발언 수" type="number" min={1} max={5000} value={maxMessages} disabled={running} onChange={e => setMaxMessages(e.target.value)} /><small>1~5,000개 · 미리 검수는 최대 50개</small></label>
      <label>실행당 최대 요청 수<input aria-label="실행당 최대 요청 수" type="number" min={1} max={200} value={maxRequests} disabled={running} onChange={e => setMaxRequests(e.target.value)} /><small>1~200회 · 실패한 요청도 포함합니다.</small></label>
    </div>
    <label className={styles.criteria}>검수 기준<textarea value={criteria} maxLength={2000} rows={3} disabled={running} onChange={e => setCriteria(e.target.value)} /><small>{criteria.length} / 2,000자</small></label>
    <div className={styles.reviewActions}><label><input type="checkbox" checked={onlyNew} disabled={running} onChange={e => setOnlyNew(e.target.checked)} /> 같은 AI·기준·맥락으로 완료한 발언 건너뛰기</label>{running ? <button className={styles.stop} onClick={() => control.current?.abort()}>검수 중지</button> : <div className={styles.runButtons}><button className={styles.primary} disabled={disabled || !apiKey.trim() || !criteria.trim() || !plans.preview.count} onClick={() => void run('preview')}>{plans.preview.count.toLocaleString()}개 미리 검수 →</button><button disabled={disabled || !apiKey.trim() || !criteria.trim() || !plan.count} onClick={() => void run('limited')}>제한 내 {plan.count.toLocaleString()}개 검수</button></div>}</div>
    <div className={styles.runPlan} aria-label="실행 전 검수 계획"><b>실행 전 확인 · 대상 {targets.length.toLocaleString()}개</b><p>미리 검수: {plans.preview.count.toLocaleString()}개 / {plans.preview.batches.length}회 요청 · 남는 대상 {plans.preview.remaining.toLocaleString()}개</p><p>제한 내 검수: {plan.count.toLocaleString()}개 / {plan.batches.length}회 요청 · 남는 대상 {plan.remaining.toLocaleString()}개</p><small>시간순 앞부분부터 검수합니다. 미리 검수도 실제 AI 요청이며, 결과를 확인한 뒤 직접 다음 실행을 시작하세요. 두 제한 중 먼저 도달하는 범위까지만 전송합니다.</small></div>
    <p className={styles.reviewHelp}>실행 시 선택한 발언과 {contextLabel(contextSeconds)} 대화를 {PROVIDERS[provider].label}에 전송합니다. 아이디·닉네임 필드는 임시 이름으로 바꿉니다. 본문에 적힌 이름은 포함됩니다. 이모티콘은 검수 대상에서 제외합니다.</p>
    {(plan.limitedContexts > 0 || plans.preview.limitedContexts > 0) && <p className={styles.contextWarning} role="status">맥락 일부 생략: 미리 검수 {plans.preview.limitedContexts}개 / 제한 내 검수 {plan.limitedContexts}개 발언. 요청당 100개 메시지·용량 한도 안에서 가까운 대화를 우선 포함합니다. 생략 여부는 AI에 알리고 결과에 기록합니다.</p>}
    <p className={styles.reviewHelp}>제공사 API 사용료가 발생할 수 있습니다. 요청 수는 금액 상한이 아니며 맥락이 길수록 입력량이 늘어납니다. ChatGPT·Gemini 앱 구독과 별도의 API 키가 필요합니다. <a href={provider === 'gemini' ? 'https://aistudio.google.com/api-keys' : 'https://platform.openai.com/api-keys'} target="_blank" rel="noreferrer">API 키 관리 ↗</a></p>
    {(error || plan.error) && <p className={styles.error} role="alert">{error || plan.error}</p>}
    {review.lastRun && <div className={styles.reviewProgress} role="status"><span>{running ? 'AI 검수 중' : review.lastRun.status === 'complete' ? '계획한 범위 검수 완료' : review.lastRun.completed ? '검수 중단 · 완료한 결과는 보관됩니다' : '검수 중단 · 완료된 발언 없음'} · {review.lastRun.completed.toLocaleString()} / {review.lastRun.total.toLocaleString()}개</span><progress value={review.lastRun.completed} max={review.lastRun.total} aria-label="AI 검수 진행률" />{review.lastRun.plannedRequests !== undefined && <small>{review.lastRun.mode === 'preview' ? '미리 검수' : '제한 내 검수'} · {contextLabel(review.lastRun.contextSeconds ?? 0)} · 요청 {review.lastRun.attemptedRequests || 0} / {review.lastRun.plannedRequests}회 · 시작 당시 대상 {review.lastRun.eligible?.toLocaleString()}개 중 {review.lastRun.total.toLocaleString()}개를 계획했습니다.</small>}</div>}
    <div className={styles.reviewSummary}><span>AI 검수 <b>{counts.reviewed.toLocaleString()}</b></span><span>검토 대기 <b>{counts.attention.toLocaleString()}</b></span><span>문제 있음 확정 <b>{counts.confirmed.toLocaleString()}</b></span><button disabled={!Object.keys(review.entries).length} onClick={download}>↓ 검수 결과 CSV</button></div>
    <ReviewUsers messages={ordered} entries={review.entries} selectedId={reviewUserId} onSelect={id => { setReviewUserId(id); setPage(1); if (!id && scope === 'user') setScope('filtered'); }} onContext={openContext} onScope={() => { setScope('user'); controlsPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} onSearch={onUser} running={running} />
    <div className={styles.reviewToolbar}><label>검수 결과<select value={resultFilter} onChange={e => { setResultFilter(e.target.value); setPage(1); }}><option value="attention">검토 대기</option><option value="uncertain">맥락 부족</option><option value="confirmed">문제 있음 확정</option><option value="dismissed">문제 없음 확정</option><option value="all">모든 검수 결과</option></select></label><span>{resultRows.length.toLocaleString()}개 · {reviewUserId ? `${reviewUserId}의 검수 결과` : '검색 조건과 별도로 전체 검수 결과 표시'}</span></div>
    <div className={styles.reviewResults}>
      {!resultRows.length ? <p className={styles.reviewEmpty}>{counts.reviewed ? '이 조건에 맞는 검수 결과가 없습니다. AI의 지적이 없어도 문제 없음이 확정된 것은 아닙니다.' : '채팅을 가져온 뒤 AI를 연결해 검수를 시작하세요. 아래에서 원문을 골라 직접 검토할 수도 있습니다.'}</p> : resultRows.slice((currentPage - 1) * 20, currentPage * 20).map(m => {
        const entry = review.entries[m.key];
        return <article key={m.key} className={styles.reviewCard}><div className={styles.reviewCardTop}><span className={styles.time}>{formatTime(m.seconds)}</span><button className={styles.userButton} onClick={() => { setReviewUserId(m.userId); setPage(1); }}>{m.nickname} <small>{m.userId}</small></button><span className={styles.reviewTag}>{entry.ai ? verdictLabel[entry.ai.verdict] : '직접 검토'} · {decisionLabel[entry.decision]}</span></div><p className={styles.reviewQuote}>{m.message}</p>{entry.ai && <p className={styles.reviewReason}><b>{entry.ai.category || 'AI 의견'}</b> · {entry.ai.reason}<small>{PROVIDERS[entry.ai.provider].label} · {entry.ai.model} · {contextLabel(entry.ai.context?.seconds ?? 0)}{entry.ai.context && ` · 범위 내 ${entry.ai.context.available}개 중 ${entry.ai.context.included}개 참고`}</small></p>}<div className={styles.reviewCardActions}><button onClick={() => openContext(m.key)}>앞뒤 대화·메모</button>{(['confirmed', 'dismissed', 'pending'] as const).map(value => <button key={value} aria-pressed={entry.decision === value} onClick={() => edit(m.key, { decision: value })}>{decisionLabel[value]}</button>)}</div>{entry.note && <p className={styles.reviewHelp}>메모: {entry.note}</p>}</article>;
      })}
    </div>
    {pageCount > 1 && <div className={styles.pagination}><span>페이지당 20개</span><div><button aria-label="검수 이전 페이지" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>←</button><span>{currentPage} / {pageCount}</span><button aria-label="검수 다음 페이지" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>→</button></div></div>}
    <details className={styles.manualReview}><summary>원문에서 직접 검토할 발언 고르기</summary><p>현재 검색 결과의 첫 100개입니다. 검색어나 시간 구간으로 좁혀 주세요.</p>{filtered.slice(0, 100).map(m => <button key={m.key} onClick={() => openContext(m.key)}><time>{formatTime(m.seconds)}</time><b>{m.nickname}</b><span>{m.message}</span><small>검토</small></button>)}</details>
    {focused && <section ref={contextPanel} tabIndex={-1} className={styles.contextPanel} aria-label="선택 발언의 앞뒤 대화"><div className={styles.tableTop}><h3>{contextLabel(contextSeconds)} 대화 · {context.length.toLocaleString()}개</h3><button onClick={() => setFocusedKey('')}>닫기</button></div><div className={styles.contextRows}>{context.slice((currentContextPage - 1) * 50, currentContextPage * 50).map(m => <div key={m.key} className={m.key === focusedKey ? styles.contextSelected : ''}><time>{formatTime(m.seconds)}</time><span><b>{m.nickname}</b> <small>{m.userId}</small><p>{m.message}</p></span></div>)}</div><div className={styles.pagination}><span>현재 선택한 발언: {formatTime(focused.seconds)}</span><div><button disabled={currentContextPage <= 1} onClick={() => setContextPage(currentContextPage - 1)} aria-label="맥락 이전 페이지">←</button><span>{currentContextPage} / {contextPageCount}</span><button disabled={currentContextPage >= contextPageCount} onClick={() => setContextPage(currentContextPage + 1)} aria-label="맥락 다음 페이지">→</button></div></div><p className={styles.reviewHelp}>현재 선택한 맥락 범위의 원문 전체를 페이지당 50개씩 표시합니다. AI는 전송 한도로 일부 대화를 생략할 수 있으며 영상·음성을 보지 않습니다.</p>{review.entries[focusedKey]?.ai && <p className={styles.reviewHelp}>이 발언의 검수 기준: {review.entries[focusedKey].ai?.criteria} · 당시 맥락: {contextLabel(review.entries[focusedKey].ai?.context?.seconds ?? 0)}{review.entries[focusedKey].ai?.context && ` · ${review.entries[focusedKey].ai!.context!.available}개 중 ${review.entries[focusedKey].ai!.context!.included}개 참고`}</p>}<label className={styles.criteria}>검수 메모<textarea rows={2} maxLength={2000} value={review.entries[focusedKey]?.note || ''} onChange={e => edit(focusedKey, { note: e.target.value })} /></label><div className={styles.reviewCardActions}>{(['confirmed', 'dismissed', 'pending'] as const).map(value => <button key={value} aria-pressed={review.entries[focusedKey]?.decision === value} onClick={() => edit(focusedKey, { decision: value })}>{decisionLabel[value]}</button>)}<button onClick={() => onUser(focused.userId)}>이 아이디의 모든 발언 보기</button></div></section>}
    <p className={styles.reviewHelp}>검수 결과와 메모는 이 브라우저의 다시보기 기록에 저장됩니다. 재검수하면 AI 의견만 갱신되며 직접 남긴 판단과 메모는 유지됩니다.</p>
  </section>;
}
