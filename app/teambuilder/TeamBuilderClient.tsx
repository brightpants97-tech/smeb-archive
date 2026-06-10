'use client';
import { useState, useEffect } from 'react';

const ACCENT = '#EB701A';
const POSITIONS = ['탑', '정글', '미드', '원딜', '서포터'];
const POS_EMOJI = ['🛡️', '🌿', '⚡', '🏹', '💊'];

interface PositionRow { pos: string; names: [string, string]; }

const defaultRows = (): PositionRow[] =>
  POSITIONS.map(pos => ({ pos, names: ['', ''] }));

interface TeamResult { pos: string; A: string; B: string; }

export default function TeamBuilderClient() {
  const [rows, setRows]       = useState<PositionRow[]>(defaultRows());
  const [result, setResult]   = useState<TeamResult[] | null>(null);
  const [rolling, setRolling] = useState(false);
  const [showResult, setShowResult] = useState(false);

  /* 저장/로드 */
  useEffect(() => {
    (async () => {
      try {
        const r = await (window as any).storage?.get('tb-names');
        if (r?.value) setRows(JSON.parse(r.value));
      } catch {}
    })();
  }, []);

  const save = (data: PositionRow[]) => {
    try { (window as any).storage?.set('tb-names', JSON.stringify(data)); } catch {}
  };

  const update = (i: number, side: 0 | 1, val: string) => {
    const next = rows.map((r, idx) =>
      idx === i ? { ...r, names: [side === 0 ? val : r.names[0], side === 1 ? val : r.names[1]] as [string,string] } : r
    );
    setRows(next); save(next);
  };

  const reset = () => { const d = defaultRows(); setRows(d); save(d); setResult(null); setShowResult(false); };

  /* 랜덤 배정 */
  const randomize = () => {
    const filled = rows.filter(r => r.names[0].trim() && r.names[1].trim());
    if (filled.length === 0) return;
    setRolling(true); setShowResult(false); setResult(null);

    let count = 0;
    const interval = setInterval(() => {
      const fake: TeamResult[] = rows.map(r => {
        const [a, b] = Math.random() > 0.5 ? [r.names[0], r.names[1]] : [r.names[1], r.names[0]];
        return { pos: r.pos, A: a || '?', B: b || '?' };
      });
      setResult(fake);
      count++;
      if (count > 14) {
        clearInterval(interval);
        // 최종 결과
        const final: TeamResult[] = rows.map(r => {
          const swap = Math.random() > 0.5;
          return { pos: r.pos, A: swap ? r.names[1] : r.names[0], B: swap ? r.names[0] : r.names[1] };
        });
        setResult(final);
        setRolling(false);
        setShowResult(true);
      }
    }, 80);
  };

  const allFilled = rows.every(r => r.names[0].trim() && r.names[1].trim());

  return (
    <div style={{ background: '#0b0b0b', minHeight: '100vh', color: '#fff', fontFamily: 'system-ui,sans-serif' }}>

      {/* 헤더 */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '16px clamp(1rem,4vw,2.5rem)', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <a href="/" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 600 }}>← 홈</a>
        <span style={{ color: 'rgba(255,255,255,0.12)' }}>|</span>
        <span style={{ fontWeight: 900, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>⚔️ 팀빌더</span>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '36px clamp(1rem,4vw,2rem)' }}>

        {/* 타이틀 */}
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.1, margin: 0 }}>
            각 라인에 이름을 넣으면<br />
            <em style={{ color: ACCENT, fontStyle: 'italic' }}>팀을 랜덤으로</em> 짜드립니다
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.88rem', marginTop: '10px' }}>
            라인별로 두 명씩 입력 → 버튼 클릭
          </p>
        </div>

        {/* 입력 테이블 */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', overflow: 'hidden', marginBottom: '20px' }}>
          {/* 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 20px' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>라인</span>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: ACCENT, letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center' }}>참가자 1</span>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#6090ff', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center' }}>참가자 2</span>
          </div>

          {rows.map((row, i) => (
            <div key={row.pos} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', alignItems: 'center', gap: '10px', padding: '10px 20px', borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '1rem' }}>{POS_EMOJI[i]}</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>{row.pos}</span>
              </div>
              {[0, 1].map(side => (
                <input key={side}
                  value={row.names[side as 0|1]}
                  onChange={e => update(i, side as 0|1, e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && allFilled && randomize()}
                  placeholder="이름 입력"
                  style={{
                    background: row.names[side as 0|1] ? `rgba(${side === 0 ? '235,112,26' : '96,144,255'},0.08)` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${row.names[side as 0|1] ? `rgba(${side === 0 ? '235,112,26' : '96,144,255'},0.25)` : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: '10px', padding: '9px 12px', color: '#fff', fontSize: '0.88rem',
                    outline: 'none', width: '100%', boxSizing: 'border-box', transition: 'all 0.15s',
                    fontWeight: row.names[side as 0|1] ? 700 : 400,
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '32px' }}>
          <button
            onClick={randomize}
            disabled={rolling}
            style={{
              flex: 1, padding: '16px', borderRadius: '14px', border: 'none', cursor: rolling ? 'wait' : allFilled ? 'pointer' : 'default',
              background: allFilled ? `linear-gradient(135deg, ${ACCENT}, #ff8c3a)` : 'rgba(255,255,255,0.06)',
              color: allFilled ? '#fff' : 'rgba(255,255,255,0.25)',
              fontSize: '1.05rem', fontWeight: 900, letterSpacing: '-0.02em',
              boxShadow: allFilled ? '0 4px 20px rgba(235,112,26,0.4)' : 'none',
              transition: 'all 0.2s',
            }}>
            {rolling ? '🎲 배정 중...' : '🎲 랜덤으로 팀 짜기'}
          </button>
          <button onClick={reset} style={{ padding: '16px 18px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
            초기화
          </button>
        </div>

        {/* 결과 */}
        {result && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', animation: showResult ? 'fadeUp 0.4s both' : 'none' }}>
            {(['A', 'B'] as const).map((team, ti) => (
              <div key={team} style={{
                background: ti === 0 ? 'rgba(235,112,26,0.06)' : 'rgba(96,144,255,0.06)',
                border: `1.5px solid ${ti === 0 ? 'rgba(235,112,26,0.3)' : 'rgba(96,144,255,0.3)'}`,
                borderRadius: '16px', padding: '16px 18px',
                filter: rolling ? 'blur(1px)' : 'none', transition: 'filter 0.1s',
              }}>
                <div style={{ fontWeight: 900, fontSize: '1rem', color: ti === 0 ? ACCENT : '#6090ff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  팀 {team}
                  {showResult && <span style={{ fontSize: '0.6rem', background: ti === 0 ? ACCENT : '#6090ff', color: '#fff', padding: '2px 7px', borderRadius: '100px' }}>확정</span>}
                </div>
                {result.map((r, i) => (
                  <div key={r.pos} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.9rem', width: '20px', textAlign: 'center', flexShrink: 0 }}>{POS_EMOJI[i]}</span>
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', width: '32px', flexShrink: 0 }}>{r.pos}</span>
                    <span style={{
                      fontSize: '0.92rem', fontWeight: 800,
                      color: (ti === 0 ? r.A : r.B) === '' || (ti === 0 ? r.A : r.B) === '?' ? 'rgba(255,255,255,0.2)' : '#fff',
                    }}>
                      {ti === 0 ? r.A || '-' : r.B || '-'}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {showResult && (
          <button onClick={randomize} style={{ width: '100%', marginTop: '14px', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
            🔄 다시 뽑기
          </button>
        )}
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        input::placeholder { color: rgba(255,255,255,0.2); }
        input:focus { border-color: rgba(235,112,26,0.4) !important; }
      `}</style>
    </div>
  );
}
