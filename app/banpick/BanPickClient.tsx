'use client';
import { useState, useEffect, useMemo } from 'react';

/* ── 상수 ── */
const ACCENT = '#EB701A';
const BG     = '#080810';
const SURFACE = 'rgba(255,255,255,0.04)';
const BORDER  = 'rgba(255,255,255,0.08)';
const BLUE_C  = '#4A8FFF';
const RED_C   = '#FF4A6A';

const TEAM_COLORS = ['#FF6B35','#4A8FFF','#A855F7','#10B981','#F59E0B','#EC4899','#06B6D4','#84CC16'];
const ROLES       = ['탑','정글','미드','원딜','서포터'];
const ROLE_ICON: Record<string,string> = {'탑':'🛡️','정글':'🌿','미드':'⚡','원딜':'🏹','서포터':'💊'};
const TAGS = {
  mustban:    { label:'🔴 필밴',   color:'#FF5566', bg:'rgba(255,85,102,0.12)', border:'rgba(255,85,102,0.35)' },
  onetrick:   { label:'🟡 장인픽', color:'#FFAA22', bg:'rgba(255,170,34,0.12)', border:'rgba(255,170,34,0.35)' },
  practicing: { label:'🟢 연습중', color:'#33CC77', bg:'rgba(51,204,119,0.12)', border:'rgba(51,204,119,0.35)' },
} as const;

/* ── 타입 ── */
interface Champ  { id:string; name:string; img:string; }
interface PChamp { champ:Champ; tag:keyof typeof TAGS; note:string; }
interface Player { id:string; name:string; role:string; champs:PChamp[]; }
interface Team   { id:string; name:string; color:string; players:Player[]; }
interface Session {
  id:string; title:string; createdAt:string;
  blueTeamId:string|null; redTeamId:string|null;
  bb:(Champ|null)[]; rb:(Champ|null)[];
  bp:(Champ|null)[]; rp:(Champ|null)[];
}
type ActiveSlot = { side:'blue'|'red'; type:'ban'|'pick'; idx:number };
type Tab = 'teams'|'bp'|'sessions';

const e5 = (): (Champ|null)[] => Array(5).fill(null);

export default function BanPickClient() {
  /* ── state ── */
  const [tab, setTab] = useState<Tab>('bp');
  const [champs, setChamps] = useState<Champ[]>([]);
  const [ver, setVer]       = useState('');
  const [loadingC, setLoadingC] = useState(true);
  const [search, setSearch] = useState('');
  const [champSearch, setChampSearch] = useState('');

  const [teams, setTeams]       = useState<Team[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  /* 현재 밴픽 */
  const [blueTeamId, setBlueTeamId] = useState<string|null>(null);
  const [redTeamId, setRedTeamId]   = useState<string|null>(null);
  const [bb, setBb] = useState<(Champ|null)[]>(e5());
  const [rb, setRb] = useState<(Champ|null)[]>(e5());
  const [bp, setBp] = useState<(Champ|null)[]>(e5());
  const [rp, setRp] = useState<(Champ|null)[]>(e5());
  const [active, setActive] = useState<ActiveSlot|null>(null);
  const [sessionTitle, setSessionTitle] = useState('');

  /* 팀 관리 */
  const [editTeam, setEditTeam]   = useState<string|null>(null);
  const [editPlayer, setEditPlayer] = useState<string|null>(null);
  const [noteKey, setNoteKey]     = useState<string|null>(null);
  const [champPicker, setChampPicker] = useState<{tid:string;pid:string}|null>(null); // 모달 대상
  const [modalSearch, setModalSearch] = useState('');

  /* 저장 */
  const save = async (key:string, val:unknown) => {
    try { await (window as any).storage?.set(key, JSON.stringify(val)); } catch {}
  };

  useEffect(() => {
    (async () => {
      try {
        const [st, ss] = await Promise.all([
          (window as any).storage?.get('bp-teams'),
          (window as any).storage?.get('bp-sessions'),
        ]);
        if (st?.value) setTeams(JSON.parse(st.value));
        if (ss?.value) setSessions(JSON.parse(ss.value));
      } catch {}
    })();
  }, []);

  /* DDragon */
  useEffect(() => {
    (async () => {
      try {
        const vr = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        const vs = await vr.json();
        const v  = vs[0]; setVer(v);
        const cr = await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/ko_KR/champion.json`);
        const cd = await cr.json();
        const list: Champ[] = (Object.values(cd.data) as any[])
          .map((c:any) => ({ id:c.id, name:c.name, img:c.image.full }))
          .sort((a,b) => a.name.localeCompare(b.name,'ko'));
        setChamps(list);
      } catch(e) { console.error(e); }
      finally { setLoadingC(false); }
    })();
  }, []);

  const imgUrl = (c:Champ) => `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${c.img}`;
  const placed = new Set([...bb,...rb,...bp,...rp].filter(Boolean).map(c=>c!.id));
  const filtered = useMemo(() => champs.filter(c => c.name.includes(search)||c.id.toLowerCase().includes(search.toLowerCase())), [champs,search]);
  const blueTeam = teams.find(t=>t.id===blueTeamId)||null;
  const redTeam  = teams.find(t=>t.id===redTeamId)||null;

  /* 팀 CRUD */
  const saveTeams = (t:Team[]) => { setTeams(t); save('bp-teams', t); };
  const addTeam   = () => {
    const t:Team = { id:Date.now().toString(), name:`팀 ${teams.length+1}`, color:TEAM_COLORS[teams.length%TEAM_COLORS.length], players:[] };
    saveTeams([...teams,t]); setEditTeam(t.id);
  };
  const updTeam   = (id:string, patch:Partial<Team>) => saveTeams(teams.map(t=>t.id===id?{...t,...patch}:t));
  const delTeam   = (id:string) => { saveTeams(teams.filter(t=>t.id!==id)); if(blueTeamId===id) setBlueTeamId(null); if(redTeamId===id) setRedTeamId(null); };

  /* 선수 CRUD */
  const addPlayer = (tid:string) => {
    const p:Player={id:Date.now().toString(),name:'선수명',role:'탑',champs:[]};
    updTeam(tid,{players:[...(teams.find(t=>t.id===tid)?.players||[]),p]}); setEditPlayer(p.id);
  };
  const updPlayer = (tid:string,pid:string,patch:Partial<Player>) =>
    updTeam(tid,{players:(teams.find(t=>t.id===tid)?.players||[]).map(p=>p.id===pid?{...p,...patch}:p)});
  const delPlayer = (tid:string,pid:string) =>
    updTeam(tid,{players:(teams.find(t=>t.id===tid)?.players||[]).filter(p=>p.id!==pid)});
  const addPC = (tid:string,pid:string,c:Champ) => {
    const t=teams.find(x=>x.id===tid); const p=t?.players.find(x=>x.id===pid);
    if(!p||p.champs.find(x=>x.champ.id===c.id)) return;
    updPlayer(tid,pid,{champs:[...p.champs,{champ:c,tag:'onetrick',note:''}]});
  };
  const updPC = (tid:string,pid:string,cid:string,patch:Partial<PChamp>) => {
    const t=teams.find(x=>x.id===tid); const p=t?.players.find(x=>x.id===pid); if(!p) return;
    updPlayer(tid,pid,{champs:p.champs.map(x=>x.champ.id===cid?{...x,...patch}:x)});
  };
  const delPC = (tid:string,pid:string,cid:string) => {
    const t=teams.find(x=>x.id===tid); const p=t?.players.find(x=>x.id===pid); if(!p) return;
    updPlayer(tid,pid,{champs:p.champs.filter(x=>x.champ.id!==cid)});
  };

  /* 밴픽 */
  const setSlot = (side:'blue'|'red',type:'ban'|'pick',idx:number,val:Champ|null) => {
    const m:Record<string,React.Dispatch<React.SetStateAction<(Champ|null)[]>>> = {'blue-ban':setBb,'red-ban':setRb,'blue-pick':setBp,'red-pick':setRp};
    m[`${side}-${type}`](p=>{const n=[...p];n[idx]=val;return n;});
  };
  const pickChamp = (c:Champ) => { if(!active||placed.has(c.id)) return; setSlot(active.side,active.type,active.idx,c); setActive(null); };
  const reset = () => { setBb(e5());setRb(e5());setBp(e5());setRp(e5());setActive(null); };
  const quickBan = (c:Champ) => {
    if(placed.has(c.id)) return;
    const bi=bb.findIndex(x=>!x), ri=rb.findIndex(x=>!x);
    if(bi>=0){setBb(p=>{const n=[...p];n[bi]=c;return n;});setTab('bp');}
    else if(ri>=0){setRb(p=>{const n=[...p];n[ri]=c;return n;});setTab('bp');}
  };

  /* 세션 저장 */
  const saveSession = () => {
    const bt=blueTeam?.name||'블루', rt=redTeam?.name||'레드';
    const title=sessionTitle.trim()||`${bt} vs ${rt} - ${new Date().toLocaleDateString('ko-KR')}`;
    const s:Session={id:Date.now().toString(),title,createdAt:new Date().toISOString(),blueTeamId,redTeamId,bb:[...bb],rb:[...rb],bp:[...bp],rp:[...rp]};
    const u=[s,...sessions].slice(0,50);
    setSessions(u); save('bp-sessions',u); setSessionTitle('');
  };
  const loadSession = (s:Session) => { setBb([...s.bb]);setRb([...s.rb]);setBp([...s.bp]);setRp([...s.rp]); setBlueTeamId(s.blueTeamId); setRedTeamId(s.redTeamId); setActive(null); setTab('bp'); };
  const delSession  = (id:string) => { const u=sessions.filter(s=>s.id!==id); setSessions(u); save('bp-sessions',u); };

  /* 슬롯 컴포넌트 */
  const Slot = ({champ,type,side,idx}:{champ:Champ|null;type:'ban'|'pick';side:'blue'|'red';idx:number}) => {
    const isActive = active?.side===side&&active?.type===type&&active?.idx===idx;
    const teamColor = side==='blue'?(blueTeam?.color||BLUE_C):(redTeam?.color||RED_C);
    const w = type==='ban' ? 50 : 68, h = type==='ban' ? 50 : 90;
    return (
      <div onClick={()=>champ?setSlot(side,type,idx,null):setActive(isActive?null:{side,type,idx})}
        title={champ?.name}
        style={{width:`${w}px`,height:`${h}px`,borderRadius:'10px',flexShrink:0,overflow:'hidden',position:'relative',cursor:'pointer',
          border: isActive?`2px solid ${teamColor}`:`1.5px solid ${champ?teamColor+'55':BORDER}`,
          background: champ?'transparent':isActive?`${teamColor}15`:SURFACE,
          boxShadow: isActive?`0 0 0 3px ${teamColor}33, 0 4px 16px ${teamColor}44`:'none',
          transition:'all 0.15s',
        }}>
        {champ?(
          <>
            <img src={imgUrl(champ)} alt={champ.name} style={{width:'100%',height:'100%',objectFit:'cover',filter:type==='ban'?'grayscale(0.6) brightness(0.65)':'none'}} />
            {type==='ban'&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.35)'}}>
              <span style={{fontSize:'1.6rem',color:'#fff',fontWeight:900,textShadow:'0 0 8px rgba(0,0,0,0.8)'}}>✕</span>
            </div>}
            <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.9))',padding:'3px 4px 4px',fontSize:'0.52rem',fontWeight:700,color:'#fff',textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {champ.name}
            </div>
          </>
        ):(
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontSize: isActive?'1.3rem':'1rem',color:isActive?teamColor:'rgba(255,255,255,0.12)'}}>
            {isActive?'◉':'+'}
          </div>
        )}
      </div>
    );
  };

  const TeamBadge = ({team,side}:{team:Team|null;side:'blue'|'red'}) => (
    <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'6px 12px',borderRadius:'10px',background:team?`${team.color}15`:SURFACE,border:`1px solid ${team?team.color+'40':BORDER}`}}>
      <div style={{width:'10px',height:'10px',borderRadius:'50%',background:team?.color||(side==='blue'?BLUE_C:RED_C),boxShadow:`0 0 6px ${team?.color||(side==='blue'?BLUE_C:RED_C)}`}} />
      <span style={{fontWeight:800,fontSize:'0.88rem',color:team?.color||(side==='blue'?BLUE_C:RED_C)}}>{team?.name||(side==='blue'?'블루팀':'레드팀')}</span>
    </div>
  );

  return (
    <div style={{background:BG,minHeight:'100vh',color:'#fff',fontFamily:'system-ui,sans-serif',paddingBottom:'60px'}}>
      {/* ══ 챔피언 선택 모달 ══ */}
      {champPicker && (() => {
        const t = teams.find(x=>x.id===champPicker.tid);
        const p = t?.players.find(x=>x.id===champPicker.pid);
        if (!t||!p) return null;
        const modalFiltered = champs.filter(c => (c.name.includes(modalSearch)||c.id.toLowerCase().includes(modalSearch.toLowerCase())) && !p.champs.find(x=>x.champ.id===c.id));
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}
            onClick={e=>{ if(e.target===e.currentTarget) setChampPicker(null); }}>
            <div style={{background:'#12121E',border:`1.5px solid ${t.color}44`,borderRadius:'18px',width:'100%',maxWidth:'600px',overflow:'hidden',boxShadow:`0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px ${t.color}22`}}>
              {/* 모달 헤더 */}
              <div style={{padding:'16px 20px',borderBottom:`1px solid ${BORDER}`,display:'flex',alignItems:'center',gap:'10px',background:`${t.color}0A`}}>
                <div style={{width:'10px',height:'10px',borderRadius:'50%',background:t.color,boxShadow:`0 0 8px ${t.color}`}} />
                <span style={{fontWeight:900,fontSize:'0.95rem',color:t.color}}>{t.name}</span>
                <span style={{fontWeight:700,fontSize:'0.88rem',color:'rgba(255,255,255,0.5)'}}>· {p.name} 챔피언 추가</span>
                <button onClick={()=>setChampPicker(null)}
                  style={{marginLeft:'auto',background:'rgba(255,255,255,0.08)',border:'none',borderRadius:'8px',color:'rgba(255,255,255,0.6)',cursor:'pointer',padding:'5px 12px',fontSize:'0.8rem',fontWeight:700}}>
                  닫기 ✕
                </button>
              </div>

              {/* 검색 */}
              <div style={{padding:'14px 16px 10px'}}>
                <input
                  autoFocus
                  value={modalSearch}
                  onChange={e=>setModalSearch(e.target.value)}
                  placeholder="챔피언 이름 검색..."
                  style={{width:'100%',background:'rgba(255,255,255,0.07)',border:`1px solid ${t.color}44`,borderRadius:'10px',padding:'10px 14px',color:'#fff',fontSize:'0.92rem',boxSizing:'border-box' as const}} />
                <div style={{marginTop:'8px',fontSize:'0.68rem',color:'rgba(255,255,255,0.3)'}}>
                  {modalFiltered.length}개 · 클릭해서 추가 · 이미 추가된 챔피언은 표시 안 됨
                </div>
              </div>

              {/* 챔피언 그리드 */}
              <div style={{padding:'0 16px 16px',maxHeight:'380px',overflowY:'auto'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(58px,1fr))',gap:'6px'}}>
                  {modalFiltered.map(c=>(
                    <div key={c.id}
                      onClick={()=>{ addPC(champPicker.tid,champPicker.pid,c); }}
                      title={c.name}
                      style={{borderRadius:'9px',overflow:'hidden',cursor:'pointer',border:`1.5px solid transparent`,transition:'all 0.12s',position:'relative'}}
                      onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.border=`1.5px solid ${t.color}`; (e.currentTarget as HTMLElement).style.transform='scale(1.06)'; }}
                      onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.border='1.5px solid transparent'; (e.currentTarget as HTMLElement).style.transform='scale(1)'; }}>
                      <img src={imgUrl(c)} alt={c.name} style={{width:'100%',aspectRatio:'1',display:'block',objectFit:'cover'}} />
                      <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.85))',padding:'3px 3px 4px',fontSize:'0.5rem',fontWeight:700,color:'#fff',textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
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

            <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .ci:hover{transform:scale(1.08);z-index:2}.ci{transition:transform 0.1s}
        input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.2)}
        input:focus,textarea:focus{outline:none}
        select{-webkit-appearance:none}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:rgba(255,255,255,0.03)}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:4px}
      `}</style>

      {/* 헤더 */}
      <div style={{borderBottom:`1px solid ${BORDER}`,padding:'0 clamp(1rem,4vw,2.5rem)',display:'flex',alignItems:'stretch',gap:'0'}}>
        <a href="/" style={{color:'rgba(255,255,255,0.3)',fontSize:'0.78rem',textDecoration:'none',fontWeight:600,display:'flex',alignItems:'center',paddingRight:'16px',borderRight:`1px solid ${BORDER}`,marginRight:'0'}}>← 홈</a>
        <div style={{display:'flex',gap:'0',flex:1}}>
          {([['teams','🏆 팀 관리'],['bp','⚔️ 밴픽'],['sessions','📁 시나리오']] as [Tab,string][]).map(([t,label]) => (
            <button key={t} onClick={()=>setTab(t)} style={{
              padding:'14px 20px', border:'none', background:'transparent', cursor:'pointer',
              fontSize:'0.85rem', fontWeight:800, color: tab===t?'#fff':'rgba(255,255,255,0.35)',
              borderBottom: tab===t?`2px solid ${ACCENT}`:'2px solid transparent',
              transition:'all 0.15s', position:'relative', top:'1px',
            }}>{label}</button>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'6px',paddingLeft:'16px',borderLeft:`1px solid ${BORDER}`}}>
          <span style={{fontSize:'0.68rem',color:'rgba(255,255,255,0.25)'}}>패치 {ver?.slice(0,5)}</span>
        </div>
      </div>

      {/* ══ 팀 관리 ══ */}
      {tab==='teams' && (
        <div style={{padding:'24px clamp(1rem,4vw,2.5rem)',animation:'fadeIn 0.2s both'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
            <div>
              <h2 style={{margin:0,fontSize:'1.3rem',fontWeight:900,letterSpacing:'-0.03em'}}>팀 관리</h2>
              <p style={{margin:'4px 0 0',fontSize:'0.75rem',color:'rgba(255,255,255,0.3)'}}>팀을 만들고 선수별 챔피언 풀을 관리하세요. 필밴 챔피언 클릭 → 밴픽 보드로 바로 이동</p>
            </div>
            <button onClick={addTeam} style={{padding:'10px 20px',borderRadius:'10px',border:'none',background:ACCENT,color:'#fff',fontSize:'0.85rem',fontWeight:800,cursor:'pointer'}}>+ 팀 추가</button>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:'16px'}}>
            {teams.map(team => (
              <div key={team.id} style={{background:SURFACE,border:`1px solid ${team.color}30`,borderRadius:'16px',overflow:'hidden',borderTop:`3px solid ${team.color}`}}>
                {/* 팀 헤더 */}
                <div style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:'10px',borderBottom:`1px solid ${BORDER}`}}>
                  <div style={{width:'12px',height:'12px',borderRadius:'50%',background:team.color,boxShadow:`0 0 8px ${team.color}`,flexShrink:0}} />
                  {editTeam===team.id?(
                    <div style={{display:'flex',gap:'8px',flex:1,alignItems:'center'}}>
                      <input value={team.name} onChange={e=>updTeam(team.id,{name:e.target.value})}
                        style={{flex:1,background:'rgba(255,255,255,0.08)',border:`1px solid ${team.color}55`,borderRadius:'8px',padding:'6px 10px',color:'#fff',fontSize:'0.92rem',fontWeight:800}} />
                      <div style={{display:'flex',gap:'4px',flexShrink:0}}>
                        {TEAM_COLORS.map(c=>(
                          <div key={c} onClick={()=>updTeam(team.id,{color:c})}
                            style={{width:'18px',height:'18px',borderRadius:'50%',background:c,cursor:'pointer',border:team.color===c?'2px solid #fff':'2px solid transparent',transition:'border 0.1s'}} />
                        ))}
                      </div>
                    </div>
                  ):(
                    <span style={{flex:1,fontWeight:900,fontSize:'0.95rem'}}>{team.name}</span>
                  )}
                  <div style={{display:'flex',gap:'4px'}}>
                    <button onClick={()=>setEditTeam(editTeam===team.id?null:team.id)} style={{padding:'4px 10px',borderRadius:'7px',border:`1px solid ${BORDER}`,background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.6)',fontSize:'0.72rem',cursor:'pointer',fontWeight:700}}>
                      {editTeam===team.id?'완료':'편집'}
                    </button>
                    <button onClick={()=>delTeam(team.id)} style={{padding:'4px 8px',borderRadius:'7px',border:'1px solid rgba(255,80,80,0.2)',background:'rgba(255,80,80,0.07)',color:'rgba(255,100,100,0.7)',fontSize:'0.72rem',cursor:'pointer'}}>삭제</button>
                  </div>
                </div>

                {/* 선수 목록 */}
                <div style={{padding:'10px 14px',display:'flex',flexDirection:'column',gap:'8px'}}>
                  {team.players.map(p=>(
                    <div key={p.id} style={{background:'rgba(255,255,255,0.025)',borderRadius:'10px',overflow:'hidden',border:`1px solid ${BORDER}`}}>
                      <div style={{padding:'8px 10px',display:'flex',alignItems:'center',gap:'8px'}}>
                        <span style={{fontSize:'1rem',flexShrink:0}}>{ROLE_ICON[p.role]||'👤'}</span>
                        {editPlayer===p.id?(
                          <div style={{display:'flex',gap:'6px',flex:1}}>
                            <input value={p.name} onChange={e=>updPlayer(team.id,p.id,{name:e.target.value})}
                              style={{flex:1,background:'rgba(255,255,255,0.07)',border:`1px solid ${BORDER}`,borderRadius:'6px',padding:'4px 8px',color:'#fff',fontSize:'0.85rem',fontWeight:700}} />
                            <select value={p.role} onChange={e=>updPlayer(team.id,p.id,{role:e.target.value})}
                              style={{background:'rgba(255,255,255,0.07)',border:`1px solid ${BORDER}`,borderRadius:'6px',padding:'4px 6px',color:'#fff',fontSize:'0.78rem'}}>
                              {ROLES.map(r=><option key={r} value={r}>{ROLE_ICON[r]} {r}</option>)}
                            </select>
                          </div>
                        ):(
                          <div style={{flex:1}}>
                            <span style={{fontWeight:800,fontSize:'0.88rem'}}>{p.name}</span>
                            <span style={{fontSize:'0.68rem',color:'rgba(255,255,255,0.35)',marginLeft:'6px'}}>{p.role}</span>
                          </div>
                        )}
                        <button onClick={()=>setEditPlayer(editPlayer===p.id?null:p.id)} style={{fontSize:'0.68rem',padding:'2px 8px',borderRadius:'5px',border:`1px solid ${BORDER}`,background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.5)',cursor:'pointer'}}>
                          {editPlayer===p.id?'완료':'편집'}
                        </button>
                        <button onClick={()=>delPlayer(team.id,p.id)} style={{fontSize:'0.7rem',background:'none',border:'none',color:'rgba(255,100,100,0.5)',cursor:'pointer'}}>✕</button>
                      </div>

                      {/* 챔피언 태그들 */}
                      {p.champs.length>0&&(
                        <div style={{padding:'4px 10px 8px',display:'flex',flexDirection:'column',gap:'4px'}}>
                          {p.champs.map(pc=>{
                            const tg=TAGS[pc.tag]; const nk=`${p.id}-${pc.champ.id}`;
                            return (
                              <div key={pc.champ.id} style={{borderRadius:'7px',overflow:'hidden',border:`1px solid ${tg.border}`,background:tg.bg}}>
                                <div style={{display:'flex',alignItems:'center',gap:'7px',padding:'5px 8px'}}>
                                  <img src={imgUrl(pc.champ)} alt={pc.champ.name}
                                    onClick={()=>pc.tag==='mustban'&&quickBan(pc.champ)}
                                    title={pc.tag==='mustban'?'클릭 → 밴 슬롯':pc.champ.name}
                                    style={{width:'32px',height:'32px',borderRadius:'6px',objectFit:'cover',cursor:pc.tag==='mustban'?'pointer':'default',border:`2px solid ${tg.color}`,flexShrink:0}} />
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontWeight:700,fontSize:'0.82rem',color:'#fff'}}>{pc.champ.name}</div>
                                    {pc.tag==='mustban'&&<div style={{fontSize:'0.58rem',color:tg.color}}>↗ 밴 슬롯으로</div>}
                                  </div>
                                  <select value={pc.tag} onChange={e=>updPC(team.id,p.id,pc.champ.id,{tag:e.target.value as any})}
                                    style={{background:'rgba(0,0,0,0.3)',border:`1px solid ${tg.border}`,borderRadius:'5px',padding:'2px 5px',color:tg.color,fontSize:'0.68rem',fontWeight:700}}>
                                    {Object.entries(TAGS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                                  </select>
                                  <button onClick={()=>setNoteKey(noteKey===nk?null:nk)} style={{fontSize:'0.65rem',padding:'2px 6px',borderRadius:'4px',border:`1px solid ${tg.border}`,background:'rgba(0,0,0,0.2)',color:tg.color,cursor:'pointer'}}>📝</button>
                                  <button onClick={()=>delPC(team.id,p.id,pc.champ.id)} style={{fontSize:'0.7rem',background:'none',border:'none',color:'rgba(255,100,100,0.5)',cursor:'pointer',padding:'0 2px'}}>✕</button>
                                </div>
                                {noteKey===nk&&(
                                  <textarea value={pc.note} onChange={e=>updPC(team.id,p.id,pc.champ.id,{note:e.target.value})}
                                    placeholder="메모 (예: 레넥 잡으면 다이브 위주, 갱 조심)"
                                    style={{width:'100%',background:'rgba(0,0,0,0.2)',border:'none',borderTop:`1px solid ${tg.border}`,padding:'6px 8px',color:'rgba(255,255,255,0.8)',fontSize:'0.75rem',lineHeight:1.5,resize:'vertical' as const,minHeight:'50px',boxSizing:'border-box' as const}} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 챔피언 추가 버튼 (모달로 열림) */}
                      {editPlayer===p.id&&(
                        <div style={{padding:'0 10px 8px'}}>
                          <button onClick={()=>{ setChampPicker({tid:team.id,pid:p.id}); setModalSearch(''); }}
                            style={{width:'100%',padding:'7px',borderRadius:'7px',border:`1.5px dashed ${team.color}55`,background:`${team.color}08`,color:`${team.color}cc`,fontSize:'0.78rem',fontWeight:700,cursor:'pointer'}}>
                            🔍 챔피언 추가
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <button onClick={()=>addPlayer(team.id)} style={{padding:'7px',borderRadius:'8px',border:`1.5px dashed ${team.color}44`,background:'transparent',color:`${team.color}88`,fontSize:'0.78rem',fontWeight:700,cursor:'pointer',transition:'all 0.15s'}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=`${team.color}15`;(e.currentTarget as HTMLElement).style.color=team.color;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.color=`${team.color}88`;}}>
                    + 선수 추가
                  </button>
                </div>
              </div>
            ))}

            {teams.length===0&&(
              <div style={{gridColumn:'1/-1',textAlign:'center',padding:'80px 20px',color:'rgba(255,255,255,0.2)'}}>
                <div style={{fontSize:'3rem',marginBottom:'12px'}}>🏆</div>
                <p style={{fontWeight:700,margin:0,fontSize:'1rem'}}>팀을 추가해보세요</p>
                <p style={{fontSize:'0.82rem',marginTop:'6px',color:'rgba(255,255,255,0.12)'}}>각 팀별 선수 챔피언 풀과 필밴 목록을 관리할 수 있어요</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ 밴픽 ══ */}
      {tab==='bp' && (
        <div style={{padding:'20px clamp(1rem,4vw,2.5rem)',animation:'fadeIn 0.2s both'}}>

          {/* 팀 선택 + 저장 바 */}
          <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'20px',flexWrap:'wrap',background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:'14px',padding:'12px 16px'}}>
            {/* 블루팀 선택 */}
            <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
              <span style={{fontSize:'0.68rem',fontWeight:700,color:BLUE_C,letterSpacing:'0.08em'}}>BLUE</span>
              <select value={blueTeamId||''} onChange={e=>setBlueTeamId(e.target.value||null)}
                style={{background:blueTeam?`${blueTeam.color}15`:SURFACE,border:`1px solid ${blueTeam?blueTeam.color+'55':BORDER}`,borderRadius:'8px',padding:'6px 10px',color:blueTeam?.color||'rgba(255,255,255,0.5)',fontSize:'0.82rem',fontWeight:800,cursor:'pointer'}}>
                <option value="">팀 선택</option>
                {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <span style={{fontWeight:900,fontSize:'0.9rem',color:'rgba(255,255,255,0.25)'}}>VS</span>

            {/* 레드팀 선택 */}
            <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
              <span style={{fontSize:'0.68rem',fontWeight:700,color:RED_C,letterSpacing:'0.08em'}}>RED</span>
              <select value={redTeamId||''} onChange={e=>setRedTeamId(e.target.value||null)}
                style={{background:redTeam?`${redTeam.color}15`:SURFACE,border:`1px solid ${redTeam?redTeam.color+'55':BORDER}`,borderRadius:'8px',padding:'6px 10px',color:redTeam?.color||'rgba(255,255,255,0.5)',fontSize:'0.82rem',fontWeight:800,cursor:'pointer'}}>
                <option value="">팀 선택</option>
                {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div style={{flex:1}} />

            <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
              <input value={sessionTitle} onChange={e=>setSessionTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveSession()} placeholder="시나리오 이름 (미입력 시 자동)"
                style={{background:'rgba(255,255,255,0.06)',border:`1px solid ${BORDER}`,borderRadius:'8px',padding:'7px 10px',color:'#fff',fontSize:'0.8rem',width:'180px'}} />
              <button onClick={saveSession} style={{padding:'7px 16px',borderRadius:'8px',border:'none',background:ACCENT,color:'#fff',fontSize:'0.8rem',fontWeight:800,cursor:'pointer',whiteSpace:'nowrap' as const}}>💾 저장</button>
              <button onClick={reset} style={{padding:'7px 12px',borderRadius:'8px',border:`1px solid ${BORDER}`,background:SURFACE,color:'rgba(255,255,255,0.5)',fontSize:'0.8rem',cursor:'pointer'}}>🔄</button>
            </div>
          </div>

          {/* 밴 영역 */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
            {([['blue','블루 밴',bb] as const,['red','레드 밴',rb] as const]).map(([side,label,slots])=>{
              const team = side==='blue'?blueTeam:redTeam;
              const color = team?.color||(side==='blue'?BLUE_C:RED_C);
              return (
                <div key={side} style={{background:SURFACE,border:`1px solid ${color}25`,borderRadius:'12px',padding:'12px 14px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',background:color,boxShadow:`0 0 6px ${color}`}} />
                    <span style={{fontSize:'0.7rem',fontWeight:800,color,letterSpacing:'0.08em'}}>{team?.name||label}</span>
                  </div>
                  <div style={{display:'flex',gap:'6px'}}>
                    {(slots as (Champ|null)[]).map((c,i)=><Slot key={i} champ={c} type="ban" side={side} idx={i} />)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 픽 + 챔피언 그리드 */}
          <div style={{display:'grid',gridTemplateColumns:'80px 1fr 80px',gap:'16px',alignItems:'start'}}>
            {/* 블루 픽 */}
            <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
              <span style={{fontSize:'0.65rem',fontWeight:800,color:blueTeam?.color||BLUE_C,letterSpacing:'0.08em',textAlign:'center' as const}}>픽</span>
              {bp.map((c,i)=><Slot key={i} champ={c} type="pick" side="blue" idx={i} />)}
            </div>

            {/* 챔피언 그리드 */}
            <div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="챔피언 검색..."
                style={{width:'100%',background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:'10px',padding:'9px 14px',color:'#fff',fontSize:'0.88rem',marginBottom:'10px',boxSizing:'border-box' as const}} />

              {active && (
                <div style={{marginBottom:'8px',padding:'7px 12px',borderRadius:'8px',background:`${(active.side==='blue'?(blueTeam?.color||BLUE_C):(redTeam?.color||RED_C))}18`,border:`1px solid ${(active.side==='blue'?(blueTeam?.color||BLUE_C):(redTeam?.color||RED_C))}44`,fontSize:'0.75rem',fontWeight:800,color:active.side==='blue'?(blueTeam?.color||BLUE_C):(redTeam?.color||RED_C),textAlign:'center' as const}}>
                  {active.side==='blue'?(blueTeam?.name||'블루'):(redTeam?.name||'레드')} · {active.type==='ban'?`밴 ${active.idx+1}`:`픽 ${active.idx+1}`} — 챔피언을 클릭하세요
                </div>
              )}

              {loadingC?(
                <div style={{textAlign:'center',color:'rgba(255,255,255,0.25)',padding:'40px',fontSize:'0.82rem'}}>챔피언 로딩 중...</div>
              ):(
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(50px,1fr))',gap:'4px',maxHeight:'420px',overflowY:'auto'}}>
                  {filtered.map(c=>{
                    const used=placed.has(c.id);
                    return (
                      <div key={c.id} className="ci" onClick={()=>active&&!used&&pickChamp(c)} title={c.name}
                        style={{borderRadius:'7px',overflow:'hidden',cursor:active&&!used?'pointer':'default',opacity:used?0.18:1,position:'relative'}}>
                        <img src={imgUrl(c)} alt={c.name} style={{width:'100%',aspectRatio:'1',display:'block',objectFit:'cover'}} />
                        <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.85))',padding:'2px 2px 3px',fontSize:'0.46rem',fontWeight:700,color:'#fff',textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {c.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 팀 필밴 챔피언 빠른 접근 */}
              {(blueTeam||redTeam) && (() => {
                const mustbans = [blueTeam,redTeam].filter(Boolean).flatMap(t=>
                  t!.players.flatMap(p=>p.champs.filter(pc=>pc.tag==='mustban').map(pc=>({...pc,team:t!,player:p})))
                ).filter(x=>!placed.has(x.champ.id));
                if(mustbans.length===0) return null;
                return (
                  <div style={{marginTop:'12px',padding:'10px 12px',background:'rgba(255,85,102,0.08)',border:'1px solid rgba(255,85,102,0.2)',borderRadius:'10px'}}>
                    <div style={{fontSize:'0.65rem',fontWeight:800,color:'#FF5566',marginBottom:'8px',letterSpacing:'0.08em'}}>🔴 필밴 목록 — 클릭 시 밴 슬롯으로</div>
                    <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                      {mustbans.map(({champ,team,player})=>(
                        <div key={`${team.id}-${champ.id}`} onClick={()=>quickBan(champ)} title={`${team.name} · ${player.name} · ${champ.name}`}
                          style={{position:'relative',cursor:'pointer',borderRadius:'6px',overflow:'hidden',width:'40px',height:'40px',flexShrink:0,border:`2px solid ${team.color}`}}>
                          <img src={imgUrl(champ)} alt={champ.name} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 레드 픽 */}
            <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
              <span style={{fontSize:'0.65rem',fontWeight:800,color:redTeam?.color||RED_C,letterSpacing:'0.08em',textAlign:'center' as const}}>픽</span>
              {rp.map((c,i)=><Slot key={i} champ={c} type="pick" side="red" idx={i} />)}
            </div>
          </div>
        </div>
      )}

      {/* ══ 시나리오 ══ */}
      {tab==='sessions' && (
        <div style={{padding:'24px clamp(1rem,4vw,2.5rem)',animation:'fadeIn 0.2s both'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
            <div>
              <h2 style={{margin:0,fontSize:'1.3rem',fontWeight:900,letterSpacing:'-0.03em'}}>저장된 시나리오</h2>
              <p style={{margin:'4px 0 0',fontSize:'0.75rem',color:'rgba(255,255,255,0.3)'}}>{sessions.length}개 저장됨 · 불러오기 클릭 시 밴픽 보드로 이동</p>
            </div>
          </div>

          {sessions.length===0?(
            <div style={{textAlign:'center',padding:'80px 20px',color:'rgba(255,255,255,0.2)'}}>
              <div style={{fontSize:'3rem',marginBottom:'12px'}}>📁</div>
              <p style={{fontWeight:700,margin:0}}>저장된 시나리오가 없어요</p>
              <p style={{fontSize:'0.82rem',marginTop:'6px',color:'rgba(255,255,255,0.12)'}}>밴픽 탭에서 시나리오를 저장해보세요</p>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              {sessions.map(s=>{
                const bt=teams.find(t=>t.id===s.blueTeamId), rt=teams.find(t=>t.id===s.redTeamId);
                const allChamps=[...s.bb,...s.bp].filter(Boolean) as Champ[];
                return (
                  <div key={s.id} style={{display:'grid',gridTemplateColumns:'1fr auto',gap:'16px',alignItems:'center',padding:'14px 16px',background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:'14px',transition:'border-color 0.15s'}}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.15)'}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor=BORDER}>
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'6px',flexWrap:'wrap'}}>
                        <span style={{fontWeight:900,fontSize:'0.95rem'}}>{s.title}</span>
                        {bt&&<span style={{fontSize:'0.7rem',fontWeight:800,padding:'2px 8px',borderRadius:'100px',background:`${bt.color}20`,color:bt.color,border:`1px solid ${bt.color}44`}}>{bt.name}</span>}
                        {rt&&<span style={{fontSize:'0.7rem',fontWeight:800,padding:'2px 8px',borderRadius:'100px',background:`${rt.color}20`,color:rt.color,border:`1px solid ${rt.color}44`}}>{rt.name}</span>}
                        <span style={{fontSize:'0.68rem',color:'rgba(255,255,255,0.25)'}}>{new Date(s.createdAt).toLocaleDateString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                      </div>
                      <div style={{display:'flex',gap:'3px',flexWrap:'wrap'}}>
                        {allChamps.slice(0,10).map((c,i)=>
                          <img key={i} src={imgUrl(c)} alt={c.name} title={c.name} style={{width:'28px',height:'28px',borderRadius:'5px',objectFit:'cover'}} />
                        )}
                        {allChamps.length>10&&<span style={{fontSize:'0.7rem',color:'rgba(255,255,255,0.3)',alignSelf:'center',marginLeft:'4px'}}>+{allChamps.length-10}</span>}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                      <button onClick={()=>loadSession(s)} style={{padding:'8px 16px',borderRadius:'8px',border:'none',background:ACCENT,color:'#fff',fontSize:'0.8rem',fontWeight:800,cursor:'pointer'}}>불러오기</button>
                      <button onClick={()=>delSession(s.id)} style={{padding:'8px 12px',borderRadius:'8px',border:'1px solid rgba(255,80,80,0.2)',background:'rgba(255,80,80,0.08)',color:'rgba(255,100,100,0.7)',fontSize:'0.8rem',cursor:'pointer'}}>삭제</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
