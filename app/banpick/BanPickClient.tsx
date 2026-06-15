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

const Btn = (color:string,bg:string,bd:string,extra?:object)=>({
  padding:'6px 13px',borderRadius:'7px',border:`1px solid ${bd}`,
  background:bg,color,cursor:'pointer' as const,fontSize:'0.84rem',fontWeight:700,
  fontFamily:'inherit',lineHeight:'1.4',...extra,
});

export default function BanPickClient() {
  const [champs,setChamps]       = useState<Champ[]>([]);
  const [ver,setVer]             = useState('');
  const [teams,setTeams]         = useState<Team[]>([]);
  const [comps,setComps]         = useState<Record<string,Composition[]>>({});
  const [saved,setSaved]         = useState(false);

  // 팀 관리
  const [manTeamId,setManTeamId] = useState<string|null>(null);
  const [editMode,setEditMode]   = useState(false);
  const [managePicks,setManagePicks] = useState<Record<string,string>>({});
  const [manCompName,setManCompName] = useState('');
  const [vsTeamId,setVsTeamId]   = useState<string|null>(null);
  const [vsCompId,setVsCompId]   = useState<string|null>(null);
  const [picker,setPicker]       = useState<{pid:string;side:'manage'|'blue'|'red'}|null>(null);
  const [ms,setMs]               = useState('');

  // 대전 기록 저장
  const [matchRecords,setMatchRecords] = useState<{id:string;name:string;blueTeamId:string|null;redTeamId:string|null;bluePicks:Record<string,string>;redPicks:Record<string,string>;savedAt:string}[]>([]);
  const [matchName,setMatchName]       = useState('');

  // 메인(블루 vs 레드)
  const [blueTeamId,setBlueTeamId] = useState<string|null>(null);
  const [redTeamId,setRedTeamId]   = useState<string|null>(null);
  const [bluePicks,setBluePicks]   = useState<Record<string,string>>({});
  const [redPicks,setRedPicks]     = useState<Record<string,string>>({});
  const [blueCompName,setBlueCompName] = useState('');
  const [editSide,setEditSide]         = useState<'blue'|'red'|null>(null); // 인라인 편집
  const [redCompName,setRedCompName]   = useState('');

  useEffect(()=>{
    try{const t=localStorage.getItem('bp-teams');if(t)setTeams(JSON.parse(t));}catch{}
    try{const c=localStorage.getItem('bp-comps');if(c)setComps(JSON.parse(c));}catch{}
    try{const m=localStorage.getItem('bp-matches');if(m)setMatchRecords(JSON.parse(m));}catch{}
    (async()=>{
      try{
        const v=(await(await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json())[0];setVer(v);
        const d=await(await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/ko_KR/champion.json`)).json();
        setChamps((Object.values(d.data) as any[]).map((c:any)=>({id:c.id,name:c.name,img:c.image.full})).sort((a:any,b:any)=>a.name.localeCompare(b.name,'ko')));
      }catch{}
    })();
  },[]);

  const img=(c:Champ)=>`https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${c.img}`;
  const flash=()=>{setSaved(true);setTimeout(()=>setSaved(false),1400);};
  const saveT=(t:Team[])=>{setTeams(t);try{localStorage.setItem('bp-teams',JSON.stringify(t));flash();}catch{}};
  const saveC=(c:Record<string,Composition[]>)=>{setComps(c);try{localStorage.setItem('bp-comps',JSON.stringify(c));flash();}catch{}};
  const getC=(tid:string)=>comps[tid]||[];
  const getTeam=(id:string|null)=>id?teams.find(t=>t.id===id)||null:null;

  // 메인 뷰에서 새 팀 추가
  const addTeamFromMain=(side?:'blue'|'red')=>{
    const tid=Date.now()+'';
    const players:Player[]=ROLES.map((role,i)=>({id:`${tid}_${i}`,name:`${role} 선수`,role,champs:[]}));
    const t:Team={id:tid,name:`팀 ${teams.length+1}`,color:COLORS[teams.length%COLORS.length],players};
    saveT([...teams,t]);
    if(side==='blue'){setBlueTeamId(tid);setBluePicks({});setEditSide('blue');}
    else if(side==='red'){setRedTeamId(tid);setRedPicks({});setEditSide('red');}
  };

  // 진영 스왑
  const swapSides=()=>{
    const [bt,rt,bp,rp]=[blueTeamId,redTeamId,bluePicks,redPicks];
    setBlueTeamId(rt); setRedTeamId(bt);
    setBluePicks(rp);  setRedPicks(bp);
  };

  // 대전 저장
  const saveMatch=()=>{
    const bt=getTeam(blueTeamId),rt=getTeam(redTeamId); if(!bt||!rt) return;
    const name=matchName.trim()||`${bt.name} vs ${rt.name} ${new Date().toLocaleDateString('ko-KR',{month:'short',day:'numeric'})}`;
    const rec={id:Date.now()+'',name,blueTeamId,redTeamId,bluePicks:{...bluePicks},redPicks:{...redPicks},savedAt:new Date().toISOString()};
    const updated=[rec,...matchRecords].slice(0,20);
    setMatchRecords(updated);setMatchName('');flash();
    try{localStorage.setItem('bp-matches',JSON.stringify(updated));}catch{}
  };
  const loadMatch=(m:typeof matchRecords[0])=>{setBlueTeamId(m.blueTeamId);setRedTeamId(m.redTeamId);setBluePicks({...m.bluePicks});setRedPicks({...m.redPicks});};
  const delMatch=(id:string)=>{const u=matchRecords.filter(m=>m.id!==id);setMatchRecords(u);try{localStorage.setItem('bp-matches',JSON.stringify(u));}catch{}};

  // 팀 CRUD
  const addTeam=()=>{
    const tid=Date.now()+'';
    const players:Player[]=ROLES.map((role,i)=>({id:`${tid}_${i}`,name:`${role} 선수`,role,champs:[]}));
    const t:Team={id:tid,name:`팀 ${teams.length+1}`,color:COLORS[teams.length%COLORS.length],players};
    saveT([...teams,t]);setManTeamId(tid);setEditMode(true);setManagePicks({});setVsTeamId(null);setVsCompId(null);
  };
  const updTeam=(id:string,p:Partial<Team>)=>saveT(teams.map(t=>t.id===id?{...t,...p}:t));
  const delTeam=(id:string)=>{saveT(teams.filter(t=>t.id!==id));if(blueTeamId===id)setBlueTeamId(null);if(redTeamId===id)setRedTeamId(null);};

  // 챔피언 CRUD
  const addPC=(pid:string,c:Champ,teamId?:string)=>{
    const tid=teamId||manTeamId; if(!tid)return;
    const tm=getTeam(tid);if(!tm)return;
    updTeam(tid,{players:tm.players.map(p=>p.id===pid?{...p,champs:p.champs.find(x=>x.champ.id===c.id)?p.champs:[...p.champs,{champ:c,tag:'onetrick' as const,note:''}]}:p)});
  };
  const updPC=(pid:string,cid:string,patch:Partial<PChamp>,teamId?:string)=>{
    const tid=teamId||manTeamId; if(!tid)return;const tm=getTeam(tid);if(!tm)return;
    updTeam(tid,{players:tm.players.map(p=>p.id===pid?{...p,champs:p.champs.map(x=>x.champ.id===cid?{...x,...patch}:x)}:p)});
  };
  const delPC=(pid:string,cid:string,teamId?:string)=>{
    const tid=teamId||manTeamId; if(!tid)return;const tm=getTeam(tid);if(!tm)return;
    updTeam(tid,{players:tm.players.map(p=>p.id===pid?{...p,champs:p.champs.filter(x=>x.champ.id!==cid)}:p)});
    setManagePicks(prev=>{const n={...prev};if(n[pid]===cid)delete n[pid];return n;});
  };

  // 조합 저장
  const saveComp=(tid:string,picks:Record<string,string>,name:string,setName:(s:string)=>void)=>{
    const n=name.trim()||`조합 ${getC(tid).length+1}`;
    saveC({...comps,[tid]:[...getC(tid),{id:Date.now()+'',name:n,picks:{...picks}}]});
    setName('');
  };
  const delComp=(tid:string,cid:string)=>saveC({...comps,[tid]:getC(tid).filter(c=>c.id!==cid)});

  // 메인 토글픽
  const togglePick=(side:'blue'|'red',pid:string,cid:string)=>{
    const setter=side==='blue'?setBluePicks:setRedPicks;
    setter(prev=>prev[pid]===cid?{...prev,[pid]:''}:{...prev,[pid]:cid});
  };

  const manTeam   = getTeam(manTeamId);
  const manSorted = manTeam?[...manTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)):[];
  const pickerTeamId = picker?.side==='blue'?blueTeamId:picker?.side==='red'?redTeamId:manTeamId;
  const mfChamps  = useMemo(()=>{
    if(!picker)return[];
    const p=getTeam(pickerTeamId)?.players.find(x=>x.id===picker.pid);
    return champs.filter(c=>(c.name.includes(ms)||c.id.toLowerCase().includes(ms.toLowerCase()))&&!p?.champs.find(x=>x.champ.id===c.id));
  },[champs,ms,picker,pickerTeamId,teams]);

  const blueTeam = getTeam(blueTeamId);
  const redTeam  = getTeam(redTeamId);

  // 우측 사이드 패널 (팀 관리 화면)
  const RightPanel = ()=>{
    if(!manTeam)return null;
    const vsTeam = getTeam(vsTeamId);
    const vsComp = vsTeamId?getC(vsTeamId).find(c=>c.id===vsCompId)||null:null;
    return (
      <div style={{position:'sticky',top:'68px',background:S,border:`1.5px solid ${manTeam.color}33`,borderRadius:'14px',overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {/* 헤더 */}
        <div style={{padding:'11px 14px',borderBottom:`1px solid ${B}`,background:`${manTeam.color}08`,display:'flex',alignItems:'center',gap:'8px'}}>
          <div style={{width:'8px',height:'8px',borderRadius:'50%',background:manTeam.color,boxShadow:`0 0 5px ${manTeam.color}`}} />
          <span style={{fontWeight:900,fontSize:'0.88rem',color:manTeam.color}}>현재 조합</span>
          <button onClick={()=>setManagePicks({})} style={{marginLeft:'auto',background:'none',border:'none',color:T3,cursor:'pointer',fontSize:'0.72rem',fontWeight:700,fontFamily:'inherit'}}>초기화</button>
        </div>

        {/* 포지션별 */}
        <div style={{padding:'10px 12px',display:'flex',flexDirection:'column',gap:'5px'}}>
          {manSorted.map(p=>{
            const selC=p.champs.find(x=>x.champ.id===managePicks[p.id]);
            const tg=selC?TAGS[selC.tag]:null;
            return (
              <div key={p.id} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 10px',borderRadius:'10px',
                background:selC?`${manTeam.color}08`:'rgba(0,0,0,0.025)',
                border:`1.5px solid ${selC?manTeam.color+'33':B}`,transition:'all 0.15s'}}>
                <span style={{fontSize:'0.95rem',flexShrink:0}}>{RI[p.role]}</span>
                {selC?(
                  <>
                    <img src={img(selC.champ)} alt={selC.champ.name} style={{width:'32px',height:'32px',borderRadius:'7px',objectFit:'cover',border:`2px solid ${manTeam.color}55`,flexShrink:0}} />
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:'0.82rem',color:manTeam.color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{selC.champ.name}</div>
                      <div style={{fontSize:'0.66rem',color:T2,marginTop:'1px'}}>{p.name} {tg&&<span style={{color:tg.color}}>{tg.short}</span>}</div>
                    </div>
                    <button onClick={()=>setManagePicks(prev=>{const n={...prev};delete n[p.id];return n;})}
                      style={{background:'none',border:'none',color:'rgba(180,50,50,0.4)',cursor:'pointer',fontSize:'0.8rem',padding:'0',flexShrink:0}}>✕</button>
                  </>
                ):(
                  <div style={{flex:1}}>
                    <div style={{fontSize:'0.8rem',color:T3,fontWeight:600}}>{p.name}</div>
                    <div style={{fontSize:'0.66rem',color:T3}}>클릭해서 선택</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 저장 */}
        <div style={{padding:'8px 12px',borderTop:`1px solid ${B}`,display:'flex',gap:'6px'}}>
          <input value={manCompName} onChange={e=>setManCompName(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&manTeamId)saveComp(manTeamId,managePicks,manCompName,setManCompName);}}
            placeholder="조합 이름"
            style={{flex:1,background:'#f8f9fb',border:`1px solid ${B}`,borderRadius:'7px',padding:'6px 9px',color:T,fontSize:'0.8rem'}} />
          <button onClick={()=>{if(manTeamId)saveComp(manTeamId,managePicks,manCompName,setManCompName);}}
            style={{...Btn('#fff',manTeam.color,'transparent',{flexShrink:0,padding:'6px 12px'})}}>저장</button>
        </div>

        {/* 저장된 조합 칩 */}
        {getC(manTeamId||'').length>0&&(
          <div style={{padding:'0 12px 10px',display:'flex',flexDirection:'column',gap:'4px'}}>
            {getC(manTeamId||'').map(c=>(
              <div key={c.id} style={{display:'flex',alignItems:'center',borderRadius:'8px',overflow:'hidden',border:`1px solid ${manTeam.color}28`,background:`${manTeam.color}08`}}>
                <button onClick={()=>setManagePicks({...c.picks})}
                  style={{flex:1,padding:'5px 8px',background:'transparent',border:'none',color:manTeam.color,fontSize:'0.76rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit',textAlign:'left' as const}}>
                  {c.name}
                </button>
                <div style={{display:'flex',gap:'2px',padding:'3px 5px',flexShrink:0}}>
                  {manSorted.map(p=>{const pc=p.champs.find(x=>x.champ.id===c.picks[p.id]);return pc?<img key={p.id} src={img(pc.champ)} alt={pc.champ.name} style={{width:'18px',height:'18px',borderRadius:'3px',objectFit:'cover'}} />:<div key={p.id} style={{width:'18px',height:'18px',borderRadius:'3px',background:'rgba(0,0,0,0.07)'}} />;}) }
                </div>
                <button onClick={()=>manTeamId&&delComp(manTeamId,c.id)}
                  style={{padding:'5px 8px',background:'transparent',border:'none',borderLeft:`1px solid ${manTeam.color}20`,color:'rgba(180,50,50,0.5)',cursor:'pointer',fontSize:'0.76rem',fontFamily:'inherit'}}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* vs 비교 구분선 */}
        <div style={{borderTop:`2px solid ${B}`,padding:'10px 14px 8px',display:'flex',alignItems:'center',gap:'6px',background:'rgba(0,0,0,0.015)'}}>
          <span style={{fontWeight:900,fontSize:'0.8rem',color:T2}}>⚔️ 상대팀 비교</span>
        </div>

        {/* 상대팀 선택 */}
        <div style={{padding:'0 12px 10px',display:'flex',flexDirection:'column',gap:'6px'}}>
          <select value={vsTeamId||''} onChange={e=>{setVsTeamId(e.target.value||null);setVsCompId(null);}}
            style={{width:'100%',background:'rgba(255,74,106,0.06)',border:'1.5px solid rgba(255,74,106,0.25)',borderRadius:'8px',padding:'7px 10px',color:T,fontSize:'0.84rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
            <option value="">상대 팀 선택</option>
            {teams.filter(t=>t.id!==manTeamId).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {vsTeamId&&(
            <select value={vsCompId||''} onChange={e=>setVsCompId(e.target.value||null)}
              style={{width:'100%',background:'rgba(255,74,106,0.04)',border:'1.5px solid rgba(255,74,106,0.18)',borderRadius:'8px',padding:'7px 10px',color:T,fontSize:'0.82rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
              <option value="">상대 조합 선택</option>
              {getC(vsTeamId).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {!vsTeamId&&<div style={{fontSize:'0.74rem',color:T3}}>상대 팀을 선택하면 포지션별 비교가 나와요</div>}
        </div>

        {/* 비교 결과 */}
        {vsTeam&&vsComp&&(
          <div style={{margin:'0 12px 12px',borderRadius:'10px',overflow:'hidden',border:`1px solid ${B}`}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 22px 1fr',background:'rgba(0,0,0,0.03)',borderBottom:`1px solid ${B}`}}>
              <div style={{padding:'6px 8px',fontWeight:800,fontSize:'0.7rem',color:manTeam.color,display:'flex',alignItems:'center',gap:'4px'}}>
                <div style={{width:'5px',height:'5px',borderRadius:'50%',background:manTeam.color}} />{manTeam.name}
              </div>
              <div style={{borderLeft:`1px solid ${B}`,borderRight:`1px solid ${B}`}} />
              <div style={{padding:'6px 8px',fontWeight:800,fontSize:'0.7rem',color:RED_C,textAlign:'right' as const,display:'flex',alignItems:'center',gap:'4px',justifyContent:'flex-end'}}>
                {vsTeam.name}<div style={{width:'5px',height:'5px',borderRadius:'50%',background:RED_C}} />
              </div>
            </div>
            {ROLES.map((role,ri)=>{
              const myP=manSorted.find(p=>p.role===role);
              const vsP=[...vsTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)).find(p=>p.role===role);
              const myC=myP?.champs.find(x=>x.champ.id===managePicks[myP.id]);
              const vsC=vsP?.champs.find(x=>x.champ.id===vsComp.picks[vsP.id]);
              return (
                <div key={role} style={{display:'grid',gridTemplateColumns:'1fr 22px 1fr',borderTop:ri>0?`1px solid ${B}`:'none',background:ri%2===0?'transparent':'rgba(0,0,0,0.015)'}}>
                  <div style={{padding:'6px 8px',display:'flex',alignItems:'center',gap:'5px'}}>
                    {myC?(
                      <>
                        <img src={img(myC.champ)} alt={myC.champ.name} style={{width:'28px',height:'28px',borderRadius:'6px',objectFit:'cover',border:`1.5px solid ${manTeam.color}44`,flexShrink:0}} />
                        <div style={{minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:'0.7rem',color:manTeam.color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{myC.champ.name}</div>
                          <div style={{fontSize:'0.58rem',color:T3}}>{myP?.name}</div>
                        </div>
                      </>
                    ):<span style={{fontSize:'0.66rem',color:T3}}>미선택</span>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.75rem',borderLeft:`1px solid ${B}`,borderRight:`1px solid ${B}`}}>{RI[role]}</div>
                  <div style={{padding:'6px 8px',display:'flex',alignItems:'center',gap:'5px',justifyContent:'flex-end',flexDirection:'row-reverse'}}>
                    {vsC?(
                      <>
                        <img src={img(vsC.champ)} alt={vsC.champ.name} style={{width:'28px',height:'28px',borderRadius:'6px',objectFit:'cover',border:'1.5px solid rgba(255,74,106,0.4)',flexShrink:0}} />
                        <div style={{minWidth:0,textAlign:'right' as const}}>
                          <div style={{fontWeight:700,fontSize:'0.7rem',color:RED_C,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{vsC.champ.name}</div>
                          <div style={{fontSize:'0.58rem',color:T3}}>{vsP?.name}</div>
                        </div>
                      </>
                    ):<span style={{fontSize:'0.66rem',color:T3}}>미선택</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {vsTeamId&&!vsCompId&&<div style={{padding:'8px 12px 12px',textAlign:'center',color:T3,fontSize:'0.74rem'}}>상대 조합을 선택하세요</div>}
      </div>
    );
  };

  // 메인 팀 패널
  const TeamPanel=({side}:{side:'blue'|'red'})=>{
    const teamId=side==='blue'?blueTeamId:redTeamId;
    const setTid=side==='blue'?setBlueTeamId:setRedTeamId;
    const picks=side==='blue'?bluePicks:redPicks;
    const cName=side==='blue'?blueCompName:redCompName;
    const setCName=side==='blue'?setBlueCompName:setRedCompName;
    const sideC=side==='blue'?BLUE_C:RED_C;
    const team=getTeam(teamId);
    const isEdit=editSide===side;
    const sorted=team?[...team.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)):[];
    return (
      <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:'10px'}}>
        {/* 팀 선택 + 편집 버튼 */}
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          <div style={{fontSize:'0.68rem',fontWeight:800,color:sideC,letterSpacing:'0.1em',flexShrink:0,width:'32px'}}>{side==='blue'?'BLUE':'RED'}</div>
          <select value={teamId||''} onChange={e=>{
            if(e.target.value==='__new__'){addTeamFromMain(side);}
            else{setTid(e.target.value||null);if(side==='blue')setBluePicks({});else setRedPicks({});setEditSide(null);}
          }}
            style={{flex:1,background:team?`${team.color}10`:S,border:`1.5px solid ${team?team.color+'55':B}`,borderRadius:'9px',padding:'8px 12px',color:team?.color||T,fontSize:'0.9rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
            <option value="">팀 선택</option>
            {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            <option value="__new__">＋ 새 팀 추가</option>
          </select>
          {team&&<button onClick={()=>setEditSide(isEdit?null:side)}
            style={{...Btn(isEdit?team.color:T2,isEdit?`${team.color}15`:S,isEdit?`${team.color}44`:B,{padding:'6px 10px',flexShrink:0})}}>
            {isEdit?'완료':'편집'}
          </button>}
        </div>

        {/* 팀 이름 편집 */}
        {team&&isEdit&&(
          <input value={team.name} onChange={e=>updTeam(team.id,{name:e.target.value})}
            style={{background:'#fff',border:`1.5px solid ${team.color}66`,borderRadius:'8px',padding:'6px 12px',color:T,fontSize:'0.92rem',fontWeight:900}} />
        )}

        {team&&(
          <>
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {sorted.map(p=>{
                const selC=p.champs.find(x=>x.champ.id===picks[p.id]);
                return (
                  <div key={p.id} style={{background:S,border:`1.5px solid ${selC?team.color+'44':B}`,borderRadius:'12px',overflow:'hidden',transition:'border-color 0.12s'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'9px 12px',borderBottom:p.champs.length>0||isEdit?`1px solid ${B}`:'none',background:selC?`${team.color}05`:'transparent'}}>
                      <span style={{fontSize:'1rem',flexShrink:0}}>{RI[p.role]}</span>
                      {isEdit?(
                        <input value={p.name} onChange={e=>updTeam(team.id,{players:team.players.map(x=>x.id===p.id?{...x,name:e.target.value}:x)})}
                          style={{flex:1,background:'rgba(0,0,0,0.04)',border:`1px solid ${B}`,borderRadius:'6px',padding:'3px 7px',color:T,fontSize:'0.86rem',fontWeight:800}} />
                      ):(
                        <span style={{fontWeight:800,fontSize:'0.88rem',flex:1}}>{p.name}</span>
                      )}
                      {selC&&!isEdit&&(
                        <div style={{display:'flex',alignItems:'center',gap:'5px',padding:'3px 8px',background:`${team.color}15`,border:`1.5px solid ${team.color}44`,borderRadius:'7px',flexShrink:0}}>
                          <img src={img(selC.champ)} alt={selC.champ.name} style={{width:'20px',height:'20px',borderRadius:'4px',objectFit:'cover',flexShrink:0}} />
                          <span style={{fontWeight:800,fontSize:'0.76rem',color:team.color,maxWidth:'80px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{selC.champ.name}</span>
                        </div>
                      )}
                      {isEdit&&<button onClick={()=>{setPicker({pid:p.id,side});setMs('');}}
                        style={{...Btn('#fff',team.color,'transparent',{padding:'4px 9px',fontSize:'0.76rem',flexShrink:0})}}>+ 챔피언</button>}
                    </div>
                    {p.champs.length>0&&(
                      <div style={{padding:'6px 10px 8px',display:'grid',gridTemplateColumns:'repeat(8,44px)',gap:'4px'}}>
                        {p.champs.map(pc=>{
                          const isSel=picks[p.id]===pc.champ.id;
                          const tg=TAGS[pc.tag];
                          return (
                            <div key={pc.champ.id} style={{position:'relative',flexShrink:0}}>
                              <div onClick={()=>!isEdit&&togglePick(side,p.id,pc.champ.id)} title={`${pc.champ.name} (${tg.label})`}
                                style={{borderRadius:'8px',overflow:'hidden',cursor:isEdit?'default':'pointer',
                                  border:isSel?`2.5px solid ${team.color}`:`2px solid ${tg.bd}`,
                                  boxShadow:isSel?`0 0 0 2px ${team.color}33`:'none',transition:'all 0.1s'}}>
                                <img src={img(pc.champ)} alt={pc.champ.name} style={{width:'44px',height:'44px',objectFit:'cover',display:'block',opacity:isSel?1:0.72}} />
                                <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.82))',padding:'2px 2px 3px',fontSize:'0.52rem',fontWeight:700,color:'#fff',textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pc.champ.name}</div>
                                <div style={{position:'absolute',top:'1px',right:'2px',fontSize:'0.58rem',lineHeight:1}}>{tg.short}</div>
                              </div>
                              {isEdit&&<button onClick={()=>delPC(p.id,pc.champ.id,team.id)}
                                style={{position:'absolute',top:'-5px',right:'-5px',width:'16px',height:'16px',borderRadius:'50%',background:'rgba(220,50,50,0.9)',border:'none',color:'#fff',cursor:'pointer',fontSize:'0.6rem',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit',lineHeight:1}}>✕</button>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{display:'flex',gap:'6px'}}>
              <input value={cName} onChange={e=>setCName(e.target.value)} placeholder="조합 이름"
                style={{flex:1,minWidth:'80px',background:'#fff',border:`1px solid ${B}`,borderRadius:'7px',padding:'6px 10px',color:T,fontSize:'0.82rem'}} />
              <button onClick={()=>{if(teamId)saveComp(teamId,picks,cName,setCName);}} style={{...Btn('#fff',team.color,'transparent',{flexShrink:0})}}>💾 저장</button>
            </div>
            {getC(team.id).length>0&&(
              <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
                {getC(team.id).map(c=>(
                  <div key={c.id} style={{display:'flex'}}>
                    <button onClick={()=>side==='blue'?setBluePicks({...c.picks}):setRedPicks({...c.picks})}
                      style={{padding:'4px 9px',borderRadius:'6px 0 0 6px',border:`1px solid ${team.color}44`,borderRight:'none',background:`${team.color}10`,color:team.color,fontSize:'0.76rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                      {c.name}
                    </button>
                    <button onClick={()=>delComp(team.id,c.id)}
                      style={{padding:'4px 7px',borderRadius:'0 6px 6px 0',border:`1px solid ${team.color}44`,background:`${team.color}08`,color:'rgba(200,50,50,0.8)',fontSize:'0.76rem',cursor:'pointer',fontFamily:'inherit'}}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {!team&&<div style={{textAlign:'center',padding:'30px 0',color:T3,fontSize:'0.84rem'}}>팀을 선택하거나<br/>새 팀을 추가해보세요</div>}
      </div>
    );
  };

  const showCmp=blueTeam&&redTeam&&ROLES.some(role=>{
    const bP=[...blueTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)).find(p=>p.role===role);
    const rP=[...redTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)).find(p=>p.role===role);
    return (bP&&bluePicks[bP.id])||(rP&&redPicks[rP.id]);
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
        <div style={{display:'flex',alignItems:'center',padding:'0 14px',flex:1}}>
          <span style={{fontWeight:900,fontSize:'0.96rem'}}>⚔️ 조합 분석</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          {saved&&<span style={{fontSize:'0.74rem',color:'#33CC77',fontWeight:700}}>✓ 저장됨</span>}
          <button onClick={()=>addTeamFromMain('blue')}
            style={{...Btn('#fff',A,'transparent',{padding:'6px 14px',fontSize:'0.84rem'})}}>
            + 팀 추가
          </button>
          {ver&&<span style={{fontSize:'0.66rem',color:T3}}>v{ver.slice(0,5)}</span>}
        </div>
      </div>


      <div style={{padding:'16px clamp(1rem,4vw,2rem)',animation:'fi 0.18s both'}}>
        <div style={{maxWidth:'1280px',margin:'0 auto'}}>
          {teams.length===0?(
            <div style={{textAlign:'center',padding:'80px 0',color:T3}}>
              <div style={{fontSize:'3rem',marginBottom:'14px'}}>🏆</div>
              <div style={{fontWeight:700,fontSize:'1rem',color:T,marginBottom:'8px'}}>팀을 만들고 조합을 짜보세요</div>
              <div style={{fontSize:'0.84rem',marginBottom:'20px',color:T3}}>헤더의 <strong style={{color:A}}>+ 팀 추가</strong> 버튼으로 팀을 생성해요</div>
              <button onClick={()=>addTeamFromMain('blue')} style={{...Btn('#fff',A,'transparent',{fontSize:'0.96rem',padding:'10px 24px'})}}>+ 첫 번째 팀 추가</button>
            </div>
          ):(()=>{
            const bSorted = blueTeam?[...blueTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)):[];
            const rSorted = redTeam?[...redTeam.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)):[];
            const isEditBlue = editSide==='blue';
            const isEditRed  = editSide==='red';

            const ChampGrid = ({team,player,picks,side,isEdit}:{team:Team|null,player:Player|null,picks:Record<string,string>,side:'blue'|'red',isEdit:boolean}) => {
              if(!team||!player) return <div style={{padding:'12px',color:T3,fontSize:'0.8rem'}}>팀을 선택하세요</div>;
              const selC = player.champs.find(x=>x.champ.id===picks[player.id]);
              return (
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'9px 12px',borderBottom:player.champs.length>0?`1px solid ${B}`:'none',background:selC?`${team.color}05`:'transparent'}}>
                    <span style={{fontSize:'0.95rem',flexShrink:0}}>{RI[player.role]}</span>
                    {isEdit?(
                      <input value={player.name} onChange={e=>updTeam(team.id,{players:team.players.map(x=>x.id===player.id?{...x,name:e.target.value}:x)})}
                        style={{flex:1,background:'rgba(0,0,0,0.04)',border:`1px solid ${B}`,borderRadius:'6px',padding:'3px 7px',color:T,fontSize:'0.86rem',fontWeight:800}} />
                    ):(
                      <span style={{fontWeight:800,fontSize:'0.88rem',flex:1}}>{player.name}</span>
                    )}
                    {selC&&!isEdit&&(
                      <div style={{display:'flex',alignItems:'center',gap:'5px',padding:'3px 8px',background:`${team.color}15`,border:`1.5px solid ${team.color}44`,borderRadius:'7px',flexShrink:0}}>
                        <img src={img(selC.champ)} alt={selC.champ.name} style={{width:'20px',height:'20px',borderRadius:'4px',objectFit:'cover',flexShrink:0}} />
                        <span style={{fontWeight:800,fontSize:'0.76rem',color:team.color,maxWidth:'80px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{selC.champ.name}</span>
                      </div>
                    )}
                    {isEdit&&<button onClick={()=>{setPicker({pid:player.id,side});setMs('');}}
                      style={{...Btn('#fff',team.color,'transparent',{padding:'4px 9px',fontSize:'0.76rem',flexShrink:0})}}>+ 챔피언</button>}
                  </div>
                  {player.champs.length>0&&(
                    <div style={{padding:'6px 10px 8px',display:'grid',gridTemplateColumns:'repeat(8,44px)',gap:'4px'}}>
                      {player.champs.map(pc=>{
                        const isSel=picks[player.id]===pc.champ.id;
                        const tg=TAGS[pc.tag];
                        return (
                          <div key={pc.champ.id} style={{position:'relative',flexShrink:0}}>
                            <div onClick={()=>!isEdit&&togglePick(side,player.id,pc.champ.id)} title={`${pc.champ.name} (${tg.label})`}
                              style={{borderRadius:'8px',overflow:'hidden',cursor:isEdit?'default':'pointer',
                                border:isSel?`2.5px solid ${team.color}`:`2px solid ${tg.bd}`,
                                boxShadow:isSel?`0 0 0 2px ${team.color}33`:'none',transition:'all 0.1s'}}>
                              <img src={img(pc.champ)} alt={pc.champ.name} style={{width:'44px',height:'44px',objectFit:'cover',display:'block',opacity:isSel?1:0.72}} />
                              <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.82))',padding:'2px 2px 3px',fontSize:'0.52rem',fontWeight:700,color:'#fff',textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pc.champ.name}</div>
                              <div style={{position:'absolute',top:'1px',right:'2px',fontSize:'0.58rem',lineHeight:1}}>{tg.short}</div>
                            </div>
                            {isEdit&&<button onClick={()=>delPC(player.id,pc.champ.id,team.id)}
                              style={{position:'absolute',top:'-5px',right:'-5px',width:'16px',height:'16px',borderRadius:'50%',background:'rgba(220,50,50,0.9)',border:'none',color:'#fff',cursor:'pointer',fontSize:'0.6rem',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit',lineHeight:1}}>✕</button>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 240px',gap:'14px',alignItems:'start'}}>

                {/* ── 블루팀 ── */}
                <div style={{background:S,border:`1.5px solid ${blueTeam?blueTeam.color+'33':B}`,borderRadius:'14px',overflow:'hidden'}}>
                  <div style={{padding:'10px 14px',display:'flex',gap:'8px',alignItems:'center',borderBottom:`1px solid ${B}`,background:blueTeam?`${blueTeam.color}06`:'rgba(0,0,0,0.02)'}}>
                    <span style={{fontSize:'0.68rem',fontWeight:800,color:BLUE_C,letterSpacing:'0.1em',flexShrink:0}}>BLUE</span>
                    <select value={blueTeamId||''} onChange={e=>{if(e.target.value==='__new__')addTeamFromMain('blue');else{setBlueTeamId(e.target.value||null);setBluePicks({});setEditSide(null);}}}
                      style={{flex:1,background:blueTeam?`${blueTeam.color}10`:S,border:`1.5px solid ${blueTeam?blueTeam.color+'55':B}`,borderRadius:'8px',padding:'6px 10px',color:blueTeam?.color||T,fontSize:'0.88rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                      <option value="">팀 선택</option>
                      {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                      <option value="__new__">＋ 새 팀 추가</option>
                    </select>
                    {blueTeam&&<button onClick={()=>setEditSide(isEditBlue?null:'blue')} style={{...Btn(isEditBlue?blueTeam.color:T2,isEditBlue?`${blueTeam.color}15`:S,isEditBlue?`${blueTeam.color}44`:B,{flexShrink:0})}}>{isEditBlue?'완료':'편집'}</button>}
                  </div>
                  {ROLES.map((role,ri)=>{
                    const p=bSorted.find(x=>x.role===role)||null;
                    return <div key={role} style={{borderTop:ri>0?`1px solid ${B}`:'none'}}><ChampGrid team={blueTeam} player={p} picks={bluePicks} side="blue" isEdit={isEditBlue} /></div>;
                  })}
                  <div style={{padding:'10px 14px',borderTop:`1px solid ${B}`,display:'flex',flexDirection:'column',gap:'6px',background:'rgba(0,0,0,0.02)'}}>
                    <div style={{display:'flex',gap:'6px'}}>
                      <input value={blueCompName} onChange={e=>setBlueCompName(e.target.value)} placeholder="조합 이름"
                        style={{flex:1,background:'#fff',border:`1px solid ${B}`,borderRadius:'7px',padding:'5px 8px',color:T,fontSize:'0.8rem'}} />
                      <button onClick={()=>{if(blueTeamId)saveComp(blueTeamId,bluePicks,blueCompName,setBlueCompName);}} style={{...Btn('#fff',blueTeam?.color||BLUE_C,'transparent',{flexShrink:0,padding:'5px 10px'})}}>💾</button>
                    </div>
                    {blueTeam&&getC(blueTeam.id).length>0&&(
                      <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                        {getC(blueTeam.id).map(c=>(
                          <div key={c.id} style={{display:'flex'}}>
                            <button onClick={()=>setBluePicks({...c.picks})} style={{padding:'3px 8px',borderRadius:'6px 0 0 6px',border:`1px solid ${blueTeam.color}44`,borderRight:'none',background:`${blueTeam.color}10`,color:blueTeam.color,fontSize:'0.74rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{c.name}</button>
                            <button onClick={()=>delComp(blueTeam.id,c.id)} style={{padding:'3px 6px',borderRadius:'0 6px 6px 0',border:`1px solid ${blueTeam.color}44`,background:`${blueTeam.color}08`,color:'rgba(200,50,50,0.8)',fontSize:'0.74rem',cursor:'pointer',fontFamily:'inherit'}}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── 레드팀 ── */}
                <div style={{background:S,border:`1.5px solid ${redTeam?redTeam.color+'33':B}`,borderRadius:'14px',overflow:'hidden'}}>
                  <div style={{padding:'10px 14px',display:'flex',gap:'8px',alignItems:'center',borderBottom:`1px solid ${B}`,background:redTeam?`${redTeam.color}06`:'rgba(0,0,0,0.02)'}}>
                    {redTeam&&<button onClick={()=>setEditSide(isEditRed?null:'red')} style={{...Btn(isEditRed?redTeam.color:T2,isEditRed?`${redTeam.color}15`:S,isEditRed?`${redTeam.color}44`:B,{flexShrink:0})}}>{isEditRed?'완료':'편집'}</button>}
                    <select value={redTeamId||''} onChange={e=>{if(e.target.value==='__new__')addTeamFromMain('red');else{setRedTeamId(e.target.value||null);setRedPicks({});setEditSide(null);}}}
                      style={{flex:1,background:redTeam?`${redTeam.color}10`:S,border:`1.5px solid ${redTeam?redTeam.color+'55':B}`,borderRadius:'8px',padding:'6px 10px',color:redTeam?.color||T,fontSize:'0.88rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                      <option value="">팀 선택</option>
                      {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                      <option value="__new__">＋ 새 팀 추가</option>
                    </select>
                    <span style={{fontSize:'0.68rem',fontWeight:800,color:RED_C,letterSpacing:'0.1em',flexShrink:0}}>RED</span>
                  </div>
                  {ROLES.map((role,ri)=>{
                    const p=rSorted.find(x=>x.role===role)||null;
                    return <div key={role} style={{borderTop:ri>0?`1px solid ${B}`:'none'}}><ChampGrid team={redTeam} player={p} picks={redPicks} side="red" isEdit={isEditRed} /></div>;
                  })}
                  <div style={{padding:'10px 14px',borderTop:`1px solid ${B}`,display:'flex',flexDirection:'column',gap:'6px',background:'rgba(0,0,0,0.02)'}}>
                    <div style={{display:'flex',gap:'6px'}}>
                      <button onClick={()=>{if(redTeamId)saveComp(redTeamId,redPicks,redCompName,setRedCompName);}} style={{...Btn('#fff',redTeam?.color||RED_C,'transparent',{flexShrink:0,padding:'5px 10px'})}}>💾</button>
                      <input value={redCompName} onChange={e=>setRedCompName(e.target.value)} placeholder="조합 이름"
                        style={{flex:1,background:'#fff',border:`1px solid ${B}`,borderRadius:'7px',padding:'5px 8px',color:T,fontSize:'0.8rem'}} />
                    </div>
                    {redTeam&&getC(redTeam.id).length>0&&(
                      <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                        {getC(redTeam.id).map(c=>(
                          <div key={c.id} style={{display:'flex'}}>
                            <button onClick={()=>setRedPicks({...c.picks})} style={{padding:'3px 8px',borderRadius:'6px 0 0 6px',border:`1px solid ${redTeam.color}44`,borderRight:'none',background:`${redTeam.color}10`,color:redTeam.color,fontSize:'0.74rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{c.name}</button>
                            <button onClick={()=>delComp(redTeam.id,c.id)} style={{padding:'3px 6px',borderRadius:'0 6px 6px 0',border:`1px solid ${redTeam.color}44`,background:`${redTeam.color}08`,color:'rgba(200,50,50,0.8)',fontSize:'0.74rem',cursor:'pointer',fontFamily:'inherit'}}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── 우측 비교 패널 (sticky) ── */}
                <div style={{position:'sticky',top:'68px',display:'flex',flexDirection:'column',gap:'10px'}}>
                  <div style={{background:S,border:`1px solid ${B}`,borderRadius:'14px',overflow:'hidden'}}>
                    {/* VS 헤더 */}
                    <div style={{padding:'10px 12px',borderBottom:`1px solid ${B}`,background:'rgba(0,0,0,0.02)'}}>
                      {blueTeam&&redTeam?(
                        <div style={{display:'flex',alignItems:'center',gap:'5px',justifyContent:'center',flexWrap:'wrap'}}>
                          <div style={{width:'6px',height:'6px',borderRadius:'50%',background:blueTeam.color}} />
                          <span style={{fontWeight:900,fontSize:'0.8rem',color:blueTeam.color}}>{blueTeam.name}</span>
                          <span style={{fontSize:'0.72rem',color:T3}}>vs</span>
                          <span style={{fontWeight:900,fontSize:'0.8rem',color:redTeam.color}}>{redTeam.name}</span>
                          <div style={{width:'6px',height:'6px',borderRadius:'50%',background:redTeam.color}} />
                          <button onClick={swapSides} title="진영 변경" style={{background:'none',border:`1px solid ${B}`,borderRadius:'6px',padding:'2px 6px',cursor:'pointer',fontSize:'0.8rem',color:T2,fontFamily:'inherit'}}>⇄</button>
                        </div>
                      ):<span style={{display:'block',textAlign:'center' as const,fontSize:'0.8rem',color:T3,fontWeight:700}}>⚔️ 비교</span>}
                    </div>
                    {/* 포지션별 */}
                    {ROLES.map((role,ri)=>{
                      const bP=bSorted.find(p=>p.role===role);
                      const rP=rSorted.find(p=>p.role===role);
                      const bC=bP?.champs.find(x=>x.champ.id===bluePicks[bP.id]);
                      const rC=rP?.champs.find(x=>x.champ.id===redPicks[rP.id]);
                      return (
                        <div key={role} style={{display:'grid',gridTemplateColumns:'1fr 28px 1fr',borderTop:ri>0?`1px solid ${B}`:'none',background:ri%2===0?'transparent':'rgba(0,0,0,0.015)'}}>
                          <div style={{padding:'8px 10px',display:'flex',flexDirection:'column',alignItems:'flex-start',gap:'3px'}}>
                            {bC?(<>
                              <img src={img(bC.champ)} alt={bC.champ.name} style={{width:'40px',height:'40px',borderRadius:'7px',objectFit:'cover',border:`2px solid ${blueTeam?.color||BLUE_C}55`}} />
                              <div style={{fontWeight:700,fontSize:'0.72rem',color:blueTeam?.color||BLUE_C,lineHeight:1.3}}>{bC.champ.name}</div>
                              <div style={{fontSize:'0.62rem',color:T3}}>{bP?.name}</div>
                            </>):<span style={{fontSize:'0.68rem',color:T3}}>미선택</span>}
                          </div>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.85rem',borderLeft:`1px solid ${B}`,borderRight:`1px solid ${B}`}}>{RI[role]}</div>
                          <div style={{padding:'8px 10px',display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'3px'}}>
                            {rC?(<>
                              <img src={img(rC.champ)} alt={rC.champ.name} style={{width:'40px',height:'40px',borderRadius:'7px',objectFit:'cover',border:`2px solid ${redTeam?.color||RED_C}55`}} />
                              <div style={{fontWeight:700,fontSize:'0.72rem',color:redTeam?.color||RED_C,lineHeight:1.3,textAlign:'right' as const}}>{rC.champ.name}</div>
                              <div style={{fontSize:'0.62rem',color:T3}}>{rP?.name}</div>
                            </>):<span style={{fontSize:'0.68rem',color:T3}}>미선택</span>}
                          </div>
                        </div>
                      );
                    })}
                    {/* 대전 저장 */}
                    <div style={{padding:'8px 10px',borderTop:`1px solid ${B}`,display:'flex',gap:'5px',background:'rgba(0,0,0,0.015)'}}>
                      <input value={matchName} onChange={e=>setMatchName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveMatch()} placeholder="대전 이름"
                        style={{flex:1,background:'#fff',border:`1px solid ${B}`,borderRadius:'6px',padding:'5px 7px',color:T,fontSize:'0.76rem',minWidth:0}} />
                      <button onClick={saveMatch} style={{...Btn('#fff',A,'transparent',{padding:'5px 8px',fontSize:'0.76rem',flexShrink:0})}}>💾</button>
                    </div>
                  </div>

                  {/* 저장된 대전 */}
                  {matchRecords.filter(m=>{const ids=new Set([m.blueTeamId,m.redTeamId]);return ids.has(blueTeamId)&&ids.has(redTeamId);}).length>0&&(
                    <div style={{display:'flex',flexDirection:'column',gap:'5px'}}>
                      <div style={{fontSize:'0.7rem',fontWeight:700,color:T3}}>이 대전 기록</div>
                      {matchRecords.filter(m=>{const ids=new Set([m.blueTeamId,m.redTeamId]);return ids.has(blueTeamId)&&ids.has(redTeamId);}).map(m=>{
                        const bt=getTeam(m.blueTeamId),rt=getTeam(m.redTeamId);
                        const bC2=bt?[...bt.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)).map(p=>p.champs.find(x=>x.champ.id===m.bluePicks[p.id])).filter(Boolean) as PChamp[]:[];
                        const rC2=rt?[...rt.players].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)).map(p=>p.champs.find(x=>x.champ.id===m.redPicks[p.id])).filter(Boolean) as PChamp[]:[];
                        return (
                          <div key={m.id} style={{background:S,border:`1px solid ${B}`,borderRadius:'9px',overflow:'hidden'}}>
                            <button onClick={()=>loadMatch(m)} style={{width:'100%',padding:'8px 10px',background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left' as const}}>
                              <div style={{fontWeight:800,fontSize:'0.76rem',color:T,marginBottom:'5px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{m.name}</div>
                              {bt&&<div style={{display:'flex',alignItems:'center',gap:'3px',marginBottom:'3px'}}>
                                <span style={{fontSize:'0.6rem',fontWeight:700,color:bt.color,width:'30px',flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{bt.name}</span>
                                {bC2.map((pc,i)=><img key={i} src={img(pc.champ)} alt={pc.champ.name} style={{width:'22px',height:'22px',borderRadius:'4px',objectFit:'cover',border:`1.5px solid ${bt.color}44`}} />)}
                              </div>}
                              {rt&&<div style={{display:'flex',alignItems:'center',gap:'3px'}}>
                                <span style={{fontSize:'0.6rem',fontWeight:700,color:rt.color,width:'30px',flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{rt.name}</span>
                                {rC2.map((pc,i)=><img key={i} src={img(pc.champ)} alt={pc.champ.name} style={{width:'22px',height:'22px',borderRadius:'4px',objectFit:'cover',border:`1.5px solid ${rt.color}44`}} />)}
                              </div>}
                            </button>
                            <button onClick={()=>delMatch(m.id)} style={{width:'100%',padding:'3px',background:'transparent',border:'none',borderTop:`1px solid ${B}`,color:'rgba(180,50,50,0.5)',cursor:'pointer',fontSize:'0.68rem',fontFamily:'inherit'}}>삭제 ✕</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      {/* 챔피언 추가 모달 */}
      {picker&&(()=>{
        const modalTeamId=picker.side==='blue'?blueTeamId:picker.side==='red'?redTeamId:manTeamId;
        const modalTeam=getTeam(modalTeamId);
        const p=modalTeam?.players.find(x=>x.id===picker.pid);if(!p||!modalTeam)return null;
        const manTeam=modalTeam;
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
                    <div key={c.id} className="ci" onClick={()=>addPC(picker.pid,c,modalTeamId||undefined)} title={c.name}
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
