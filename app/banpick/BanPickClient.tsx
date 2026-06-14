'use client';
import { useState, useEffect, useMemo } from 'react';

const ACCENT = '#EB701A';
const BG     = '#080810';
const SURFACE = 'rgba(255,255,255,0.04)';
const BORDER  = 'rgba(255,255,255,0.08)';

const TEAM_COLORS = ['#FF6B35','#4A8FFF','#A855F7','#10B981','#F59E0B','#EC4899','#06B6D4','#84CC16'];
const ROLES       = ['탑','정글','미드','원딜','서포터'];
const ROLE_ICON: Record<string,string> = {'탑':'🛡️','정글':'🌿','미드':'⚡','원딜':'🏹','서포터':'💊'};
const TAGS = {
  mustban:    { label:'🔴 필밴',   color:'#FF5566', bg:'rgba(255,85,102,0.12)',  border:'rgba(255,85,102,0.35)'  },
  onetrick:   { label:'🟡 장인픽', color:'#FFAA22', bg:'rgba(255,170,34,0.12)', border:'rgba(255,170,34,0.35)' },
  practicing: { label:'🟢 연습중', color:'#33CC77', bg:'rgba(51,204,119,0.12)', border:'rgba(51,204,119,0.35)' },
} as const;

interface Champ  { id:string; name:string; img:string; }
interface PChamp { champ:Champ; tag:keyof typeof TAGS; note:string; }
interface Player { id:string; name:string; role:string; champs:PChamp[]; }
interface Team   { id:string; name:string; color:string; players:Player[]; }

export default function BanPickClient() {
  const [champs, setChamps] = useState<Champ[]>([]);
  const [ver, setVer]       = useState('');
  const [teams, setTeams]   = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string|null>(null);
  const [editTeam, setEditTeam]     = useState<string|null>(null);
  const [editPlayer, setEditPlayer] = useState<string|null>(null);
  const [noteKey, setNoteKey]       = useState<string|null>(null);
  const [champPicker, setChampPicker] = useState<{tid:string;pid:string}|null>(null);
  const [modalSearch, setModalSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const st = await (window as any).storage?.get('bp-teams');
        if (st?.value) setTeams(JSON.parse(st.value));
      } catch {}
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
    })();
  }, []);

  const imgUrl = (c:Champ) => `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${c.img}`;

  const saveTeams = async (t:Team[]) => {
    setTeams(t);
    try { await (window as any).storage?.set('bp-teams', JSON.stringify(t)); } catch {}
  };

  /* 팀 CRUD */
  const addTeam = () => {
    const t:Team = { id:Date.now().toString(), name:`팀 ${teams.length+1}`, color:TEAM_COLORS[teams.length%TEAM_COLORS.length], players:[] };
    saveTeams([...teams, t]);
    setSelectedTeam(t.id);
    setEditTeam(t.id);
  };
  const updTeam = (id:string, patch:Partial<Team>) => saveTeams(teams.map(t=>t.id===id?{...t,...patch}:t));
  const delTeam = (id:string) => { saveTeams(teams.filter(t=>t.id!==id)); setSelectedTeam(null); };

  /* 선수 CRUD */
  const getTeam = (tid:string) => teams.find(t=>t.id===tid);
  const addPlayer = (tid:string) => {
    const p:Player = {id:Date.now().toString(), name:'선수명', role:'탑', champs:[]};
    updTeam(tid, {players:[...(getTeam(tid)?.players||[]), p]});
    setEditPlayer(p.id);
  };
  const updPlayer = (tid:string, pid:string, patch:Partial<Player>) =>
    updTeam(tid, {players:(getTeam(tid)?.players||[]).map(p=>p.id===pid?{...p,...patch}:p)});
  const delPlayer = (tid:string, pid:string) =>
    updTeam(tid, {players:(getTeam(tid)?.players||[]).filter(p=>p.id!==pid)});

  /* 챔피언 CRUD */
  const addPC = (tid:string, pid:string, c:Champ) => {
    const p = getTeam(tid)?.players.find(x=>x.id===pid);
    if (!p || p.champs.find(x=>x.champ.id===c.id)) return;
    updPlayer(tid, pid, {champs:[...p.champs, {champ:c, tag:'onetrick', note:''}]});
  };
  const updPC = (tid:string, pid:string, cid:string, patch:Partial<PChamp>) => {
    const p = getTeam(tid)?.players.find(x=>x.id===pid); if(!p) return;
    updPlayer(tid, pid, {champs:p.champs.map(x=>x.champ.id===cid?{...x,...patch}:x)});
  };
  const delPC = (tid:string, pid:string, cid:string) => {
    const p = getTeam(tid)?.players.find(x=>x.id===pid); if(!p) return;
    updPlayer(tid, pid, {champs:p.champs.filter(x=>x.champ.id!==cid)});
  };

  const currentTeam = selectedTeam ? teams.find(t=>t.id===selectedTeam)||null : null;
  const roleOrder   = (r:string) => ROLES.indexOf(r);
  const sortedPlayers = currentTeam
    ? [...currentTeam.players].sort((a,b) => roleOrder(a.role)-roleOrder(b.role))
    : [];

  const modalFiltered = useMemo(() => {
    if (!champPicker) return [];
    const p = getTeam(champPicker.tid)?.players.find(x=>x.id===champPicker.pid);
    return champs.filter(c =>
      (c.name.includes(modalSearch) || c.id.toLowerCase().includes(modalSearch.toLowerCase())) &&
      !p?.champs.find(x=>x.champ.id===c.id)
    );
  }, [champs, modalSearch, champPicker, teams]);

  return (
    <div style={{background:BG, minHeight:'100vh', color:'#fff', fontFamily:'system-ui,sans-serif', paddingBottom:'60px'}}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.2)}
        input:focus,textarea:focus{outline:none}
        select{-webkit-appearance:none}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:rgba(255,255,255,0.03)}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:4px}
        .team-card:hover{border-color:rgba(255,255,255,0.2)!important;transform:translateY(-2px)}
        .team-card{transition:all 0.15s}
        .champ-hover:hover{transform:scale(1.08);z-index:2}
        .champ-hover{transition:transform 0.1s}
      `}</style>

      {/* 헤더 */}
      <div style={{borderBottom:`1px solid ${BORDER}`, padding:'14px clamp(1rem,4vw,2.5rem)', display:'flex', alignItems:'center', gap:'14px'}}>
        {currentTeam ? (
          <button onClick={()=>{setSelectedTeam(null);setEditTeam(null);setEditPlayer(null);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:'0.82rem',fontWeight:700,padding:0,display:'flex',alignItems:'center',gap:'4px'}}>
            ← 팀 목록
          </button>
        ) : (
          <a href="/" style={{color:'rgba(255,255,255,0.35)',fontSize:'0.82rem',textDecoration:'none',fontWeight:700}}>← 홈</a>
        )}
        <span style={{color:'rgba(255,255,255,0.1)'}}>|</span>
        <span style={{fontWeight:900,fontSize:'1rem'}}>
          {currentTeam ? (
            <span style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <span style={{width:'10px',height:'10px',borderRadius:'50%',background:currentTeam.color,display:'inline-block',boxShadow:`0 0 6px ${currentTeam.color}`}} />
              <span style={{color:currentTeam.color}}>{currentTeam.name}</span>
            </span>
          ) : '🏆 팀 관리'}
        </span>
        {ver && <span style={{marginLeft:'auto',fontSize:'0.65rem',color:'rgba(255,255,255,0.2)',background:SURFACE,padding:'3px 8px',borderRadius:'6px'}}>패치 {ver.slice(0,5)}</span>}
      </div>

      {/* ── 팀 목록 ── */}
      {!currentTeam && (
        <div style={{padding:'28px clamp(1rem,4vw,2.5rem)', animation:'fadeIn 0.2s both'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:'24px'}}>
            <div>
              <h2 style={{margin:0,fontSize:'1.6rem',fontWeight:900,letterSpacing:'-0.04em'}}>팀 관리</h2>
              <p style={{margin:'6px 0 0',fontSize:'0.78rem',color:'rgba(255,255,255,0.3)'}}>팀을 클릭하면 선수 전체를 확인할 수 있어요</p>
            </div>
            <button onClick={addTeam} style={{padding:'10px 20px',borderRadius:'10px',border:'none',background:ACCENT,color:'#fff',fontSize:'0.88rem',fontWeight:800,cursor:'pointer',boxShadow:`0 4px 12px ${ACCENT}44`}}>
              + 팀 추가
            </button>
          </div>

          {teams.length === 0 ? (
            <div style={{textAlign:'center',padding:'100px 20px',color:'rgba(255,255,255,0.15)'}}>
              <div style={{fontSize:'4rem',marginBottom:'16px'}}>🏆</div>
              <p style={{fontWeight:700,fontSize:'1.1rem',margin:0}}>팀을 추가해보세요</p>
              <p style={{fontSize:'0.82rem',marginTop:'8px',color:'rgba(255,255,255,0.1)'}}>각 팀별 선수와 챔피언 풀을 관리할 수 있어요</p>
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'14px'}}>
              {teams.map(team => (
                <div key={team.id} className="team-card"
                  onClick={()=>setSelectedTeam(team.id)}
                  style={{background:SURFACE,border:`1.5px solid ${BORDER}`,borderRadius:'16px',overflow:'hidden',cursor:'pointer',borderTop:`3px solid ${team.color}`}}>
                  <div style={{padding:'16px 18px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px'}}>
                      <div style={{width:'12px',height:'12px',borderRadius:'50%',background:team.color,flexShrink:0,boxShadow:`0 0 8px ${team.color}`}} />
                      <span style={{fontWeight:900,fontSize:'1rem',color:'#fff'}}>{team.name}</span>
                      <span style={{marginLeft:'auto',fontSize:'0.7rem',color:'rgba(255,255,255,0.35)',background:'rgba(255,255,255,0.06)',padding:'2px 8px',borderRadius:'100px'}}>{team.players.length}명</span>
                    </div>
                    {/* 선수 포지션 미리보기 */}
                    <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                      {[...team.players].sort((a,b)=>roleOrder(a.role)-roleOrder(b.role)).map(p=>(
                        <div key={p.id} style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 8px',borderRadius:'8px',background:`${team.color}12`,border:`1px solid ${team.color}30`}}>
                          <span style={{fontSize:'0.78rem'}}>{ROLE_ICON[p.role]||'👤'}</span>
                          <span style={{fontSize:'0.72rem',fontWeight:700,color:'rgba(255,255,255,0.8)'}}>{p.name}</span>
                        </div>
                      ))}
                      {team.players.length===0&&<span style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.2)'}}>선수 없음</span>}
                    </div>
                    {/* 필밴 챔피언 미리보기 */}
                    {team.players.flatMap(p=>p.champs.filter(pc=>pc.tag==='mustban')).length > 0 && (
                      <div style={{marginTop:'10px',display:'flex',alignItems:'center',gap:'4px'}}>
                        <span style={{fontSize:'0.6rem',color:'#FF5566',fontWeight:700}}>🔴 필밴</span>
                        <div style={{display:'flex',gap:'3px'}}>
                          {team.players.flatMap(p=>p.champs.filter(pc=>pc.tag==='mustban')).slice(0,6).map(pc=>(
                            <img key={pc.champ.id} src={imgUrl(pc.champ)} alt={pc.champ.name} title={pc.champ.name}
                              style={{width:'22px',height:'22px',borderRadius:'4px',objectFit:'cover',border:'1.5px solid rgba(255,85,102,0.4)'}} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{padding:'10px 18px',borderTop:`1px solid ${BORDER}`,background:`${team.color}08`,fontSize:'0.72rem',color:team.color,fontWeight:700}}>
                    클릭해서 상세 보기 →
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 팀 상세 ── */}
      {currentTeam && (
        <div style={{padding:'24px clamp(1rem,4vw,2.5rem)', animation:'slideIn 0.2s both'}}>

          {/* 팀 이름 편집 + 삭제 */}
          <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'28px',flexWrap:'wrap'}}>
            {editTeam===currentTeam.id ? (
              <div style={{display:'flex',alignItems:'center',gap:'8px',flex:1,flexWrap:'wrap'}}>
                <input value={currentTeam.name} onChange={e=>updTeam(currentTeam.id,{name:e.target.value})}
                  style={{background:'rgba(255,255,255,0.08)',border:`1.5px solid ${currentTeam.color}66`,borderRadius:'10px',padding:'8px 14px',color:'#fff',fontSize:'1.1rem',fontWeight:900,letterSpacing:'-0.02em'}} />
                <div style={{display:'flex',gap:'5px'}}>
                  {TEAM_COLORS.map(c=>(
                    <div key={c} onClick={()=>updTeam(currentTeam.id,{color:c})}
                      style={{width:'22px',height:'22px',borderRadius:'50%',background:c,cursor:'pointer',border:currentTeam.color===c?'2px solid #fff':'2px solid transparent',transition:'border 0.1s'}} />
                  ))}
                </div>
                <button onClick={()=>setEditTeam(null)} style={{padding:'8px 14px',borderRadius:'8px',border:'none',background:ACCENT,color:'#fff',fontSize:'0.82rem',fontWeight:800,cursor:'pointer'}}>완료</button>
              </div>
            ) : (
              <div style={{flex:1,display:'flex',alignItems:'center',gap:'10px'}}>
                <h2 style={{margin:0,fontSize:'1.5rem',fontWeight:900,letterSpacing:'-0.04em',color:currentTeam.color}}>{currentTeam.name}</h2>
                <span style={{fontSize:'0.78rem',color:'rgba(255,255,255,0.3)'}}>선수 {currentTeam.players.length}명</span>
              </div>
            )}
            <div style={{display:'flex',gap:'8px'}}>
              {editTeam!==currentTeam.id&&<button onClick={()=>setEditTeam(currentTeam.id)} style={{padding:'8px 14px',borderRadius:'8px',border:`1px solid ${BORDER}`,background:SURFACE,color:'rgba(255,255,255,0.6)',fontSize:'0.82rem',fontWeight:700,cursor:'pointer'}}>팀 편집</button>}
              <button onClick={()=>addPlayer(currentTeam.id)} style={{padding:'8px 16px',borderRadius:'8px',border:'none',background:currentTeam.color,color:'#fff',fontSize:'0.82rem',fontWeight:800,cursor:'pointer'}}>+ 선수 추가</button>
              <button onClick={()=>{if(confirm(`${currentTeam.name}을 삭제할까요?`))delTeam(currentTeam.id);}} style={{padding:'8px 12px',borderRadius:'8px',border:'1px solid rgba(255,80,80,0.25)',background:'rgba(255,80,80,0.08)',color:'rgba(255,100,100,0.8)',fontSize:'0.82rem',cursor:'pointer'}}>팀 삭제</button>
            </div>
          </div>

          {/* 선수 목록 (포지션 순) */}
          {sortedPlayers.length===0 ? (
            <div style={{textAlign:'center',padding:'60px 20px',color:'rgba(255,255,255,0.2)'}}>
              <div style={{fontSize:'2.5rem',marginBottom:'12px'}}>👤</div>
              <p style={{fontWeight:700,margin:0}}>선수를 추가해보세요</p>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              {sortedPlayers.map(p => {
                const isEditing = editPlayer===p.id;
                return (
                  <div key={p.id} style={{background:SURFACE,border:`1.5px solid ${isEditing?currentTeam.color+'55':BORDER}`,borderRadius:'16px',overflow:'hidden',transition:'border-color 0.2s'}}>
                    {/* 선수 헤더 */}
                    <div style={{padding:'14px 18px',display:'flex',alignItems:'center',gap:'12px',borderBottom:`1px solid ${BORDER}`,background:isEditing?`${currentTeam.color}08`:'transparent'}}>
                      <div style={{width:'40px',height:'40px',borderRadius:'10px',background:`${currentTeam.color}20`,border:`2px solid ${currentTeam.color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.2rem',flexShrink:0}}>
                        {ROLE_ICON[p.role]||'👤'}
                      </div>
                      {isEditing ? (
                        <div style={{display:'flex',gap:'8px',flex:1,alignItems:'center',flexWrap:'wrap'}}>
                          <input value={p.name} onChange={e=>updPlayer(currentTeam.id,p.id,{name:e.target.value})}
                            style={{background:'rgba(255,255,255,0.08)',border:`1px solid ${currentTeam.color}55`,borderRadius:'8px',padding:'6px 10px',color:'#fff',fontSize:'0.95rem',fontWeight:800,flex:1,minWidth:'100px'}} />
                          <select value={p.role} onChange={e=>updPlayer(currentTeam.id,p.id,{role:e.target.value})}
                            style={{background:'rgba(255,255,255,0.08)',border:`1px solid ${BORDER}`,borderRadius:'8px',padding:'6px 10px',color:'#fff',fontSize:'0.85rem',cursor:'pointer'}}>
                            {ROLES.map(r=><option key={r} value={r}>{ROLE_ICON[r]} {r}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div style={{flex:1}}>
                          <div style={{fontWeight:900,fontSize:'1rem'}}>{p.name}</div>
                          <div style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.4)',marginTop:'2px'}}>{p.role} · 챔피언 {p.champs.length}개</div>
                        </div>
                      )}
                      <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                        <button onClick={()=>{setEditPlayer(isEditing?null:p.id);setNoteKey(null);}}
                          style={{padding:'6px 12px',borderRadius:'8px',border:`1px solid ${isEditing?currentTeam.color+'55':BORDER}`,background:isEditing?`${currentTeam.color}20`:SURFACE,color:isEditing?currentTeam.color:'rgba(255,255,255,0.5)',fontSize:'0.75rem',fontWeight:700,cursor:'pointer',transition:'all 0.15s'}}>
                          {isEditing?'완료':'편집'}
                        </button>
                        {isEditing&&<button onClick={()=>{setChampPicker({tid:currentTeam.id,pid:p.id});setModalSearch('');}}
                          style={{padding:'6px 12px',borderRadius:'8px',border:'none',background:currentTeam.color,color:'#fff',fontSize:'0.75rem',fontWeight:800,cursor:'pointer'}}>
                          + 챔피언
                        </button>}
                        <button onClick={()=>{if(confirm(`${p.name} 선수를 삭제할까요?`))delPlayer(currentTeam.id,p.id);}}
                          style={{padding:'6px 10px',borderRadius:'8px',border:'1px solid rgba(255,80,80,0.2)',background:'rgba(255,80,80,0.07)',color:'rgba(255,100,100,0.7)',fontSize:'0.75rem',cursor:'pointer'}}>삭제</button>
                      </div>
                    </div>

                    {/* 챔피언 목록 */}
                    {p.champs.length>0 ? (
                      <div style={{padding:'14px 18px',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'8px'}}>
                        {p.champs.map(pc => {
                          const tg = TAGS[pc.tag];
                          const nk = `${p.id}-${pc.champ.id}`;
                          return (
                            <div key={pc.champ.id} style={{borderRadius:'10px',overflow:'hidden',border:`1.5px solid ${tg.border}`,background:tg.bg}}>
                              <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 10px'}}>
                                <img src={imgUrl(pc.champ)} alt={pc.champ.name}
                                  style={{width:'40px',height:'40px',borderRadius:'8px',objectFit:'cover',border:`2px solid ${tg.color}`,flexShrink:0}} />
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontWeight:800,fontSize:'0.88rem',color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pc.champ.name}</div>
                                  <div style={{fontSize:'0.65rem',color:tg.color,marginTop:'2px',fontWeight:700}}>{tg.label}</div>
                                </div>
                                <select value={pc.tag} onChange={e=>updPC(currentTeam.id,p.id,pc.champ.id,{tag:e.target.value as any})}
                                  style={{background:'rgba(0,0,0,0.3)',border:`1px solid ${tg.border}`,borderRadius:'6px',padding:'4px 6px',color:tg.color,fontSize:'0.7rem',fontWeight:700,cursor:'pointer',flexShrink:0}}>
                                  {Object.entries(TAGS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                                </select>
                                <button onClick={()=>setNoteKey(noteKey===nk?null:nk)}
                                  style={{fontSize:'0.75rem',padding:'4px 8px',borderRadius:'6px',border:`1px solid ${tg.border}`,background:'rgba(0,0,0,0.2)',color:tg.color,cursor:'pointer',flexShrink:0}}>📝</button>
                                <button onClick={()=>delPC(currentTeam.id,p.id,pc.champ.id)}
                                  style={{fontSize:'0.78rem',background:'none',border:'none',color:'rgba(255,100,100,0.5)',cursor:'pointer',padding:'0 2px',flexShrink:0}}>✕</button>
                              </div>
                              {noteKey===nk&&(
                                <textarea value={pc.note} onChange={e=>updPC(currentTeam.id,p.id,pc.champ.id,{note:e.target.value})}
                                  placeholder="메모 (예: 레넥 잡으면 다이브 위주, 갱 조심)"
                                  style={{width:'100%',background:'rgba(0,0,0,0.25)',border:'none',borderTop:`1px solid ${tg.border}`,padding:'8px 10px',color:'rgba(255,255,255,0.8)',fontSize:'0.78rem',lineHeight:1.6,resize:'vertical' as const,minHeight:'56px',boxSizing:'border-box' as const}} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{padding:'20px 18px',color:'rgba(255,255,255,0.2)',fontSize:'0.8rem',textAlign:'center' as const}}>
                        챔피언이 없어요 · 편집 모드에서 추가하세요
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 챔피언 선택 모달 */}
      {champPicker && (() => {
        const t = teams.find(x=>x.id===champPicker.tid);
        const p = t?.players.find(x=>x.id===champPicker.pid);
        if (!t||!p) return null;
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}
            onClick={e=>{ if(e.target===e.currentTarget) setChampPicker(null); }}>
            <div style={{background:'#12121E',border:`1.5px solid ${t.color}44`,borderRadius:'18px',width:'100%',maxWidth:'620px',overflow:'hidden',boxShadow:`0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px ${t.color}22`,animation:'fadeIn 0.15s both'}}>
              <div style={{padding:'16px 20px',borderBottom:`1px solid ${BORDER}`,display:'flex',alignItems:'center',gap:'10px',background:`${t.color}0C`}}>
                <div style={{width:'10px',height:'10px',borderRadius:'50%',background:t.color,boxShadow:`0 0 8px ${t.color}`}} />
                <span style={{fontWeight:900,fontSize:'0.92rem',color:t.color}}>{t.name}</span>
                <span style={{fontSize:'0.88rem',color:'rgba(255,255,255,0.4)',fontWeight:700}}>· {p.name}</span>
                <span style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.25)',marginLeft:'4px'}}>챔피언 추가</span>
                <button onClick={()=>setChampPicker(null)}
                  style={{marginLeft:'auto',background:'rgba(255,255,255,0.08)',border:`1px solid ${BORDER}`,borderRadius:'8px',color:'rgba(255,255,255,0.5)',cursor:'pointer',padding:'5px 12px',fontSize:'0.78rem',fontWeight:700}}>
                  닫기 ✕
                </button>
              </div>
              <div style={{padding:'14px 16px 10px'}}>
                <input autoFocus value={modalSearch} onChange={e=>setModalSearch(e.target.value)}
                  placeholder="챔피언 이름 검색..."
                  style={{width:'100%',background:'rgba(255,255,255,0.07)',border:`1.5px solid ${t.color}44`,borderRadius:'10px',padding:'10px 14px',color:'#fff',fontSize:'0.92rem',boxSizing:'border-box' as const}} />
                <div style={{marginTop:'6px',fontSize:'0.65rem',color:'rgba(255,255,255,0.25)'}}>
                  {modalFiltered.length}개 표시 중 · 클릭해서 추가
                </div>
              </div>
              <div style={{padding:'0 16px 16px',maxHeight:'420px',overflowY:'auto'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(60px,1fr))',gap:'6px'}}>
                  {modalFiltered.map(c=>(
                    <div key={c.id} className="champ-hover"
                      onClick={()=>addPC(champPicker.tid,champPicker.pid,c)}
                      title={c.name}
                      style={{borderRadius:'10px',overflow:'hidden',cursor:'pointer',border:'1.5px solid transparent',position:'relative'}}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=t.color;}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='transparent';}}>
                      <img src={imgUrl(c)} alt={c.name} style={{width:'100%',aspectRatio:'1',display:'block',objectFit:'cover'}} />
                      <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.9))',padding:'3px 3px 4px',fontSize:'0.5rem',fontWeight:700,color:'#fff',textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
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
