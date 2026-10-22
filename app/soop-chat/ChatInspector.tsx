'use client';
import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { exportCsv, filterMessages, formatTime, parseSource, parseTime, type ChatMessage, type ChatSource } from '../lib/chat-inspector';
import { collectLive } from './live';
import { deleteSession, saveBatch, savedMessages, savedSessions, type SavedSession } from './storage';
import styles from './chat.module.css';

const EXAMPLE_VOD = 'https://vod.sooplive.com/player/210511423';
const EXAMPLE_LIVE = 'https://play.sooplive.com/townboy/298032215';
const PAGE_SIZE = 100;
async function json<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '요청을 완료하지 못했습니다.');
  return data;
}
const kst = (timestamp: string | null) => timestamp ? new Date(timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }) : '제공되지 않음';
const labelKind = { chat: '채팅', emoticon: '이모티콘', event: '후원·기타' };

export default function ChatInspector() {
  const [url, setUrl] = useState('');
  const [session, setSession] = useState<SavedSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [archives, setArchives] = useState<SavedSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('주소를 입력하면 채팅 기록을 확인할 수 있습니다.');
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [query, setQuery] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [kind, setKind] = useState('all');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState('');
  const control = useRef<AbortController | null>(null);
  const sessionRef = useRef<SavedSession | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const persistence = useRef(Promise.resolve());
  const liveBuffer = useRef<ChatMessage[]>([]);
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const runId = useRef(0);
  const deferredQuery = useDeferredValue(query);

  async function refreshArchives() {
    try { setArchives(await savedSessions()); } catch { setStorageError('이 브라우저에서 기록을 저장할 수 없습니다. CSV로 내려받아 보관해 주세요.'); }
  }
  useEffect(() => {
    void savedSessions().then(setArchives).catch(() => setStorageError('이 브라우저에서 기록을 저장할 수 없습니다. CSV로 내려받아 보관해 주세요.'));
    return () => { runId.current++; control.current?.abort(); if (flushTimer.current) clearInterval(flushTimer.current); };
  }, []);
  useEffect(() => {
    if (!busy) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [busy]);

  function persist(current: SavedSession, rows: ChatMessage[]) {
    const snapshot = { ...current, completedChunks: [...current.completedChunks] };
    persistence.current = persistence.current.then(() => saveBatch(snapshot, rows)).catch(() => {
      setStorageError('브라우저 저장 공간이 부족하거나 저장이 차단되었습니다. 현재 기록을 CSV로 내려받아 주세요.');
    });
  }
  function append(rows: ChatMessage[], chunk?: string) {
    const current = sessionRef.current;
    if (!current) return;
    messagesRef.current = [...messagesRef.current, ...rows];
    const next = { ...current, count: messagesRef.current.length, completedChunks: chunk ? [...current.completedChunks, chunk] : current.completedChunks };
    sessionRef.current = next; setSession(next); setMessages(messagesRef.current); persist(next, rows);
  }
  function flushLive() {
    if (liveBuffer.current.length) { const rows = liveBuffer.current; liveBuffer.current = []; append(rows); }
  }
  async function stop() {
    runId.current++; control.current?.abort(); flushLive();
    if (flushTimer.current) clearInterval(flushTimer.current);
    flushTimer.current = null; setBusy(false);
    setStatus('수집을 중지했습니다. 지금까지 가져온 기록은 검색·저장할 수 있습니다.');
    await persistence.current; await refreshArchives();
  }
  function resetFilters() { setQuery(''); setUserId(''); setFrom(''); setTo(''); setKind('all'); setPage(1); }

  async function start(resume = false) {
    if (busy) return;
    const input = resume && sessionRef.current ? sessionRef.current.source.url : url;
    try { parseSource(input); } catch (e) { setError((e as Error).message); return; }
    const generation = ++runId.current;
    const controller = new AbortController(); control.current = controller;
    setBusy(true); setError(''); setStatus('방송 정보를 확인하고 있습니다…'); setProgress({ done: 0, total: 0 });
    try {
      const source = await json<ChatSource>(`/api/chat-inspector/source?url=${encodeURIComponent(input)}`, controller.signal);
      if (generation !== runId.current) return;
      let current: SavedSession;
      if (resume && sessionRef.current?.source.type === 'vod') {
        current = { ...sessionRef.current, source };
      } else {
        current = { id: crypto.randomUUID(), source, createdAt: new Date().toISOString(), count: 0, complete: false, completedChunks: [] };
        messagesRef.current = []; setMessages([]); resetFilters();
      }
      sessionRef.current = current; setSession(current); persist(current, []);
      if (source.type === 'live') {
        liveBuffer.current = [];
        flushTimer.current = setInterval(flushLive, 1000);
        collectLive(source, controller.signal, rows => liveBuffer.current.push(...rows), text => {
          if (generation === runId.current) setStatus(text);
        }, text => {
          if (generation !== runId.current) return;
          flushLive(); if (flushTimer.current) clearInterval(flushTimer.current); flushTimer.current = null;
          setBusy(false); setError(text); setStatus('생방송 수집 종료 · 저장된 기록을 확인하세요');
          void persistence.current.then(refreshArchives);
        });
        return;
      }
      const chunks = source.files!.flatMap(file => Array.from({ length: Math.max(1, Math.ceil(file.duration / 300)) }, (_, index) => ({ file: file.index, start: index * 300, key: `${file.index}:${index * 300}` })));
      const done = new Set(current.completedChunks); let completed = chunks.filter(c => done.has(c.key)).length;
      setProgress({ done: completed, total: chunks.length });
      for (const chunk of chunks) {
        if (done.has(chunk.key)) continue;
        if (controller.signal.aborted) break;
        setStatus(`다시보기 채팅을 가져오는 중 · ${completed}/${chunks.length} 구간`);
        let result: { messages: ChatMessage[] } | undefined;
        for (let retry = 0; retry < 3; retry++) {
          try {
            result = await json(`/api/chat-inspector/chunk?id=${source.id}&file=${chunk.file}&start=${chunk.start}`, controller.signal); break;
          } catch (e) {
            if (controller.signal.aborted || retry === 2) throw e;
            await new Promise(resolve => setTimeout(resolve, 500 * (retry + 1)));
          }
        }
        if (generation !== runId.current) return;
        append(result!.messages, chunk.key); completed++;
        setProgress({ done: completed, total: chunks.length });
      }
      if (generation !== runId.current) return;
      messagesRef.current.sort((a, b) => a.seconds - b.seconds);
      setMessages([...messagesRef.current]);
      const finalSession = { ...sessionRef.current!, complete: true };
      sessionRef.current = finalSession; setSession(finalSession); persist(finalSession, []);
      setBusy(false); setStatus(`가져오기 완료 · 제공된 ${chunks.length}개 구간을 모두 확인했습니다.`);
      await persistence.current; await refreshArchives();
    } catch (e) {
      if (generation !== runId.current) return;
      setBusy(false); setError((e as Error).message);
      setStatus('가져오기가 완료되지 않았습니다. 다시보기는 이어받기로 실패한 구간부터 재시도할 수 있습니다.');
      await persistence.current; await refreshArchives();
    }
  }

  async function openSaved(id: string) {
    if (busy || !id) return;
    const selected = archives.find(a => a.id === id); if (!selected) return;
    setError(''); setBusy(true); setStatus('저장된 기록을 여는 중…');
    try {
      await persistence.current;
      const rows = await savedMessages(id);
      sessionRef.current = selected; messagesRef.current = rows; setSession(selected); setMessages(rows); setUrl(selected.source.url); resetFilters();
      setStatus(selected.complete ? '이 브라우저에 저장된 기록입니다.' : '중단된 수집 기록입니다. 다시보기는 이어받을 수 있습니다.');
      setProgress({ done: 0, total: 0 });
    } catch { setError('저장된 기록을 열지 못했습니다.'); }
    finally { setBusy(false); }
  }
  async function removeSaved(id: string) {
    try {
      await persistence.current; await deleteSession(id); setDeleteId(''); await refreshArchives();
      if (sessionRef.current?.id === id) { sessionRef.current = null; messagesRef.current = []; setSession(null); setMessages([]); setStatus('저장 기록을 삭제했습니다.'); }
    } catch { setError('기록을 삭제하지 못했습니다.'); }
  }

  const fromSeconds = parseTime(from), toSeconds = parseTime(to);
  const invalidTime = Number.isNaN(fromSeconds) || Number.isNaN(toSeconds) || (fromSeconds !== null && toSeconds !== null && fromSeconds > toSeconds);
  const filtered = useMemo(() => invalidTime ? [] : filterMessages(messages, { query: deferredQuery, userId, from: fromSeconds, to: toSeconds, kind }), [messages, deferredQuery, userId, fromSeconds, toSeconds, kind, invalidTime]);
  const users = useMemo(() => {
    const map = new Map<string, { userId: string; nickname: string; count: number }>();
    for (const m of messages) { const user = map.get(m.userId); if (user) { user.count++; user.nickname = m.nickname; } else map.set(m.userId, { userId: m.userId, nickname: m.nickname, count: 1 }); }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [messages]);
  const userSearch = deferredQuery.trim().toLocaleLowerCase();
  const shownUsers = users.filter(u => !userSearch || `${u.userId} ${u.nickname}`.toLocaleLowerCase().includes(userSearch));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const source = session?.source;
  function downloadCsv() {
    const href = URL.createObjectURL(new Blob([exportCsv(filtered)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = href; a.download = `SOOP_${source?.id || 'chat'}_${filtered.length}개.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  return <main className={styles.root}>
    <div className={styles.shell}>
      <nav className={styles.nav}><Link href="/apps">← 도구 목록</Link><span>SMEB <b>ARCHIVE</b></span><span className={styles.localBadge}>내 브라우저에 저장</span></nav>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>TOOLS / CHAT INSPECTOR</p><h1>SOOP 채팅 부검<span>.</span></h1><p className={styles.subtitle}>누가, 언제, 어떤 말을 했는지. 채팅의 흐름을 한눈에.</p></div>
        <span className={styles.version}>LIVE + VOD</span>
      </header>

      <section className={styles.sourcePanel} aria-labelledby="source-title">
        <div className={styles.sectionTitle}><h2 id="source-title">방송 주소로 시작하기</h2><span>생방송 · 다시보기 자동 인식</span></div>
        <form className={styles.urlForm} onSubmit={e => { e.preventDefault(); void start(); }}>
          <label className={styles.urlInput}><span aria-hidden="true">↗</span><input aria-label="SOOP 방송 주소" placeholder="https://vod.sooplive.com/player/…" value={url} onChange={e => setUrl(e.target.value)} disabled={busy} type="url" required /></label>
          {busy ? <button type="button" className={styles.stop} onClick={() => void stop()}>수집 중지</button> : <button className={styles.primary} type="submit">채팅 가져오기 <span>→</span></button>}
        </form>
        <div className={styles.examples}><span>예시 주소</span><button disabled={busy} onClick={() => setUrl(EXAMPLE_VOD)}>다시보기</button><button disabled={busy} onClick={() => setUrl(EXAMPLE_LIVE)}>생방송</button><a href="https://www.sooplive.com/my/favorite" target="_blank" rel="noreferrer">SOOP 즐겨찾기 열기 ↗</a></div>
        <div className={styles.status} role="status"><i className={busy ? styles.activeDot : ''} /><span>{status}</span>{source?.type === 'vod' && progress.total > 0 && <strong>{Math.round(progress.done / progress.total * 100)}%</strong>}</div>
        {source?.type === 'vod' && progress.total > 0 && <progress className={styles.progress} value={progress.done} max={progress.total} aria-label="채팅 수집 진행률" />}
        {error && <div className={styles.error} role="alert">{error}</div>}
        {storageError && <div className={styles.error} role="alert">{storageError}</div>}
        {session && !session.complete && source?.type === 'vod' && !busy && <button className={styles.resume} onClick={() => void start(true)}>이 다시보기 이어받기 →</button>}
      </section>

      <div className={styles.workspaceHeader}><div><span className={styles.eyebrow}>CHAT LOG</span><h2>{source?.title || '채팅 기록'}</h2>{source && <a href={source.url} target="_blank" rel="noreferrer">{source.nickname} · {source.type === 'vod' ? '다시보기' : '생방송'} #{source.id} ↗</a>}</div>
        <div className={styles.archiveControls}><select aria-label="저장 기록 열기" disabled={busy} value={session?.id && archives.some(a => a.id === session.id) ? session.id : ''} onChange={e => void openSaved(e.target.value)}><option value="">저장 기록 ({archives.length})</option>{archives.map(a => <option key={a.id} value={a.id}>{a.source.type === 'vod' ? 'VOD' : 'LIVE'} · {a.source.title} · {a.count.toLocaleString()}개 · {kst(a.createdAt)}</option>)}</select>{session && !busy && archives.some(a => a.id === session.id) && <button onClick={() => setDeleteId(session.id)}>삭제</button>}</div>
      </div>
      {deleteId && <div className={styles.deleteNotice} role="alert">이 브라우저의 선택한 기록을 삭제할까요? <button onClick={() => void removeSaved(deleteId)}>기록 삭제</button><button onClick={() => setDeleteId('')}>취소</button></div>}

      <div className={styles.stats}><div><span>수집한 메시지</span><strong>{messages.length.toLocaleString()}<small>개</small></strong></div><div><span>참여 아이디</span><strong>{users.length.toLocaleString()}<small>명</small></strong></div><div><span>검색 결과</span><strong className={styles.orange}>{filtered.length.toLocaleString()}<small>개</small></strong></div><div><span>{source?.type === 'live' ? '마지막 수집 경과' : '영상 길이'}</span><strong className={styles.timeStat}>{formatTime(source?.type === 'live' ? messages.at(-1)?.seconds || 0 : source?.duration || 0)}</strong></div></div>

      <section className={styles.filterPanel} aria-label="채팅 검색 조건">
        <label className={styles.search}><span aria-hidden="true">⌕</span><input aria-label="아이디, 닉네임, 채팅 내용 검색" placeholder="아이디, 닉네임 또는 채팅 내용 검색" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /></label>
        <div className={styles.filterRow}><div className={styles.timeFilter}><label>시간 구간<input aria-label="시작 시간" placeholder="00:00:00" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} /></label><span>—</span><input aria-label="종료 시간" placeholder="00:00:00" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} /></div><select aria-label="메시지 종류" value={kind} onChange={e => { setKind(e.target.value); setPage(1); }}><option value="all">모든 종류</option><option value="chat">채팅</option><option value="emoticon">이모티콘</option><option value="event">후원·기타</option></select><button onClick={resetFilters}>초기화</button><button className={styles.export} disabled={!filtered.length} onClick={downloadCsv}>↓ 검색 결과 CSV</button></div>
        {invalidTime && <p className={styles.error}>시간을 분:초 또는 시:분:초로 입력하세요. 종료 시간은 시작 시간 이후여야 합니다.</p>}
        {userId && <div className={styles.selectedUser}>아이디: <b>{userId}</b><button onClick={() => { setUserId(''); setPage(1); }} aria-label="사용자 필터 해제">×</button><span>선택한 아이디의 모든 닉네임 이력을 함께 검색합니다.</span></div>}
      </section>

      <div className={styles.logLayout}>
        <section className={styles.tablePanel} aria-label="채팅 목록"><div className={styles.tableTop}><h3>{userId ? '선택한 사용자의 채팅' : '전체 채팅'}</h3><span>시간순 · {filtered.length.toLocaleString()}개</span></div>
          {!messages.length ? <div className={styles.empty}><div className={styles.emptyIcon}>≡</div><h3>{busy ? '채팅을 기다리고 있습니다' : '기록을 불러와 주세요'}</h3><p>{busy ? '수신된 메시지가 여기에 순서대로 표시됩니다.' : '방송 주소를 입력하거나 저장 기록을 선택하면\n아이디와 닉네임, 내용, 시간을 확인할 수 있습니다.'}</p><span>생방송은 연결 이후 · 다시보기는 제공된 전체 구간</span></div> : !filtered.length ? <div className={styles.empty}><h3>일치하는 채팅이 없습니다</h3><p>검색어나 시간 구간을 바꿔 보세요.</p><button onClick={resetFilters}>검색 조건 초기화</button></div> : <div className={styles.tableScroll}><table><thead><tr><th>{source?.type === 'live' ? '수집 경과 / 수신 시각' : '영상 시간 / 추정 시각'}</th><th>닉네임 / 아이디</th><th>채팅 내용</th></tr></thead><tbody>{visibleRows.map(m => <tr key={m.key}><td><span className={styles.time}>{formatTime(m.seconds)}</span><small title={m.timeBasis === 'estimated' ? '영상 파일 시작 시각 + 채팅의 영상 내 시간으로 추정' : '이 브라우저가 메시지를 수신한 시각'}>{kst(m.timestamp)}</small></td><td><button className={styles.userButton} onClick={() => { setUserId(m.userId); setPage(1); }}><b>{m.nickname || '(닉네임 없음)'}</b><small>{m.userId}</small></button></td><td>{m.kind !== 'chat' && <span className={styles.kind}>{labelKind[m.kind]}</span>}<span className={styles.message}>{m.message}</span></td></tr>)}</tbody></table></div>}
          <div className={styles.pagination}><span>페이지당 {PAGE_SIZE}개 · 전체 결과를 CSV로 저장</span><div><button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="이전 페이지">←</button><span>{currentPage} / {pageCount}</span><button disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} aria-label="다음 페이지">→</button></div></div>
        </section>
        <aside className={styles.usersPanel}><div className={styles.tableTop}><h3>참여 사용자</h3><span>{users.length.toLocaleString()}명</span></div><p>아이디를 누르면 해당 사용자의 기록만 봅니다.</p><div className={styles.userList}>{shownUsers.length ? shownUsers.slice(0, 100).map((u, i) => <button key={u.userId} className={u.userId === userId ? styles.userSelected : ''} onClick={() => { setUserId(u.userId === userId ? '' : u.userId); setPage(1); }}><span className={styles.rank}>{String(i + 1).padStart(2, '0')}</span><span><b>{u.nickname}</b><small>{u.userId}</small></span><strong>{u.count.toLocaleString()}</strong></button>) : <div className={styles.usersEmpty}>{messages.length ? '검색된 사용자가 없습니다' : '수집 후 표시됩니다'}</div>}</div>{shownUsers.length > 100 && <p>상위 100명 표시 · 검색으로 다른 사용자 찾기</p>}</aside>
      </div>
      <footer className={styles.notes}><h3>기록을 읽기 전에</h3><p><b>생방송</b> 연결 이후의 일반 채팅·이모티콘을 수집합니다. 탭을 닫거나 기기가 잠들면 수집이 멈추며, 재연결 사이의 기록은 복구되지 않습니다. 시각은 발신 시각이 아닌 브라우저 수신 시각입니다.</p><p><b>다시보기</b> SOOP이 공개하는 채팅·이모티콘·텍스트가 있는 후원 기록을 가져옵니다. 영상 시간은 원본 데이터 기준이며, 날짜·시각은 파일 시작 시각을 더한 추정값(KST)입니다. 삭제·비공개·인증 제한 기록은 가져올 수 없습니다.</p><p><b>저장</b> 이 브라우저의 저장 공간을 사용합니다. 다른 기기와 공유되지 않으며 브라우저 데이터 삭제 시 사라집니다. 필요한 기록은 CSV로 보관하세요.</p></footer>
    </div>
  </main>;
}
