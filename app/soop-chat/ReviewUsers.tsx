'use client';
import { useMemo, useState } from 'react';
import type { ChatMessage } from '../lib/chat-inspector';
import { formatTime } from '../lib/chat-inspector';
import { reviewUsers, type ReviewState } from '../lib/chat-review';
import styles from './chat.module.css';

type Props = {
  messages: ChatMessage[]; entries: ReviewState['entries']; selectedId: string;
  onSelect: (id: string) => void; onContext: (key: string) => void;
  onScope: () => void; onSearch: (id: string) => void; running: boolean;
};
const labels = { pending: '미확정', confirmed: '문제 있음', dismissed: '문제 없음' };
const aiLabels = { review: '검토 필요', uncertain: '맥락 부족', clear: '지적 없음' };

export default function ReviewUsers({ messages, entries, selectedId, onSelect, onContext, onScope, onSearch, running }: Props) {
  const [query, setQuery] = useState('');
  const [userPage, setUserPage] = useState(1);
  const users = useMemo(() => reviewUsers(messages, entries), [messages, entries]);
  const found = useMemo(() => {
    const text = query.trim().toLocaleLowerCase();
    return users.filter(u => `${u.userId} ${u.nicknames.join(' ')}`.toLocaleLowerCase().includes(text));
  }, [query, users]);
  const selected = users.find(u => u.userId === selectedId);
  const totalPages = Math.max(1, Math.ceil(found.length / 10));
  const page = Math.min(userPage, totalPages);
  return <section className={styles.reviewUsers} aria-label="아이디별 검수">
    <div className={styles.reviewHeading}><div><h3>아이디별 검수</h3><p>검토 대기 발언이 많은 순서입니다. AI 의견과 직접 내린 판단을 구분해 확인하세요.</p></div><span>{users.length.toLocaleString()}명</span></div>
    <input className={styles.userReviewSearch} aria-label="검수 사용자 검색" placeholder="아이디 또는 예전 닉네임 검색" value={query} onChange={e => { setQuery(e.target.value); setUserPage(1); }} />
    <div className={styles.reviewUserList}>{found.slice((page - 1) * 10, page * 10).map(u => <button key={u.userId} aria-pressed={selectedId === u.userId} onClick={() => onSelect(selectedId === u.userId ? '' : u.userId)}><span><b>{u.nickname || '(닉네임 없음)'}</b><small>{u.userId}</small></span><span>전체 {u.total} · AI 검수 {u.reviewed}<small>검토 대기 {u.attention} · 문제 있음 {u.confirmed} · 문제 없음 {u.dismissed}</small></span></button>)}</div>
    {!found.length && <p className={styles.reviewHelp}>일치하는 아이디가 없습니다.</p>}
    <div className={styles.pagination}><span>검색 {found.length.toLocaleString()}명</span><div><button disabled={page <= 1} aria-label="사용자 이전 페이지" onClick={() => setUserPage(page - 1)}>←</button><span>{page} / {totalPages}</span><button disabled={page >= totalPages} aria-label="사용자 다음 페이지" onClick={() => setUserPage(page + 1)}>→</button></div></div>
    {selected && <UserHistory key={selected.userId} user={selected} messages={messages} entries={entries} onContext={onContext} onClear={() => onSelect('')} onScope={onScope} onSearch={onSearch} running={running} />}
  </section>;
}

function UserHistory({ user, messages, entries, onContext, onClear, onScope, onSearch, running }: {
  user: ReturnType<typeof reviewUsers>[number]; messages: ChatMessage[]; entries: ReviewState['entries'];
  onContext: (key: string) => void; onClear: () => void; onScope: () => void; onSearch: (id: string) => void; running: boolean;
}) {
  const [view, setView] = useState('all');
  const [page, setPage] = useState(1);
  const rows = useMemo(() => messages.filter(m => {
    if (m.userId !== user.userId) return false;
    const entry = entries[m.key];
    if (view === 'all') return true;
    if (view === 'attention') return entry?.decision === 'pending' && entry.ai?.verdict !== 'clear';
    if (view === 'unreviewed') return m.kind !== 'emoticon' && !entry?.ai;
    return entry?.decision === view;
  }), [messages, user.userId, entries, view]);
  const totalPages = Math.max(1, Math.ceil(rows.length / 20));
  const currentPage = Math.min(page, totalPages);
  return <section className={styles.userHistory} aria-label="선택 아이디의 발언 이력">
    <div className={styles.tableTop}><h3>{user.nickname} <small>{user.userId}</small></h3><button onClick={onClear}>아이디 선택 해제</button></div>
    <p className={styles.reviewHelp}>닉네임 이력: {user.nicknames.filter(Boolean).join(' → ') || '(없음)'}</p>
    <p className={styles.reviewHelp}>전체 발언 {user.total}개 · AI 검수 {user.reviewed}개 · 검토 대기 {user.attention}개 · 문제 있음 {user.confirmed}개 · 문제 없음 {user.dismissed}개</p>
    <div className={styles.reviewCardActions}><button disabled={running} onClick={onScope}>이 아이디를 AI 검수 대상으로</button><button onClick={() => onSearch(user.userId)}>채팅 검색에도 이 아이디 적용</button></div>
    <div className={styles.reviewToolbar}><label>발언 이력 필터<select aria-label="아이디 발언 이력 필터" value={view} onChange={e => { setView(e.target.value); setPage(1); }}><option value="all">전체 발언</option><option value="attention">검토 대기</option><option value="unreviewed">AI 미검수</option><option value="confirmed">문제 있음</option><option value="dismissed">문제 없음</option></select></label><span>{rows.length.toLocaleString()}개</span></div>
    <div className={styles.userHistoryRows}>{rows.slice((currentPage - 1) * 20, currentPage * 20).map(m => {
      const entry = entries[m.key];
      return <article key={m.key}><div><time>{formatTime(m.seconds)}</time><b>{m.nickname}</b><span>{entry ? labels[entry.decision] : '판단 전'} · {entry?.ai ? `AI ${aiLabels[entry.ai.verdict]}` : m.kind === 'emoticon' ? '이모티콘' : 'AI 미검수'}</span></div><p>{m.message}</p>{entry?.ai && <p className={styles.reviewReason}>AI: {entry.ai.reason}</p>}{entry?.note && <p className={styles.reviewHelp}>메모: {entry.note}</p>}<button onClick={() => onContext(m.key)}>맥락 확인·판단·메모</button></article>;
    })}</div>
    {!rows.length && <p className={styles.reviewHelp}>이 조건에 맞는 발언이 없습니다.</p>}
    <div className={styles.pagination}><span>페이지당 20개 · 이 다시보기의 전체 이력</span><div><button disabled={currentPage <= 1} aria-label="아이디 발언 이전 페이지" onClick={() => setPage(currentPage - 1)}>←</button><span>{currentPage} / {totalPages}</span><button disabled={currentPage >= totalPages} aria-label="아이디 발언 다음 페이지" onClick={() => setPage(currentPage + 1)}>→</button></div></div>
  </section>;
}
