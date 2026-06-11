'use client';
import { useState, useEffect, useRef } from 'react';

const A_COLOR = '#EB701A';
const B_COLOR = '#4A7FE8';
const BG      = '#09090F';
const CARD_BG = 'rgba(255,255,255,0.03)';
const BORDER  = 'rgba(255,255,255,0.08)';

const POSITIONS = ['탑','정글','미드','원딜','서포터'];
const POS_ICON  = ['🛡️','🌿','⚡','🏹','💊'];

type Mode = 'basic' | 'myeolmang';

/* ─── 기본 모드 타입 ─── */
interface BasicResult { pos:string; emoji:string; A:string; B:string; }

/* ─── 멸망전 모드 타입 ─── */
interface MyeolResult {
  pos:string; emoji:string;
  teams: string[];   // 팀A, 팀B 순
  subs: string[];    // 후보
}

const shuffle = <T,>(arr:T[]): T[] => {
  const a = [...arr]; for (let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a;
};

/* ─────────────────────────── 메인 ─────────────────────────── */
export default function TeamBuilderClient() {
  const [mode, setMode]   = useState<Mode>('basic');

  return (
    <div style={{ background:BG, minHeight:'100vh', color:'#fff', fontFamily:"system-ui,sans-serif" }}>
      <style>{`
        @keyframes slideInL { from{opacity:0;transform:translateX(-28px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideInR { from{opacity:0;transform:translateX(28px)}  to{opacity:1;transform:translateX(0)} }
        @keyframes popIn    { from{opacity:0;transform:scale(0.9)}        to{opacity:1;transform:scale(1)} }
        @keyframes shimmer  { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes pulse    { 0%,100%{box-shadow:0 0 0 0 rgba(235,112,26,0.4)} 50%{box-shadow:0 0 0 10px rgba(235,112,26,0)} }
        input::placeholder  { color:rgba(255,255,255,0.18) }
        input:focus         { outline:none }
      `}</style>

      {/* 헤더 */}
      <header style={{ position:'relative', overflow:'hidden', padding:'40px clamp(1rem,5vw,3rem) 32px', textAlign:'center', borderBottom:`1px solid ${BORDER}` }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(235,112,26,0.1) 0%, transparent 70%)', pointerEvents:'none' }}/>
        <a href="/" style={{ position:'absolute', top:'16px', left:'clamp(1rem,4vw,2.5rem)', color:'rgba(255,255,255,0.3)', fontSize:'0.78rem', textDecoration:'none', fontWeight:600 }}>← 홈</a>
        <div style={{ fontSize:'0.62rem', fontWeight:700, color:A_COLOR, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:'8px', opacity:0.8 }}>SMEB 멸망전</div>
        <h1 style={{ margin:0, fontSize:'clamp(1.8rem,5vw,2.8rem)', fontWeight:900, letterSpacing:'-0.04em', lineHeight:1 }}>
          팀 <span style={{ color:A_COLOR }}>빌</span>더
        </h1>

        {/* 모드 탭 */}
        <div style={{ display:'inline-flex', marginTop:'20px', background:'rgba(255,255,255,0.05)', borderRadius:'12px', padding:'4px', border:`1px solid ${BORDER}`, gap:'0' }}>
          {([['basic','⚔️  기본 모드'],['myeolmang','🔥  멸망전 모드']] as const).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding:'9px 22px', borderRadius:'8px', border:'none', cursor:'pointer',
              fontSize:'0.82rem', fontWeight:800, letterSpacing:'-0.01em', transition:'all 0.18s',
              background: mode===m ? (m==='basic' ? A_COLOR : '#7B2FE8') : 'transparent',
              color: mode===m ? '#fff' : 'rgba(255,255,255,0.35)',
              boxShadow: mode===m ? `0 2px 10px rgba(${m==='basic'?'235,112,26':'123,47,232'},0.4)` : 'none',
            }}>
              {label}
            </button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth:'720px', margin:'0 auto', padding:'32px clamp(1rem,4vw,2rem) 80px' }}>
        {mode === 'basic' ? <BasicMode /> : <MyeolmangMode />}
      </main>
    </div>
  );
}

/* ─────────────────────────── 기본 모드 ─────────────────────────── */
function BasicMode() {
  const [names, setNames]   = useState<[string,string][]>(POSITIONS.map(()=>['','']));
  const [result, setResult] = useState<BasicResult[]|null>(null);
  const [rolling, setRolling] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(() => {
    (async()=>{ try{ const r=await (window as any).storage?.get('tb-basic'); if(r?.value) setNames(JSON.parse(r.value)); }catch{} })();
    return ()=>{ if(timer.current) clearInterval(timer.current); };
  },[]);
  const save=(d:[string,string][])=>{ try{(window as any).storage?.set('tb-basic',JSON.stringify(d));}catch{} };
  const setName=(row:number,side:0|1,val:string)=>{ const n=names.map((p,i)=>i===row?(side===0?[val,p[1]]:[p[0],val]) as [string,string]:p); setNames(n);save(n); };
  const reset=()=>{ const d=POSITIONS.map(()=>['','']) as [string,string][]; setNames(d);save(d);setResult(null);setRevealed(false); };
  const allFilled = names.every(([a,b])=>a.trim()&&b.trim());

  const roll = () => {
    if(!allFilled||rolling) return;
    setRolling(true); setRevealed(false); setResult(null);
    let tick=0;
    timer.current = setInterval(()=>{
      setResult(POSITIONS.map((pos,i)=>{
        const sw=Math.random()>0.5;
        return {pos,emoji:POS_ICON[i],A:sw?names[i][1]:names[i][0],B:sw?names[i][0]:names[i][1]};
      }));
      tick++;
      if(tick>=16){
        clearInterval(timer.current!);
        const final=POSITIONS.map((pos,i)=>{const sw=Math.random()>0.5;return{pos,emoji:POS_ICON[i],A:sw?names[i][1]:names[i][0],B:sw?names[i][0]:names[i][1]};});
        setResult(final); setRolling(false); setTimeout(()=>setRevealed(true),60);
      }
    },75);
  };

  return (
    <>
      <p style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.3)', marginBottom:'20px', textAlign:'center' }}>라인별로 두 명씩 입력 → 랜덤 배정</p>
      <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'24px' }}>
        {POSITIONS.map((pos,i)=>(
          <div key={pos} style={{ display:'grid', gridTemplateColumns:'1fr 44px 1fr', background:CARD_BG, border:`1px solid ${BORDER}`, borderRadius:'14px', overflow:'hidden' }}>
            <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
              <span style={{ position:'absolute', left:'14px', fontSize:'0.65rem', fontWeight:800, color:names[i][0]?A_COLOR:'rgba(255,255,255,0.2)', pointerEvents:'none' }}>A</span>
              <input value={names[i][0]} onChange={e=>setName(i,0,e.target.value)} onKeyDown={e=>e.key==='Enter'&&allFilled&&roll()} placeholder="이름" style={{ width:'100%', background:'transparent', border:'none', padding:'15px 14px 15px 28px', color:'#fff', fontSize:'0.95rem', fontWeight:700 }} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', borderLeft:`1px solid ${BORDER}`, borderRight:`1px solid ${BORDER}`, padding:'8px 0', background:'rgba(255,255,255,0.015)' }}>
              <span style={{ fontSize:'0.95rem', lineHeight:1 }}>{POS_ICON[i]}</span>
              <span style={{ fontSize:'0.48rem', fontWeight:700, color:'rgba(255,255,255,0.2)', letterSpacing:'0.06em', marginTop:'2px' }}>{pos}</span>
            </div>
            <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
              <input value={names[i][1]} onChange={e=>setName(i,1,e.target.value)} onKeyDown={e=>e.key==='Enter'&&allFilled&&roll()} placeholder="이름" style={{ width:'100%', background:'transparent', border:'none', padding:'15px 28px 15px 14px', color:'#fff', fontSize:'0.95rem', fontWeight:700, textAlign:'right' }} />
              <span style={{ position:'absolute', right:'14px', fontSize:'0.65rem', fontWeight:800, color:names[i][1]?B_COLOR:'rgba(255,255,255,0.2)', pointerEvents:'none' }}>B</span>
            </div>
          </div>
        ))}
      </div>
      <RollBar allFilled={allFilled} rolling={rolling} onRoll={roll} onReset={reset} />
      {result && <TwoTeamResult result={result.map(r=>({pos:r.pos,emoji:r.emoji,teams:[r.A,r.B],subs:[]}))} revealed={revealed} onReroll={roll} />}
    </>
  );
}

/* ─────────────────────────── 멸망전 모드 ─────────────────────────── */
function MyeolmangMode() {
  const [rows, setRows]     = useState<{pos:string; names:string[]}[]>(POSITIONS.map(p=>({pos:p, names:['','']})));
  const [result, setResult] = useState<MyeolResult[]|null>(null);
  const [rolling, setRolling] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(()=>{
    (async()=>{ try{ const r=await (window as any).storage?.get('tb-myeol'); if(r?.value) setRows(JSON.parse(r.value)); }catch{} })();
    return ()=>{ if(timer.current) clearInterval(timer.current); };
  },[]);
  const save=(d:typeof rows)=>{ try{(window as any).storage?.set('tb-myeol',JSON.stringify(d));}catch{} };

  const setName=(ri:number, ni:number, val:string)=>{
    const next=rows.map((r,i)=>i===ri?{...r,names:r.names.map((n,j)=>j===ni?val:n)}:r);
    setRows(next); save(next);
  };
  const addName=(ri:number)=>{
    const next=rows.map((r,i)=>i===ri?{...r,names:[...r.names,'']}:r);
    setRows(next); save(next);
  };
  const removeName=(ri:number, ni:number)=>{
    if(rows[ri].names.length<=2) return;
    const next=rows.map((r,i)=>i===ri?{...r,names:r.names.filter((_,j)=>j!==ni)}:r);
    setRows(next); save(next);
  };
  const reset=()=>{ const d=POSITIONS.map(p=>({pos:p,names:['','']})); setRows(d);save(d);setResult(null);setRevealed(false); };
  const allFilled = rows.every(r=>r.names.filter(n=>n.trim()).length>=2);

  const totalParticipants = rows.reduce((s,r)=>s+r.names.filter(n=>n.trim()).length,0);

  const roll=()=>{
    if(!allFilled||rolling) return;
    setRolling(true); setRevealed(false); setResult(null);
    let tick=0;
    timer.current = setInterval(()=>{
      const fake=rows.map((r,i)=>{
        const filled=shuffle(r.names.filter(n=>n.trim()));
        return {pos:r.pos,emoji:POS_ICON[i],teams:filled.slice(0,2),subs:filled.slice(2)};
      });
      setResult(fake); tick++;
      if(tick>=16){
        clearInterval(timer.current!);
        const final=rows.map((r,i)=>{
          const filled=shuffle(r.names.filter(n=>n.trim()));
          return {pos:r.pos,emoji:POS_ICON[i],teams:filled.slice(0,2),subs:filled.slice(2)};
        });
        setResult(final); setRolling(false); setTimeout(()=>setRevealed(true),60);
      }
    },75);
  };

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
        <p style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.3)', margin:0 }}>라인별 인원 자유롭게 추가 → 2명씩 팀 배정, 나머지는 후보</p>
        <span style={{ fontSize:'0.7rem', fontWeight:700, color:'rgba(255,255,255,0.3)', background:'rgba(255,255,255,0.05)', padding:'3px 10px', borderRadius:'100px', border:`1px solid ${BORDER}` }}>
          총 {totalParticipants}명
        </span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'24px' }}>
        {rows.map((row, ri)=>(
          <div key={row.pos} style={{ background:CARD_BG, border:`1px solid ${BORDER}`, borderRadius:'14px', overflow:'hidden' }}>
            {/* 라인 헤더 */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px 8px', borderBottom:`1px solid ${BORDER}` }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ fontSize:'1rem' }}>{POS_ICON[ri]}</span>
                <span style={{ fontSize:'0.82rem', fontWeight:800, color:'rgba(255,255,255,0.7)' }}>{row.pos}</span>
                <span style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.25)', background:'rgba(255,255,255,0.05)', padding:'1px 7px', borderRadius:'100px' }}>
                  {row.names.filter(n=>n.trim()).length}명
                </span>
              </div>
              <button onClick={()=>addName(ri)} style={{ fontSize:'0.72rem', fontWeight:800, color:A_COLOR, background:'rgba(235,112,26,0.1)', border:'1px solid rgba(235,112,26,0.2)', borderRadius:'8px', padding:'3px 10px', cursor:'pointer' }}>
                + 추가
              </button>
            </div>
            {/* 이름 입력들 */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'6px', padding:'10px 12px' }}>
              {row.names.map((name, ni)=>(
                <div key={ni} style={{ position:'relative', display:'flex', alignItems:'center' }}>
                  <span style={{ position:'absolute', left:'10px', fontSize:'0.6rem', fontWeight:900, color: ni===0?A_COLOR:ni===1?B_COLOR:'rgba(255,255,255,0.25)', zIndex:1, pointerEvents:'none' }}>
                    {ni===0?'A':ni===1?'B':`후보${ni-1}`}
                  </span>
                  <input
                    value={name}
                    onChange={e=>setName(ri,ni,e.target.value)}
                    placeholder="이름"
                    style={{
                      width:'100%', background: ni===0?'rgba(235,112,26,0.06)':ni===1?'rgba(74,127,232,0.06)':'rgba(255,255,255,0.03)',
                      border:`1px solid ${ni===0?'rgba(235,112,26,0.2)':ni===1?'rgba(74,127,232,0.2)':'rgba(255,255,255,0.07)'}`,
                      borderRadius:'9px', padding:'8px 28px 8px 36px', color:'#fff', fontSize:'0.85rem', fontWeight:700,
                    }}
                  />
                  {ni>=2 && (
                    <button onClick={()=>removeName(ri,ni)} style={{ position:'absolute', right:'8px', background:'none', border:'none', color:'rgba(255,100,100,0.5)', cursor:'pointer', fontSize:'0.8rem', padding:'0', lineHeight:1 }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <RollBar allFilled={allFilled} rolling={rolling} onRoll={roll} onReset={reset} />

      {result && <TwoTeamResult result={result} revealed={revealed} onReroll={roll} showSubs />}
    </>
  );
}

/* ─────────────────────────── 공통 컴포넌트 ─────────────────────────── */
function RollBar({ allFilled, rolling, onRoll, onReset }: { allFilled:boolean; rolling:boolean; onRoll:()=>void; onReset:()=>void; }) {
  return (
    <div style={{ display:'flex', gap:'10px', marginBottom:'36px' }}>
      <button onClick={onRoll} disabled={!allFilled||rolling} style={{
        flex:1, padding:'16px 24px', borderRadius:'14px', border:'none',
        background: allFilled ? `linear-gradient(135deg,${A_COLOR},#FF6B35)` : 'rgba(255,255,255,0.06)',
        color: allFilled?'#fff':'rgba(255,255,255,0.2)', fontSize:'1rem', fontWeight:900, letterSpacing:'-0.02em',
        cursor: allFilled&&!rolling?'pointer':'default',
        animation: allFilled&&!rolling?'pulse 2s infinite':'none', transition:'all 0.2s',
      }}>
        {rolling ? <span style={{ animation:'shimmer 0.4s infinite' }}>🎲 배정 중...</span> : '⚔️  랜덤으로 팀 짜기'}
      </button>
      <button onClick={onReset} style={{ padding:'16px', borderRadius:'14px', border:`1px solid ${BORDER}`, background:'none', color:'rgba(255,255,255,0.25)', fontSize:'0.82rem', fontWeight:700, cursor:'pointer' }}>초기화</button>
    </div>
  );
}

function TwoTeamResult({ result, revealed, onReroll, showSubs=false }: {
  result: MyeolResult[]; revealed:boolean; onReroll:()=>void; showSubs?:boolean;
}) {
  const hasSubs = showSubs && result.some(r=>r.subs.length>0);
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
        <div style={{ flex:1, height:'1px', background:`linear-gradient(to right,transparent,${BORDER})` }}/>
        <span style={{ fontSize:'0.62rem', fontWeight:700, color:'rgba(255,255,255,0.22)', letterSpacing:'0.15em', textTransform:'uppercase' }}>{revealed?'결과 확정':'배정 중'}</span>
        <div style={{ flex:1, height:'1px', background:`linear-gradient(to left,transparent,${BORDER})` }}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
        {(['A','B'] as const).map((team,ti)=>{
          const color = ti===0 ? A_COLOR : B_COLOR;
          return (
            <div key={team} style={{
              background:`rgba(${ti===0?'235,112,26':'74,127,232'},0.06)`,
              border:`1.5px solid rgba(${ti===0?'235,112,26':'74,127,232'},${revealed?'0.3':'0.12'})`,
              borderRadius:'16px', overflow:'hidden',
              animation:revealed?`${ti===0?'slideInL':'slideInR'} 0.38s both`:'none',
            }}>
              <div style={{ padding:'12px 16px 10px', borderBottom:`1px solid rgba(255,255,255,0.05)`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:color, boxShadow:`0 0 7px ${color}` }}/>
                  <span style={{ fontWeight:900, fontSize:'1rem', color }}> 팀 {team}</span>
                </div>
                {revealed && <span style={{ fontSize:'0.58rem', fontWeight:700, background:color, color:'#fff', padding:'2px 8px', borderRadius:'100px' }}>확정 ✓</span>}
              </div>
              <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:'7px' }}>
                {result.map((r,i)=>{
                  const name = r.teams[ti] || '—';
                  return (
                    <div key={r.pos} style={{ display:'flex', alignItems:'center', gap:'9px', animation:revealed?`popIn 0.32s ${i*0.06}s both`:'none' }}>
                      <div style={{ width:'26px', height:'26px', borderRadius:'7px', background:`rgba(${ti===0?'235,112,26':'74,127,232'},0.1)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.8rem', flexShrink:0 }}>{r.emoji}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.28)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em' }}>{r.pos}</div>
                        <div style={{ fontSize:revealed?'0.98rem':'0.88rem', fontWeight:900, color:name!=='—'?'#fff':'rgba(255,255,255,0.2)', letterSpacing:'-0.02em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', transition:'font-size 0.2s' }}>
                          {name}
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

      {/* 후보 */}
      {hasSubs && revealed && (
        <div style={{ marginTop:'12px', background:'rgba(255,255,255,0.02)', border:`1px solid ${BORDER}`, borderRadius:'12px', padding:'12px 16px', animation:'popIn 0.4s 0.3s both' }}>
          <p style={{ fontSize:'0.65rem', fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'10px' }}>후보 선수</p>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            {result.filter(r=>r.subs.length>0).map(r=>(
              <div key={r.pos} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ fontSize:'0.85rem' }}>{r.emoji}</span>
                <span style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.3)', width:'36px' }}>{r.pos}</span>
                <div style={{ display:'flex', gap:'6px' }}>
                  {r.subs.map((s,i)=>(
                    <span key={i} style={{ fontSize:'0.82rem', fontWeight:700, color:'rgba(255,255,255,0.55)', background:'rgba(255,255,255,0.05)', padding:'3px 10px', borderRadius:'8px', border:`1px solid ${BORDER}` }}>{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {revealed && (
        <button onClick={onReroll} style={{ width:'100%', marginTop:'10px', padding:'12px', borderRadius:'12px', border:`1px solid ${BORDER}`, background:'rgba(255,255,255,0.03)', color:'rgba(255,255,255,0.38)', fontSize:'0.85rem', fontWeight:700, cursor:'pointer', transition:'all 0.15s' }}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color='#fff';(e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.2)';}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.38)';(e.currentTarget as HTMLElement).style.borderColor=BORDER;}}>
          🔄  다시 뽑기
        </button>
      )}
    </div>
  );
}
