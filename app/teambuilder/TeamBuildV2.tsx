'use client';
import { useState, useEffect, useRef } from 'react';

const A_COLOR = '#EB701A';
const B_COLOR = '#4A7FE8';
const BG      = '#09090F';
const CARD_BG = 'rgba(255,255,255,0.03)';
const BORDER  = 'rgba(255,255,255,0.08)';

const POSITIONS = ['탑','정글','미드','원딜','서포터'];
const POS_ICON  = ['🛡️','🌿','⚡','🏹','💊'];

interface Result { pos:string; emoji:string; A:string; B:string; }

export default function TeamBuilderClient() {
  const [names, setNames]     = useState<[string,string][]>(POSITIONS.map(()=>['','']));
  const [result, setResult]   = useState<Result[]|null>(null);
  const [rolling, setRolling] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [lockA, setLockA] = useState<boolean[]>(POSITIONS.map(()=>false));
  const [lockB, setLockB] = useState<boolean[]>(POSITIONS.map(()=>false));
  const [lockMode, setLockMode] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(()=>{
    (async()=>{ try{ const r=await (window as any).storage?.get('tb-basic'); if(r?.value) setNames(JSON.parse(r.value)); }catch{} })();
    return ()=>{ if(timer.current) clearInterval(timer.current); };
  },[]);

  const save = (d:[string,string][]) => { try{(window as any).storage?.set('tb-basic',JSON.stringify(d));}catch{} };
  const setName = (row:number, side:0|1, val:string) => {
    const n = names.map((p,i)=>i===row?(side===0?[val,p[1]]:[p[0],val]) as [string,string]:p);
    setNames(n); save(n);
  };
  const toggleLock = (i:number) => setLocked(prev=>prev.map((v,j)=>j===i?!v:v));
  const reset = () => {
    const d = POSITIONS.map(()=>['','']) as [string,string][];
    setNames(d); save(d); setResult(null); setRevealed(false);
    setLockA(POSITIONS.map(()=>false)); setLockB(POSITIONS.map(()=>false)); setLockMode(false);
  };
  const allFilled = names.every(([a,b])=>a.trim()&&b.trim());

  const roll = () => {
    if(!allFilled||rolling) return;
    setRolling(true); setRevealed(false);
    const prev = result;
    let tick = 0;
    timer.current = setInterval(()=>{
      setResult(POSITIONS.map((pos,i)=>{
        if(lockMode&&(lockA[i]||lockB[i])) return {pos,emoji:POS_ICON[i],A:names[i][0],B:names[i][1]};
        const sw = Math.random()>0.5;
        return {pos, emoji:POS_ICON[i], A:sw?names[i][1]:names[i][0], B:sw?names[i][0]:names[i][1]};
      }));
      tick++;
      if(tick>=16){
        clearInterval(timer.current!);
        const final = POSITIONS.map((pos,i)=>{
          if(lockMode&&(lockA[i]||lockB[i])) return {pos,emoji:POS_ICON[i],A:names[i][0],B:names[i][1]};
          const sw = Math.random()>0.5;
          return {pos, emoji:POS_ICON[i], A:sw?names[i][1]:names[i][0], B:sw?names[i][0]:names[i][1]};
        });
        setResult(final); setRolling(false); setTimeout(()=>setRevealed(true),60);
      }
    },75);
  };

  return (
    <div style={{background:BG, minHeight:'100vh', color:'#fff', fontFamily:'system-ui,sans-serif'}}>
      <style>{`
        @keyframes slideInL{from{opacity:0;transform:translateX(-28px)}to{opacity:1;transform:translateX(0)}}
        @keyframes slideInR{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:translateX(0)}}
        @keyframes popIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
        @keyframes shimmer{0%,100%{opacity:0.6}50%{opacity:1}}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(235,112,26,0.4)}50%{box-shadow:0 0 0 10px rgba(235,112,26,0)}}
        input::placeholder{color:rgba(255,255,255,0.18)}
        input:focus{outline:none}
        .lbtn{transition:all 0.15s;opacity:0.22;filter:grayscale(1)}
        .lbtn:hover{opacity:0.6!important}
        .lbtn.on{opacity:1!important;filter:none!important}
      `}</style>

      {/* 헤더 */}
      <header style={{position:'relative',overflow:'hidden',padding:'40px clamp(1rem,5vw,3rem) 28px',textAlign:'center',borderBottom:`1px solid ${BORDER}`}}>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 60% 80% at 50% 0%,rgba(235,112,26,0.1) 0%,transparent 70%)',pointerEvents:'none'}}/>
        <a href="/" style={{position:'absolute',top:'16px',left:'clamp(1rem,4vw,2.5rem)',color:'rgba(255,255,255,0.3)',fontSize:'0.78rem',textDecoration:'none',fontWeight:600}}>← 홈</a>
        <div style={{fontSize:'0.62rem',fontWeight:700,color:A_COLOR,letterSpacing:'0.2em',textTransform:'uppercase',marginBottom:'8px',opacity:0.8}}>SMEB</div>
        <h1 style={{margin:0,fontSize:'clamp(1.8rem,5vw,2.8rem)',fontWeight:900,letterSpacing:'-0.04em',lineHeight:1}}>
          팀 <span style={{color:A_COLOR}}>빌</span>더
        </h1>

        {/* 모드 탭 */}
        <div style={{display:'inline-flex',marginTop:'20px',background:'rgba(255,255,255,0.05)',borderRadius:'12px',padding:'4px',border:`1px solid ${BORDER}`,gap:0}}>
          {([
            [false,'🎲  전 라인 랜덤'],
            [true, '🔒  팀 고정'],
          ] as const).map(([m,label])=>(
            <button key={String(m)} onClick={()=>{setLockMode(m);if(!m){setLockA(POSITIONS.map(()=>false));setLockB(POSITIONS.map(()=>false));}}} style={{
              padding:'9px 22px',borderRadius:'8px',border:'none',cursor:'pointer',
              fontSize:'0.82rem',fontWeight:800,letterSpacing:'-0.01em',transition:'all 0.18s',
              background:lockMode===m?(m?'#5B4FE8':A_COLOR):'transparent',
              color:lockMode===m?'#fff':'rgba(255,255,255,0.35)',
              boxShadow:lockMode===m?`0 2px 10px rgba(${m?'91,79,232':'235,112,26'},0.4)`:'none',
            }}>{label}</button>
          ))}
        </div>
      </header>

      {/* 메인: 2열 레이아웃 */}
      <main style={{maxWidth:'1080px',margin:'0 auto',padding:'28px clamp(1rem,4vw,2rem) 60px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'32px',alignItems:'start'}}>

          {/* 왼쪽: 입력 */}
          <div>
            <p style={{fontSize:'0.78rem',color:'rgba(255,255,255,0.3)',marginBottom:'14px',textAlign:'center'}}>
              {lockMode?'🔒 선수 옆 버튼으로 팀을 고정 후 나머지만 다시 굴릴 수 있어요':'🎲 매번 전체 라인을 새로 랜덤 배정해요'}
            </p>

            <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
              {POSITIONS.map((pos,i)=>(
                <div key={pos} style={{
                  display:'grid',gridTemplateColumns:'1fr 56px 1fr',
                  background:lockMode&&(lockA[i]||lockB[i])?'rgba(235,112,26,0.04)':CARD_BG,
                  border:`1px solid ${lockMode&&lockA[i]?'rgba(235,112,26,0.4)':lockMode&&lockB[i]?'rgba(74,127,232,0.4)':BORDER}`,
                  borderRadius:'14px',overflow:'hidden',transition:'all 0.18s',
                }}>
                  <div style={{position:'relative',display:'flex',alignItems:'center'}}>
                    <span style={{position:'absolute',left:'14px',fontSize:'0.65rem',fontWeight:800,color:names[i][0]?A_COLOR:'rgba(255,255,255,0.2)',pointerEvents:'none'}}>A</span>
                    <input value={names[i][0]} onChange={e=>setName(i,0,e.target.value)} onKeyDown={e=>e.key==='Enter'&&allFilled&&roll()} placeholder="이름"
                      style={{width:'100%',background:'transparent',border:'none',padding:'15px lockMode?'36px':'14px' 15px 28px',color:'#fff',fontSize:'0.95rem',fontWeight:700}}/>
                    {lockMode&&(
                      <button onClick={()=>setLockA(prev=>prev.map((v,j)=>j===i?!v:v))}
                        title={lockA[i]?'팀A 고정 해제':'팀A에 고정'}
                        style={{position:'absolute',right:'8px',background:'none',border:`1px solid ${lockA[i]?A_COLOR:'rgba(255,255,255,0.2)'}`,borderRadius:'5px',cursor:'pointer',fontSize:'0.65rem',fontWeight:800,color:lockA[i]?A_COLOR:'rgba(255,255,255,0.25)',padding:'2px 5px',lineHeight:1,transition:'all 0.15s'}}>
                        {lockA[i]?'🔒A':'🔓'}
                      </button>
                    )}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',borderLeft:`1px solid ${BORDER}`,borderRight:`1px solid ${BORDER}`,padding:'6px 0',background:'rgba(255,255,255,0.015)',gap:'2px'}}>
                    <span style={{fontSize:'0.95rem',lineHeight:1}}>{POS_ICON[i]}</span>
                    <span style={{fontSize:'0.45rem',fontWeight:700,color:'rgba(255,255,255,0.2)',letterSpacing:'0.06em'}}>{pos}</span>
                    {lockMode&&(
                      <button onClick={()=>toggleLock(i)} className={`lbtn${locked[i]?' on':''}`}
                        title={locked[i]?'고정 해제':'이 라인 고정'}
                        style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.8rem',lineHeight:1,padding:'1px',marginTop:'1px'}}>
                        🔒
                      </button>
                    )}
                  </div>
                  <div style={{position:'relative',display:'flex',alignItems:'center'}}>
                    {lockMode&&(
                      <button onClick={()=>setLockB(prev=>prev.map((v,j)=>j===i?!v:v))}
                        title={lockB[i]?'팀B 고정 해제':'팀B에 고정'}
                        style={{position:'absolute',left:'8px',background:'none',border:`1px solid ${lockB[i]?B_COLOR:'rgba(255,255,255,0.2)'}`,borderRadius:'5px',cursor:'pointer',fontSize:'0.65rem',fontWeight:800,color:lockB[i]?B_COLOR:'rgba(255,255,255,0.25)',padding:'2px 5px',lineHeight:1,transition:'all 0.15s'}}>
                        {lockB[i]?'🔒B':'🔓'}
                      </button>
                    )}
                    <input value={names[i][1]} onChange={e=>setName(i,1,e.target.value)} onKeyDown={e=>e.key==='Enter'&&allFilled&&roll()} placeholder="이름"
                      style={{width:'100%',background:'transparent',border:'none',padding:'15px 28px 15px lockMode?'36px':'14px'',color:'#fff',fontSize:'0.95rem',fontWeight:700,textAlign:'right'}}/>
                    <span style={{position:'absolute',right:'14px',fontSize:'0.65rem',fontWeight:800,color:names[i][1]?B_COLOR:'rgba(255,255,255,0.2)',pointerEvents:'none'}}>B</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={roll} disabled={!allFilled||rolling} style={{
                flex:1,padding:'16px 24px',borderRadius:'14px',border:'none',
                background:allFilled?`linear-gradient(135deg,${A_COLOR},#FF6B35)`:'rgba(255,255,255,0.06)',
                color:allFilled?'#fff':'rgba(255,255,255,0.2)',fontSize:'1rem',fontWeight:900,letterSpacing:'-0.02em',
                cursor:allFilled&&!rolling?'pointer':'default',
                animation:allFilled&&!rolling?'pulse 2s infinite':'none',transition:'all 0.2s',
              }}>
                {rolling?<span style={{animation:'shimmer 0.4s infinite'}}>🎲 배정 중...</span>:'⚔️  랜덤으로 팀 짜기'}
              </button>
              <button onClick={reset} style={{padding:'16px',borderRadius:'14px',border:`1px solid ${BORDER}`,background:'none',color:'rgba(255,255,255,0.25)',fontSize:'0.82rem',fontWeight:700,cursor:'pointer'}}>초기화</button>
            </div>
          </div>

          {/* 오른쪽: 결과 */}
          <div style={{position:'sticky',top:'24px',minHeight:'200px'}}>
            {!result&&(
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'280px',color:'rgba(255,255,255,0.15)',flexDirection:'column',gap:'12px'}}>
                <span style={{fontSize:'2.5rem'}}>⚔️</span>
                <span style={{fontSize:'0.82rem',fontWeight:600}}>팀 짜기 결과가 여기 나와요</span>
              </div>
            )}
            {result&&(
              <div style={{display:'flex',flexDirection:'column',gap:'10px',animation:'popIn 0.3s both'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                  {(['A','B'] as const).map((team,ti)=>{
                    const color = ti===0?A_COLOR:B_COLOR;
                    return (
                      <div key={team} style={{
                        background:`rgba(${ti===0?'235,112,26':'74,127,232'},0.06)`,
                        border:`1.5px solid rgba(${ti===0?'235,112,26':'74,127,232'},${revealed?'0.3':'0.12'})`,
                        borderRadius:'16px',overflow:'hidden',
                        animation:revealed?`${ti===0?'slideInL':'slideInR'} 0.38s both`:'none',
                      }}>
                        <div style={{padding:'12px 16px 10px',borderBottom:'1px solid rgba(255,255,255,0.05)',display:'flex',alignItems:'center',gap:'8px'}}>
                          <div style={{width:'7px',height:'7px',borderRadius:'50%',background:color,boxShadow:`0 0 7px ${color}`}}/>
                          <span style={{fontWeight:900,fontSize:'1rem',color}}>팀 {team}</span>
                          {revealed&&<span style={{marginLeft:'auto',fontSize:'0.58rem',fontWeight:700,background:color,color:'#fff',padding:'2px 8px',borderRadius:'100px'}}>확정 ✓</span>}
                        </div>
                        <div style={{padding:'10px 14px',display:'flex',flexDirection:'column',gap:'7px'}}>
                          {result.map((r,i)=>(
                            <div key={r.pos} style={{display:'flex',alignItems:'center',gap:'9px',animation:revealed?`popIn 0.32s ${i*0.06}s both`:'none'}}>
                              <div style={{width:'26px',height:'26px',borderRadius:'7px',background:`rgba(${ti===0?'235,112,26':'74,127,232'},0.1)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.8rem',flexShrink:0}}>{r.emoji}</div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:'0.55rem',color:'rgba(255,255,255,0.28)',fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.04em'}}>
                                  {r.pos}{lockMode&&(lockA[i]||lockB[i])?' 🔒':''}
                                </div>
                                <div style={{fontSize:revealed?'0.98rem':'0.88rem',fontWeight:900,color:'#fff',letterSpacing:'-0.02em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>
                                  {rolling?'···':ti===0?r.A:r.B}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {revealed&&lockMode&&(
                  <p style={{textAlign:'center',fontSize:'0.72rem',color:'rgba(255,255,255,0.25)',margin:'4px 0 0'}}>
                    🔒 버튼으로 라인 고정 후 다시 굴리면 고정된 라인은 유지돼요
                  </p>
                )}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
