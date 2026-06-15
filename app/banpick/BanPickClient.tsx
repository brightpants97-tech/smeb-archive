'use client';
import { useState, useEffect, useMemo } from 'react';

const A  = '#EB701A';
const BG = '#F4F5F8';
const S  = '#ffffff';
const B  = 'rgba(0,0,0,0.09)';
const T  = '#111';
const T2 = '#666';
const T3 = '#AAA';
const BLUE_C = '#4A8FFF';
const RED_C  = '#FF4A6A';

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
interface Composition { id:string; name:string; picks:Record<string,string>; }

const Btn = (color:string, bg:string, bd:string, extra?:object) => ({
  padding:'6px 13px', borderRadius:'7px', border:`1px solid ${bd}`,
  background:bg, color, cursor:'pointer' as const, fontSize:'0.84rem', fontWeight:700,
  fontFamily:'inherit', lineHeight:'1.4', ...extra,
});

type View = 'main' | 'manage';

export default function BanPickClient() {
  const [view, setView]       = useState<View>('main');
  const [champs, setChamps]   = useState<Champ[]>([]);
  const [ver, setVer]         = useState('');
  const [teams, setTeams]     = useState<Team[]>([]);
  const [comps, setComps]     = useState<Record<string, Composition[]>>({});
  const [saved, setSaved]     = useState(false);

  // 메인: 블루/레드 선택
  const [blueTeamId, setBlueTeamId] = useState<string|null>(null);
  const [redTeamId,  setRedTeamId]  = useState<string|null>(null);
  const [bluePicks, setBluePicks]   = useState<Record<string,string>>({});
  const [redPicks,  setRedPicks]    = useState<Record<string,string>>({});
  const [blueCompName, setBlueCompName] = useState('');
  const [redCompName,  setRedCompName]  = useState('');

  // 팀 관리
  const [manageTeamId, setManageTeamId] = useState<string|null>(null);
  const [editMode,     setEditMode]     = useState(false);
  const [picker,       setPicker]       = useState<string|null>(null); // player id
  const [ms,           setMs]           = useState('');
  const [noteKey,      setNoteKey]      = useState<string|null>(null);
  const [vsTeamId,  setVsTeamId]  = useState<string|null>(null); // 상대팀
  const [vsCompId,  setVsCompId]  = useState<string|null>(null); // 상대 조합
  const [managePicks, setManagePicks]   = useState<Record<string,string>>({});  // 팀 관리 화면에서 바로 조합
  const [manCompName, setManCompName]   = useState('');

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

  const img    = (c:Champ) => `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${c.img}`;
  const flash  = () => { setSaved(true); setTimeout(()=>setSaved(false),1400); };
  const saveT  = (t:Team[]) => { setTeams(t); try{localStorage.setItem('bp-teams',JSON.stringify(t));flash();}catch{} };
  const saveC  = (c:Record<string,Composition[]>) => { setComps(c); try{localStorage.setItem('bp-comps',JSON.stringify(c));flash();}catch{} };
  const getC   = (tid:string) => comps[tid]||[];
  const getTeam= (id:string|null) => id ? teams.find(t=>t.id===id)||null : null;

  // 팀 CRUD
  const addTeam = () => {
    const tid=Date.now()+'';
    const players:Player[]=ROLES.map((role,i)=>({id:`${tid}_${i}`,name:`${role} 선수`,role,champs:[]}));
    const t:Team={id:tid,name:`팀 ${teams.length+1}`,color:COLORS[teams.length%COLORS.length],players};
    saveT([...teams,t]); setManageTeamId(tid); setEditMode(true);
  };
  const updTeam=(id:string,p:Partial<Team>)=>saveT(teams.map(t=>t.id===id?{...t,...p}:t));
  const delTeam=(id:string)=>{saveT(teams.filter(t=>t.id!==id));if(blueTeamId===id)setBlueTeamId(null);if(redTeamId===id)setRedTeamId(null);};

  // 챔피언 CRUD
  const addPC=(pid:string,c:Champ)=>{
    if(!manageTeamId) return;
    const tm=getTeam(manageTeamId); if(!tm) return;
    const players=tm.players.map(p=>p.id===pid?{...p,champs:p.champs.find(x=>x.champ.id===c.id)?p.champs:[...p.champs,{champ:c,tag:'onetrick' as const,note:''}]}:p);
    updTeam(manageTeamId,{players});
  };
  const updPC=(pid:string,cid:string,patch:Partial<PChamp>)=>{
    if(!manageTeamId) return;
    const tm=getTeam(manageTeamId); if(!tm) return;
    updTeam(manageTeamId,{players:tm.players.map(p=>p.id===pid?{...p,champs:p.champs.map(x=>x.champ.id===cid?{...x,...patch}:x)}:p)});
  };
  const delPC=(pid:string,cid:string)=>{
    if(!manageTeamId) return;
    const tm=getTeam(manageTeamId); if(!tm) return;
    updTeam(manageTeamId,{players:tm.players.map(p=>p.id===pid?{...p,champs:p.champs.filter(x=>x.champ.id!==cid)}:p)});
  };

  // 조합 저장/불러오기
  const saveComp=(side:'blue'|'red')=>{
    const tid=side==='blue'?blueTeamId:redTeamId; if(!tid) return;
    const picks=side==='blue'?bluePicks:redPicks;
    const name=(side==='blue'?blueCompName:redCompName).trim()||`조합 ${getC(tid).length+1}`;
    const nc:Composition={id:Date.now()+'',name,picks:{...picks}};
    saveC({...comps,[tid]:[...getC(tid),nc]});
    if(side==='blue') setBlueCompName(''); else setRedCompName('');
  };
  const loadComp=(side:'blue'|'red',c:Composition)=>{ if(side==='blue') setBluePicks({...c.picks}); else setRedPicks({...c.picks}); };
  const delComp=(tid:string,cid:string)=>saveC({...comps,[tid]:getC(tid).filter(c=>c.id!==cid)});

  const togglePick=(side:'blue'|'red',pid:string,champId:string)=>{
    if(side==='blue') setBluePicks(p=>p[pid]===champId?{...p,[pid]:''}:{...p,[pid]:champId});
    else setRedPicks(p=>p[pid]===champId?{...p,[pid]:''}:{...p,[pid]:champId});
  };

  const blueTeam  = getTeam(blueTeamId);
  const redTeam   = getTeam(redTeamId);
  const manTeam   = getTeam(manageTeamId);
  const manSorted = manTeam ? [...manTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)) : [];
  const mfChamps  = useMemo(()=>{
    if(!picker||!manageTeamId) return [];
    const p=getTeam(manageTeamId)?.players.find(x=>x.id===picker);
    return champs.filter(c=>(c.name.includes(ms)||c.id.toLowerCase().includes(ms.toLowerCase()))&&!p?.champs.find(x=>x.champ.id===c.id));
  },[champs,ms,picker,manageTeamId,teams]);

  // 팀 패널 컴포넌트 (블루/레드 공용)
  const TeamPanel = ({side}:{side:'blue'|'red'}) => {
    const teamId  = side==='blue' ? blueTeamId : redTeamId;
    const setTid  = side==='blue' ? setBlueTeamId : setRedTeamId;
    const picks   = side==='blue' ? bluePicks : redPicks;
    const cName   = side==='blue' ? blueCompName : redCompName;
    const setCName= side==='blue' ? setBlueCompName : setRedCompName;
    const sideC   = side==='blue' ? BLUE_C : RED_C;
    const team    = getTeam(teamId);
    const sorted  = team ? [...team.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)) : [];

    return (
      <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:'10px'}}>
        {/* 팀 선택 */}
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          <div style={{fontSize:'0.68rem',fontWeight:800,color:sideC,letterSpacing:'0.1em',flexShrink:0,width:'32px'}}>{side==='blue'?'BLUE':'RED'}</div>
          <select value={teamId||''} onChange={e=>{setTid(e.target.value||null);if(side==='blue')setBluePicks({});else setRedPicks({});}}
            style={{flex:1,background:team?`${team.color}10`:S,border:`1.5px solid ${team?team.color+'55':B}`,borderRadius:'9px',padding:'8px 12px',color:team?.color||T,fontSize:'0.9rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
            <option value="">팀 선택</option>
            {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* 선수별 챔피언 선택 */}
        {team && (
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {sorted.map(p=>{
              const selC = p.champs.find(x=>x.champ.id===picks[p.id]);
              return (
                <div key={p.id} style={{background:S,border:`1.5px solid ${selC?team.color+'44':B}`,borderRadius:'12px',overflow:'hidden',transition:'border-color 0.12s'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'9px 12px',borderBottom:p.champs.length>0?`1px solid ${B}`:'none',background:selC?`${team.color}05`:'transparent'}}>
                    <span style={{fontSize:'1rem',flexShrink:0}}>{RI[p.role]}</span>
                    <span style={{fontWeight:800,fontSize:'0.88rem',flex:1}}>{p.name}</span>
                    {selC && (
                      <div style={{display:'flex',alignItems:'center',gap:'6px',padding:'3px 9px',background:`${team.color}15`,border:`1.5px solid ${team.color}44`,borderRadius:'7px'}}>
                        <img src={img(selC.champ)} alt={selC.champ.name} style={{width:'24px',height:'24px',borderRadius:'5px',objectFit:'cover'}} />
                        <span style={{fontWeight:800,fontSize:'0.8rem',color:team.color}}>{selC.champ.name}</span>
                        <span style={{fontSize:'0.62rem',color:TAGS[selC.tag].color}}>{TAGS[selC.tag].short}</span>
                      </div>
                    )}
                  </div>
                  {p.champs.length>0 && (
                    <div style={{padding:'8px 10px',display:'flex',gap:'5px',flexWrap:'wrap'}}>
                      {p.champs.map(pc=>{
                        const isSel=picks[p.id]===pc.champ.id;
                        const tg=TAGS[pc.tag];
                        return (
                          <div key={pc.champ.id} onClick={()=>togglePick(side,p.id,pc.champ.id)}
                            title={`${pc.champ.name} (${tg.label})`}
                            style={{position:'relative',cursor:'pointer',borderRadius:'8px',overflow:'hidden',flexShrink:0,
                              border:isSel?`2.5px solid ${team.color}`:`2px solid ${tg.bd}`,
                              boxShadow:isSel?`0 0 0 2px ${team.color}33`:'none',transition:'all 0.1s',
                            }}>
                            <img src={img(pc.champ)} alt={pc.champ.name}
                              style={{width:'44px',height:'44px',objectFit:'cover',display:'block',opacity:isSel?1:0.72}} />
                            <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.82))',padding:'2px 2px 3px',fontSize:'0.5rem',fontWeight:700,color:'#fff',textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pc.champ.name}</div>
                            <div style={{position:'absolute',top:'1px',right:'2px',fontSize:'0.58rem',lineHeight:1}}>{tg.short}</div>
                          </div>
                        );
                      })}
                      {p.champs.length===0 && <span style={{fontSize:'0.76rem',color:T3,padding:'10px 0'}}>챔피언 없음</span>}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 저장/불러오기 */}
            <div style={{display:'flex',gap:'6px',alignItems:'center',flexWrap:'wrap'}}>
              <input value={cName} onChange={e=>setCName(e.target.value)} placeholder="조합 이름"
                style={{flex:1,minWidth:'80px',background:'#fff',border:`1px solid ${B}`,borderRadius:'7px',padding:'6px 10px',color:T,fontSize:'0.82rem'}} />
              <button onClick={()=>saveComp(side)} style={{...Btn('#fff',team.color,'transparent',{flexShrink:0})}}>💾 저장</button>
            </div>
            {getC(team.id).length>0 && (
              <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
                {getC(team.id).map(c=>(
                  <div key={c.id} style={{display:'flex'}}>
                    <button onClick={()=>loadComp(side,c)}
                      style={{padding:'4px 10px',borderRadius:'6px 0 0 6px',border:`1px solid ${team.color}44`,borderRight:'none',background:`${team.color}10`,color:team.color,fontSize:'0.76rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                      {c.name}
                    </button>
                    <button onClick={()=>delComp(team.id,c.id)}
                      style={{padding:'4px 7px',borderRadius:'0 6px 6px 0',border:`1px solid ${team.color}44`,background:`${team.color}08`,color:'rgba(200,50,50,0.8)',fontSize:'0.76rem',cursor:'pointer',fontFamily:'inherit'}}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!team && (
          <div style={{textAlign:'center',padding:'40px 0',color:T3,fontSize:'0.84rem'}}>팀을 선택하면<br/>챔피언 풀이 나와요</div>
        )}
      </div>
    );
  };

  // 비교 결과 표시 여부
  const showCmp = blueTeam && redTeam && ROLES.some(role=>{
    const bP=[...blueTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)).find(p=>p.role===role);
    const rP=[...redTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)).find(p=>p.role===role);
    return (bP && bluePicks[bP.id]) || (rP && redPicks[rP.id]);
  });

  return (
    <div style={{background:BG,minHeight:'100vh',color:T,fontFamily:'system-ui,sans-serif',paddingBottom:'60px'}}>
      <style>{`
        @keyframes fi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        input,textarea,select{font-family:inherit}
        input::placeholder{color:${T3}}
        input:focus,select:focus{outline:none}
        .ci{transition:transform 0.08s}.ci:hover{transform:scale(1.06)}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.14);border-radius:4px}
      `}</style>

      {/* 헤더 */}
      <div style={{borderBottom:`1px solid ${B}`,padding:'0 clamp(1rem,4vw,2rem)',display:'flex',alignItems:'stretch',height:'52px',background:S,position:'sticky',top:0,zIndex:100}}>
        <a href="/" style={{color:T2,fontSize:'0.88rem',textDecoration:'none',fontWeight:700,paddingRight:'14px',borderRight:`1px solid ${B}`,display:'flex',alignItems:'center'}}>← 홈</a>
        <div style={{display:'flex',alignItems:'center',padding:'0 14px',gap:'8px',flex:1}}>
          <span style={{fontWeight:900,fontSize:'0.96rem'}}>⚔️ 조합 분석</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          {saved&&<span style={{fontSize:'0.74rem',color:'#33CC77',fontWeight:700}}>✓ 저장됨</span>}
          <button onClick={()=>setView(view==='main'?'manage':'main')}
            style={{...Btn(view==='manage'?A:T2,view==='manage'?`${A}15`:S,view==='manage'?`${A}44`:B)}}>
            {view==='manage'?'← 조합으로':'⚙️ 팀 관리'}
          </button>
          {ver&&<span style={{fontSize:'0.66rem',color:T3}}>v{ver.slice(0,5)}</span>}
        </div>
      </div>

      {/* ── 메인: 블루 vs 레드 조합 ── */}
      {view==='main' && (
        <div style={{padding:'20px clamp(1rem,4vw,2rem)',animation:'fi 0.18s both'}}>
          <div style={{maxWidth:'1100px',margin:'0 auto'}}>
            {teams.length===0 ? (
              <div style={{textAlign:'center',padding:'80px 0',color:T3}}>
                <div style={{fontSize:'2.5rem',marginBottom:'12px'}}>⚙️</div>
                <div style={{fontWeight:700,fontSize:'1rem',marginBottom:'8px'}}>먼저 팀을 만들어보세요</div>
                <button onClick={()=>setView('manage')} style={{...Btn('#fff',A,'transparent',{fontSize:'0.9rem',padding:'9px 20px'})}}>팀 관리로 이동</button>
              </div>
            ) : (
              <>
                {/* 블루 | 레드 패널 */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',alignItems:'start'}}>
                  <div style={{background:`${BLUE_C}08`,border:`1.5px solid ${BLUE_C}30`,borderRadius:'16px',padding:'16px'}}>
                    <TeamPanel side="blue" />
                  </div>
                  <div style={{background:`${RED_C}08`,border:`1.5px solid ${RED_C}30`,borderRadius:'16px',padding:'16px'}}>
                    <TeamPanel side="red" />
                  </div>
                </div>

                {/* 비교 결과 */}
                {showCmp && blueTeam && redTeam && (
                  <div style={{marginTop:'20px',background:S,border:`1px solid ${B}`,borderRadius:'14px',overflow:'hidden',animation:'fi 0.18s both'}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 44px 1fr',borderBottom:`1px solid ${B}`}}>
                      <div style={{padding:'11px 18px',background:`${blueTeam.color}10`,fontWeight:900,fontSize:'0.92rem',color:blueTeam.color}}>
                        <span style={{display:'inline-flex',alignItems:'center',gap:'6px'}}>
                          <span style={{width:'7px',height:'7px',borderRadius:'50%',background:blueTeam.color,display:'inline-block',boxShadow:`0 0 4px ${blueTeam.color}`}} />
                          {blueTeam.name}
                        </span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.02)',borderLeft:`1px solid ${B}`,borderRight:`1px solid ${B}`,fontSize:'0.76rem',fontWeight:900,color:T3}}>VS</div>
                      <div style={{padding:'11px 18px',background:`${redTeam.color}10`,fontWeight:900,fontSize:'0.92rem',color:redTeam.color,textAlign:'right' as const}}>
                        <span style={{display:'inline-flex',alignItems:'center',gap:'6px',justifyContent:'flex-end'}}>
                          {redTeam.name}
                          <span style={{width:'7px',height:'7px',borderRadius:'50%',background:redTeam.color,display:'inline-block',boxShadow:`0 0 4px ${redTeam.color}`}} />
                        </span>
                      </div>
                    </div>
                    {ROLES.map((role,ri)=>{
                      const bP=[...blueTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)).find(p=>p.role===role);
                      const rP=[...redTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)).find(p=>p.role===role);
                      const bC=bP?.champs.find(x=>x.champ.id===bluePicks[bP.id]);
                      const rC=rP?.champs.find(x=>x.champ.id===redPicks[rP.id]);
                      return (
                        <div key={role} style={{display:'grid',gridTemplateColumns:'1fr 44px 1fr',borderTop:`1px solid ${B}`,background:ri%2===0?'transparent':'rgba(0,0,0,0.015)'}}>
                          <div style={{padding:'11px 18px',display:'flex',alignItems:'center',gap:'10px'}}>
                            {bC?(
                              <>
                                <img src={img(bC.champ)} alt={bC.champ.name} style={{width:'42px',height:'42px',borderRadius:'8px',objectFit:'cover',border:`2px solid ${blueTeam.color}55`,flexShrink:0}} />
                                <div>
                                  <div style={{fontWeight:800,fontSize:'0.9rem'}}>{bC.champ.name}</div>
                                  <div style={{fontSize:'0.72rem',color:T2,marginTop:'1px'}}>{bP?.name} <span style={{color:TAGS[bC.tag].color}}>{TAGS[bC.tag].short}</span></div>
                                  {bC.note&&<div style={{fontSize:'0.66rem',color:T3,marginTop:'1px',fontStyle:'italic'}}>{bC.note}</div>}
                                </div>
                              </>
                            ):<span style={{color:T3,fontSize:'0.82rem'}}>{bP?.name||role} · 미선택</span>}
                          </div>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',borderLeft:`1px solid ${B}`,borderRight:`1px solid ${B}`}}>{RI[role]}</div>
                          <div style={{padding:'11px 18px',display:'flex',alignItems:'center',gap:'10px',justifyContent:'flex-end',flexDirection:'row-reverse'}}>
                            {rC?(
                              <>
                                <img src={img(rC.champ)} alt={rC.champ.name} style={{width:'42px',height:'42px',borderRadius:'8px',objectFit:'cover',border:`2px solid ${redTeam.color}55`,flexShrink:0}} />
                                <div style={{textAlign:'right' as const}}>
                                  <div style={{fontWeight:800,fontSize:'0.9rem'}}>{rC.champ.name}</div>
                                  <div style={{fontSize:'0.72rem',color:T2,marginTop:'1px'}}>{rP?.name} <span style={{color:TAGS[rC.tag].color}}>{TAGS[rC.tag].short}</span></div>
                                  {rC.note&&<div style={{fontSize:'0.66rem',color:T3,marginTop:'1px',fontStyle:'italic'}}>{rC.note}</div>}
                                </div>
                              </>
                            ):<span style={{color:T3,fontSize:'0.82rem'}}>{rP?.name||role} · 미선택</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 팀 관리 ── */}
      {view==='manage' && (
        <div style={{padding:'20px clamp(1rem,4vw,2rem)',animation:'fi 0.18s both'}}>
          <div style={{maxWidth:'960px',margin:'0 auto'}}>
            <div style={{display:'flex',gap:'10px',alignItems:'center',marginBottom:'20px'}}>
              <div style={{fontWeight:900,fontSize:'1.1rem'}}>팀 관리</div>
              <button onClick={addTeam} style={{...Btn('#fff',A,'transparent',{marginLeft:'auto'})}}>+ 팀 추가</button>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 260px',gap:'16px',alignItems:'start'}}>
            <div>{/* 왼쪽: 팀 탭 + 편집 */}

            {/* 팀 탭 */}
            {teams.length>0 && (
              <div style={{display:'flex',gap:'6px',marginBottom:'16px',flexWrap:'wrap'}}>
                {teams.map(t=>(
                  <div key={t.id} style={{display:'flex',gap:'0'}}>
                    <button onClick={()=>{setManageTeamId(t.id);setEditMode(false);setManagePicks({});setVsTeamId(null);setVsCompId(null);}}
                      style={{padding:'6px 14px',borderRadius:'8px 0 0 8px',border:`1.5px solid ${manageTeamId===t.id?t.color+'66':B}`,borderRight:'none',background:manageTeamId===t.id?`${t.color}18`:S,color:manageTeamId===t.id?t.color:T2,fontSize:'0.86rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                      {t.name}
                    </button>
                    <button onClick={()=>{if(confirm(`${t.name} 삭제?`))delTeam(t.id);if(manageTeamId===t.id)setManageTeamId(null);}}
                      style={{padding:'6px 8px',borderRadius:'0 8px 8px 0',border:`1.5px solid ${B}`,background:S,color:'rgba(200,50,50,0.7)',fontSize:'0.8rem',cursor:'pointer',fontFamily:'inherit'}}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* 선택된 팀 편집 */}
            {manTeam && (
              <div style={{background:S,border:`1.5px solid ${manTeam.color}44`,borderRadius:'16px',overflow:'hidden'}}>
                {/* 팀 헤더 */}
                <div style={{padding:'12px 16px',borderBottom:`1px solid ${B}`,display:'flex',alignItems:'center',gap:'8px',background:`${manTeam.color}06`}}>
                  {editMode?(
                    <>
                      <input value={manTeam.name} onChange={e=>updTeam(manTeam.id,{name:e.target.value})}
                        style={{background:'#fff',border:`1.5px solid ${manTeam.color}66`,borderRadius:'7px',padding:'5px 10px',color:T,fontSize:'0.96rem',fontWeight:900,width:'130px'}} />
                      <div style={{display:'flex',gap:'3px'}}>
                        {COLORS.map(c=><div key={c} onClick={()=>updTeam(manTeam.id,{color:c})} style={{width:'18px',height:'18px',borderRadius:'50%',background:c,cursor:'pointer',border:manTeam.color===c?'2.5px solid #333':'2.5px solid transparent'}} />)}
                      </div>
                    </>
                  ):(
                    <span style={{fontWeight:900,fontSize:'0.96rem',color:manTeam.color}}>{manTeam.name}</span>
                  )}
                  <div style={{display:'flex',gap:'6px',marginLeft:'auto'}}>
                    <button onClick={()=>setEditMode(!editMode)} style={{...Btn(editMode?A:T2,editMode?`${A}15`:S,editMode?`${A}44`:B)}}>
                      {editMode?'완료':'편집'}
                    </button>
                  </div>
                </div>

                {/* 조합 모드 안내 */}
                {!editMode && (
                  <div style={{padding:'7px 16px',borderBottom:`1px solid ${B}`,display:'flex',alignItems:'center',gap:'6px',background:'rgba(0,0,0,0.015)'}}>
                    <span style={{fontSize:'0.74rem',color:T3}}>⚔️ 챔피언을 클릭해 오른쪽 패널에서 조합을 구성하세요</span>
                  </div>
                )}

                {/* 선수별 */}
                <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:'10px'}}>
                  {manSorted.map(p=>(
                    <div key={p.id} style={{display:'flex',alignItems:'flex-start',gap:'10px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'6px',width:'110px',flexShrink:0,paddingTop:'10px'}}>
                        <span style={{fontSize:'1rem'}}>{RI[p.role]}</span>
                        {editMode?(
                          <input value={p.name} onChange={e=>updTeam(manTeam.id,{players:manTeam.players.map(x=>x.id===p.id?{...x,name:e.target.value}:x)})}
                            style={{background:'#fff',border:`1px solid ${manTeam.color}55`,borderRadius:'6px',padding:'4px 6px',color:T,fontSize:'0.84rem',fontWeight:800,width:'72px'}} />
                        ):(
                          <span style={{fontWeight:800,fontSize:'0.88rem'}}>{p.name}</span>
                        )}
                      </div>
                      <div style={{flex:1,display:'flex',flexWrap:'wrap',gap:'5px'}}>
                        {p.champs.map(pc=>{
                          const tg=TAGS[pc.tag]; const nk=`${p.id}-${pc.champ.id}`;
                          return (
                            <div key={pc.champ.id} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px'}}>
                              {(() => {
                                const isSel = managePicks[p.id]===pc.champ.id;
                                return (
                                  <div onClick={()=>!editMode&&setManagePicks(prev=>prev[p.id]===pc.champ.id?{...prev,[p.id]:''}:{...prev,[p.id]:pc.champ.id})}
                                    style={{position:'relative',borderRadius:'8px',overflow:'hidden',
                                      border:isSel?`2.5px solid ${manTeam.color}`:`2px solid ${tg.bd}`,
                                      boxShadow:isSel?`0 0 0 2px ${manTeam.color}44`:'none',
                                      cursor:editMode?'default':'pointer',flexShrink:0,transition:'all 0.1s'}}>
                                    <img src={img(pc.champ)} alt={pc.champ.name} title={pc.champ.name}
                                      style={{width:'44px',height:'44px',objectFit:'cover',display:'block',opacity:isSel?1:0.75}} />
                                    <div style={{position:'absolute',top:'1px',right:'2px',fontSize:'0.58rem',lineHeight:1}}>{tg.short}</div>
                                    {isSel&&<div style={{position:'absolute',bottom:'2px',left:'50%',transform:'translateX(-50%)',width:'6px',height:'6px',borderRadius:'50%',background:manTeam.color}} />}
                                  </div>
                                );
                              })()}
                              {editMode&&(
                                <div style={{display:'flex',gap:'3px'}}>
                                  <select value={pc.tag} onChange={e=>updPC(p.id,pc.champ.id,{tag:e.target.value as any})}
                                    style={{background:tg.bg,border:`1px solid ${tg.bd}`,borderRadius:'4px',padding:'1px 3px',color:tg.color,fontSize:'0.6rem',fontWeight:700,cursor:'pointer',width:'38px'}}>
                                    {Object.entries(TAGS).map(([k,v])=><option key={k} value={k}>{v.short}</option>)}
                                  </select>
                                  <button onClick={()=>delPC(p.id,pc.champ.id)}
                                    style={{background:'rgba(255,80,80,0.1)',border:'1px solid rgba(255,80,80,0.3)',borderRadius:'4px',color:'rgba(200,40,40,0.9)',cursor:'pointer',fontSize:'0.6rem',fontWeight:700,padding:'1px 4px',fontFamily:'inherit'}}>✕</button>
                                </div>
                              )}
                              {editMode&&(
                                <input value={pc.note} onChange={e=>updPC(p.id,pc.champ.id,{note:e.target.value})} placeholder="메모"
                                  style={{width:'44px',background:'rgba(0,0,0,0.04)',border:`1px solid ${B}`,borderRadius:'4px',padding:'2px 4px',color:T,fontSize:'0.6rem',textAlign:'center'}} />
                              )}
                            </div>
                          );
                        })}
                        {editMode&&(
                          <button onClick={()=>{setPicker(p.id);setMs('');}}
                            style={{width:'44px',height:'44px',borderRadius:'8px',border:`1.5px dashed ${manTeam.color}55`,background:`${manTeam.color}08`,color:manTeam.color,cursor:'pointer',fontSize:'1.3rem',fontFamily:'inherit'}}>+</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {teams.length===0&&<div style={{textAlign:'center',padding:'60px 0',color:T3}}>
              <div style={{fontSize:'2.5rem',marginBottom:'10px'}}>🏆</div>
              <div style={{fontWeight:700}}>+ 팀 추가로 시작해보세요</div>
            </div>}

            </div>{/* 왼쪽 끝 */}

            {/* 오른쪽: 현재 조합 패널 */}
            {manTeam && (
              <div style={{position:'sticky',top:'68px',background:S,border:`1.5px solid ${manTeam.color}33`,borderRadius:'14px',overflow:'hidden'}}>
                {/* 패널 헤더 */}
                <div style={{padding:'11px 14px',borderBottom:`1px solid ${B}`,background:`${manTeam.color}08`,display:'flex',alignItems:'center',gap:'8px'}}>
                  <div style={{width:'8px',height:'8px',borderRadius:'50%',background:manTeam.color,boxShadow:`0 0 5px ${manTeam.color}`}} />
                  <span style={{fontWeight:900,fontSize:'0.88rem',color:manTeam.color}}>현재 조합</span>
                  <button onClick={()=>setManagePicks({})} style={{marginLeft:'auto',background:'none',border:'none',color:T3,cursor:'pointer',fontSize:'0.72rem',fontWeight:700,fontFamily:'inherit'}}>초기화</button>
                </div>

                {/* 포지션별 선택 현황 */}
                <div style={{padding:'10px 12px',display:'flex',flexDirection:'column',gap:'6px'}}>
                  {[...manTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)).map(p=>{
                    const selC = p.champs.find(x=>x.champ.id===managePicks[p.id]);
                    const tg   = selC ? TAGS[selC.tag] : null;
                    return (
                      <div key={p.id} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 10px',borderRadius:'10px',
                        background:selC?`${manTeam.color}08`:'rgba(0,0,0,0.025)',
                        border:`1.5px solid ${selC?manTeam.color+'33':B}`,
                        transition:'all 0.15s',
                      }}>
                        <span style={{fontSize:'1rem',flexShrink:0}}>{RI[p.role]}</span>
                        {selC ? (
                          <>
                            <img src={img(selC.champ)} alt={selC.champ.name}
                              style={{width:'34px',height:'34px',borderRadius:'7px',objectFit:'cover',border:`2px solid ${manTeam.color}55`,flexShrink:0}} />
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontWeight:800,fontSize:'0.84rem',color:manTeam.color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{selC.champ.name}</div>
                              <div style={{fontSize:'0.68rem',color:T2,marginTop:'1px'}}>{p.name} {tg&&<span style={{color:tg.color}}>{tg.short}</span>}</div>
                            </div>
                            <button onClick={()=>setManagePicks(prev=>{const n={...prev};delete n[p.id];return n;})}
                              style={{background:'none',border:'none',color:'rgba(180,50,50,0.45)',cursor:'pointer',fontSize:'0.8rem',padding:'0',flexShrink:0}}>✕</button>
                          </>
                        ) : (
                          <div style={{flex:1}}>
                            <div style={{fontSize:'0.82rem',color:T3,fontWeight:600}}>{p.name}</div>
                            <div style={{fontSize:'0.68rem',color:T3,marginTop:'1px'}}>클릭해서 선택</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 저장 */}
                <div style={{padding:'10px 12px',borderTop:`1px solid ${B}`,display:'flex',gap:'6px'}}>
                  <input value={manCompName} onChange={e=>setManCompName(e.target.value)}
                    onKeyDown={e=>{
                      if(e.key==='Enter'&&manageTeamId){
                        const name=manCompName.trim()||`조합 ${getC(manageTeamId).length+1}`;
                        saveC({...comps,[manageTeamId]:[...getC(manageTeamId),{id:Date.now()+'',name,picks:{...managePicks}}]});
                        setManCompName('');
                      }
                    }}
                    placeholder="조합 이름"
                    style={{flex:1,background:'#f8f9fb',border:`1px solid ${B}`,borderRadius:'7px',padding:'6px 9px',color:T,fontSize:'0.8rem'}} />
                  <button onClick={()=>{
                    if(!manageTeamId) return;
                    const name=manCompName.trim()||`조합 ${getC(manageTeamId).length+1}`;
                    saveC({...comps,[manageTeamId]:[...getC(manageTeamId),{id:Date.now()+'',name,picks:{...managePicks}}]});
                    setManCompName('');
                  }} style={{...Btn('#fff',manTeam.color,'transparent',{flexShrink:0,padding:'6px 12px'})}}>저장</button>
                </div>

                {/* 저장된 조합 칩 */}
                {getC(manageTeamId||'').length>0 && (
                  <div style={{padding:'0 12px 10px',display:'flex',flexDirection:'column',gap:'4px'}}>
                    {getC(manageTeamId||'').map(c=>(
                      <div key={c.id} style={{display:'flex',alignItems:'center',borderRadius:'8px',overflow:'hidden',border:`1px solid ${manTeam.color}28`,background:`${manTeam.color}08`}}>
                        <button onClick={()=>setManagePicks({...c.picks})}
                          style={{flex:1,padding:'6px 10px',background:'transparent',border:'none',color:manTeam.color,fontSize:'0.78rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit',textAlign:'left' as const}}>
                          {c.name}
                        </button>
                        <div style={{display:'flex',gap:'2px',padding:'4px 6px',flexShrink:0}}>
                          {[...manTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)).map(p=>{
                            const pc=p.champs.find(x=>x.champ.id===c.picks[p.id]);
                            return pc?(
                              <img key={p.id} src={img(pc.champ)} alt={pc.champ.name} title={pc.champ.name}
                                style={{width:'20px',height:'20px',borderRadius:'4px',objectFit:'cover'}} />
                            ):<div key={p.id} style={{width:'20px',height:'20px',borderRadius:'4px',background:'rgba(0,0,0,0.08)'}} />;
                          })}
                        </div>
                        <button onClick={()=>manageTeamId&&saveC({...comps,[manageTeamId]:getC(manageTeamId).filter(x=>x.id!==c.id)})}
                          style={{padding:'6px 8px',background:'transparent',border:'none',borderLeft:`1px solid ${manTeam.color}20`,color:'rgba(180,50,50,0.5)',cursor:'pointer',fontSize:'0.78rem',fontFamily:'inherit'}}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── vs 비교 ── */}
                <div style={{borderTop:`2px solid ${B}`,margin:'0 0 0 0'}}>
                  <div style={{padding:'10px 14px 8px',display:'flex',alignItems:'center',gap:'6px'}}>
                    <span style={{fontWeight:900,fontSize:'0.8rem',color:T2}}>⚔️ 상대팀 비교</span>
                  </div>
                  <div style={{padding:'0 12px 10px',display:'flex',flexDirection:'column',gap:'6px'}}>
                    <select value={vsTeamId||''} onChange={e=>{setVsTeamId(e.target.value||null);setVsCompId(null);}}
                      style={{width:'100%',background:'rgba(255,74,106,0.06)',border:'1.5px solid rgba(255,74,106,0.25)',borderRadius:'8px',padding:'7px 10px',color:T,fontSize:'0.84rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                      <option value="">상대 팀 선택</option>
                      {teams.filter(t=>t.id!==manageTeamId).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {vsTeamId && (
                      <select value={vsCompId||''} onChange={e=>setVsCompId(e.target.value||null)}
                        style={{width:'100%',background:'rgba(255,74,106,0.04)',border:'1.5px solid rgba(255,74,106,0.18)',borderRadius:'8px',padding:'7px 10px',color:T,fontSize:'0.82rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                        <option value="">상대 조합 선택</option>
                        {getC(vsTeamId).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </div>

                  {/* 비교 결과 */}
                  {vsCompId && vsTeamId && manTeam && (()=>{
                    const vsTeam = teams.find(t=>t.id===vsTeamId);
                    const vsComp = getC(vsTeamId).find(c=>c.id===vsCompId);
                    if(!vsTeam||!vsComp) return null;
                    const vsSorted = [...vsTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role));
                    const mySorted = [...manTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role));
                    return (
                      <div style={{margin:'0 12px 12px',borderRadius:'10px',overflow:'hidden',border:`1px solid ${B}`}}>
                        {/* 팀명 헤더 */}
                        <div style={{display:'grid',gridTemplateColumns:'1fr 22px 1fr',background:'rgba(0,0,0,0.03)',borderBottom:`1px solid ${B}`}}>
                          <div style={{padding:'6px 8px',fontWeight:800,fontSize:'0.72rem',color:manTeam.color,display:'flex',alignItems:'center',gap:'4px'}}>
                            <div style={{width:'6px',height:'6px',borderRadius:'50%',background:manTeam.color,flexShrink:0}} />{manTeam.name}
                          </div>
                          <div style={{borderLeft:`1px solid ${B}`,borderRight:`1px solid ${B}`}} />
                          <div style={{padding:'6px 8px',fontWeight:800,fontSize:'0.72rem',color:'#FF4A6A',textAlign:'right' as const,display:'flex',alignItems:'center',gap:'4px',justifyContent:'flex-end'}}>
                            {vsTeam.name}<div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#FF4A6A',flexShrink:0}} />
                          </div>
                        </div>
                        {/* 포지션별 */}
                        {ROLES.map((role,ri)=>{
                          const myP  = mySorted.find(p=>p.role===role);
                          const vsP  = vsSorted.find(p=>p.role===role);
                          const myC  = myP?.champs.find(x=>x.champ.id===managePicks[myP.id]);
                          const vsC  = vsP?.champs.find(x=>x.champ.id===vsComp.picks[vsP.id]);
                          return (
                            <div key={role} style={{display:'grid',gridTemplateColumns:'1fr 22px 1fr',borderTop:ri>0?`1px solid ${B}`:'none',background:ri%2===0?'transparent':'rgba(0,0,0,0.015)'}}>
                              <div style={{padding:'6px 8px',display:'flex',alignItems:'center',gap:'5px'}}>
                                {myC?(
                                  <>
                                    <img src={img(myC.champ)} alt={myC.champ.name} style={{width:'28px',height:'28px',borderRadius:'6px',objectFit:'cover',border:`1.5px solid ${manTeam.color}44`,flexShrink:0}} />
                                    <div style={{minWidth:0}}>
                                      <div style={{fontWeight:700,fontSize:'0.72rem',color:manTeam.color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{myC.champ.name}</div>
                                      <div style={{fontSize:'0.6rem',color:T3}}>{myP?.name}</div>
                                    </div>
                                  </>
                                ):<span style={{fontSize:'0.68rem',color:T3}}>미선택</span>}
                              </div>
                              <div style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.75rem',borderLeft:`1px solid ${B}`,borderRight:`1px solid ${B}`}}>{RI[role]}</div>
                              <div style={{padding:'6px 8px',display:'flex',alignItems:'center',gap:'5px',justifyContent:'flex-end',flexDirection:'row-reverse'}}>
                                {vsC?(
                                  <>
                                    <img src={img(vsC.champ)} alt={vsC.champ.name} style={{width:'28px',height:'28px',borderRadius:'6px',objectFit:'cover',border:'1.5px solid rgba(255,74,106,0.4)',flexShrink:0}} />
                                    <div style={{minWidth:0,textAlign:'right' as const}}>
                                      <div style={{fontWeight:700,fontSize:'0.72rem',color:'#FF4A6A',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{vsC.champ.name}</div>
                                      <div style={{fontSize:'0.6rem',color:T3}}>{vsP?.name}</div>
                                    </div>
                                  </>
                                ):<span style={{fontSize:'0.68rem',color:T3}}>미선택</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  {vsTeamId && !vsCompId && (
                    <div style={{padding:'12px',textAlign:'center',color:T3,fontSize:'0.76rem'}}>상대 조합을 선택하세요</div>
                  )}
                  {!vsTeamId && (
                    <div style={{padding:'0 12px 12px',fontSize:'0.74rem',color:T3}}>상대 팀을 선택하면 포지션별 비교가 나와요</div>
                  )}
                </div>
              </div>{/* vs 비교 끝 */}
              </div>{/* 패널 끝 */}
            )}

            </div>{/* grid 끝 */}
          </div>
        </div>
      )}

      {/* 챔피언 추가 모달 */}
      {picker && manTeam && (()=>{
        const p=manTeam.players.find(x=>x.id===picker); if(!p) return null;
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.48)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}}
            onClick={e=>{if(e.target===e.currentTarget)setPicker(null);}}>
            <div style={{background:'#fff',border:`1.5px solid ${manTeam.color}44`,borderRadius:'16px',width:'100%',maxWidth:'660px',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.18)'}}>
              <div style={{padding:'13px 16px',borderBottom:`1px solid ${B}`,display:'flex',alignItems:'center',gap:'8px',background:`${manTeam.color}08`}}>
                <span style={{fontWeight:900,fontSize:'0.94rem',color:manTeam.color}}>{manTeam.name} · {p.name}</span>
                <button onClick={()=>setPicker(null)} style={{marginLeft:'auto',...Btn(T2,S,B,{padding:'4px 10px'})}}>닫기 ✕</button>
              </div>
              <div style={{padding:'10px 14px',borderBottom:`1px solid ${B}`,display:'flex',gap:'8px',alignItems:'center'}}>
                <input autoFocus value={ms} onChange={e=>setMs(e.target.value)} placeholder="챔피언 검색..."
                  style={{flex:1,background:'#f8f9fb',border:`1.5px solid ${manTeam.color}55`,borderRadius:'8px',padding:'8px 12px',color:T,fontSize:'0.92rem'}} />
                <span style={{fontSize:'0.74rem',color:T3}}>{mfChamps.length}개</span>
              </div>
              <div style={{padding:'10px 14px 14px',maxHeight:'380px',overflowY:'auto'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(64px,1fr))',gap:'5px'}}>
                  {mfChamps.map(c=>(
                    <div key={c.id} className="ci" onClick={()=>addPC(picker,c)} title={c.name}
                      style={{borderRadius:'8px',overflow:'hidden',cursor:'pointer',border:'1.5px solid transparent',position:'relative'}}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor=manTeam.color}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='transparent'}>
                      <img src={img(c)} alt={c.name} style={{width:'100%',aspectRatio:'1',display:'block',objectFit:'cover'}} />
                      <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.85))',padding:'2px 2px 3px',fontSize:'0.52rem',fontWeight:700,color:'#fff',textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</div>
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
