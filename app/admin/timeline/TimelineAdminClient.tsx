'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';

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

interface VodItem {
  id: string | number;
  title: string;
  thumb: string;
  date: string;
  views: number;
  duration: number;
}

const ADMIN_PW_KEY = 'timeline_admin_pw';

function toSeconds(e: TimelineEntry) {
  return (e.h ?? 0) * 3600 + e.m * 60 + (e.s ?? 0);
}

function fmtDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function TimelineAdminClient() {
  const [pw, setPw] = useState('');
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sha, setSha] = useState('');
  const [vods, setVods] = useState<VodData[]>([]);
  const [pwInput, setPwInput] = useState('');

  // VOD browser state
  const [vodList, setVodList] = useState<VodItem[]>([]);
  const [vodListLoading, setVodListLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedVod, setSelectedVod] = useState<VodItem | null>(null);

  // New entry form
  const [newH, setNewH] = useState('');
  const [newM, setNewM] = useState('');
  const [newS, setNewS] = useState('');
  const [newLabel, setNewLabel] = useState('');

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
    } catch {
      setError('네트워크 오류'); setLoading(false); return false;
    }
  }, []);

  const loadVodList = useCallback(async () => {
    setVodListLoading(true);
    try {
      const res = await fetch('/api/soop');
      const json = await res.json();
      if (json.vods) setVodList(json.vods.map((v: VodItem) => ({ ...v, id: String(v.id) })));
    } catch {
      // silently fail — VOD list is non-critical
    }
    setVodListLoading(false);
  }, []);

  useEffect(() => {
    if (authed) { loadVodList(); }
  }, [authed, loadVodList]);

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
    } catch {
      setError('네트워크 오류');
    }
    setLoading(false);
  };

  const ensureVod = (vodId: string) => {
    setVods(prev => {
      if (prev.find(v => v.id === vodId)) return prev;
      return [...prev, { id: vodId, entries: [] }];
    });
  };

  const addEntry = () => {
    if (!selectedVod) return;
    const label = newLabel.trim();
    if (!label) return;
    const m = parseInt(newM || '0', 10);
    if (isNaN(m)) return;
    const h = newH !== '' ? parseInt(newH, 10) : undefined;
    const s = newS !== '' ? parseInt(newS, 10) : undefined;
    const entry: TimelineEntry = { label, m, ...(h !== undefined && h > 0 ? { h } : {}), ...(s !== undefined && s > 0 ? { s } : {}) };
    const id = String(selectedVod.id);
    ensureVod(id);
    setVods(prev => prev.map(v => {
      if (v.id !== id) return v;
      const updated = [...v.entries, entry].sort((a, b) => toSeconds(a) - toSeconds(b));
      return { ...v, entries: updated };
    }));
    setNewH(''); setNewM(''); setNewS(''); setNewLabel('');
  };

  const removeEntry = (vodId: string, entryIdx: number) => {
    setVods(prev => prev.map(v => v.id !== vodId ? v : {
      ...v, entries: v.entries.filter((_, ei) => ei !== entryIdx),
    }));
  };

  const updateEntry = (vodId: string, entryIdx: number, field: keyof TimelineEntry, val: string | number) => {
    setVods(prev => prev.map(v => v.id !== vodId ? v : {
      ...v,
      entries: v.entries.map((e, ei) => ei !== entryIdx ? e : { ...e, [field]: val }),
    }));
  };

  const removeVod = (vodId: string) => {
    setVods(prev => prev.filter(v => v.id !== vodId));
    if (selectedVod && String(selectedVod.id) === vodId) setSelectedVod(null);
  };

  const filteredList = useMemo(() => {
    if (!search.trim()) return vodList;
    const q = search.toLowerCase();
    return vodList.filter(v => v.title.toLowerCase().includes(q) || String(v.date).includes(q));
  }, [vodList, search]);

  const groupedList = useMemo(() => {
    const groups: { month: string; label: string; vods: VodItem[] }[] = [];
    const map = new Map<string, VodItem[]>();
    for (const vod of filteredList) {
      const month = String(vod.date).slice(0, 7); // YYYY-MM
      if (!map.has(month)) map.set(month, []);
      map.get(month)!.push(vod);
    }
    for (const [month, items] of map) {
      const [y, m] = month.split('-');
      groups.push({ month, label: `${y}년 ${parseInt(m)}월`, vods: items });
    }
    return groups;
  }, [filteredList]);

  const hasTimeline = (vodId: string) => {
    const v = vods.find(v => v.id === vodId);
    return v && v.entries.length > 0;
  };

  const selectedId = selectedVod ? String(selectedVod.id) : null;
  const selectedVodData = selectedId ? vods.find(v => v.id === selectedId) : null;

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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'var(--card)' }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>타임라인 관리</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {sha && <span style={{ fontSize: '0.68rem', color: 'var(--subtext)', fontFamily: 'monospace' }}>SHA: {sha.slice(0, 7)}</span>}
          <button onClick={save} disabled={loading} style={{ padding: '6px 16px', borderRadius: 8, background: '#EB701A', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* Status banners */}
      {error && <div style={{ background: '#3b1212', color: '#e74c3c', padding: '8px 20px', fontSize: '0.85rem', flexShrink: 0 }}>{error}</div>}
      {success && <div style={{ background: '#0d2b0d', color: '#2ecc71', padding: '8px 20px', fontSize: '0.85rem', flexShrink: 0 }}>{success}</div>}

      {/* Main two-panel layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left panel: VOD list */}
        <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
            <input
              type="text"
              placeholder="영상 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {vodListLoading && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--subtext)', fontSize: '0.85rem' }}>불러오는 중...</div>
            )}
            {!vodListLoading && filteredList.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--subtext)', fontSize: '0.85rem' }}>영상이 없습니다</div>
            )}
            {groupedList.map(group => (
              <div key={group.month}>
                {/* Month header */}
                <div style={{ padding: '8px 12px 6px', background: 'var(--card)', borderBottom: '1px solid var(--card-border)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#EB701A' }}>{group.label}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--subtext)', marginLeft: 6 }}>{group.vods.length}개</span>
                </div>
                {group.vods.map(vod => {
                  const vid = String(vod.id);
                  const isSelected = selectedId === vid;
                  const hasTL = hasTimeline(vid);
                  const day = String(vod.date).slice(8, 10);
                  const dayOfWeek = ['일','월','화','수','목','금','토'][new Date(vod.date + 'T00:00:00').getDay()];
                  return (
                    <div
                      key={vid}
                      onClick={() => setSelectedVod(vod)}
                      style={{
                        display: 'flex',
                        gap: 0,
                        cursor: 'pointer',
                        borderLeft: isSelected ? '3px solid #EB701A' : '3px solid transparent',
                        background: isSelected ? 'rgba(235,112,26,0.07)' : 'transparent',
                        borderBottom: '1px solid var(--card-border)',
                        transition: 'background 0.12s',
                        alignItems: 'stretch',
                      }}
                    >
                      {/* Date column */}
                      <div style={{ width: 44, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 0', borderRight: '1px solid var(--card-border)', gap: 1 }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, lineHeight: 1, color: isSelected ? '#EB701A' : 'var(--text)' }}>{parseInt(day)}</span>
                        <span style={{ fontSize: '0.65rem', color: dayOfWeek === '일' ? '#e74c3c' : dayOfWeek === '토' ? '#3498db' : 'var(--subtext)' }}>{dayOfWeek}</span>
                      </div>
                      {/* Thumbnail + info */}
                      <div style={{ display: 'flex', gap: 8, padding: '8px 10px', flex: 1, minWidth: 0, alignItems: 'center' }}>
                        {vod.thumb && (
                          <img
                            src={vod.thumb}
                            alt=""
                            style={{ width: 64, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0, background: '#333' }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {vod.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                            {vod.duration > 0 && <span style={{ fontSize: '0.65rem', color: 'var(--subtext)' }}>{fmtDuration(vod.duration)}</span>}
                            {hasTL && (
                              <span style={{ fontSize: '0.6rem', background: '#EB701A', color: '#fff', borderRadius: 3, padding: '1px 4px', fontWeight: 700 }}>
                                ▶ {vods.find(v => v.id === vid)?.entries.length}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: Player + editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedVod ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--subtext)', flexDirection: 'column', gap: 12 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span style={{ fontSize: '0.9rem' }}>왼쪽에서 영상을 선택하세요</span>
            </div>
          ) : (
            <>
              {/* Player */}
              <div style={{ background: '#000', flexShrink: 0 }}>
                <div style={{ position: 'relative', width: '100%', paddingBottom: '42%', maxHeight: '60vh' }}>
                  <iframe
                    key={selectedId}
                    src={`https://vod.sooplive.com/player/${selectedId}/embed?autoPlay=false&showChat=false&mutePlay=false`}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                    allowFullScreen
                  />
                </div>
              </div>

              {/* Timeline editor */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>타임라인</span>
                    <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--subtext)' }}>VOD {selectedId}</span>
                    <a href={`https://www.sooplive.com/vod/${selectedId}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8, fontSize: '0.72rem', color: '#EB701A' }}>SOOP ↗</a>
                  </div>
                  {selectedVodData && selectedVodData.entries.length > 0 && (
                    <button onClick={() => removeVod(selectedId!)} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '0.8rem' }}>
                      VOD 전체 삭제
                    </button>
                  )}
                </div>

                {/* Add entry form */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '10px 12px' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--subtext)' }}>시</label>
                  <input type="number" min={0} placeholder="0" value={newH}
                    onChange={e => setNewH(e.target.value)}
                    style={{ width: 50, padding: '5px 7px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem' }} />
                  <label style={{ fontSize: '0.72rem', color: 'var(--subtext)' }}>분</label>
                  <input type="number" min={0} max={59} placeholder="0" value={newM}
                    onChange={e => setNewM(e.target.value)}
                    style={{ width: 50, padding: '5px 7px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem' }} />
                  <label style={{ fontSize: '0.72rem', color: 'var(--subtext)' }}>초</label>
                  <input type="number" min={0} max={59} placeholder="0" value={newS}
                    onChange={e => setNewS(e.target.value)}
                    style={{ width: 50, padding: '5px 7px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem' }} />
                  <input type="text" placeholder="레이블 입력 후 Enter" value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addEntry(); }}
                    style={{ flex: 1, minWidth: 140, padding: '5px 9px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem' }} />
                  <button onClick={addEntry} style={{ padding: '5px 14px', borderRadius: 6, background: '#EB701A', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                    추가
                  </button>
                </div>

                {/* Entry list */}
                {(!selectedVodData || selectedVodData.entries.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--subtext)', fontSize: '0.85rem' }}>
                    타임라인 항목이 없습니다
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedVodData.entries.map((entry, ei) => (
                      <div key={ei} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 7, padding: '7px 10px' }}>
                        <span style={{ fontSize: '0.72rem', color: '#EB701A', fontWeight: 700, minWidth: 52, fontFamily: 'monospace' }}>
                          {(entry.h ?? 0) > 0 ? `${entry.h}:` : ''}{String(entry.m).padStart(2, '0')}:{String(entry.s ?? 0).padStart(2, '0')}
                        </span>
                        <label style={{ fontSize: '0.72rem', color: 'var(--subtext)' }}>시</label>
                        <input type="number" min={0} value={entry.h ?? ''} placeholder="0"
                          onChange={e => updateEntry(selectedId!, ei, 'h', e.target.value === '' ? undefined as any : Number(e.target.value))}
                          style={{ width: 46, padding: '4px 6px', borderRadius: 5, border: '1px solid var(--card-border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.82rem' }} />
                        <label style={{ fontSize: '0.72rem', color: 'var(--subtext)' }}>분</label>
                        <input type="number" min={0} max={59} value={entry.m}
                          onChange={e => updateEntry(selectedId!, ei, 'm', Number(e.target.value))}
                          style={{ width: 46, padding: '4px 6px', borderRadius: 5, border: '1px solid var(--card-border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.82rem' }} />
                        <label style={{ fontSize: '0.72rem', color: 'var(--subtext)' }}>초</label>
                        <input type="number" min={0} max={59} value={entry.s ?? ''} placeholder="0"
                          onChange={e => updateEntry(selectedId!, ei, 's', e.target.value === '' ? undefined as any : Number(e.target.value))}
                          style={{ width: 46, padding: '4px 6px', borderRadius: 5, border: '1px solid var(--card-border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.82rem' }} />
                        <input type="text" value={entry.label}
                          onChange={e => updateEntry(selectedId!, ei, 'label', e.target.value)}
                          style={{ flex: 1, minWidth: 120, padding: '4px 8px', borderRadius: 5, border: '1px solid var(--card-border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.82rem' }} />
                        <button onClick={() => removeEntry(selectedId!, ei)} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: '0 4px' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
