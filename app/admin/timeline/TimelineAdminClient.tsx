'use client';
import { useState, useEffect, useCallback } from 'react';

interface TimelineEntry {
  label: string;
  h?: number;
  m: number;
  s?: number;
}

interface VodData {
  id: string;
  entries: TimelineEntry[];
}

const ADMIN_PW_KEY = 'timeline_admin_pw';

export default function TimelineAdminClient() {
  const [pw, setPw] = useState('');
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sha, setSha] = useState('');
  const [vods, setVods] = useState<VodData[]>([]);
  const [pwInput, setPwInput] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_PW_KEY);
    if (saved) { setPw(saved); setAuthed(true); }
  }, []);

  const load = useCallback(async (password: string) => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/timeline', {
        headers: { 'x-admin-password': password },
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || '불러오기 실패'); setLoading(false); return false; }
      setSha(json.sha);
      const data: Record<string, TimelineEntry[]> = json.data;
      const list: VodData[] = Object.entries(data)
        .filter(([k]) => !k.startsWith('_'))
        .map(([id, entries]) => ({ id, entries: Array.isArray(entries) ? entries : [] }));
      setVods(list);
      setLoading(false);
      return true;
    } catch (e) {
      setError('네트워크 오류'); setLoading(false); return false;
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await load(pwInput);
    if (ok) {
      setPw(pwInput);
      sessionStorage.setItem(ADMIN_PW_KEY, pwInput);
      setAuthed(true);
    } else {
      setError('비밀번호가 틀렸거나 서버 오류입니다.');
    }
  };

  const save = async () => {
    setLoading(true); setError(''); setSuccess('');
    const data: Record<string, TimelineEntry[]> = {
      _guide: 'VOD ID key. SOOP replay URL last number is VOD ID.' as any,
    };
    vods.forEach(v => { data[v.id] = v.entries; });
    try {
      const res = await fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
        body: JSON.stringify({ data, sha }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || '저장 실패'); setLoading(false); return; }
      setSha(json.sha);
      setSuccess('저장됐어요! Vercel이 재배포 중입니다 (약 1-2분 소요)');
    } catch (e) {
      setError('네트워크 오류');
    }
    setLoading(false);
  };

  const addVod = () => {
    const id = prompt('SOOP VOD ID를 입력하세요 (URL 마지막 숫자):');
    if (!id || !id.trim()) return;
    if (vods.find(v => v.id === id.trim())) { alert('이미 있는 VOD ID입니다.'); return; }
    setVods(prev => [...prev, { id: id.trim(), entries: [] }]);
  };

  const removeVod = (idx: number) => {
    if (!confirm('이 VOD를 삭제할까요?')) return;
    setVods(prev => prev.filter((_, i) => i !== idx));
  };

  const addEntry = (vodIdx: number) => {
    setVods(prev => prev.map((v, i) => i !== vodIdx ? v : {
      ...v, entries: [...v.entries, { label: '', m: 0 }],
    }));
  };

  const removeEntry = (vodIdx: number, entryIdx: number) => {
    setVods(prev => prev.map((v, i) => i !== vodIdx ? v : {
      ...v, entries: v.entries.filter((_, ei) => ei !== entryIdx),
    }));
  };

  const updateEntry = (vodIdx: number, entryIdx: number, field: keyof TimelineEntry, val: string | number) => {
    setVods(prev => prev.map((v, i) => i !== vodIdx ? v : {
      ...v,
      entries: v.entries.map((e, ei) => ei !== entryIdx ? e : { ...e, [field]: val }),
    }));
  };

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <form onSubmit={handleLogin} style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '32px 36px', minWidth: 320 }}>
          <h2 style={{ color: 'var(--text)', marginBottom: 20, fontSize: '1.2rem' }}>타임라인 관리자</h2>
          <input
            type="password"
            placeholder="비밀번호"
            value={pwInput}
            onChange={e => setPwInput(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '1rem', marginBottom: 12, boxSizing: 'border-box' }}
          />
          {error && <p style={{ color: '#e74c3c', fontSize: '0.85rem', marginBottom: 8 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#EB701A', color: '#fff', border: 'none', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
            {loading ? '확인 중...' : '로그인'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 16px', color: 'var(--text)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>타임라인 관리</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {sha && <span style={{ fontSize: '0.7rem', color: 'var(--subtext)', fontFamily: 'monospace' }}>SHA: {sha.slice(0, 7)}</span>}
          <button onClick={addVod} style={{ padding: '7px 16px', borderRadius: 8, background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text)', cursor: 'pointer', fontSize: '0.9rem' }}>+ VOD 추가</button>
          <button onClick={save} disabled={loading} style={{ padding: '7px 18px', borderRadius: 8, background: '#EB701A', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {error && <div style={{ background: '#3b1212', color: '#e74c3c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.88rem' }}>{error}</div>}
      {success && <div style={{ background: '#0d2b0d', color: '#2ecc71', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.88rem' }}>{success}</div>}

      {vods.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--subtext)' }}>
          <p>타임라인이 없습니다. "+ VOD 추가" 버튼으로 추가하세요.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {vods.map((vod, vi) => (
          <div key={vi} style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: '1rem' }}>VOD ID: {vod.id}</span>
                <a href={`https://sooplive.com/vod/${vod.id}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 10, fontSize: '0.75rem', color: '#EB701A' }}>SOOP에서 보기 ↗</a>
              </div>
              <button onClick={() => removeVod(vi)} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '0.85rem' }}>삭제</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {vod.entries.map((entry, ei) => (
                <div key={ei} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--subtext)', minWidth: 14 }}>시</label>
                  <input type="number" min={0} value={entry.h ?? ''} placeholder="0"
                    onChange={e => updateEntry(vi, ei, 'h', e.target.value === '' ? undefined as any : Number(e.target.value))}
                    style={{ width: 52, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem' }} />
                  <label style={{ fontSize: '0.75rem', color: 'var(--subtext)' }}>분</label>
                  <input type="number" min={0} max={59} value={entry.m} required
                    onChange={e => updateEntry(vi, ei, 'm', Number(e.target.value))}
                    style={{ width: 52, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem' }} />
                  <label style={{ fontSize: '0.75rem', color: 'var(--subtext)' }}>초</label>
                  <input type="number" min={0} max={59} value={entry.s ?? ''} placeholder="0"
                    onChange={e => updateEntry(vi, ei, 's', e.target.value === '' ? undefined as any : Number(e.target.value))}
                    style={{ width: 52, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem' }} />
                  <input type="text" value={entry.label} placeholder="타임라인 레이블" required
                    onChange={e => updateEntry(vi, ei, 'label', e.target.value)}
                    style={{ flex: 1, minWidth: 120, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem' }} />
                  <button onClick={() => removeEntry(vi, ei)} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: '0 4px' }}>×</button>
                </div>
              ))}
            </div>

            <button onClick={() => addEntry(vi)} style={{ marginTop: 10, padding: '6px 14px', borderRadius: 7, background: 'transparent', border: '1px dashed var(--card-border)', color: 'var(--subtext)', cursor: 'pointer', fontSize: '0.82rem' }}>
              + 타임라인 항목 추가
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
