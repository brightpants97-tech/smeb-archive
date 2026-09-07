'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const ORANGE = '#EB701A';

interface StreamerEntry {
  fcNickname: string;
  displayName: string;
  teamColor: string;
  addedAt: number;
}

export default function AdminClient() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [streamers, setStreamers] = useState<StreamerEntry[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [fcNickname, setFcNickname] = useState('');
  const [teamColor, setTeamColor] = useState('#E0A62F');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('fc_admin_pw');
    if (saved) {
      setPassword(saved);
      verify(saved);
    }
  }, []);

  const verify = async (pw: string) => {
    setChecking(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/fconline/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || '로그인에 실패했어요.');
        sessionStorage.removeItem('fc_admin_pw');
      } else {
        setAuthed(true);
        sessionStorage.setItem('fc_admin_pw', pw);
        loadStreamers();
      }
    } catch {
      setAuthError('로그인 중 문제가 생겼어요.');
    } finally {
      setChecking(false);
    }
  };

  const loadStreamers = async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/fconline/streamers');
      const data = await res.json();
      setStreamers(data.streamers || []);
    } finally {
      setLoadingList(false);
    }
  };

  const submitAdd = async () => {
    if (!displayName.trim() || !fcNickname.trim()) {
      setFormError('스트리머명과 FC 온라인 닉네임을 모두 입력해주세요.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch('/api/fconline/streamers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ displayName: displayName.trim(), fcNickname: fcNickname.trim(), teamColor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || '등록에 실패했어요.');
      } else {
        setDisplayName('');
        setFcNickname('');
        setTeamColor('#E0A62F');
        loadStreamers();
      }
    } catch {
      setFormError('등록 중 문제가 생겼어요.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (nick: string) => {
    if (!confirm(`'${nick}' 등록을 삭제할까요?`)) return;
    try {
      await fetch(`/api/fconline/streamers?fcNickname=${encodeURIComponent(nick)}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': password },
      });
      loadStreamers();
    } catch {}
  };

  if (!authed) {
    return (
      <main style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Pretendard', system-ui, sans-serif" }}>
        <div style={{ width: '320px' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: ORANGE, marginBottom: '8px' }}>ADMIN</p>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '20px', color: '#111' }}>스트리머 관리 로그인</h1>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') verify(password); }}
            placeholder="비밀번호"
            style={{
              width: '100%', padding: '12px 16px', borderRadius: '10px',
              border: '1px solid #ddd', fontSize: '0.9rem', marginBottom: '10px',
              outline: 'none', boxSizing: 'border-box' as const,
            }}
          />
          {authError && <p style={{ color: '#e05252', fontSize: '0.8rem', marginBottom: '10px' }}>{authError}</p>}
          <button
            onClick={() => verify(password)}
            disabled={checking || !password}
            style={{
              width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              background: ORANGE, color: '#fff', fontWeight: 700, cursor: 'pointer',
              opacity: checking || !password ? 0.6 : 1,
            }}
          >{checking ? '확인 중...' : '로그인'}</button>
          <Link href="/fc-record" style={{ display: 'block', marginTop: '16px', fontSize: '0.8rem', color: '#999', textAlign: 'center' as const }}>← 전적 페이지로</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#fff', padding: 'clamp(32px,6vw,64px) clamp(1.5rem,6vw,5rem)', fontFamily: "'Pretendard', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <Link href="/fc-record" style={{ fontSize: '0.8rem', color: '#999', textDecoration: 'none' }}>← 전적 페이지로</Link>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: '10px 0 24px', color: '#111' }}>스트리머 관리</h1>

        {/* 등록 폼 */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', padding: '20px', borderRadius: '14px', border: '1px solid #eee', marginBottom: '28px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const }}>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="스트리머명 (예: 임유진)"
              style={{ flex: '1 1 160px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.88rem' }} />
            <input value={fcNickname} onChange={e => setFcNickname(e.target.value)} placeholder="FC 온라인 닉네임"
              style={{ flex: '1 1 160px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.88rem' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="color" value={teamColor} onChange={e => setTeamColor(e.target.value)}
                style={{ width: '40px', height: '38px', border: '1px solid #ddd', borderRadius: '8px', padding: '2px', cursor: 'pointer' }} />
              <span style={{ fontSize: '0.78rem', color: '#888' }}>메인 팀컬러</span>
            </div>
          </div>
          {formError && <p style={{ color: '#e05252', fontSize: '0.8rem', margin: 0 }}>{formError}</p>}
          <button onClick={submitAdd} disabled={saving} style={{
            alignSelf: 'flex-start', padding: '10px 20px', borderRadius: '8px', border: 'none',
            background: ORANGE, color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
            opacity: saving ? 0.6 : 1,
          }}>{saving ? '등록 중...' : '+ 등록'}</button>
        </div>

        {/* 목록 */}
        <p style={{ fontSize: '0.8rem', color: '#999', marginBottom: '12px' }}>등록된 스트리머 {streamers.length}명</p>
        {loadingList ? (
          <p style={{ color: '#999', fontSize: '0.85rem' }}>불러오는 중...</p>
        ) : streamers.length === 0 ? (
          <p style={{ color: '#999', fontSize: '0.85rem' }}>등록된 스트리머가 없어요.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
            {streamers.map(s => (
              <div key={s.fcNickname} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                borderRadius: '10px', border: '1px solid #eee',
              }}>
                <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: s.teamColor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#111' }}>{s.displayName}</p>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: '#999' }}>{s.fcNickname}</p>
                </div>
                <button onClick={() => remove(s.fcNickname)} style={{
                  padding: '6px 12px', borderRadius: '8px', border: '1px solid #f0c0c0',
                  background: '#fff5f5', color: '#e05252', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                }}>삭제</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
