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
const labels = { pending: '��Ȯ��', confirmed: '���� ����', dismissed: '���� ����' };
const aiLabels = { review: '���� �ʿ�', uncertain: '�ƶ� ����', clear: '���� ����' };

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
  return <section className={styles.reviewUsers} aria-label="���̵� �˼�">
    <div className={styles.reviewHeading}><div><h3>���̵� �˼�</h3><p>���� ��� �߾��� ���� �����Դϴ�. AI �ǰ߰� ���� ���� �Ǵ��� ������ Ȯ���ϼ���.</p></div><span>{users.length.toLocaleString()}��</span></div>
    <input className={styles.userReviewSearch} aria-label="�˼� ����� �˻�" placeholder="���̵� �Ǵ� ���� �г��� �˻�" value={query} onChange={e => { setQuery(e.target.value); setUserPage(1); }} />
    <div className={styles.reviewUserList}>{found.slice((page - 1) * 10, page * 10).map(u => <button key={u.userId} aria-pressed={selectedId === u.userId} onClick={() => onSelect(selectedId === u.userId ? '' : u.userId)}><span><b>{u.nickname || '(�г��� ����)'}</b><small>{u.userId}</small></span><span>��ü {u.total} �� AI �˼� {u.reviewed}<small>���� ��� {u.attention} �� ���� ���� {u.confirmed} �� ���� ���� {u.dismissed}</small></span></button>)}</div>
    {!found.length && <p className={styles.reviewHelp}>��ġ�ϴ� ���̵� �����ϴ�.</p>}
    <div className={styles.pagination}><span>�˻� {found.length.toLocaleString()}��</span><div><button disabled={page <= 1} aria-label="����� ���� ������" onClick={() => setUserPage(page - 1)}>��</button><span>{page} / {totalPages}</span><button disabled={page >= totalPages} aria-label="����� ���� ������" onClick={() => setUserPage(page + 1)}>��</button></div></div>
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
  return <section className={styles.userHistory} aria-label="���� ���̵��� �߾� �̷�">
    <div className={styles.tableTop}><h3>{user.nickname} <small>{user.userId}</small></h3><button onClick={onClear}>���̵� ���� ����</button></div>
    <p className={styles.reviewHelp}>�г��� �̷�: {user.nicknames.filter(Boolean).join(' �� ') || '(����)'}</p>
    <p className={styles.reviewHelp}>��ü �߾� {user.total}�� �� AI �˼� {user.reviewed}�� �� ���� ��� {user.attention}�� �� ���� ���� {user.confirmed}�� �� ���� ���� {user.dismissed}��</p>
    <div className={styles.reviewCardActions}><button disabled={running} onClick={onScope}>�� ���̵� AI �˼� �������</button><button onClick={() => onSearch(user.userId)}>ä�� �˻����� �� ���̵� ����</button></div>
    <div className={styles.reviewToolbar}><label>�߾� �̷� ����<select aria-label="���̵� �߾� �̷� ����" value={view} onChange={e => { setView(e.target.value); setPage(1); }}><option value="all">��ü �߾�</option><option value="attention">���� ���</option><option value="unreviewed">AI �̰˼�</option><option value="confirmed">���� ����</option><option value="dismissed">���� ����</option></select></label><span>{rows.length.toLocaleString()}��</span></div>
    <div className={styles.userHistoryRows}>{rows.slice((currentPage - 1) * 20, currentPage * 20).map(m => {
      const entry = entries[m.key];
      return <article key={m.key}><div><time>{formatTime(m.seconds)}</time><b>{m.nickname}</b><span>{entry ? labels[entry.decision] : '�Ǵ� ��'} �� {entry?.ai ? `AI ${aiLabels[entry.ai.verdict]}` : m.kind === 'emoticon' ? '�̸�Ƽ��' : 'AI �̰˼�'}</span></div><p>{m.message}</p>{entry?.ai && <p className={styles.reviewReason}>AI: {entry.ai.reason}</p>}{entry?.note && <p className={styles.reviewHelp}>�޸�: {entry.note}</p>}<button onClick={() => onContext(m.key)}>�ƶ� Ȯ�Ρ��Ǵܡ��޸�</button></article>;
    })}</div>
    {!rows.length && <p className={styles.reviewHelp}>�� ���ǿ� �´� �߾��� �����ϴ�.</p>}
    <div className={styles.pagination}><span>�������� 20�� �� �� �ٽú����� ��ü �̷�</span><div><button disabled={currentPage <= 1} aria-label="���̵� �߾� ���� ������" onClick={() => setPage(currentPage - 1)}>��</button><span>{currentPage} / {totalPages}</span><button disabled={currentPage >= totalPages} aria-label="���̵� �߾� ���� ������" onClick={() => setPage(currentPage + 1)}>��</button></div></div>
  </section>;
}
