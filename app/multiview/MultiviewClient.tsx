'use client';
import { useState, useEffect, useRef } from 'react';

const BG     = '#09090F';
const CARD   = 'rgba(255,255,255,0.03)';
const BORDER = 'rgba(255,255,255,0.08)';
const A      = '#EB701A';
const MAX_STREAMS = 6;
const STORAGE_KEY = 'mv-ids';

function extractId(raw: string): string {
  let s = raw.trim();
  if (!s) return '';
  // 전체 URL을 붙여넣은 경우 아이디만 추출
  const m = s.match(/sooplive\.co\.kr\/(?:[a-zA-Z]+\.)?([a-zA-Z0-9_]+)/) || s.match(/afreecatv\.com\/([a-zA-Z0-9_]+)/);
  if (m) return m[1];
  // 마지막 슬래시 이후, 쿼리스트링 제거
  s = s.split('?')[0].split('/').filter(Boolean).pop() || s;
  return s.trim();
}

export default function MultiviewClient() {
  const [ids, setIds] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setIds(JSON.parse(saved));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch {}
  }, [ids, hydrated]);

  const addId = () => {
    const id = extractId(input);
    if (!id) return;
    if (ids.includes(id)) { setError('이미 추가된 방송이에요'); setTimeout(() => setError(''), 2000); return; }
    if (ids.length >= MAX_STREAMS) { setError(`최대 ${MAX_STREAMS}개까지만 동시 시청할 수 있어요`); setTimeout(() => setError(''), 2500); return; }
    setIds(prev => [...prev, id]);
    setInput('');
    inputRef.current?.focus();
  };

  const removeId = (id: string) => setIds(prev => prev.filter(x => x !== id));
  const clearAll = () => setIds([]);

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: 'system-ui,sans-serif' }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
        input::placeholder{color:rgba(255,255,255,0.22)}
        input:focus{outline:none}
      `}</style>

      {/* 헤더 */}
      <header style={{
        position: 'relative', overflow: 'hidden',
        padding: '40px clamp(1rem,5vw,3rem) 28px', textAlign: 'center',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(235,112,26,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <a href="/" style={{
          position: 'absolute', top: '16px', left: 'clamp(1rem,4vw,2.5rem)',
          color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem', textDecoration: 'none', fontWeight: 600,
        }}>← 홈</a>
        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: A, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '8px', opacity: 0.8 }}>SMEB</div>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem,5vw,2.8rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
          멀티<span style={{ color: A }}>뷰</span>
        </h1>
        <p style={{ marginTop: '10px', fontSize: '0.84rem', color: 'rgba(255,255,255,0.35)' }}>
          SOOP 라이브를 최대 {MAX_STREAMS}개까지 동시에 시청하세요
        </p>
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px clamp(1rem,4vw,2rem) 60px' }}>

        {/* 입력 영역 */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', gap: '8px', maxWidth: '480px', margin: '0 auto' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addId()}
              placeholder="SOOP 아이디 또는 방송 링크 입력"
              style={{
                flex: 1, background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: '12px',
                padding: '13px 16px', color: '#fff', fontSize: '0.92rem', fontWeight: 600,
              }}
            />
            <button
              onClick={addId}
              disabled={!input.trim()}
              style={{
                padding: '13px 22px', borderRadius: '12px', border: 'none', cursor: input.trim() ? 'pointer' : 'default',
                background: input.trim() ? `linear-gradient(135deg,${A},#FF6B35)` : 'rgba(255,255,255,0.06)',
                color: input.trim() ? '#fff' : 'rgba(255,255,255,0.25)', fontWeight: 800, fontSize: '0.9rem',
                flexShrink: 0, transition: 'all 0.15s',
              }}
            >
              + 추가
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '10px', minHeight: '20px' }}>
            <span style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
              {ids.length} / {MAX_STREAMS}
            </span>
            {ids.length > 0 && (
              <button onClick={clearAll} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.25)', fontSize: '0.74rem', fontWeight: 600, textDecoration: 'underline',
                fontFamily: 'inherit',
              }}>
                전체 삭제
              </button>
            )}
            {error && (
              <span style={{
                fontSize: '0.74rem', color: '#FF6B6B', fontWeight: 700, animation: 'shake 0.3s',
              }}>
                {error}
              </span>
            )}
          </div>
        </div>

        {/* 스트림 그리드 */}
        {ids.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '100px 20px', color: 'rgba(255,255,255,0.18)', gap: '14px',
          }}>
            <span style={{ fontSize: '3rem' }}>📺</span>
            <span style={{ fontSize: '0.92rem', fontWeight: 600 }}>방송 아이디를 입력해 추가해보세요</span>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '16px',
          }}>
            {ids.map((id, i) => (
              <div key={id} style={{
                background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px',
                overflow: 'hidden', animation: `fadeUp 0.25s ${i * 0.04}s both`,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 14px', borderBottom: `1px solid ${BORDER}`,
                }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {id}
                  </span>
                  <button onClick={() => removeId(id)} style={{
                    background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '6px',
                    width: '22px', height: '22px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
                    fontSize: '0.78rem', lineHeight: 1, flexShrink: 0,
                  }}>
                    ✕
                  </button>
                </div>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000' }}>
                  <iframe
                    src={`https://play.sooplive.co.kr/${id}/embed`}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                    allow="autoplay; encrypted-media; fullscreen"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
