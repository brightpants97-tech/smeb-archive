'use client';
import { useState, useEffect, useMemo } from 'react';

const A = '#EB701A';
const BG = '#F4F5F8';
const S  = '#ffffff';
const B  = 'rgba(0,0,0,0.09)';
const T  = '#111';
const T2 = '#555';
const T3 = '#AAA';

const COLORS = ['#FF6B35','#4A8FFF','#A855F7','#10B981','#F59E0B','#EC4899','#06B6D4','#84CC16'];
const ROLES  = ['탑','정글','미드','원딜','서포터'];
const RI: Record<string,string> = {'탑':'🛡️','정글':'🌿','미드':'⚡','원딜':'🏹','서포터':'💊'};
const TAGS = {
  mustban:    { label:'필밴',   short:'🔴', color:'#FF5566', bg:'rgba(255,85,102,0.1)',  bd:'rgba(255,85,102,0.3)'  },
  onetrick:   { label:'장인픽', short:'🟡', color:'#FFAA22', bg:'rgba(255,170,34,0.1)', bd:'rgba(255,170,34,0.3)' },
  practicing: { label:'연습중', short:'🟢', color:'#33CC77', bg:'rgba(51,204,119,0.1)', bd:'rgba(51,204,119,0.3)' },
} as const;

interface Champ  { id:string; name:string; img:string; }
interface PChamp { champ:Champ; tag:keyof typeof TAGS; note:string; }
interface Player { id:string; name:string; role:string; champs:PChamp[]; }
interface Team   { id:string; name:string; color:string; players:Player[]; }

const btn = (color:string, bg:string, bd:string) => ({
  padding:'5px 11px', borderRadius:'7px', border:`1px solid ${bd}`,
  background:bg, color, cursor:'pointer' as const, fontSize:'0.72rem', fontWeight:700,
  transition:'opacity 0.15s', lineHeight:'1.4',
});

export default function BanPickClient() {
  const [champs, setChamps] = useState<Champ[]>([]);
  const [ver, setVer]       = useState('');
  const [teams, setTeams]   = useState<Team[]>([]);
  const [sel, setSel]       = useState<string|null>(null);
  const [editT, setEditT]   = useState<string|null>(null);
  const [editP, setEditP]   = useState<string|null>(null);
  const [noteK, setNoteK]   = useState<string|null>(null);
  const [picker, setPicker] = useState<{tid:string;pid:string}|null>(null);
  const [ms, setMs]         = useState('');

  useEffect(() => {
    // localStorage 동기 로드
    try { const s = localStorage.getItem('bp-teams'); if(s) setTeams(JSON.parse(s)); } catch {}
    // DDragon 비동기 로드
    (async () => {
      try {
        const v = (await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json())[0]; setVer(v);
        const d = await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/ko_KR/champion.json`)).json();
        setChamps((Object.values(d.data) as any[]).map((c:any) => ({id:c.id,name:c.name,img:c.image.full})).sort((a:any,b:any)=>a.name.localeCompare(b.name,'ko')));
      } catch {}
    })();
  }, []);

  const img  = (c:Champ) => `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${c.img}`;
  const [saved, setSaved] = useState(false);

  const save = (t:Team[]) => {
    setTeams(t);
    try { localStorage.setItem('bp-teams', JSON.stringify(t)); setSaved(true); setTimeout(()=>setSaved(false), 1400); } catch {}
  };
  const get  = (id:string) => teams.find(t=>t.id===id);

  const addTeam  = () => { const t:Team={id:Date.now()+'',name:`팀 ${teams.length+1}`,color:COLORS[teams.length%COLORS.length],players:[]}; save([...teams,t]); setSel(t.id); setEditT(t.id); };
  const updTeam  = (id:string,p:Partial<Team>) => save(teams.map(t=>t.id===id?{...t,...p}:t));
  const delTeam  = (id:string) => { save(teams.filter(t=>t.id!==id)); setSel(null); };
  const addP     = (tid:string) => { const p:Player={id:Date.now()+'',name:'선수',role:'탑',champs:[]}; updTeam(tid,{players:[...(get(tid)?.players||[]),p]}); setEditP(p.id); };
  const updP     = (tid:string,pid:string,p:Partial<Player>) => updTeam(tid,{players:(get(tid)?.players||[]).map(x=>x.id===pid?{...x,...p}:x)});
  const delP     = (tid:string,pid:string) => updTeam(tid,{players:(get(tid)?.players||[]).filter(x=>x.id!==pid)});
  const addPC    = (tid:string,pid:string,c:Champ) => { const p=get(tid)?.players.find(x=>x.id===pid); if(!p||p.champs.find(x=>x.champ.id===c.id)) return; updP(tid,pid,{champs:[...p.champs,{champ:c,tag:'onetrick',note:''}]}); };
  const updPC    = (tid:string,pid:string,cid:string,patch:Partial<PChamp>) => { const p=get(tid)?.players.find(x=>x.id===pid); if(!p) return; updP(tid,pid,{champs:p.champs.map(x=>x.champ.id===cid?{...x,...patch}:x)}); };
  const delPC    = (tid:string,pid:string,cid:string) => { const p=get(tid)?.players.find(x=>x.id===pid); if(!p) return; updP(tid,pid,{champs:p.champs.filter(x=>x.champ.id!==cid)}); };

  const curTeam  = sel ? teams.find(t=>t.id===sel)||null : null;
  const sorted   = curTeam ? [...curTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)) : [];
  const mf       = useMemo(() => { if(!picker) return []; const p=get(picker.tid)?.players.find(x=>x.id===picker.pid); return champs.filter(c=>(c.name.includes(ms)||c.id.toLowerCase().includes(ms.toLowerCase()))&&!p?.champs.find(x=>x.champ.id===c.id)); }, [champs,ms,picker,teams]);

  const Pill = ({label,color,bg,bd,onClick}:{label:string;color:string;bg:string;bd:string;onClick?:()=>void}) => (
    <span onClick={onClick} style={{display:'inline-flex',alignItems:'center',padding:'2px 7px',borderRadius:'5px',background:bg,border:`1px solid ${bd}`,color,fontSize:'0.65rem',fontWeight:700,cursor:onClick?'pointer':'default',whiteSpace:'nowrap' as const}}>{label}</span>
  );

  return (
    <div style={{background:BG,minHeight:'100vh',color:T,fontFamily:'system-ui,sans-serif',paddingBottom:'80px'}}>
      <style>{`
        @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes si{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}
        input,textarea,select{font-family:inherit}
        input::placeholder,textarea::placeholder{color:${T3}}
        input:focus,textarea:focus,select:focus{outline:none}
        .tc:hover{border-color:rgba(0,0,0,0.18)!important;background:#ECEDF1!important}
        .tc{transition:all 0.12s!important}
        .ci{transition:transform 0.08s}
        .ci:hover{transform:scale(1.07)}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.15);border-radius:4px}
      `}</style>

      {/* 헤더 */}
      <div style={{borderBottom:`1px solid ${B}`,padding:'0 clamp(1rem,4vw,2.5rem)',display:'flex',alignItems:'stretch',height:'44px',gap:'0'}}>
        {curTeam ? (
          <button onClick={()=>{setSel(null);setEditT(null);setEditP(null);setNoteK(null);}}
            style={{background:'none',border:'none',color:T2,cursor:'pointer',fontSize:'0.78rem',fontWeight:700,paddingRight:'14px',borderRight:`1px solid ${B}`,display:'flex',alignItems:'center',gap:'4px'}}>
            ← 전체
          </button>
        ) : (
          <a href="/" style={{color:T2,fontSize:'0.78rem',textDecoration:'none',fontWeight:700,paddingRight:'14px',borderRight:`1px solid ${B}`,display:'flex',alignItems:'center'}}>← 홈</a>
        )}
        <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'0 14px',flex:1}}>
          {curTeam ? (
            <>
              <div style={{width:'8px',height:'8px',borderRadius:'50%',background:curTeam.color,boxShadow:`0 0 6px ${curTeam.color}`}} />
              <span style={{fontWeight:900,fontSize:'0.88rem',color:curTeam.color}}>{curTeam.name}</span>
              <span style={{color:T3,fontSize:'0.78rem'}}>· 선수 {curTeam.players.length}명</span>
            </>
          ) : (
            <span style={{fontWeight:800,fontSize:'0.88rem'}}>🏆 팀 관리</span>
          )}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          {saved && <span style={{fontSize:'0.68rem',color:'#33CC77',fontWeight:700,animation:'fi 0.2s both'}}>✓ 저장됨</span>}
          {ver && <span style={{fontSize:'0.62rem',color:T3}}>v{ver.slice(0,5)}</span>}
        </div>
      </div>

      {/* ── 팀 목록 ── */}
      {!curTeam && (
        <div style={{padding:'20px clamp(1rem,4vw,2.5rem)',animation:'fi 0.18s both'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
            <div>
              <div style={{fontWeight:900,fontSize:'1.1rem',letterSpacing:'-0.03em'}}>팀 목록</div>
              <div style={{fontSize:'0.72rem',color:T3,marginTop:'3px'}}>팀 카드를 클릭하면 선수 목록을 볼 수 있어요</div>
            </div>
            <button onClick={addTeam} style={{padding:'7px 14px',borderRadius:'8px',border:'none',background:A,color:'#fff',fontSize:'0.8rem',fontWeight:800,cursor:'pointer'}}>+ 팀 추가</button>
          </div>

          {teams.length===0 ? (
            <div style={{textAlign:'center',padding:'80px 0',color:T3}}>
              <div style={{fontSize:'2.5rem',marginBottom:'10px'}}>🏆</div>
              <div style={{fontWeight:700,fontSize:'0.92rem'}}>팀을 추가해보세요</div>
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:'10px'}}>
              {teams.map(t => {
                const mustbans = t.players.flatMap(p=>p.champs.filter(pc=>pc.tag==='mustban'));
                return (
                  <div key={t.id} className="tc"
                    onClick={()=>setSel(t.id)}
                    style={{background:S,border:`1px solid ${B}`,borderRadius:'12px',overflow:'hidden',cursor:'pointer',borderLeft:`3px solid ${t.color}`}}>
                    <div style={{padding:'12px 14px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
                        <div style={{width:'8px',height:'8px',borderRadius:'50%',background:t.color,boxShadow:`0 0 5px ${t.color}`,flexShrink:0}} />
                        <span style={{fontWeight:900,fontSize:'0.92rem'}}>{t.name}</span>
                        <span style={{marginLeft:'auto',fontSize:'0.65rem',color:T3,background:'rgba(255,255,255,0.06)',padding:'2px 7px',borderRadius:'100px'}}>{t.players.length}명</span>
                      </div>
                      {/* 선수 라인업 */}
                      <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                        {[...t.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)).map(p=>(
                          <div key={p.id} style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'0.75rem'}}>
                            <span style={{fontSize:'0.78rem',width:'18px',flexShrink:0}}>{RI[p.role]||'👤'}</span>
                            <span style={{fontWeight:700,color:'rgba(255,255,255,0.8)'}}>{p.name}</span>
                            <span style={{color:T3,fontSize:'0.65rem'}}>챔피언 {p.champs.length}</span>
                          </div>
                        ))}
                        {t.players.length===0&&<div style={{fontSize:'0.72rem',color:T3}}>선수 없음</div>}
                      </div>
                      {/* 필밴 미리보기 */}
                      {mustbans.length>0&&(
                        <div style={{marginTop:'10px',display:'flex',alignItems:'center',gap:'5px'}}>
                          <span style={{fontSize:'0.6rem',color:'#FF5566',fontWeight:700,flexShrink:0}}>🔴 필밴</span>
                          <div style={{display:'flex',gap:'3px',flexWrap:'wrap'}}>
                            {mustbans.slice(0,7).map(pc=>(
                              <img key={pc.champ.id} src={img(pc.champ)} alt={pc.champ.name} title={pc.champ.name}
                                style={{width:'20px',height:'20px',borderRadius:'4px',objectFit:'cover',border:'1px solid rgba(255,85,102,0.4)'}} />
                            ))}
                            {mustbans.length>7&&<span style={{fontSize:'0.62rem',color:T3,alignSelf:'center'}}>+{mustbans.length-7}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 팀 상세 ── */}
      {curTeam && (
        <div style={{padding:'16px clamp(1rem,4vw,2.5rem)',animation:'si 0.18s both'}}>

          {/* 팀 헤더 */}
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'16px',paddingBottom:'14px',borderBottom:`1px solid ${B}`}}>
            {editT===curTeam.id ? (
              <>
                <input value={curTeam.name} onChange={e=>updTeam(curTeam.id,{name:e.target.value})}
                  style={{background:S,border:`1px solid ${curTeam.color}55`,borderRadius:'7px',padding:'5px 10px',color:T,fontSize:'0.92rem',fontWeight:900,flex:1,maxWidth:'160px'}} />
                <div style={{display:'flex',gap:'4px'}}>
                  {COLORS.map(c=><div key={c} onClick={()=>updTeam(curTeam.id,{color:c})} style={{width:'18px',height:'18px',borderRadius:'50%',background:c,cursor:'pointer',border:curTeam.color===c?'2px solid #fff':'2px solid transparent',flexShrink:0}} />)}
                </div>
                <button onClick={()=>setEditT(null)} style={{...btn('#fff',A,'transparent')}}>완료</button>
              </>
            ) : (
              <span style={{fontWeight:900,fontSize:'0.95rem',color:curTeam.color,flex:1}}>{curTeam.name}</span>
            )}
            <div style={{display:'flex',gap:'5px',marginLeft:'auto',flexShrink:0}}>
              {editT!==curTeam.id&&<button onClick={()=>setEditT(curTeam.id)} style={{...btn(T2,S,B)}}>편집</button>}
              <button onClick={()=>addP(curTeam.id)} style={{...btn('#fff',curTeam.color,'transparent')}}>+ 선수</button>
              <button onClick={()=>{if(confirm(`${curTeam.name} 삭제?`))delTeam(curTeam.id);}} style={{...btn('rgba(255,100,100,0.8)','rgba(255,80,80,0.08)','rgba(255,80,80,0.25)')}}>삭제</button>
            </div>
          </div>

          {/* 선수 테이블 */}
          {sorted.length===0 ? (
            <div style={{textAlign:'center',padding:'60px 0',color:T3}}>
              <div style={{fontSize:'1.8rem',marginBottom:'8px'}}>👤</div>
              <div style={{fontSize:'0.82rem',fontWeight:600}}>선수를 추가해보세요</div>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              {sorted.map(p => {
                const isE = editP===p.id;
                return (
                  <div key={p.id} style={{background:S,border:`1px solid ${isE?curTeam.color+'44':B}`,borderRadius:'12px',overflow:'hidden',transition:'border-color 0.15s'}}>

                    {/* 선수 행 */}
                    <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 14px'}}>
                      <div style={{width:'32px',height:'32px',borderRadius:'8px',background:`${curTeam.color}18`,border:`1.5px solid ${curTeam.color}33`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',flexShrink:0}}>
                        {RI[p.role]||'👤'}
                      </div>
                      {isE ? (
                        <>
                          <input value={p.name} onChange={e=>updP(curTeam.id,p.id,{name:e.target.value})}
                            style={{background:'rgba(255,255,255,0.07)',border:`1px solid ${curTeam.color}44`,borderRadius:'6px',padding:'4px 8px',color:T,fontSize:'0.88rem',fontWeight:800,width:'100px',flexShrink:0}} />
                          <select value={p.role} onChange={e=>updP(curTeam.id,p.id,{role:e.target.value})}
                            style={{background:'rgba(255,255,255,0.07)',border:`1px solid ${B}`,borderRadius:'6px',padding:'4px 8px',color:T,fontSize:'0.8rem',cursor:'pointer',flexShrink:0}}>
                            {ROLES.map(r=><option key={r} value={r}>{RI[r]} {r}</option>)}
                          </select>
                        </>
                      ) : (
                        <>
                          <span style={{fontWeight:800,fontSize:'0.88rem',flexShrink:0}}>{p.name}</span>
                          <span style={{fontSize:'0.7rem',color:T3,flexShrink:0}}>{p.role}</span>
                        </>
                      )}

                      {/* 챔피언 인라인 미리보기 (편집 아닐 때) */}
                      {!isE && p.champs.length>0 && (
                        <div style={{display:'flex',gap:'3px',flex:1,minWidth:0,overflowX:'auto'}}>
                          {p.champs.map(pc=>{
                            const tg=TAGS[pc.tag];
                            return (
                              <div key={pc.champ.id} title={`${pc.champ.name} · ${tg.label}`}
                                style={{position:'relative',flexShrink:0}}>
                                <img src={img(pc.champ)} alt={pc.champ.name}
                                  style={{width:'28px',height:'28px',borderRadius:'5px',objectFit:'cover',display:'block',border:`2px solid ${tg.bd}`}} />
                                <div style={{position:'absolute',bottom:'-2px',right:'-2px',fontSize:'0.45rem',lineHeight:1,background:BG,borderRadius:'3px',padding:'0 1px'}}>{tg.short}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {!isE && p.champs.length===0 && <span style={{fontSize:'0.7rem',color:T3,flex:1}}>챔피언 없음</span>}

                      {/* 컨트롤 */}
                      <div style={{display:'flex',gap:'4px',flexShrink:0}}>
                        <button onClick={()=>setEditP(isE?null:p.id)} style={{...btn(isE?curTeam.color:T2,isE?`${curTeam.color}15`:S,isE?`${curTeam.color}44`:B)}}>
                          {isE?'완료':'편집'}
                        </button>
                        {isE&&<button onClick={()=>{setPicker({tid:curTeam.id,pid:p.id});setMs('');}} style={{...btn('#fff',curTeam.color,'transparent')}}>+ 챔피언</button>}
                        <button onClick={()=>{if(confirm(`${p.name} 삭제?`))delP(curTeam.id,p.id);}} style={{...btn('rgba(255,100,100,0.7)','rgba(255,80,80,0.07)','rgba(255,80,80,0.2)')}}>삭제</button>
                      </div>
                    </div>

                    {/* 편집 모드: 챔피언 상세 */}
                    {isE && p.champs.length>0 && (
                      <div style={{borderTop:`1px solid ${B}`,padding:'10px 14px',display:'flex',flexDirection:'column',gap:'6px'}}>
                        {p.champs.map(pc => {
                          const tg=TAGS[pc.tag]; const nk=`${p.id}-${pc.champ.id}`;
                          return (
                            <div key={pc.champ.id} style={{display:'flex',flexDirection:'column',gap:'0'}}>
                              <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'6px 10px',background:'rgba(0,0,0,0.02)',borderRadius:`8px ${nk===noteK?'8px 0 0':'8px 8px 8px'}`,border:`1px solid ${tg.bd}`}}>
                                <img src={img(pc.champ)} alt={pc.champ.name}
                                  style={{width:'32px',height:'32px',borderRadius:'6px',objectFit:'cover',border:`1.5px solid ${tg.color}`,flexShrink:0}} />
                                <span style={{fontWeight:700,fontSize:'0.82rem',flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{pc.champ.name}</span>
                                <Pill label={tg.label} color={tg.color} bg={tg.bg} bd={tg.bd} />
                                <select value={pc.tag} onChange={e=>updPC(curTeam.id,p.id,pc.champ.id,{tag:e.target.value as any})}
                                  style={{background:tg.bg,border:`1px solid ${tg.bd}`,borderRadius:'5px',padding:'3px 6px',color:tg.color,fontSize:'0.68rem',fontWeight:700,cursor:'pointer',flexShrink:0}}>
                                  {Object.entries(TAGS).map(([k,v])=><option key={k} value={k}>{v.short} {v.label}</option>)}
                                </select>
                                <button onClick={()=>setNoteK(noteK===nk?null:nk)}
                                  style={{...btn(noteK===nk?tg.color:T3,noteK===nk?tg.bg:S,noteK===nk?tg.bd:B),...{padding:'3px 7px'}}}>📝</button>
                                <button onClick={()=>delPC(curTeam.id,p.id,pc.champ.id)}
                                  style={{background:'none',border:'none',color:'rgba(255,100,100,0.5)',cursor:'pointer',fontSize:'0.8rem',padding:'0 2px'}}>✕</button>
                              </div>
                              {noteK===nk&&(
                                <textarea value={pc.note} onChange={e=>updPC(curTeam.id,p.id,pc.champ.id,{note:e.target.value})}
                                  placeholder="메모 (예: 레넥 잡으면 다이브 위주, 갱 조심)"
                                  style={{width:'100%',background:'rgba(0,0,0,0.025)',border:`1px solid ${tg.bd}`,borderTop:'none',borderRadius:'0 0 8px 8px',padding:'7px 10px',color:'#333',fontSize:'0.75rem',lineHeight:1.6,resize:'vertical' as const,minHeight:'48px',boxSizing:'border-box' as const}} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 챔피언 모달 */}
      {picker&&(()=>{
        const t=teams.find(x=>x.id===picker.tid); const p=t?.players.find(x=>x.id===picker.pid); if(!t||!p) return null;
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}}
            onClick={e=>{if(e.target===e.currentTarget)setPicker(null);}}>
            <div style={{background:'#fff',border:`1px solid ${t.color}33`,borderRadius:'16px',width:'100%',maxWidth:'580px',overflow:'hidden',boxShadow:`0 24px 64px rgba(0,0,0,0.8)`}}>
              {/* 모달 헤더 */}
              <div style={{padding:'12px 16px',borderBottom:`1px solid ${B}`,display:'flex',alignItems:'center',gap:'8px'}}>
                <div style={{width:'7px',height:'7px',borderRadius:'50%',background:t.color,boxShadow:`0 0 5px ${t.color}`}} />
                <span style={{fontWeight:900,fontSize:'0.85rem',color:t.color}}>{t.name}</span>
                <span style={{fontSize:'0.82rem',color:T2,fontWeight:700}}>· {p.name}</span>
                <span style={{fontSize:'0.72rem',color:T3}}>챔피언 추가</span>
                <button onClick={()=>setPicker(null)} style={{marginLeft:'auto',...btn(T2,S,B),...{padding:'4px 10px'}}}>닫기 ✕</button>
              </div>
              {/* 검색 */}
              <div style={{padding:'10px 14px 8px',display:'flex',gap:'8px',alignItems:'center',borderBottom:`1px solid ${B}`}}>
                <input autoFocus value={ms} onChange={e=>setMs(e.target.value)}
                  placeholder="챔피언 검색..."
                  style={{flex:1,background:S,border:`1px solid ${t.color}44`,borderRadius:'8px',padding:'7px 12px',color:T,fontSize:'0.88rem'}} />
                <span style={{fontSize:'0.68rem',color:T3,flexShrink:0}}>{mf.length}개</span>
              </div>
              {/* 그리드 */}
              <div style={{padding:'10px 14px 14px',maxHeight:'400px',overflowY:'auto'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(56px,1fr))',gap:'5px'}}>
                  {mf.map(c=>(
                    <div key={c.id} className="ci" onClick={()=>addPC(picker.tid,picker.pid,c)} title={c.name}
                      style={{borderRadius:'8px',overflow:'hidden',cursor:'pointer',border:'1.5px solid transparent',position:'relative',transition:'border-color 0.1s'}}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor=t.color}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='transparent'}>
                      <img src={img(c)} alt={c.name} style={{width:'100%',aspectRatio:'1',display:'block',objectFit:'cover'}} />
                      <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.82))',padding:'2px 2px 3px',fontSize:'0.46rem',fontWeight:700,color:T,textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {c.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
