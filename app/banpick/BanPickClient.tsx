'use client';
import { useState, useEffect, useMemo } from 'react';

const A  = '#EB701A';
const BG = '#F4F5F8';
const S  = '#ffffff';
const B  = 'rgba(0,0,0,0.09)';
const T  = '#111';
const T2 = '#666';
const T3 = '#AAA';

const COLORS = ['#FF6B35','#4A8FFF','#A855F7','#10B981','#F59E0B','#EC4899','#06B6D4','#84CC16'];
const ROLES  = ['탑','정글','미드','원딜','서포터'];
const RI: Record<string,string> = {'탑':'🛡️','정글':'🌿','미드':'⚡','원딜':'🏹','서포터':'💊'};
const TAGS = {
  mustban:    { label:'필밴',   short:'🔴', color:'#FF5566', bg:'rgba(255,85,102,0.1)',  bd:'rgba(255,85,102,0.3)'  },
  onetrick:   { label:'장인픽', short:'🟡', color:'#FFAA22', bg:'rgba(255,170,34,0.1)', bd:'rgba(255,170,34,0.3)' },
  practicing: { label:'연습중', short:'🟢', color:'#33CC77', bg:'rgba(51,204,119,0.1)', bd:'rgba(51,204,119,0.3)' },
} as const;

interface Champ       { id:string; name:string; img:string; }
interface PChamp      { champ:Champ; tag:keyof typeof TAGS; note:string; }
interface Player      { id:string; name:string; role:string; champs:PChamp[]; }
interface Team        { id:string; name:string; color:string; players:Player[]; }
interface Composition { id:string; name:string; picks:Record<string,string>; } // playerId → champId

const Btn = (color:string, bg:string, bd:string, extra?:object) => ({
  padding:'7px 14px', borderRadius:'8px', border:`1px solid ${bd}`,
  background:bg, color, cursor:'pointer' as const, fontSize:'0.88rem', fontWeight:700,
  fontFamily:'inherit', lineHeight:'1.4', ...extra,
});

export default function BanPickClient() {
  const [champs, setChamps] = useState<Champ[]>([]);
  const [ver, setVer]       = useState('');
  const [teams, setTeams]   = useState<Team[]>([]);
  const [comps, setComps]   = useState<Record<string,Composition[]>>({});
  const [sel, setSel]       = useState<string|null>(null);       // 선택된 팀 id
  const [saved, setSaved]   = useState(false);
  const [editMode, setEditMode] = useState(false);               // 선수명 편집 모드
  const [picker, setPicker]     = useState<string|null>(null);   // 챔피언 추가 모달 (player id)
  const [ms, setMs]             = useState('');
  const [currentPicks, setCurrentPicks] = useState<Record<string,string>>({}); // 현재 선택 중인 조합 (playerId→champId)
  const [compName, setCompName] = useState('');
  const [vsMode, setVsMode]     = useState(false);
  const [vsLeft, setVsLeft]     = useState<{teamId:string;compId:string}|null>(null);
  const [vsRight, setVsRight]   = useState<{teamId:string;compId:string}|null>(null);
  const [noteKey, setNoteKey]   = useState<string|null>(null);

  useEffect(() => {
    try { const t=localStorage.getItem('bp-teams'); if(t) setTeams(JSON.parse(t)); } catch {}
    try { const c=localStorage.getItem('bp-comps');  if(c) setComps(JSON.parse(c)); } catch {}
    (async () => {
      try {
        const v=(await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json())[0]; setVer(v);
        const d=await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/ko_KR/champion.json`)).json();
        setChamps((Object.values(d.data) as any[]).map((c:any)=>({id:c.id,name:c.name,img:c.image.full})).sort((a:any,b:any)=>a.name.localeCompare(b.name,'ko')));
      } catch {}
    })();
  }, []);

  const img   = (c:Champ) => `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${c.img}`;
  const flash = () => { setSaved(true); setTimeout(()=>setSaved(false),1400); };

  const saveTeams = (t:Team[]) => { setTeams(t); try{localStorage.setItem('bp-teams',JSON.stringify(t));flash();}catch{} };
  const saveComps = (c:Record<string,Composition[]>) => { setComps(c); try{localStorage.setItem('bp-comps',JSON.stringify(c));flash();}catch{} };
  const getComps  = (tid:string) => comps[tid]||[];

  /* 팀 */
  const addTeam = () => {
    const tid=Date.now()+'';
    const players:Player[]=ROLES.map((role,i)=>({id:`${tid}_${i}`,name:`${role} 선수`,role,champs:[]}));
    const t:Team={id:tid,name:`팀 ${teams.length+1}`,color:COLORS[teams.length%COLORS.length],players};
    saveTeams([...teams,t]); setSel(tid); setCurrentPicks({});
  };
  const updTeam = (id:string,p:Partial<Team>) => saveTeams(teams.map(t=>t.id===id?{...t,...p}:t));
  const delTeam = (id:string) => { saveTeams(teams.filter(t=>t.id!==id)); if(sel===id)setSel(null); };
  const get     = (id:string) => teams.find(t=>t.id===id);

  /* 선수 챔피언 */
  const addPC = (pid:string,c:Champ) => {
    if(!sel) return;
    const team=get(sel); if(!team) return;
    const players=team.players.map(p=>p.id===pid?{...p,champs:p.champs.find(x=>x.champ.id===c.id)?p.champs:[...p.champs,{champ:c,tag:'onetrick' as const,note:''}]}:p);
    updTeam(sel,{players});
  };
  const updPC = (pid:string,cid:string,patch:Partial<PChamp>) => {
    if(!sel) return;
    const team=get(sel); if(!team) return;
    const players=team.players.map(p=>p.id===pid?{...p,champs:p.champs.map(x=>x.champ.id===cid?{...x,...patch}:x)}:p);
    updTeam(sel,{players});
  };
  const delPC = (pid:string,cid:string) => {
    if(!sel) return;
    const team=get(sel); if(!team) return;
    const players=team.players.map(p=>p.id===pid?{...p,champs:p.champs.filter(x=>x.champ.id!==cid)}:p);
    updTeam(sel,{players});
    if(currentPicks[pid]===cid) setCurrentPicks(prev=>{const n={...prev};delete n[pid];return n;});
  };

  /* 조합 픽 선택 */
  const togglePick = (pid:string, champId:string) => {
    setCurrentPicks(prev => prev[pid]===champId ? {...prev,[pid]:''} : {...prev,[pid]:champId});
  };

  /* 조합 저장/불러오기 */
  const saveComp = () => {
    if(!sel) return;
    const name = compName.trim()||`조합 ${getComps(sel).length+1}`;
    const nc:Composition = {id:Date.now()+'', name, picks:{...currentPicks}};
    saveComps({...comps,[sel]:[...getComps(sel),nc]});
    setCompName('');
  };
  const loadComp = (c:Composition) => { setCurrentPicks({...c.picks}); };
  const delComp  = (tid:string,cid:string) => saveComps({...comps,[tid]:getComps(tid).filter(c=>c.id!==cid)});

  const curTeam   = sel ? get(sel)||null : null;
  const sortedP   = curTeam ? [...curTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)) : [];
  const mfChamps  = useMemo(() => {
    if(!picker||!sel) return [];
    const team=get(sel); const p=team?.players.find(x=>x.id===picker);
    return champs.filter(c=>(c.name.includes(ms)||c.id.toLowerCase().includes(ms.toLowerCase()))&&!p?.champs.find(x=>x.champ.id===c.id));
  },[champs,ms,picker,sel,teams]);

  /* VS 비교 */
  const vsLeftTeam  = vsLeft ? get(vsLeft.teamId) : null;
  const vsRightTeam = vsRight ? get(vsRight.teamId) : null;
  const vsLeftComp  = vsLeft ? getComps(vsLeft.teamId).find(c=>c.id===vsLeft.compId) : null;
  const vsRightComp = vsRight ? getComps(vsRight.teamId).find(c=>c.id===vsRight.compId) : null;

  return (
    <div style={{background:BG,minHeight:'100vh',color:T,fontFamily:'system-ui,sans-serif',paddingBottom:'80px'}}>
      <style>{`
        @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes si{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
        input,textarea,select{font-family:inherit}
        input::placeholder,textarea::placeholder{color:${T3}}
        input:focus,textarea:focus,select:focus{outline:none}
        .tc:hover{border-color:rgba(0,0,0,0.18)!important;background:#ECEDF1!important}
        .tc{transition:all 0.12s!important}
        .ci{transition:transform 0.08s}.ci:hover{transform:scale(1.06)}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.14);border-radius:4px}
      `}</style>

      {/* 헤더 */}
      <div style={{borderBottom:`1px solid ${B}`,padding:'0 clamp(1rem,4vw,2.5rem)',display:'flex',alignItems:'stretch',height:'54px',background:S,position:'sticky',top:0,zIndex:100}}>
        {curTeam ? (
          <button onClick={()=>{setSel(null);setEditMode(false);setPicker(null);setCurrentPicks({});}}
            style={{background:'none',border:'none',color:T2,cursor:'pointer',fontSize:'0.9rem',fontWeight:700,paddingRight:'16px',borderRight:`1px solid ${B}`,display:'flex',alignItems:'center',gap:'4px'}}>
            ← 팀 목록
          </button>
        ) : (
          <a href="/" style={{color:T2,fontSize:'0.9rem',textDecoration:'none',fontWeight:700,paddingRight:'16px',borderRight:`1px solid ${B}`,display:'flex',alignItems:'center'}}>← 홈</a>
        )}
        <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'0 16px',flex:1}}>
          {curTeam ? (
            <>
              <div style={{width:'9px',height:'9px',borderRadius:'50%',background:curTeam.color,boxShadow:`0 0 6px ${curTeam.color}`}} />
              <span style={{fontWeight:900,fontSize:'1rem',color:curTeam.color}}>{curTeam.name}</span>
            </>
          ) : <span style={{fontWeight:900,fontSize:'1rem'}}>🏆 팀 관리</span>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          {saved&&<span style={{fontSize:'0.76rem',color:'#33CC77',fontWeight:700}}>✓ 저장됨</span>}
          {ver&&<span style={{fontSize:'0.68rem',color:T3}}>v{ver.slice(0,5)}</span>}
        </div>
      </div>

      {/* ── 팀 목록 ── */}
      {!curTeam && (
        <div style={{padding:'24px clamp(1rem,4vw,2.5rem)',animation:'fi 0.18s both'}}>
          <div style={{maxWidth:'960px',margin:'0 auto'}}>

            {/* 대전 비교 패널 */}
            {vsMode && (
              <div style={{background:S,border:`1px solid ${B}`,borderRadius:'16px',overflow:'hidden',marginBottom:'24px',animation:'fi 0.18s both'}}>
                <div style={{padding:'14px 20px',borderBottom:`1px solid ${B}`,display:'flex',alignItems:'center',gap:'10px',background:'rgba(0,0,0,0.02)'}}>
                  <span style={{fontWeight:900,fontSize:'1.05rem'}}>⚔️ 대전 비교</span>
                  <button onClick={()=>{setVsMode(false);setVsLeft(null);setVsRight(null);}}
                    style={{marginLeft:'auto',...Btn(T2,S,B,{padding:'5px 12px'})}}>닫기</button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 44px 1fr'}}>
                  {/* 블루팀 선택 */}
                  <div style={{padding:'16px 20px',borderRight:`1px solid ${B}`}}>
                    <div style={{fontSize:'0.72rem',fontWeight:800,color:'#4A8FFF',letterSpacing:'0.08em',marginBottom:'10px'}}>BLUE TEAM</div>
                    <select value={vsLeft?.teamId||''} onChange={e=>{setVsLeft(e.target.value?{teamId:e.target.value,compId:''}:null);}}
                      style={{width:'100%',background:'rgba(74,143,255,0.08)',border:'1.5px solid rgba(74,143,255,0.35)',borderRadius:'9px',padding:'8px 12px',color:T,fontSize:'0.9rem',fontWeight:700,cursor:'pointer',marginBottom:'8px'}}>
                      <option value="">팀 선택</option>
                      {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {vsLeft?.teamId && (
                      <select value={vsLeft.compId} onChange={e=>setVsLeft(v=>v?{...v,compId:e.target.value}:null)}
                        style={{width:'100%',background:'rgba(74,143,255,0.06)',border:'1.5px solid rgba(74,143,255,0.2)',borderRadius:'9px',padding:'8px 12px',color:T,fontSize:'0.88rem',fontWeight:600,cursor:'pointer'}}>
                        <option value="">조합 선택</option>
                        {getComps(vsLeft.teamId).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:'0.88rem',color:T3}}>VS</div>
                  {/* 레드팀 선택 */}
                  <div style={{padding:'16px 20px',borderLeft:`1px solid ${B}`}}>
                    <div style={{fontSize:'0.72rem',fontWeight:800,color:'#FF4A6A',letterSpacing:'0.08em',marginBottom:'10px'}}>RED TEAM</div>
                    <select value={vsRight?.teamId||''} onChange={e=>{setVsRight(e.target.value?{teamId:e.target.value,compId:''}:null);}}
                      style={{width:'100%',background:'rgba(255,74,106,0.08)',border:'1.5px solid rgba(255,74,106,0.35)',borderRadius:'9px',padding:'8px 12px',color:T,fontSize:'0.9rem',fontWeight:700,cursor:'pointer',marginBottom:'8px'}}>
                      <option value="">팀 선택</option>
                      {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {vsRight?.teamId && (
                      <select value={vsRight.compId} onChange={e=>setVsRight(v=>v?{...v,compId:e.target.value}:null)}
                        style={{width:'100%',background:'rgba(255,74,106,0.06)',border:'1.5px solid rgba(255,74,106,0.2)',borderRadius:'9px',padding:'8px 12px',color:T,fontSize:'0.88rem',fontWeight:600,cursor:'pointer'}}>
                        <option value="">조합 선택</option>
                        {getComps(vsRight.teamId).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>

                {/* 비교 결과 */}
                {vsLeftComp && vsRightComp && vsLeftTeam && vsRightTeam && (
                  <div style={{borderTop:`1px solid ${B}`}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 44px 1fr'}}>
                      <div style={{padding:'12px 20px',background:`${vsLeftTeam.color}10`,fontWeight:900,color:vsLeftTeam.color}}>
                        <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                          <div style={{width:'8px',height:'8px',borderRadius:'50%',background:vsLeftTeam.color,boxShadow:`0 0 4px ${vsLeftTeam.color}`}} />
                          {vsLeftTeam.name}
                        </div>
                        <div style={{fontSize:'0.76rem',color:T2,fontWeight:600,marginTop:'2px'}}>{vsLeftComp.name}</div>
                      </div>
                      <div style={{borderLeft:`1px solid ${B}`,borderRight:`1px solid ${B}`,background:'rgba(0,0,0,0.02)'}} />
                      <div style={{padding:'12px 20px',background:`${vsRightTeam.color}10`,fontWeight:900,color:vsRightTeam.color,textAlign:'right' as const}}>
                        <div style={{display:'flex',alignItems:'center',gap:'6px',justifyContent:'flex-end'}}>
                          {vsRightTeam.name}
                          <div style={{width:'8px',height:'8px',borderRadius:'50%',background:vsRightTeam.color,boxShadow:`0 0 4px ${vsRightTeam.color}`}} />
                        </div>
                        <div style={{fontSize:'0.76rem',color:T2,fontWeight:600,marginTop:'2px'}}>{vsRightComp.name}</div>
                      </div>
                    </div>
                    {ROLES.map((role,ri)=>{
                      const lP = [...vsLeftTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)).find(p=>p.role===role);
                      const rP = [...vsRightTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)).find(p=>p.role===role);
                      const lC = lP?.champs.find(x=>x.champ.id===vsLeftComp.picks[lP.id]);
                      const rC = rP?.champs.find(x=>x.champ.id===vsRightComp.picks[rP.id]);
                      return (
                        <div key={role} style={{display:'grid',gridTemplateColumns:'1fr 44px 1fr',borderTop:`1px solid ${B}`,background:ri%2===0?'transparent':'rgba(0,0,0,0.015)'}}>
                          <div style={{padding:'12px 20px',display:'flex',alignItems:'center',gap:'10px'}}>
                            {lC ? (
                              <>
                                <img src={img(lC.champ)} alt={lC.champ.name} style={{width:'44px',height:'44px',borderRadius:'9px',objectFit:'cover',border:`2px solid ${vsLeftTeam.color}55`,flexShrink:0}} />
                                <div>
                                  <div style={{fontWeight:800,fontSize:'0.92rem'}}>{lC.champ.name}</div>
                                  <div style={{fontSize:'0.74rem',color:T2,marginTop:'1px'}}>{lP?.name} <span style={{color:TAGS[lC.tag].color}}>{TAGS[lC.tag].short}</span></div>
                                  {lC.note&&<div style={{fontSize:'0.68rem',color:T3,marginTop:'2px',fontStyle:'italic'}}>{lC.note}</div>}
                                </div>
                              </>
                            ) : <span style={{color:T3,fontSize:'0.84rem'}}>{lP?.name||role} · 미선택</span>}
                          </div>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.2rem',borderLeft:`1px solid ${B}`,borderRight:`1px solid ${B}`}}>{RI[role]}</div>
                          <div style={{padding:'12px 20px',display:'flex',alignItems:'center',gap:'10px',justifyContent:'flex-end',flexDirection:'row-reverse'}}>
                            {rC ? (
                              <>
                                <img src={img(rC.champ)} alt={rC.champ.name} style={{width:'44px',height:'44px',borderRadius:'9px',objectFit:'cover',border:`2px solid ${vsRightTeam.color}55`,flexShrink:0}} />
                                <div style={{textAlign:'right' as const}}>
                                  <div style={{fontWeight:800,fontSize:'0.92rem'}}>{rC.champ.name}</div>
                                  <div style={{fontSize:'0.74rem',color:T2,marginTop:'1px'}}>{rP?.name} <span style={{color:TAGS[rC.tag].color}}>{TAGS[rC.tag].short}</span></div>
                                  {rC.note&&<div style={{fontSize:'0.68rem',color:T3,marginTop:'2px',fontStyle:'italic'}}>{rC.note}</div>}
                                </div>
                              </>
                            ) : <span style={{color:T3,fontSize:'0.84rem'}}>{rP?.name||role} · 미선택</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {(!vsLeftComp||!vsRightComp)&&<div style={{padding:'28px',textAlign:'center',color:T3,fontSize:'0.86rem',borderTop:`1px solid ${B}`}}>양쪽 팀과 조합을 선택하면 비교 결과가 나와요</div>}
              </div>
            )}

            {/* 팀 목록 헤더 */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
              <div>
                <div style={{fontWeight:900,fontSize:'1.2rem',letterSpacing:'-0.03em'}}>팀 목록</div>
                <div style={{fontSize:'0.82rem',color:T3,marginTop:'4px'}}>팀 클릭 → 챔피언 선택으로 조합 구성</div>
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={()=>{setVsMode(!vsMode);if(!vsMode){setVsLeft(null);setVsRight(null);}}}
                  style={{...Btn(vsMode?A:T2,vsMode?`${A}15`:S,vsMode?`${A}44`:B)}}>⚔️ 대전 비교</button>
                <button onClick={addTeam} style={{...Btn('#fff',A,'transparent')}}>+ 팀 추가</button>
              </div>
            </div>

            {teams.length===0 ? (
              <div style={{textAlign:'center',padding:'100px 0',color:T3}}>
                <div style={{fontSize:'3rem',marginBottom:'12px'}}>🏆</div>
                <div style={{fontWeight:700,fontSize:'1rem'}}>팀을 추가해보세요</div>
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'12px'}}>
                {teams.map(t=>{
                  const mustbans=t.players.flatMap(p=>p.champs.filter(pc=>pc.tag==='mustban'));
                  const compCount=getComps(t.id).length;
                  return (
                    <div key={t.id} className="tc"
                      onClick={()=>{setSel(t.id);setCurrentPicks({});}}
                      style={{background:S,border:`1px solid ${B}`,borderRadius:'14px',overflow:'hidden',cursor:'pointer',borderLeft:`4px solid ${t.color}`}}>
                      <div style={{padding:'16px 18px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                          <div style={{width:'9px',height:'9px',borderRadius:'50%',background:t.color,flexShrink:0,boxShadow:`0 0 5px ${t.color}`}} />
                          <span style={{fontWeight:900,fontSize:'1rem'}}>{t.name}</span>
                          {compCount>0&&<span style={{marginLeft:'auto',fontSize:'0.72rem',color:t.color,background:`${t.color}18`,padding:'2px 8px',borderRadius:'100px',fontWeight:700}}>조합 {compCount}</span>}
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:'5px'}}>
                          {[...t.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)).map(p=>(
                            <div key={p.id} style={{display:'flex',alignItems:'center',gap:'7px',fontSize:'0.84rem'}}>
                              <span style={{width:'20px',flexShrink:0}}>{RI[p.role]||'👤'}</span>
                              <span style={{fontWeight:700}}>{p.name}</span>
                              <span style={{color:T3,fontSize:'0.72rem'}}>챔 {p.champs.length}</span>
                            </div>
                          ))}
                        </div>
                        {mustbans.length>0&&(
                          <div style={{marginTop:'12px',display:'flex',alignItems:'center',gap:'5px'}}>
                            <span style={{fontSize:'0.68rem',color:'#FF5566',fontWeight:700,flexShrink:0}}>🔴 필밴</span>
                            <div style={{display:'flex',gap:'3px'}}>
                              {mustbans.slice(0,7).map(pc=>(
                                <img key={pc.champ.id} src={img(pc.champ)} alt={pc.champ.name} title={pc.champ.name}
                                  style={{width:'24px',height:'24px',borderRadius:'5px',objectFit:'cover',border:'1.5px solid rgba(255,85,102,0.4)'}} />
                              ))}
                              {mustbans.length>7&&<span style={{fontSize:'0.7rem',color:T3,alignSelf:'center'}}>+{mustbans.length-7}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{padding:'10px 18px',background:`${t.color}08`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <span style={{fontSize:'0.76rem',color:t.color,fontWeight:700}}>클릭해서 조합 짜기 →</span>
                        <button onClick={e=>{e.stopPropagation();if(confirm(`${t.name} 삭제?`))delTeam(t.id);}}
                          style={{fontSize:'0.74rem',padding:'4px 10px',borderRadius:'6px',border:'1px solid rgba(255,80,80,0.25)',background:'rgba(255,80,80,0.08)',color:'rgba(200,50,50,0.9)',cursor:'pointer',fontWeight:700,fontFamily:'inherit'}}>
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 팀 상세: 조합 짜기 ── */}
      {curTeam && (
        <div style={{padding:'20px clamp(1rem,4vw,2.5rem)',animation:'si 0.18s both'}}>
          <div style={{maxWidth:'960px',margin:'0 auto'}}>

            {/* 팀 헤더 */}
            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'20px',flexWrap:'wrap'}}>
              <button onClick={()=>{setSel(null);setEditMode(false);setPicker(null);setCurrentPicks({});}}
                style={{...Btn(T2,S,B),flexShrink:0}}>← 팀 목록</button>
              <div style={{width:'1px',height:'24px',background:B}} />
              {editMode ? (
                <input value={curTeam.name} onChange={e=>updTeam(curTeam.id,{name:e.target.value})}
                  style={{background:'#fff',border:`1.5px solid ${curTeam.color}77`,borderRadius:'8px',padding:'6px 12px',color:T,fontSize:'1rem',fontWeight:900,width:'140px'}} />
              ) : (
                <span style={{fontWeight:900,fontSize:'1.1rem',color:curTeam.color,flex:1}}>{curTeam.name}</span>
              )}
              <div style={{display:'flex',gap:'6px',flexShrink:0,marginLeft:'auto'}}>
                <button onClick={()=>setEditMode(!editMode)} style={{...Btn(editMode?A:T2,editMode?`${A}15`:S,editMode?`${A}44`:B)}}>
                  {editMode?'완료':'선수 편집'}
                </button>
                {!editMode && (
                  <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                    <input value={compName} onChange={e=>setCompName(e.target.value)} placeholder="조합 이름"
                      style={{background:'#fff',border:`1px solid ${B}`,borderRadius:'8px',padding:'6px 10px',color:T,fontSize:'0.86rem',width:'120px'}} />
                    <button onClick={saveComp} style={{...Btn('#fff',curTeam.color,'transparent')}}>💾 저장</button>
                  </div>
                )}
              </div>
            </div>

            {/* 저장된 조합 불러오기 */}
            {!editMode && getComps(curTeam.id).length>0 && (
              <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'16px',padding:'12px 16px',background:S,border:`1px solid ${B}`,borderRadius:'12px'}}>
                <span style={{fontSize:'0.78rem',fontWeight:700,color:T2,alignSelf:'center',marginRight:'2px'}}>불러오기:</span>
                {getComps(curTeam.id).map(c=>(
                  <div key={c.id} style={{display:'flex',alignItems:'center',gap:'0'}}>
                    <button onClick={()=>loadComp(c)}
                      style={{padding:'5px 12px',borderRadius:'7px 0 0 7px',border:`1px solid ${curTeam.color}44`,borderRight:'none',background:`${curTeam.color}10`,color:curTeam.color,fontSize:'0.8rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                      {c.name}
                    </button>
                    <button onClick={()=>delComp(curTeam.id,c.id)}
                      style={{padding:'5px 8px',borderRadius:'0 7px 7px 0',border:`1px solid ${curTeam.color}44`,background:`${curTeam.color}08`,color:'rgba(200,50,50,0.8)',fontSize:'0.78rem',cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 선수별 조합 선택 */}
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              {sortedP.map(p=>{
                const selChamp = p.champs.find(x=>x.champ.id===currentPicks[p.id]);
                return (
                  <div key={p.id} style={{background:S,border:`1.5px solid ${selChamp?curTeam.color+'44':B}`,borderRadius:'14px',overflow:'hidden',transition:'border-color 0.15s'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px 16px',borderBottom:p.champs.length>0?`1px solid ${B}`:'none',background:selChamp?`${curTeam.color}05`:'transparent'}}>
                      {/* 역할 + 선수명 */}
                      <div style={{display:'flex',alignItems:'center',gap:'8px',flexShrink:0,width:'120px'}}>
                        <div style={{width:'36px',height:'36px',borderRadius:'9px',background:`${curTeam.color}15`,border:`1.5px solid ${curTeam.color}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem'}}>
                          {RI[p.role]}
                        </div>
                        {editMode ? (
                          <input value={p.name} onChange={e=>{const pl=curTeam.players.map(x=>x.id===p.id?{...x,name:e.target.value}:x);updTeam(curTeam.id,{players:pl});}}
                            style={{background:'#fff',border:`1px solid ${curTeam.color}55`,borderRadius:'6px',padding:'4px 8px',color:T,fontSize:'0.88rem',fontWeight:800,width:'80px'}} />
                        ) : (
                          <span style={{fontWeight:900,fontSize:'0.92rem'}}>{p.name}</span>
                        )}
                      </div>

                      {/* 현재 선택된 챔피언 */}
                      {selChamp ? (
                        <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'5px 12px',background:`${curTeam.color}12`,border:`1.5px solid ${curTeam.color}44`,borderRadius:'9px',flexShrink:0}}>
                          <img src={img(selChamp.champ)} alt={selChamp.champ.name} style={{width:'32px',height:'32px',borderRadius:'6px',objectFit:'cover'}} />
                          <div>
                            <div style={{fontWeight:800,fontSize:'0.88rem',color:curTeam.color}}>{selChamp.champ.name}</div>
                            <div style={{fontSize:'0.68rem',color:TAGS[selChamp.tag].color}}>{TAGS[selChamp.tag].label}</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{padding:'6px 12px',background:'rgba(0,0,0,0.03)',border:`1.5px dashed ${B}`,borderRadius:'9px',fontSize:'0.82rem',color:T3,flexShrink:0}}>
                          챔피언 선택
                        </div>
                      )}

                      {/* 챔피언 추가 버튼 (편집 모드) */}
                      {editMode && (
                        <button onClick={()=>{setPicker(p.id);setMs('');}}
                          style={{...Btn('#fff',curTeam.color,'transparent',{marginLeft:'auto',flexShrink:0})}}>
                          + 챔피언
                        </button>
                      )}
                    </div>

                    {/* 챔피언 선택 그리드 */}
                    {p.champs.length>0 && (
                      <div style={{padding:'10px 14px',display:'flex',gap:'6px',flexWrap:'wrap'}}>
                        {p.champs.map(pc=>{
                          const isSel = currentPicks[p.id]===pc.champ.id;
                          const tg    = TAGS[pc.tag];
                          return (
                            <div key={pc.champ.id} style={{position:'relative',flexShrink:0}}>
                              <div onClick={()=>!editMode&&togglePick(p.id,pc.champ.id)}
                                title={`${pc.champ.name} (${tg.label})`}
                                style={{borderRadius:'9px',overflow:'hidden',cursor:editMode?'default':'pointer',
                                  border:isSel?`2.5px solid ${curTeam.color}`:`2px solid ${tg.bd}`,
                                  boxShadow:isSel?`0 0 0 3px ${curTeam.color}33, 0 2px 8px ${curTeam.color}33`:'none',
                                  transition:'all 0.12s',
                                }}>
                                <img src={img(pc.champ)} alt={pc.champ.name}
                                  style={{width:'48px',height:'48px',objectFit:'cover',display:'block',opacity:isSel?1:0.75,transition:'opacity 0.1s'}} />
                                <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.82))',padding:'2px 2px 3px',fontSize:'0.52rem',fontWeight:700,color:'#fff',textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                  {pc.champ.name}
                                </div>
                                <div style={{position:'absolute',top:'2px',right:'2px',fontSize:'0.6rem',lineHeight:1}}>{tg.short}</div>
                              </div>
                              {/* 편집 모드: 태그변경 + 삭제 */}
                              {editMode && (
                                <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'3px',background:'rgba(255,255,255,0.92)',borderRadius:'9px',border:`2px solid ${tg.bd}`}}>
                                  <select value={pc.tag} onChange={e=>updPC(p.id,pc.champ.id,{tag:e.target.value as any})}
                                    style={{background:tg.bg,border:`1px solid ${tg.bd}`,borderRadius:'4px',padding:'2px 4px',color:tg.color,fontSize:'0.62rem',fontWeight:700,cursor:'pointer',width:'46px',textAlign:'center'}}>
                                    {Object.entries(TAGS).map(([k,v])=><option key={k} value={k}>{v.short}</option>)}
                                  </select>
                                  <button onClick={()=>delPC(p.id,pc.champ.id)}
                                    style={{background:'rgba(255,80,80,0.12)',border:'1px solid rgba(255,80,80,0.3)',borderRadius:'4px',color:'rgba(200,40,40,0.9)',cursor:'pointer',fontSize:'0.62rem',fontWeight:700,padding:'1px 6px',fontFamily:'inherit'}}>
                                    삭제
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {p.champs.length===0&&<div style={{fontSize:'0.8rem',color:T3,padding:'10px 0'}}>챔피언 없음 · 편집 모드에서 추가</div>}
                      </div>
                    )}

                    {/* 메모 (편집 모드) */}
                    {editMode && selChamp && (
                      <div style={{borderTop:`1px solid ${B}`,padding:'8px 14px'}}>
                        <input value={selChamp.note} onChange={e=>updPC(p.id,selChamp.champ.id,{note:e.target.value})}
                          placeholder={`${selChamp.champ.name} 메모`}
                          style={{width:'100%',background:'rgba(0,0,0,0.02)',border:`1px solid ${B}`,borderRadius:'7px',padding:'6px 10px',color:T,fontSize:'0.8rem'}} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 챔피언 추가 모달 */}
      {picker && curTeam && (()=>{
        const p=curTeam.players.find(x=>x.id===picker); if(!p) return null;
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}}
            onClick={e=>{if(e.target===e.currentTarget)setPicker(null);}}>
            <div style={{background:'#fff',border:`1.5px solid ${curTeam.color}44`,borderRadius:'18px',width:'100%',maxWidth:'680px',overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,0.18)'}}>
              <div style={{padding:'14px 18px',borderBottom:`1px solid ${B}`,display:'flex',alignItems:'center',gap:'10px',background:`${curTeam.color}08`}}>
                <span style={{fontWeight:900,fontSize:'0.96rem',color:curTeam.color}}>{curTeam.name}</span>
                <span style={{fontSize:'0.9rem',color:T2,fontWeight:700}}>· {p.name} 챔피언 추가</span>
                <button onClick={()=>setPicker(null)} style={{marginLeft:'auto',...Btn(T2,S,B,{padding:'5px 12px'})}}>닫기 ✕</button>
              </div>
              <div style={{padding:'12px 16px 10px',display:'flex',gap:'10px',alignItems:'center',borderBottom:`1px solid ${B}`}}>
                <input autoFocus value={ms} onChange={e=>setMs(e.target.value)} placeholder="챔피언 검색..."
                  style={{flex:1,background:'#f8f9fb',border:`1.5px solid ${curTeam.color}55`,borderRadius:'9px',padding:'9px 14px',color:T,fontSize:'0.96rem'}} />
                <span style={{fontSize:'0.76rem',color:T3}}>{mfChamps.length}개</span>
              </div>
              <div style={{padding:'12px 16px 16px',maxHeight:'400px',overflowY:'auto',background:'#fafafa'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(68px,1fr))',gap:'6px'}}>
                  {mfChamps.map(c=>(
                    <div key={c.id} className="ci" onClick={()=>addPC(picker,c)} title={c.name}
                      style={{borderRadius:'9px',overflow:'hidden',cursor:'pointer',border:'1.5px solid transparent',position:'relative'}}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor=curTeam.color}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='transparent'}>
                      <img src={img(c)} alt={c.name} style={{width:'100%',aspectRatio:'1',display:'block',objectFit:'cover'}} />
                      <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.85))',padding:'3px 3px 4px',fontSize:'0.56rem',fontWeight:700,color:'#fff',textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</div>
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
