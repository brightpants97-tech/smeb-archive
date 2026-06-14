'use client';
import { useState, useEffect, useMemo } from 'react';

const A  = '#EB701A';
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

interface Champ       { id:string; name:string; img:string; }
interface PChamp      { champ:Champ; tag:keyof typeof TAGS; note:string; }
interface Player      { id:string; name:string; role:string; champs:PChamp[]; }
interface Team        { id:string; name:string; color:string; players:Player[]; }
interface CompPick    { playerId:string; champId:string; }
interface Composition { id:string; name:string; picks:CompPick[]; }

const B_STYLE = (color:string, bg:string, bd:string) => ({
  padding:'7px 14px', borderRadius:'8px', border:`1px solid ${bd}`,
  background:bg, color, cursor:'pointer' as const, fontSize:'0.86rem', fontWeight:700,
  transition:'opacity 0.15s', lineHeight:'1.4', fontFamily:'inherit',
});

export default function BanPickClient() {
  const [champs, setChamps] = useState<Champ[]>([]);
  const [ver, setVer]       = useState('');
  const [teams, setTeams]   = useState<Team[]>([]);
  const [comps, setComps]   = useState<Record<string, Composition[]>>({});
  const [sel, setSel]       = useState<string|null>(null);
  const [tab, setTab]       = useState<'players'|'comps'>('players');
  const [saved, setSaved]   = useState(false);
  const [editT, setEditT]   = useState<string|null>(null);
  const [editP, setEditP]   = useState<string|null>(null);
  const [editC, setEditC]   = useState<string|null>(null);
  const [noteK, setNoteK]   = useState<string|null>(null);
  const [picker, setPicker] = useState<{tid:string;pid:string}|null>(null);
  const [cmpMode, setCmpMode]     = useState(false);
  const [cmpMyComp, setCmpMyComp] = useState<string|null>(null);
  const [cmpOppTeam, setCmpOppTeam] = useState<string|null>(null);
  const [cmpOppComp, setCmpOppComp] = useState<string|null>(null);
  const [vsView, setVsView]       = useState(false);            // 대전 비교 독립 화면
  const [vsBlueTeam, setVsBlueTeam] = useState<string|null>(null);
  const [vsBlueComp, setVsBlueComp] = useState<string|null>(null);
  const [vsRedTeam, setVsRedTeam]   = useState<string|null>(null);
  const [vsRedComp, setVsRedComp]   = useState<string|null>(null);
  const [ms, setMs]         = useState('');

  useEffect(() => {
    try { const s=localStorage.getItem('bp-teams'); if(s) setTeams(JSON.parse(s)); } catch {}
    try { const c=localStorage.getItem('bp-comps');  if(c) setComps(JSON.parse(c)); } catch {}
    (async () => {
      try {
        const v=(await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json())[0]; setVer(v);
        const d=await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/ko_KR/champion.json`)).json();
        setChamps((Object.values(d.data) as any[]).map((c:any)=>({id:c.id,name:c.name,img:c.image.full})).sort((a:any,b:any)=>a.name.localeCompare(b.name,'ko')));
      } catch {}
    })();
  }, []);

  const img = (c:Champ) => `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${c.img}`;

  const flash = () => { setSaved(true); setTimeout(()=>setSaved(false),1400); };

  const saveTeams = (t:Team[]) => { setTeams(t); try{localStorage.setItem('bp-teams',JSON.stringify(t));flash();}catch{} };
  const saveComps = (c:Record<string,Composition[]>) => { setComps(c); try{localStorage.setItem('bp-comps',JSON.stringify(c));flash();}catch{} };

  const get      = (id:string) => teams.find(t=>t.id===id);
  const getComps = (tid:string) => comps[tid]||[];

  /* 팀 */
  const addTeam = () => {
    const tid = Date.now()+'';
    const players: Player[] = ROLES.map((role, i) => ({
      id: tid + '_' + i, name: role + ' 선수', role, champs: []
    }));
    const t: Team = { id:tid, name:`팀 ${teams.length+1}`, color:COLORS[teams.length%COLORS.length], players };
    saveTeams([...teams, t]); setSel(t.id); setEditT(t.id); setTab('players');
  };
  const updTeam = (id:string,p:Partial<Team>) => saveTeams(teams.map(t=>t.id===id?{...t,...p}:t));
  const delTeam = (id:string) => { saveTeams(teams.filter(t=>t.id!==id)); setSel(null); };

  /* 선수 */
  const addP  = (tid:string) => { const p:Player={id:Date.now()+'',name:'선수',role:'탑',champs:[]}; updTeam(tid,{players:[...(get(tid)?.players||[]),p]}); setEditP(p.id); };
  const updP  = (tid:string,pid:string,p:Partial<Player>) => updTeam(tid,{players:(get(tid)?.players||[]).map(x=>x.id===pid?{...x,...p}:x)});
  const delP  = (tid:string,pid:string) => updTeam(tid,{players:(get(tid)?.players||[]).filter(x=>x.id!==pid)});

  /* 챔피언 */
  const addPC = (tid:string,pid:string,c:Champ) => { const p=get(tid)?.players.find(x=>x.id===pid); if(!p||p.champs.find(x=>x.champ.id===c.id)) return; updP(tid,pid,{champs:[...p.champs,{champ:c,tag:'onetrick',note:''}]}); };
  const updPC = (tid:string,pid:string,cid:string,patch:Partial<PChamp>) => { const p=get(tid)?.players.find(x=>x.id===pid); if(!p) return; updP(tid,pid,{champs:p.champs.map(x=>x.champ.id===cid?{...x,...patch}:x)}); };
  const delPC = (tid:string,pid:string,cid:string) => { const p=get(tid)?.players.find(x=>x.id===pid); if(!p) return; updP(tid,pid,{champs:p.champs.filter(x=>x.champ.id!==cid)}); };

  /* 조합 */
  const addComp  = (tid:string) => {
    const team=teams.find(t=>t.id===tid); if(!team) return;
    const sorted=[...team.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role));
    const nc:Composition={id:Date.now()+'',name:`조합 ${getComps(tid).length+1}`,picks:sorted.map(p=>({playerId:p.id,champId:p.champs[0]?.champ.id||''}))};
    saveComps({...comps,[tid]:[...getComps(tid),nc]}); setEditC(nc.id);
  };
  const updComp  = (tid:string,cid:string,patch:Partial<Composition>) => saveComps({...comps,[tid]:getComps(tid).map(c=>c.id===cid?{...c,...patch}:c)});
  const delComp  = (tid:string,cid:string) => { saveComps({...comps,[tid]:getComps(tid).filter(c=>c.id!==cid)}); if(editC===cid) setEditC(null); };
  const updPick  = (tid:string,cid:string,pid:string,champId:string) => { const c=getComps(tid).find(x=>x.id===cid); if(!c) return; updComp(tid,cid,{picks:c.picks.map(p=>p.playerId===pid?{...p,champId}:p)}); };

  const curTeam  = sel ? teams.find(t=>t.id===sel)||null : null;
  const sorted   = curTeam ? [...curTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)) : [];
  const mf       = useMemo(() => { if(!picker) return []; const p=get(picker.tid)?.players.find(x=>x.id===picker.pid); return champs.filter(c=>(c.name.includes(ms)||c.id.toLowerCase().includes(ms.toLowerCase()))&&!p?.champs.find(x=>x.champ.id===c.id)); },[champs,ms,picker,teams]);

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
        .ci{transition:transform 0.08s}.ci:hover{transform:scale(1.07)}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.15);border-radius:4px}
      `}</style>

      {/* 헤더 */}
      <div style={{borderBottom:`1px solid ${B}`,padding:'0 clamp(1rem,4vw,2.5rem)',display:'flex',alignItems:'stretch',height:'56px',background:S}}>
        {curTeam ? (
          <button onClick={()=>{setSel(null);setEditT(null);setEditP(null);setNoteK(null);setEditC(null);}}
            style={{background:'none',border:'none',color:T2,cursor:'pointer',fontSize:'0.9rem',fontWeight:700,paddingRight:'16px',borderRight:`1px solid ${B}`,display:'flex',alignItems:'center',gap:'4px'}}>
            ← 전체
          </button>
        ) : (
          <a href="/" style={{color:T2,fontSize:'0.9rem',textDecoration:'none',fontWeight:700,paddingRight:'16px',borderRight:`1px solid ${B}`,display:'flex',alignItems:'center'}}>← 홈</a>
        )}
        <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'0 16px',flex:1}}>
          {curTeam ? (
            <>
              <div style={{width:'9px',height:'9px',borderRadius:'50%',background:curTeam.color,boxShadow:`0 0 6px ${curTeam.color}`}} />
              <span style={{fontWeight:900,fontSize:'1rem',color:curTeam.color}}>{curTeam.name}</span>
              <span style={{color:T3,fontSize:'0.82rem'}}>· 5명</span>
            </>
          ) : <span style={{fontWeight:900,fontSize:'1rem'}}>🏆 팀 관리</span>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          {saved && <span style={{fontSize:'0.76rem',color:'#33CC77',fontWeight:700}}>✓ 저장됨</span>}
          {ver && <span style={{fontSize:'0.7rem',color:T3}}>v{ver.slice(0,5)}</span>}
        </div>
      </div>

      {/* ── 팀 목록 ── */}
      {!curTeam && (
        <div style={{padding:'24px clamp(1rem,4vw,2.5rem)',animation:'fi 0.18s both'}}>
          <div style={{maxWidth:'960px',margin:'0 auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
              <div>
                <div style={{fontWeight:900,fontSize:'1.2rem',letterSpacing:'-0.03em'}}>팀 목록</div>
                <div style={{fontSize:'0.82rem',color:T3,marginTop:'4px'}}>팀 카드를 클릭하면 선수와 조합을 확인해요</div>
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={()=>setVsView(true)} style={{...B_STYLE(T2,S,B)}}>⚔️ 대전 비교</button>
                <button onClick={addTeam} style={{...B_STYLE('#fff',A,'transparent')}}>+ 팀 추가</button>
              </div>
            </div>
            {/* 대전 비교 화면 */}
            {vsView && (
              <div style={{marginBottom:'28px',background:S,border:`1px solid ${B}`,borderRadius:'16px',overflow:'hidden',animation:'fi 0.18s both'}}>
                {/* 헤더 */}
                <div style={{padding:'14px 20px',borderBottom:`1px solid ${B}`,display:'flex',alignItems:'center',gap:'10px',background:'rgba(0,0,0,0.02)'}}>
                  <span style={{fontWeight:900,fontSize:'1.05rem'}}>⚔️ 대전 비교</span>
                  <button onClick={()=>{setVsView(false);setVsBlueTeam(null);setVsBlueComp(null);setVsRedTeam(null);setVsRedComp(null);}}
                    style={{marginLeft:'auto',...B_STYLE(T2,S,B),...{padding:'5px 12px'}}}>닫기</button>
                </div>

                {/* 팀 선택 */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 40px 1fr',gap:'0'}}>
                  {/* 블루팀 */}
                  <div style={{padding:'16px 20px',borderRight:`1px solid ${B}`}}>
                    <div style={{fontSize:'0.72rem',fontWeight:800,color:'#4A8FFF',letterSpacing:'0.08em',marginBottom:'10px'}}>BLUE TEAM</div>
                    <select value={vsBlueTeam||''} onChange={e=>{setVsBlueTeam(e.target.value||null);setVsBlueComp(null);}}
                      style={{width:'100%',background:'rgba(74,143,255,0.08)',border:'1.5px solid rgba(74,143,255,0.35)',borderRadius:'9px',padding:'8px 12px',color:T,fontSize:'0.9rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginBottom:'8px'}}>
                      <option value="">팀 선택</option>
                      {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {vsBlueTeam && (
                      <select value={vsBlueComp||''} onChange={e=>setVsBlueComp(e.target.value||null)}
                        style={{width:'100%',background:'rgba(74,143,255,0.06)',border:'1.5px solid rgba(74,143,255,0.25)',borderRadius:'9px',padding:'8px 12px',color:T,fontSize:'0.88rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                        <option value="">조합 선택</option>
                        {getComps(vsBlueTeam).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </div>
                  {/* VS */}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:'0.88rem',color:T3}}>VS</div>
                  {/* 레드팀 */}
                  <div style={{padding:'16px 20px',borderLeft:`1px solid ${B}`}}>
                    <div style={{fontSize:'0.72rem',fontWeight:800,color:'#FF4A6A',letterSpacing:'0.08em',marginBottom:'10px'}}>RED TEAM</div>
                    <select value={vsRedTeam||''} onChange={e=>{setVsRedTeam(e.target.value||null);setVsRedComp(null);}}
                      style={{width:'100%',background:'rgba(255,74,106,0.08)',border:'1.5px solid rgba(255,74,106,0.35)',borderRadius:'9px',padding:'8px 12px',color:T,fontSize:'0.9rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginBottom:'8px'}}>
                      <option value="">팀 선택</option>
                      {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {vsRedTeam && (
                      <select value={vsRedComp||''} onChange={e=>setVsRedComp(e.target.value||null)}
                        style={{width:'100%',background:'rgba(255,74,106,0.06)',border:'1.5px solid rgba(255,74,106,0.25)',borderRadius:'9px',padding:'8px 12px',color:T,fontSize:'0.88rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                        <option value="">조합 선택</option>
                        {getComps(vsRedTeam).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>

                {/* 비교 결과 */}
                {vsBlueComp && vsRedComp && (() => {
                  const blueT = teams.find(t=>t.id===vsBlueTeam);
                  const redT  = teams.find(t=>t.id===vsRedTeam);
                  const blueC = getComps(vsBlueTeam!).find(c=>c.id===vsBlueComp);
                  const redC  = getComps(vsRedTeam!).find(c=>c.id===vsRedComp);
                  if(!blueT||!redT||!blueC||!redC) return null;
                  return (
                    <div style={{borderTop:`1px solid ${B}`}}>
                      {/* 팀명 헤더 */}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 50px 1fr'}}>
                        <div style={{padding:'12px 20px',background:`${blueT.color}10`,fontWeight:900,fontSize:'0.94rem',color:blueT.color}}>
                          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                            <div style={{width:'8px',height:'8px',borderRadius:'50%',background:blueT.color,boxShadow:`0 0 4px ${blueT.color}`}} />
                            {blueT.name}
                          </div>
                          <div style={{fontSize:'0.76rem',color:T2,fontWeight:600,marginTop:'2px'}}>{blueC.name}</div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.03)',borderLeft:`1px solid ${B}`,borderRight:`1px solid ${B}`,fontWeight:900,fontSize:'0.78rem',color:T3}}>라인</div>
                        <div style={{padding:'12px 20px',background:`${redT.color}10`,fontWeight:900,fontSize:'0.94rem',color:redT.color,textAlign:'right' as const}}>
                          <div style={{display:'flex',alignItems:'center',gap:'6px',justifyContent:'flex-end'}}>
                            {redT.name}
                            <div style={{width:'8px',height:'8px',borderRadius:'50%',background:redT.color,boxShadow:`0 0 4px ${redT.color}`}} />
                          </div>
                          <div style={{fontSize:'0.76rem',color:T2,fontWeight:600,marginTop:'2px'}}>{redC.name}</div>
                        </div>
                      </div>

                      {/* 라인별 비교 */}
                      {ROLES.map((role,ri)=>{
                        const blueP  = [...blueT.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)).find(p=>p.role===role);
                        const redP   = [...redT.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)).find(p=>p.role===role);
                        const bluePk = blueC.picks.find(x=>x.playerId===blueP?.id);
                        const redPk  = redC.picks.find(x=>x.playerId===redP?.id);
                        const blueChamp = blueP?.champs.find(x=>x.champ.id===bluePk?.champId);
                        const redChamp  = redP?.champs.find(x=>x.champ.id===redPk?.champId);
                        return (
                          <div key={role} style={{display:'grid',gridTemplateColumns:'1fr 50px 1fr',borderTop:`1px solid ${B}`,background:ri%2===0?'transparent':'rgba(0,0,0,0.015)'}}>
                            {/* 블루 */}
                            <div style={{padding:'12px 20px',display:'flex',alignItems:'center',gap:'10px'}}>
                              {blueChamp ? (
                                <>
                                  <img src={img(blueChamp.champ)} alt={blueChamp.champ.name}
                                    style={{width:'46px',height:'46px',borderRadius:'9px',objectFit:'cover',border:`2px solid ${blueT.color}55`,flexShrink:0}} />
                                  <div>
                                    <div style={{fontWeight:800,fontSize:'0.92rem'}}>{blueChamp.champ.name}</div>
                                    <div style={{fontSize:'0.74rem',color:T2,marginTop:'2px'}}>
                                      {blueP?.name}
                                      {blueChamp.tag!=='onetrick'&&<span style={{marginLeft:'5px',color:TAGS[blueChamp.tag].color,fontWeight:700}}>{TAGS[blueChamp.tag].short}</span>}
                                    </div>
                                    {blueChamp.note&&<div style={{fontSize:'0.7rem',color:T3,marginTop:'2px',fontStyle:'italic'}}>{blueChamp.note}</div>}
                                  </div>
                                </>
                              ) : (
                                <div style={{color:T3,fontSize:'0.84rem'}}>{blueP?.name||role} · 미선택</div>
                              )}
                            </div>
                            {/* 라인 */}
                            <div style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.2rem',borderLeft:`1px solid ${B}`,borderRight:`1px solid ${B}`}}>{RI[role]}</div>
                            {/* 레드 */}
                            <div style={{padding:'12px 20px',display:'flex',alignItems:'center',gap:'10px',justifyContent:'flex-end',flexDirection:'row-reverse'}}>
                              {redChamp ? (
                                <>
                                  <img src={img(redChamp.champ)} alt={redChamp.champ.name}
                                    style={{width:'46px',height:'46px',borderRadius:'9px',objectFit:'cover',border:`2px solid ${redT.color}55`,flexShrink:0}} />
                                  <div style={{textAlign:'right' as const}}>
                                    <div style={{fontWeight:800,fontSize:'0.92rem'}}>{redChamp.champ.name}</div>
                                    <div style={{fontSize:'0.74rem',color:T2,marginTop:'2px'}}>
                                      {redP?.name}
                                      {redChamp.tag!=='onetrick'&&<span style={{marginLeft:'5px',color:TAGS[redChamp.tag].color,fontWeight:700}}>{TAGS[redChamp.tag].short}</span>}
                                    </div>
                                    {redChamp.note&&<div style={{fontSize:'0.7rem',color:T3,marginTop:'2px',fontStyle:'italic'}}>{redChamp.note}</div>}
                                  </div>
                                </>
                              ) : (
                                <div style={{color:T3,fontSize:'0.84rem'}}>{redP?.name||role} · 미선택</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {(!vsBlueComp||!vsRedComp)&&(
                  <div style={{padding:'32px',textAlign:'center',color:T3,fontSize:'0.86rem',borderTop:`1px solid ${B}`}}>
                    {!vsBlueTeam?'블루팀을 선택하세요':!vsBlueComp?'블루팀 조합을 선택하세요':!vsRedTeam?'레드팀을 선택하세요':'레드팀 조합을 선택하세요'}
                  </div>
                )}
              </div>
            )}

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
                      onClick={()=>{setSel(t.id);setTab('players');setEditC(null);}}
                      style={{background:S,border:`1px solid ${B}`,borderRadius:'14px',overflow:'hidden',cursor:'pointer',borderLeft:`4px solid ${t.color}`}}>
                      <div style={{padding:'16px 18px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                          <div style={{width:'9px',height:'9px',borderRadius:'50%',background:t.color,flexShrink:0,boxShadow:`0 0 5px ${t.color}`}} />
                          <span style={{fontWeight:900,fontSize:'1rem'}}>{t.name}</span>
                          <div style={{marginLeft:'auto',display:'flex',gap:'5px'}}>
                            <span style={{fontSize:'0.72rem',color:T3,background:'rgba(0,0,0,0.06)',padding:'2px 8px',borderRadius:'100px'}}>5명</span>
                            {compCount>0&&<span style={{fontSize:'0.72rem',color:t.color,background:`${t.color}18`,padding:'2px 8px',borderRadius:'100px',fontWeight:700}}>조합 {compCount}</span>}
                          </div>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:'5px'}}>
                          {[...t.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)).map(p=>(
                            <div key={p.id} style={{display:'flex',alignItems:'center',gap:'7px',fontSize:'0.82rem'}}>
                              <span style={{width:'20px',flexShrink:0}}>{RI[p.role]||'👤'}</span>
                              <span style={{fontWeight:700,color:'rgba(0,0,0,0.8)'}}>{p.name}</span>
                              <span style={{color:T3,fontSize:'0.72rem'}}>챔 {p.champs.length}</span>
                            </div>
                          ))}
                          {t.players.length===0&&<div style={{fontSize:'0.8rem',color:T3}}>선수 없음</div>}
                        </div>
                        {mustbans.length>0&&(
                          <div style={{marginTop:'12px',display:'flex',alignItems:'center',gap:'6px'}}>
                            <span style={{fontSize:'0.68rem',color:'#FF5566',fontWeight:700,flexShrink:0}}>🔴 필밴</span>
                            <div style={{display:'flex',gap:'3px'}}>
                              {mustbans.slice(0,7).map(pc=>(
                                <img key={pc.champ.id} src={img(pc.champ)} alt={pc.champ.name} title={pc.champ.name}
                                  style={{width:'26px',height:'26px',borderRadius:'5px',objectFit:'cover',border:'1.5px solid rgba(255,85,102,0.4)'}} />
                              ))}
                              {mustbans.length>7&&<span style={{fontSize:'0.7rem',color:T3,alignSelf:'center'}}>+{mustbans.length-7}</span>}
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
        </div>
      )}

      {/* ── 팀 상세 ── */}
      {curTeam && (
        <div style={{padding:'20px clamp(1rem,4vw,2.5rem)',animation:'si 0.18s both'}}>
          <div style={{maxWidth:'960px',margin:'0 auto'}}>

            {/* 팀 헤더 */}
            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'20px',paddingBottom:'18px',borderBottom:`1px solid ${B}`,flexWrap:'wrap'}}>
              <button onClick={()=>{setSel(null);setEditT(null);setEditP(null);setNoteK(null);setEditC(null);}}
                style={{display:'flex',alignItems:'center',gap:'5px',padding:'7px 14px',borderRadius:'8px',border:`1px solid ${B}`,background:S,color:T2,cursor:'pointer',fontSize:'0.88rem',fontWeight:700,fontFamily:'inherit',flexShrink:0}}>
                ← 팀 목록
              </button>
              {editT===curTeam.id ? (
                <>
                  <input value={curTeam.name} onChange={e=>updTeam(curTeam.id,{name:e.target.value})}
                    style={{background:'#fff',border:`1.5px solid ${curTeam.color}77`,borderRadius:'8px',padding:'6px 12px',color:T,fontSize:'1rem',fontWeight:900,maxWidth:'160px'}} />
                  <div style={{display:'flex',gap:'4px'}}>
                    {COLORS.map(c=><div key={c} onClick={()=>updTeam(curTeam.id,{color:c})} style={{width:'20px',height:'20px',borderRadius:'50%',background:c,cursor:'pointer',border:curTeam.color===c?'2.5px solid #333':'2.5px solid transparent',flexShrink:0}} />)}
                  </div>
                  <button onClick={()=>setEditT(null)} style={{...B_STYLE('#fff',A,'transparent')}}>완료</button>
                </>
              ) : (
                <span style={{fontWeight:900,fontSize:'1.1rem',color:curTeam.color,flex:1}}>{curTeam.name}</span>
              )}
              <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                {editT!==curTeam.id&&<button onClick={()=>setEditT(curTeam.id)} style={{...B_STYLE(T2,S,B)}}>편집</button>}
                
                <button onClick={()=>{if(confirm(`${curTeam.name} 삭제?`))delTeam(curTeam.id);}} style={{...B_STYLE('rgba(255,80,80,0.9)','rgba(255,80,80,0.07)','rgba(255,80,80,0.25)')}}>팀 삭제</button>
              </div>
            </div>

            {/* 탭 */}
            <div style={{display:'flex',gap:'4px',marginBottom:'22px',background:'rgba(0,0,0,0.06)',padding:'4px',borderRadius:'10px',width:'fit-content'}}>
              {(['players','comps'] as const).map(t=>(
                <button key={t} onClick={()=>setTab(t)} style={{
                  padding:'8px 20px',borderRadius:'8px',border:'none',cursor:'pointer',fontSize:'0.94rem',fontWeight:800,
                  background:tab===t?'#fff':'transparent',
                  color:tab===t?curTeam.color:T2,
                  boxShadow:tab===t?'0 1px 5px rgba(0,0,0,0.1)':'none',
                  transition:'all 0.12s',fontFamily:'inherit',
                }}>
                  {t==='players'?'👥 선수 목록':'⚔️ 조합'}
                  {t==='comps'&&getComps(curTeam.id).length>0&&
                    <span style={{marginLeft:'6px',fontSize:'0.72rem',background:curTeam.color,color:'#fff',padding:'1px 6px',borderRadius:'100px'}}>{getComps(curTeam.id).length}</span>
                  }
                </button>
              ))}
            </div>

            {/* 선수 목록 탭 */}
            {tab==='players' && (
              sorted.length===0 ? (
                <div style={{textAlign:'center',padding:'60px 0',color:T3}}>
                  <div style={{fontSize:'2rem',marginBottom:'10px'}}>👤</div>
                  <div style={{fontWeight:700,fontSize:'0.96rem'}}>선수를 추가해보세요</div>
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                  {sorted.map(p=>{
                    const isE=editP===p.id;
                    return (
                      <div key={p.id} style={{background:S,border:`1.5px solid ${isE?curTeam.color+'55':B}`,borderRadius:'14px',overflow:'hidden',transition:'border-color 0.15s'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 18px'}}>
                          <div style={{width:'40px',height:'40px',borderRadius:'10px',background:`${curTeam.color}18`,border:`1.5px solid ${curTeam.color}33`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.2rem',flexShrink:0}}>
                            {RI[p.role]||'👤'}
                          </div>
                          {isE ? (
                            <>
                              <input value={p.name} onChange={e=>updP(curTeam.id,p.id,{name:e.target.value})}
                                style={{background:'#fff',border:`1px solid ${curTeam.color}66`,borderRadius:'7px',padding:'5px 10px',color:T,fontSize:'0.94rem',fontWeight:800,width:'110px',flexShrink:0}} />
                              <select value={p.role} onChange={e=>updP(curTeam.id,p.id,{role:e.target.value})}
                                style={{background:'#fff',border:`1px solid ${B}`,borderRadius:'7px',padding:'5px 10px',color:T,fontSize:'0.86rem',cursor:'pointer',flexShrink:0}}>
                                {ROLES.map(r=><option key={r} value={r}>{RI[r]} {r}</option>)}
                              </select>
                            </>
                          ) : (
                            <>
                              <span style={{fontWeight:900,fontSize:'0.96rem',flexShrink:0}}>{p.name}</span>
                              <span style={{fontSize:'0.78rem',color:T3,flexShrink:0}}>{p.role}</span>
                            </>
                          )}
                          {!isE&&p.champs.length>0&&(
                            <div style={{display:'flex',gap:'4px',flex:1,minWidth:0,overflowX:'auto'}}>
                              {p.champs.map(pc=>{
                                const tg=TAGS[pc.tag];
                                return (
                                  <div key={pc.champ.id} title={`${pc.champ.name} (${tg.label})`} style={{position:'relative',flexShrink:0}}>
                                    <img src={img(pc.champ)} alt={pc.champ.name}
                                      style={{width:'36px',height:'36px',borderRadius:'7px',objectFit:'cover',display:'block',border:`2px solid ${tg.bd}`}} />
                                    <div style={{position:'absolute',bottom:'-1px',right:'-1px',fontSize:'0.55rem',lineHeight:1,background:'#fff',borderRadius:'3px',padding:'0 1px'}}>{tg.short}</div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {!isE&&p.champs.length===0&&<span style={{fontSize:'0.8rem',color:T3,flex:1}}>챔피언 없음</span>}
                          <div style={{display:'flex',gap:'5px',flexShrink:0}}>
                            <button onClick={()=>setEditP(isE?null:p.id)} style={{...B_STYLE(isE?curTeam.color:T2,isE?`${curTeam.color}15`:S,isE?`${curTeam.color}44`:B)}}>{isE?'완료':'편집'}</button>
                            {isE&&<button onClick={()=>{setPicker({tid:curTeam.id,pid:p.id});setMs('');}} style={{...B_STYLE('#fff',curTeam.color,'transparent')}}>+ 챔피언</button>}
                          </div>
                        </div>

                        {isE&&p.champs.length>0&&(
                          <div style={{borderTop:`1px solid ${B}`,padding:'12px 18px',display:'flex',flexDirection:'column',gap:'6px'}}>
                            {p.champs.map(pc=>{
                              const tg=TAGS[pc.tag]; const nk=`${p.id}-${pc.champ.id}`;
                              return (
                                <div key={pc.champ.id}>
                                  <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'7px 10px',background:'rgba(0,0,0,0.02)',borderRadius:'9px',border:`1px solid ${tg.bd}`}}>
                                    <img src={img(pc.champ)} alt={pc.champ.name}
                                      style={{width:'40px',height:'40px',borderRadius:'8px',objectFit:'cover',border:`2px solid ${tg.color}`,flexShrink:0}} />
                                    <span style={{fontWeight:700,fontSize:'0.9rem',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{pc.champ.name}</span>
                                    <select value={pc.tag} onChange={e=>updPC(curTeam.id,p.id,pc.champ.id,{tag:e.target.value as any})}
                                      style={{background:tg.bg,border:`1px solid ${tg.bd}`,borderRadius:'6px',padding:'4px 8px',color:tg.color,fontSize:'0.76rem',fontWeight:700,cursor:'pointer',flexShrink:0,fontFamily:'inherit'}}>
                                      {Object.entries(TAGS).map(([k,v])=><option key={k} value={k}>{v.short} {v.label}</option>)}
                                    </select>
                                    <button onClick={()=>setNoteK(noteK===nk?null:nk)}
                                      style={{...B_STYLE(noteK===nk?tg.color:T3,noteK===nk?tg.bg:S,noteK===nk?tg.bd:B),...{padding:'4px 9px'}}}>📝</button>
                                    <button onClick={()=>delPC(curTeam.id,p.id,pc.champ.id)}
                                      style={{background:'none',border:'none',color:'rgba(255,80,80,0.5)',cursor:'pointer',fontSize:'0.9rem',padding:'0 2px'}}>✕</button>
                                  </div>
                                  {noteK===nk&&(
                                    <textarea value={pc.note} onChange={e=>updPC(curTeam.id,p.id,pc.champ.id,{note:e.target.value})}
                                      placeholder="메모 (예: 레넥 잡으면 다이브 위주, 갱 조심)"
                                      style={{width:'100%',background:'rgba(0,0,0,0.025)',border:`1px solid ${tg.bd}`,borderTop:'none',borderRadius:'0 0 9px 9px',padding:'8px 10px',color:'#333',fontSize:'0.82rem',lineHeight:1.6,resize:'vertical' as const,minHeight:'50px',boxSizing:'border-box' as const}} />
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
              )
            )}

            {/* 조합 탭 */}
            {tab==='comps' && (
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'18px'}}>
                  <div style={{fontSize:'0.88rem',color:T2}}>선수별 챔피언을 골라 조합을 저장하세요</div>
                  <div style={{display:'flex',gap:'6px'}}>
                    <button onClick={()=>{setCmpMode(!cmpMode);if(!cmpMode){setCmpMyComp(null);setCmpOppTeam(null);setCmpOppComp(null);}}}
                      style={{...B_STYLE(cmpMode?curTeam.color:T2,cmpMode?`${curTeam.color}15`:S,cmpMode?`${curTeam.color}44`:B)}}>
                      {cmpMode?'⚔️ 비교 중':'⚔️ 비교'}
                    </button>
                    <button onClick={()=>addComp(curTeam.id)} style={{...B_STYLE('#fff',curTeam.color,'transparent')}}>+ 새 조합</button>
                  </div>
                </div>

                {getComps(curTeam.id).length===0 ? (
                  <div style={{textAlign:'center',padding:'70px 0',color:T3}}>
                    <div style={{fontSize:'2.5rem',marginBottom:'12px'}}>⚔️</div>
                    <div style={{fontWeight:700,fontSize:'1rem'}}>조합을 만들어보세요</div>
                    <div style={{fontSize:'0.84rem',marginTop:'6px'}}>선수별 챔피언 풀에서 하나씩 선택해 조합을 구성해요</div>
                  </div>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                    {getComps(curTeam.id).map(comp=>{
                      const isE=editC===comp.id;
                      return (
                        <div key={comp.id} style={{background:S,border:`1.5px solid ${isE?curTeam.color+'55':B}`,borderRadius:'14px',overflow:'hidden',transition:'border-color 0.15s'}}>
                          {/* 조합 헤더 */}
                          <div style={{padding:'13px 18px',display:'flex',alignItems:'center',gap:'12px',borderBottom:isE?`1px solid ${B}`:'none',background:isE?`${curTeam.color}06`:'transparent'}}>
                            {isE ? (
                              <input value={comp.name} onChange={e=>updComp(curTeam.id,comp.id,{name:e.target.value})}
                                style={{flex:1,background:'#fff',border:`1px solid ${curTeam.color}66`,borderRadius:'7px',padding:'6px 10px',color:T,fontSize:'0.96rem',fontWeight:800}} />
                            ) : (
                              <span style={{flex:1,fontWeight:900,fontSize:'1rem'}}>{comp.name}</span>
                            )}
                            {/* 미리보기 */}
                            {!isE&&(
                              <div style={{display:'flex',gap:'5px'}}>
                                {sorted.map(p=>{
                                  const pick=comp.picks.find(x=>x.playerId===p.id);
                                  const pc=p.champs.find(x=>x.champ.id===pick?.champId);
                                  return pc ? (
                                    <div key={p.id} title={`${p.name}: ${pc.champ.name}`} style={{position:'relative',flexShrink:0}}>
                                      <img src={img(pc.champ)} alt={pc.champ.name}
                                        style={{width:'38px',height:'38px',borderRadius:'8px',objectFit:'cover',border:`2px solid ${curTeam.color}55`,display:'block'}} />
                                      <div style={{position:'absolute',bottom:'-2px',left:'-2px',fontSize:'0.6rem',background:curTeam.color,color:'#fff',borderRadius:'4px',padding:'0 3px',fontWeight:800,lineHeight:'16px'}}>{RI[p.role]}</div>
                                    </div>
                                  ) : (
                                    <div key={p.id} style={{width:'38px',height:'38px',borderRadius:'8px',background:'rgba(0,0,0,0.05)',border:`1.5px dashed ${B}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem'}}>{RI[p.role]||'?'}</div>
                                  );
                                })}
                              </div>
                            )}
                            <div style={{display:'flex',gap:'5px',flexShrink:0}}>
                              <button onClick={()=>setEditC(isE?null:comp.id)} style={{...B_STYLE(isE?curTeam.color:T2,isE?`${curTeam.color}15`:S,isE?`${curTeam.color}44`:B)}}>{isE?'완료':'편집'}</button>
                              <button onClick={()=>{if(confirm(`${comp.name} 삭제?`))delComp(curTeam.id,comp.id);}} style={{...B_STYLE('rgba(255,80,80,0.8)','rgba(255,80,80,0.07)','rgba(255,80,80,0.2)')}}>삭제</button>
                            </div>
                          </div>

                          {/* 조합 편집 */}
                          {isE&&(
                            <div style={{padding:'16px 18px',display:'flex',flexDirection:'column',gap:'12px'}}>
                              {sorted.map(p=>{
                                const pick=comp.picks.find(x=>x.playerId===p.id);
                                const selC=p.champs.find(x=>x.champ.id===pick?.champId);
                                return (
                                  <div key={p.id} style={{display:'flex',alignItems:'center',gap:'12px'}}>
                                    <div style={{display:'flex',alignItems:'center',gap:'7px',width:'100px',flexShrink:0}}>
                                      <span style={{fontSize:'1.1rem'}}>{RI[p.role]||'👤'}</span>
                                      <span style={{fontWeight:800,fontSize:'0.9rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{p.name}</span>
                                    </div>
                                    {selC ? (
                                      <div style={{display:'flex',alignItems:'center',gap:'7px',padding:'5px 12px',background:`${curTeam.color}12`,border:`1.5px solid ${curTeam.color}44`,borderRadius:'9px',flexShrink:0}}>
                                        <img src={img(selC.champ)} alt={selC.champ.name} style={{width:'34px',height:'34px',borderRadius:'6px',objectFit:'cover'}} />
                                        <div>
                                          <div style={{fontWeight:800,fontSize:'0.88rem',color:curTeam.color}}>{selC.champ.name}</div>
                                          <div style={{fontSize:'0.68rem',color:TAGS[selC.tag].color}}>{TAGS[selC.tag].label}</div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{padding:'7px 12px',background:'rgba(0,0,0,0.04)',border:`1.5px dashed ${B}`,borderRadius:'9px',fontSize:'0.84rem',color:T3,flexShrink:0}}>미선택</div>
                                    )}
                                    <div style={{display:'flex',gap:'5px',flex:1,overflowX:'auto'}}>
                                      {p.champs.map(pc=>{
                                        const isSel=pick?.champId===pc.champ.id;
                                        const tg=TAGS[pc.tag];
                                        return (
                                          <div key={pc.champ.id}
                                            onClick={()=>updPick(curTeam.id,comp.id,p.id,isSel?'':pc.champ.id)}
                                            title={`${pc.champ.name} (${tg.label})`}
                                            style={{position:'relative',cursor:'pointer',flexShrink:0,borderRadius:'9px',overflow:'hidden',
                                              border:isSel?`2.5px solid ${curTeam.color}`:`2px solid ${tg.bd}`,
                                              boxShadow:isSel?`0 0 0 2px ${curTeam.color}44`:'none',
                                              transition:'all 0.1s',
                                            }}>
                                            <img src={img(pc.champ)} alt={pc.champ.name}
                                              style={{width:'44px',height:'44px',objectFit:'cover',display:'block',opacity:isSel?1:0.7}} />
                                            <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.8))',padding:'2px 2px 3px',fontSize:'0.5rem',fontWeight:700,color:'#fff',textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                              {pc.champ.name}
                                            </div>
                                            <div style={{position:'absolute',top:'1px',right:'2px',fontSize:'0.58rem',lineHeight:1}}>{tg.short}</div>
                                          </div>
                                        );
                                      })}
                                      {p.champs.length===0&&<span style={{fontSize:'0.82rem',color:T3,alignSelf:'center'}}>챔피언 없음 · 선수 목록에서 추가</span>}
                                    </div>
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
          </div>
        </div>
      )}

      {/* 챔피언 모달 */}
      {picker&&(()=>{
        const t=teams.find(x=>x.id===picker.tid); const p=t?.players.find(x=>x.id===picker.pid); if(!t||!p) return null;
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}}
            onClick={e=>{if(e.target===e.currentTarget)setPicker(null);}}>
            <div style={{background:'#fff',border:`1.5px solid ${t.color}44`,borderRadius:'18px',width:'100%',maxWidth:'680px',overflow:'hidden',boxShadow:`0 24px 64px rgba(0,0,0,0.2)`}}>
              <div style={{padding:'14px 18px',borderBottom:`1px solid ${B}`,display:'flex',alignItems:'center',gap:'10px',background:`${t.color}08`}}>
                <div style={{width:'8px',height:'8px',borderRadius:'50%',background:t.color,boxShadow:`0 0 5px ${t.color}`}} />
                <span style={{fontWeight:900,fontSize:'0.96rem',color:t.color}}>{t.name}</span>
                <span style={{fontSize:'0.9rem',color:T2,fontWeight:700}}>· {p.name} 챔피언 추가</span>
                <button onClick={()=>setPicker(null)} style={{marginLeft:'auto',...B_STYLE(T2,S,B),...{padding:'5px 12px'}}}>닫기 ✕</button>
              </div>
              <div style={{padding:'12px 16px 10px',display:'flex',gap:'10px',alignItems:'center',borderBottom:`1px solid ${B}`,background:'#fafafa'}}>
                <input autoFocus value={ms} onChange={e=>setMs(e.target.value)}
                  placeholder="챔피언 검색..."
                  style={{flex:1,background:'#fff',border:`1.5px solid ${t.color}55`,borderRadius:'9px',padding:'9px 14px',color:T,fontSize:'0.96rem'}} />
                <span style={{fontSize:'0.76rem',color:T3,flexShrink:0}}>{mf.length}개</span>
              </div>
              <div style={{padding:'12px 16px 16px',maxHeight:'420px',overflowY:'auto',background:'#fafafa'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(68px,1fr))',gap:'6px'}}>
                  {mf.map(c=>(
                    <div key={c.id} className="ci" onClick={()=>addPC(picker.tid,picker.pid,c)} title={c.name}
                      style={{borderRadius:'9px',overflow:'hidden',cursor:'pointer',border:'1.5px solid transparent',position:'relative'}}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor=t.color}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='transparent'}>
                      <img src={img(c)} alt={c.name} style={{width:'100%',aspectRatio:'1',display:'block',objectFit:'cover'}} />
                      <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.85))',padding:'3px 3px 4px',fontSize:'0.56rem',fontWeight:700,color:'#fff',textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
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
