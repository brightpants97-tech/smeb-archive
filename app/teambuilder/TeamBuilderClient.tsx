'use client';
import { useState, useEffect, useRef } from 'react';

/* ── 팔레트 ── */
const A_COLOR = '#EB701A';
const B_COLOR = '#4A7FE8';
const BG      = '#09090F';
const CARD_BG = 'rgba(255,255,255,0.03)';
const BORDER  = 'rgba(255,255,255,0.08)';

const POSITIONS = ['탑','정글','미드','원딜','서포터'];
const POS_ICON  = ['🛡️','🌿','⚡','🏹','💊'];
const POS_COLOR = ['#7B61FF','#2ECC71','#F39C12','#3498DB','#E74C3C'];

interface TeamResult { pos:string; A:string; B:string; emoji:string; }

const blank = (): [string,string][] => POSITIONS.map(() => ['','']);

export default function TeamBuilderClient() {
  const [names, setNames]     = useState<[string,string][]>(blank());
  const [result, setResult]   = useState<TeamResult[]|null>(null);
  const [rolling, setRolling] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await (window as any).storage?.get('tb2-names');
        if (r?.value) setNames(JSON.parse(r.value));
      } catch {}
    })();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const save = (d:[string,string][]) => {
    try { (window as any).storage?.set('tb2-names', JSON.stringify(d)); } catch {}
  };

  const setName = (row:number, side:0|1, val:string) => {
    const n = names.map((pair,i) => i===row ? (side===0?[val,pair[1]]:[pair[0],val]) as [string,string] : pair);
    setNames(n); save(n);
  };

  const allFilled = names.every(([a,b]) => a.trim() && b.trim());

  const roll = () => {
    if (!allFilled || rolling) return;
    setRolling(true); setRevealed(false); setResult(null);

    let tick = 0;
    timerRef.current = setInterval(() => {
      const fake = POSITIONS.map((pos,i) => {
        const swap = Math.random() > 0.5;
        return { pos, emoji: POS_ICON[i], A: swap ? names[i][1] : names[i][0], B: swap ? names[i][0] : names[i][1] };
      });
      setResult(fake);
      tick++;
      if (tick >= 16) {
        clearInterval(timerRef.current!);
        const final = POSITIONS.map((pos,i) => {
          const swap = Math.random() > 0.5;
          return { pos, emoji: POS_ICON[i], A: swap ? names[i][1] : names[i][0], B: swap ? names[i][0] : names[i][1] };
        });
        setResult(final);
        setRolling(false);
        setTimeout(() => setRevealed(true), 60);
      }
    }, 75);
  };

  const reset = () => { setNames(blank()); save(blank()); setResult(null); setRevealed(false); };

  return (
    <div style={{ background: BG, minHeight:'100vh', color:'#fff', fontFamily:"'Pretendard','Apple SD Gothic Neo',system-ui,sans-serif", overflowX:'hidden' }}>
      <style>{`
        @keyframes slideInL { from { opacity:0; transform:translateX(-32px); } to { opacity:1; transform:translateX(0); } }
        @keyframes slideInR { from { opacity:0; transform:translateX(32px);  } to { opacity:1; transform:translateX(0); } }
        @keyframes popIn    { from { opacity:0; transform:scale(0.88); }       to { opacity:1; transform:scale(1); } }
        @keyframes shimmer  { 0%,100%{opacity:0.6;} 50%{opacity:1;} }
        @keyframes pulse    { 0%,100%{box-shadow:0 0 0 0 rgba(235,112,26,0.4);} 50%{box-shadow:0 0 0 12px rgba(235,112,26,0);} }
        input::placeholder { color:rgba(255,255,255,0.18); }
        input:focus { outline:none; }
        .row-card:focus-within { border-color:rgba(255,255,255,0.18) !important; }
      `}</style>

      {/* 헤더 */}
      <header style={{ position:'relative', overflow:'hidden', padding:'48px clamp(1rem,5vw,3rem) 40px', textAlign:'center', borderBottom:`1px solid ${BORDER}` }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(235,112,26,0.12) 0%, transparent 70%)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:'1px', height:'100%', background:'linear-gradient(to bottom, rgba(235,112,26,0.3), transparent)', pointerEvents:'none' }}/>
        <a href="/" style={{ position:'absolute', top:'18px', left:'clamp(1rem,4vw,2.5rem)', color:'rgba(255,255,255,0.3)', fontSize:'0.78rem', textDecoration:'none', fontWeight:600, letterSpacing:'0.05em' }}>← 홈</a>
        <div style={{ fontSize:'0.65rem', fontWeight:700, color:A_COLOR, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:'10px', opacity:0.8 }}>SMEB 멸망전</div>
        <h1 style={{ margin:0, fontSize:'clamp(2rem,5vw,3.2rem)', fontWeight:900, letterSpacing:'-0.04em', lineHeight:1 }}>
          팀 <span style={{ color:A_COLOR }}>빌</span>더
        </h1>
        <p style={{ color:'rgba(255,255,255,0.35)', fontSize:'0.88rem', marginTop:'10px', letterSpacing:'-0.01em' }}>각 라인에 이름을 넣고 뽑기</p>
      </header>

      <main style={{ maxWidth:'680px', margin:'0 auto', padding:'36px clamp(1rem,4vw,2rem) 80px' }}>

        {/* 입력 카드들 */}
        <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'28px' }}>
          {POSITIONS.map((pos, i) => (
            <div key={pos} className="row-card" style={{ display:'grid', gridTemplateColumns:'1fr 44px 1fr', alignItems:'center', gap:'0', background:CARD_BG, border:`1px solid ${BORDER}`, borderRadius:'14px', overflow:'hidden', transition:'border-color 0.2s' }}>
              {/* 왼쪽 입력 */}
              <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                <span style={{ position:'absolute', left:'14px', fontSize:'0.68rem', fontWeight:800, color: names[i][0] ? A_COLOR : 'rgba(255,255,255,0.2)', letterSpacing:'0.05em', pointerEvents:'none', transition:'color 0.15s' }}>A</span>
                <input
                  value={names[i][0]}
                  onChange={e => setName(i, 0, e.target.value)}
                  onKeyDown={e => e.key==='Enter' && allFilled && roll()}
                  placeholder="이름"
                  style={{ width:'100%', background:'transparent', border:'none', padding:'15px 14px 15px 28px', color:'#fff', fontSize:'0.95rem', fontWeight:700, textAlign:'left' }}
                />
              </div>

              {/* 중앙 VS 배지 */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'2px', borderLeft:`1px solid ${BORDER}`, borderRight:`1px solid ${BORDER}`, height:'100%', padding:'8px 0', background:'rgba(255,255,255,0.015)' }}>
                <span style={{ fontSize:'1rem', lineHeight:1 }}>{POS_ICON[i]}</span>
                <span style={{ fontSize:'0.5rem', fontWeight:900, color:'rgba(255,255,255,0.2)', letterSpacing:'0.08em', textTransform:'uppercase' }}>{pos}</span>
              </div>

              {/* 오른쪽 입력 */}
              <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                <input
                  value={names[i][1]}
                  onChange={e => setName(i, 1, e.target.value)}
                  onKeyDown={e => e.key==='Enter' && allFilled && roll()}
                  placeholder="이름"
                  style={{ width:'100%', background:'transparent', border:'none', padding:'15px 28px 15px 14px', color:'#fff', fontSize:'0.95rem', fontWeight:700, textAlign:'right' }}
                />
                <span style={{ position:'absolute', right:'14px', fontSize:'0.68rem', fontWeight:800, color: names[i][1] ? B_COLOR : 'rgba(255,255,255,0.2)', letterSpacing:'0.05em', pointerEvents:'none', transition:'color 0.15s' }}>B</span>
              </div>
            </div>
          ))}
        </div>

        {/* 버튼 영역 */}
        <div style={{ display:'flex', gap:'10px', marginBottom:'40px' }}>
          <button
            onClick={roll}
            disabled={!allFilled || rolling}
            style={{
              flex:1, padding:'17px 24px', borderRadius:'14px', border:'none',
              background: allFilled ? `linear-gradient(135deg, ${A_COLOR} 0%, #FF6B35 50%, ${A_COLOR} 100%)` : 'rgba(255,255,255,0.06)',
              backgroundSize: allFilled ? '200% auto' : undefined,
              color: allFilled ? '#fff' : 'rgba(255,255,255,0.2)',
              fontSize:'1.05rem', fontWeight:900, letterSpacing:'-0.02em',
              cursor: allFilled && !rolling ? 'pointer' : 'default',
              animation: allFilled && !rolling ? 'pulse 2s infinite' : 'none',
              transition:'all 0.2s',
              position:'relative', overflow:'hidden',
            }}>
            {rolling ? (
              <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', animation:'shimmer 0.4s infinite' }}>
                🎲 배정 중...
              </span>
            ) : '⚔️  랜덤으로 팀 짜기'}
          </button>
          <button onClick={reset} style={{ padding:'17px 16px', borderRadius:'14px', border:`1px solid ${BORDER}`, background:'none', color:'rgba(255,255,255,0.25)', fontSize:'0.82rem', fontWeight:700, cursor:'pointer', transition:'color 0.15s, border-color 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#fff'; (e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.25)'; (e.currentTarget as HTMLElement).style.borderColor=BORDER; }}>
            초기화
          </button>
        </div>

        {/* 결과 */}
        {result && (
          <div>
            {/* 구분선 */}
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
              <div style={{ flex:1, height:'1px', background:`linear-gradient(to right, transparent, ${BORDER})` }}/>
              <span style={{ fontSize:'0.65rem', fontWeight:700, color:'rgba(255,255,255,0.25)', letterSpacing:'0.15em', textTransform:'uppercase' }}>{revealed ? '결과 확정' : '배정 중'}</span>
              <div style={{ flex:1, height:'1px', background:`linear-gradient(to left, transparent, ${BORDER})` }}/>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              {(['A','B'] as const).map((team, ti) => {
                const color = ti === 0 ? A_COLOR : B_COLOR;
                return (
                  <div key={team} style={{
                    background:`rgba(${ti===0?'235,112,26':'74,127,232'},0.06)`,
                    border:`1.5px solid rgba(${ti===0?'235,112,26':'74,127,232'},${revealed?'0.35':'0.15'})`,
                    borderRadius:'18px', overflow:'hidden',
                    animation: revealed ? `${ti===0?'slideInL':'slideInR'} 0.4s both` : 'none',
                    transition:'border-color 0.3s',
                  }}>
                    {/* 팀 헤더 */}
                    <div style={{ padding:'14px 18px 10px', borderBottom:`1px solid rgba(255,255,255,0.06)`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:color, boxShadow:`0 0 8px ${color}` }}/>
                        <span style={{ fontWeight:900, fontSize:'1.1rem', letterSpacing:'-0.03em', color }}>팀 {team}</span>
                      </div>
                      {revealed && <span style={{ fontSize:'0.6rem', fontWeight:700, background:color, color:'#fff', padding:'2px 8px', borderRadius:'100px', letterSpacing:'0.05em' }}>확정 ✓</span>}
                    </div>

                    {/* 멤버 */}
                    <div style={{ padding:'12px 18px', display:'flex', flexDirection:'column', gap:'8px' }}>
                      {result.map((r, i) => {
                        const playerName = ti === 0 ? r.A : r.B;
                        return (
                          <div key={r.pos} style={{
                            display:'flex', alignItems:'center', gap:'10px',
                            animation: revealed ? `popIn 0.35s ${i*0.07}s both` : 'none',
                          }}>
                            <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:`rgba(${ti===0?'235,112,26':'74,127,232'},0.12)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.85rem', flexShrink:0 }}>
                              {r.emoji}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase' }}>{r.pos}</div>
                              <div style={{
                                fontSize: revealed ? '1rem' : '0.88rem',
                                fontWeight:900, color: playerName?'#fff':'rgba(255,255,255,0.2)',
                                letterSpacing:'-0.02em', lineHeight:1.2,
                                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                                transition:'font-size 0.2s',
                              }}>
                                {playerName || '—'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {revealed && (
              <button onClick={roll} style={{
                width:'100%', marginTop:'12px', padding:'13px', borderRadius:'12px',
                border:`1px solid ${BORDER}`, background:'rgba(255,255,255,0.03)',
                color:'rgba(255,255,255,0.4)', fontSize:'0.85rem', fontWeight:700, cursor:'pointer',
                transition:'all 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#fff'; (e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.4)'; (e.currentTarget as HTMLElement).style.borderColor=BORDER; }}>
                🔄  다시 뽑기
              </button>
            )}
          </div>
        )}

        {!allFilled && !result && (
          <div style={{ textAlign:'center', padding:'20px 0', color:'rgba(255,255,255,0.15)', fontSize:'0.8rem' }}>
            모든 라인에 이름을 입력하면 버튼이 활성화됩니다
          </div>
        )}
      </main>
    </div>
  );
}
