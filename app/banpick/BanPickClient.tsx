'use client';
import { useState, useEffect, useMemo } from 'react';

const ACCENT = '#EB701A';
const BLUE_C = '#4A7FFF';
const RED_C  = '#FF4A6A';
const BG     = '#09090F';
const CARD   = 'rgba(255,255,255,0.04)';

const TAGS = {
  mustban:    { label:'🔴 필밴',   color:'#FF5566', bg:'rgba(255,85,102,0.15)', border:'rgba(255,85,102,0.4)' },
  onetrick:   { label:'🟡 장인픽', color:'#FFAA22', bg:'rgba(255,170,34,0.15)', border:'rgba(255,170,34,0.4)' },
  practicing: { label:'🟢 연습중', color:'#33CC77', bg:'rgba(51,204,119,0.15)', border:'rgba(51,204,119,0.4)' },
} as const;

const ROLES = ['탑','정글','미드','원딜','서포터'];
const ROLE_ICON: Record<string,string> = { '탑':'🛡️','정글':'🌿','미드':'⚡','원딜':'🏹','서포터':'💊' };

interface Champ { id:string; name:string; img:string; }
interface ActiveSlot { side:'blue'|'red'; type:'ban'|'pick'; idx:number; }
interface Scenario { id:string; name:string; date:string; bb:(Champ|null)[]; rb:(Champ|null)[]; bp:(Champ|null)[]; rp:(Champ|null)[]; }
interface PChamp { champ:Champ; tag:keyof typeof TAGS; note:string; }
interface Player { id:string; name:string; role:string; champs:PChamp[]; }

const empty5 = (): (Champ|null)[] => Array(5).fill(null);

export default function BanPickClient() {
  const [tab, setTab] = useState<'bp'|'dash'>('bp');
  const [champs, setChamps] = useState<Champ[]>([]);
  const [ver, setVer]       = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [bb, setBb] = useState<(Champ|null)[]>(empty5());
  const [rb, setRb] = useState<(Champ|null)[]>(empty5());
  const [bp, setBp] = useState<(Champ|null)[]>(empty5());
  const [rp, setRp] = useState<(Champ|null)[]>(empty5());
  const [active, setActive] = useState<ActiveSlot|null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenName, setScenName] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [editId, setEditId] = useState<string|null>(null);
  const [noteOpen, setNoteOpen] = useState<string|null>(null);

  // Storage
  useEffect(() => {
    (async () => {
      try {
        const [sv,sp] = await Promise.all([
          (window as any).storage?.get('bp-scenarios'),
          (window as any).storage?.get('bp-players'),
        ]);
        if (sv?.value) setScenarios(JSON.parse(sv.value));
        if (sp?.value) setPlayers(JSON.parse(sp.value));
      } catch {}
    })();
  }, []);

  // DDragon 챔피언 로드
  useEffect(() => {
    (async () => {
      try {
        const vr = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        const vs = await vr.json();
        const v  = vs[0]; setVer(v);
        const cr = await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/ko_KR/champion.json`);
        const cd = await cr.json();
        const list: Champ[] = (Object.values(cd.data) as any[])
          .map(c => ({ id:c.id, name:c.name, img:c.image.full }))
          .sort((a,b) => a.name.localeCompare(b.name,'ko'));
        setChamps(list);
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const img = (c:Champ) => `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${c.img}`;
  const placed = new Set([...bb,...rb,...bp,...rp].filter(Boolean).map(c=>c!.id));
  const filtered = useMemo(() =>
    champs.filter(c => c.name.includes(search) || c.id.toLowerCase().includes(search.toLowerCase())),
    [champs, search]);

  const setSlot = (side:'blue'|'red', type:'ban'|'pick', idx:number, val:Champ|null) => {
    const setters: Record<string, React.Dispatch<React.SetStateAction<(Champ|null)[]>>> =
      { 'blue-ban':setBb, 'red-ban':setRb, 'blue-pick':setBp, 'red-pick':setRp };
    setters[`${side}-${type}`](p => { const n=[...p]; n[idx]=val; return n; });
  };

  const pickChamp = (c:Champ) => {
    if (!active || placed.has(c.id)) return;
    setSlot(active.side, active.type, active.idx, c);
    setActive(null);
  };

  const saveScen = async () => {
    const s:Scenario = { id:Date.now().toString(), name:scenName.trim()||`시나리오 ${scenarios.length+1}`, date:new Date().toLocaleString('ko-KR'), bb:[...bb],rb:[...rb],bp:[...bp],rp:[...rp] };
    const u = [s,...scenarios].slice(0,30);
    setScenarios(u); setScenName('');
    try { await (window as any).storage?.set('bp-scenarios', JSON.stringify(u)); } catch {}
  };

  const loadScen = (s:Scenario) => { setBb([...s.bb]);setRb([...s.rb]);setBp([...s.bp]);setRp([...s.rp]);setActive(null); };
  const delScen  = async (id:string) => { const u=scenarios.filter(s=>s.id!==id); setScenarios(u); try{await (window as any).storage?.set('bp-scenarios',JSON.stringify(u));}catch{} };
  const reset    = () => { setBb(empty5());setRb(empty5());setBp(empty5());setRp(empty5());setActive(null); };

  const savePlayers = async (p:Player[]) => { setPlayers(p); try{await (window as any).storage?.set('bp-players',JSON.stringify(p));}catch{} };
  const addPlayer = () => { const p:Player={id:Date.now().toString(),name:'선수명',role:'탑',champs:[]}; savePlayers([...players,p]); setEditId(p.id); };
  const delPlayer = (id:string) => savePlayers(players.filter(p=>p.id!==id));
  const updatePlayer = (id:string, patch:Partial<Player>) => savePlayers(players.map(p=>p.id===id?{...p,...patch}:p));

  const addChampToPlayer = (pid:string, c:Champ) => {
    const p = players.find(x=>x.id===pid); if(!p) return;
    if (p.champs.find(x=>x.champ.id===c.id)) return;
    updatePlayer(pid, { champs:[...p.champs,{champ:c,tag:'onetrick',note:''}] });
  };

  const updatePChamp = (pid:string, cid:string, patch:Partial<PChamp>) => {
    const p = players.find(x=>x.id===pid); if(!p) return;
    updatePlayer(pid, { champs:p.champs.map(x=>x.champ.id===cid?{...x,...patch}:x) });
  };

  const removePChamp = (pid:string, cid:string) => {
    const p = players.find(x=>x.id===pid); if(!p) return;
    updatePlayer(pid, { champs:p.champs.filter(x=>x.champ.id!==cid) });
  };

  // 필밴 챔피언 → 밴 슬롯으로
  const quickBan = (c:Champ) => {
    if (placed.has(c.id)) return;
    const bi = bb.findIndex(x=>!x);
    const ri = rb.findIndex(x=>!x);
    if (bi>=0) { setBb(p=>{const n=[...p];n[bi]=c;return n;}); setTab('bp'); }
    else if (ri>=0) { setRb(p=>{const n=[...p];n[ri]=c;return n;}); setTab('bp'); }
  };

  // Slot UI
  const SlotBox = ({ champ, type, side, idx }: { champ:Champ|null; type:'ban'|'pick'; side:'blue'|'red'; idx:number }) => {
    const isActive = active?.side===side && active?.type===type && active?.idx===idx;
    const color = side==='blue' ? BLUE_C : RED_C;
    const w = type==='ban' ? 48 : 64;
    const h = type==='ban' ? 48 : 84;
    return (
      <div onClick={() => champ ? setSlot(side,type,idx,null) : setActive(isActive?null:{side,type,idx})}
        title={champ?.name}
        style={{ width:`${w}px`, height:`${h}px`, borderRadius:'8px', flexShrink:0,
          border: isActive ? `2px solid ${color}` : `1.5px solid rgba(255,255,255,0.1)`,
          background: champ ? 'transparent' : CARD, cursor:'pointer', overflow:'hidden', position:'relative',
          boxShadow: isActive ? `0 0 0 4px ${color}33` : 'none', transition:'all 0.15s',
        }}>
        {champ ? (
          <>
            <img src={img(champ)} alt={champ.name} style={{ width:'100%', height:'100%', objectFit:'cover', filter:type==='ban'?'grayscale(0.7) brightness(0.7)':'none' }} />
            {type==='ban' && <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.4rem',color:'#fff',textShadow:'0 0 4px #000' }}>✕</div>}
            <div style={{ position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.85))',padding:'2px 3px 3px',fontSize:'0.52rem',fontWeight:700,color:'#fff',textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
              {champ.name}
            </div>
          </>
        ) : (
          <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',
            color: isActive ? color : 'rgba(255,255,255,0.15)', fontSize: isActive ? '1.2rem' : '1rem', fontWeight:900 }}>
            {isActive ? '◉' : '+'}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ background:BG, minHeight:'100vh', color:'#fff', fontFamily:'system-ui,sans-serif', paddingBottom:'60px' }}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .champ-card:hover{transform:scale(1.06);z-index:2}
        .champ-card{transition:transform 0.1s}
        input::placeholder{color:rgba(255,255,255,0.25)}
        input:focus{outline:none}
        textarea::placeholder{color:rgba(255,255,255,0.25)}
        textarea:focus{outline:none}
      `}</style>

      {/* 헤더 */}
      <div style={{ borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'14px clamp(1rem,4vw,2.5rem)', display:'flex', alignItems:'center', gap:'16px' }}>
        <a href="/" style={{ color:'rgba(255,255,255,0.35)', fontSize:'0.78rem', textDecoration:'none', fontWeight:600 }}>← 홈</a>
        <span style={{ color:'rgba(255,255,255,0.1)' }}>|</span>
        <span style={{ fontWeight:900, fontSize:'1rem' }}>⚔️ 밴픽 도구</span>
        <div style={{ marginLeft:'auto', display:'flex', gap:'6px' }}>
          {(['bp','dash'] as const).map(t => (
            <button key={t} onClick={()=>setTab(t)} style={{
              padding:'7px 16px', borderRadius:'8px', border:'none', cursor:'pointer',
              fontSize:'0.82rem', fontWeight:800,
              background: tab===t ? ACCENT : 'rgba(255,255,255,0.07)',
              color: tab===t ? '#fff' : 'rgba(255,255,255,0.5)',
              transition:'all 0.15s',
            }}>
              {t==='bp' ? '⚔️ 밴픽 시뮬레이터' : '📋 선수 전력 분석'}
            </button>
          ))}
        </div>
      </div>

      {/* ── 밴픽 탭 ── */}
      {tab === 'bp' && (
        <div style={{ padding:'20px clamp(1rem,4vw,2.5rem)', animation:'fadeIn 0.2s both' }}>

          {/* 밴 영역 */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', gap:'12px', flexWrap:'wrap' }}>
            {/* 블루 밴 */}
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              <span style={{ fontSize:'0.68rem', fontWeight:800, color:BLUE_C, letterSpacing:'0.1em' }}>BLUE BAN</span>
              <div style={{ display:'flex', gap:'6px' }}>
                {bb.map((c,i) => <SlotBox key={i} champ={c} type="ban" side="blue" idx={i} />)}
              </div>
            </div>

            {/* 중앙 컨트롤 */}
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', justifyContent:'center' }}>
              <button onClick={reset} style={{ padding:'7px 14px', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.6)', fontSize:'0.8rem', fontWeight:700, cursor:'pointer' }}>🔄 초기화</button>
              <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                <input value={scenName} onChange={e=>setScenName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveScen()} placeholder="시나리오 이름"
                  style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'8px', padding:'7px 10px', color:'#fff', fontSize:'0.8rem', width:'140px' }} />
                <button onClick={saveScen} style={{ padding:'7px 14px', borderRadius:'8px', border:'none', background:ACCENT, color:'#fff', fontSize:'0.8rem', fontWeight:800, cursor:'pointer' }}>💾 저장</button>
              </div>
            </div>

            {/* 레드 밴 */}
            <div style={{ display:'flex', flexDirection:'column', gap:'6px', alignItems:'flex-end' }}>
              <span style={{ fontSize:'0.68rem', fontWeight:800, color:RED_C, letterSpacing:'0.1em' }}>RED BAN</span>
              <div style={{ display:'flex', gap:'6px' }}>
                {rb.map((c,i) => <SlotBox key={i} champ={c} type="ban" side="red" idx={i} />)}
              </div>
            </div>
          </div>

          {/* 픽 + 챔피언 그리드 */}
          <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:'16px', alignItems:'start' }}>

            {/* 블루 픽 */}
            <div style={{ display:'flex', flexDirection:'column', gap:'6px', alignItems:'flex-start' }}>
              <span style={{ fontSize:'0.68rem', fontWeight:800, color:BLUE_C, letterSpacing:'0.1em' }}>BLUE PICK</span>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {bp.map((c,i) => <SlotBox key={i} champ={c} type="pick" side="blue" idx={i} />)}
              </div>
            </div>

            {/* 챔피언 그리드 */}
            <div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="챔피언 검색..."
                style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'10px', padding:'10px 14px', color:'#fff', fontSize:'0.9rem', marginBottom:'10px', boxSizing:'border-box' as const }} />
              {loading ? (
                <div style={{ textAlign:'center', color:'rgba(255,255,255,0.3)', padding:'40px', fontSize:'0.85rem' }}>챔피언 데이터 로딩 중...</div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(52px,1fr))', gap:'5px', maxHeight:'400px', overflowY:'auto', paddingRight:'4px' }}>
                  {filtered.map(c => {
                    const used = placed.has(c.id);
                    return (
                      <div key={c.id} className="champ-card"
                        onClick={() => active && !used && pickChamp(c)}
                        title={c.name}
                        style={{ position:'relative', borderRadius:'7px', overflow:'hidden', cursor: active&&!used?'pointer':'default', opacity:used?0.25:1 }}>
                        <img src={img(c)} alt={c.name} style={{ width:'100%', aspectRatio:'1', display:'block', objectFit:'cover' }} />
                        <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(transparent,rgba(0,0,0,0.9))', padding:'2px 2px 3px', fontSize:'0.48rem', fontWeight:700, color:'#fff', textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {c.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {active && (
                <div style={{ marginTop:'8px', padding:'6px 10px', background:`rgba(${active.side==='blue'?'74,127,255':'255,74,106'},0.15)`, borderRadius:'8px', fontSize:'0.75rem', fontWeight:700, color: active.side==='blue'?BLUE_C:RED_C, textAlign:'center' }}>
                  {active.side==='blue'?'🔵 블루':'🔴 레드'} {active.type==='ban'?`밴 ${active.idx+1}`:`픽 ${active.idx+1}`} 선택 중 · 챔피언을 클릭하세요
                </div>
              )}
            </div>

            {/* 레드 픽 */}
            <div style={{ display:'flex', flexDirection:'column', gap:'6px', alignItems:'flex-end' }}>
              <span style={{ fontSize:'0.68rem', fontWeight:800, color:RED_C, letterSpacing:'0.1em' }}>RED PICK</span>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {rp.map((c,i) => <SlotBox key={i} champ={c} type="pick" side="red" idx={i} />)}
              </div>
            </div>
          </div>

          {/* 저장된 시나리오 */}
          {scenarios.length > 0 && (
            <div style={{ marginTop:'24px' }}>
              <p style={{ fontSize:'0.7rem', fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:'0.1em', textTransform:'uppercase' as const, marginBottom:'10px' }}>저장된 시나리오</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {scenarios.map(s => (
                  <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:CARD, borderRadius:'10px', border:'1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:800, fontSize:'0.88rem' }}>{s.name}</div>
                      <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.3)', marginTop:'2px' }}>{s.date}</div>
                    </div>
                    <div style={{ display:'flex', gap:'5px', flexShrink:0 }}>
                      {[...s.bb,...s.bp].filter(Boolean).slice(0,5).map((c,i)=>c&&<img key={i} src={img(c)} alt={c.name} style={{width:'24px',height:'24px',borderRadius:'4px',objectFit:'cover'}} />)}
                    </div>
                    <button onClick={()=>loadScen(s)} style={{ padding:'5px 12px', borderRadius:'7px', border:'none', background:ACCENT, color:'#fff', fontSize:'0.75rem', fontWeight:800, cursor:'pointer' }}>불러오기</button>
                    <button onClick={()=>delScen(s.id)} style={{ padding:'5px 10px', borderRadius:'7px', border:'1px solid rgba(255,80,80,0.2)', background:'rgba(255,80,80,0.08)', color:'rgba(255,100,100,0.8)', fontSize:'0.75rem', cursor:'pointer' }}>삭제</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 선수 전력 분석 탭 ── */}
      {tab === 'dash' && (
        <div style={{ padding:'20px clamp(1rem,4vw,2.5rem)', animation:'fadeIn 0.2s both' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
            <div>
              <p style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.3)', margin:0, marginBottom:'4px' }}>필밴 챔피언 클릭 시 밴 슬롯으로 바로 이동</p>
            </div>
            <button onClick={addPlayer} style={{ padding:'9px 18px', borderRadius:'10px', border:'none', background:ACCENT, color:'#fff', fontSize:'0.85rem', fontWeight:800, cursor:'pointer' }}>+ 선수 추가</button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:'14px' }}>
            {players.map(p => (
              <div key={p.id} style={{ background:CARD, border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', overflow:'hidden' }}>
                {/* 선수 헤더 */}
                <div style={{ padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:'10px' }}>
                  <span style={{ fontSize:'1.2rem' }}>{ROLE_ICON[p.role]||'👤'}</span>
                  {editId===p.id ? (
                    <div style={{ display:'flex', gap:'6px', flex:1 }}>
                      <input value={p.name} onChange={e=>updatePlayer(p.id,{name:e.target.value})}
                        style={{ flex:1, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'7px', padding:'5px 9px', color:'#fff', fontSize:'0.9rem', fontWeight:700 }} />
                      <select value={p.role} onChange={e=>updatePlayer(p.id,{role:e.target.value})}
                        style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'7px', padding:'5px', color:'#fff', fontSize:'0.8rem' }}>
                        {ROLES.map(r=><option key={r} value={r}>{ROLE_ICON[r]} {r}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div style={{ flex:1 }}>
                      <span style={{ fontWeight:900, fontSize:'0.95rem' }}>{p.name}</span>
                      <span style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.4)', marginLeft:'8px' }}>{p.role}</span>
                    </div>
                  )}
                  <div style={{ display:'flex', gap:'4px' }}>
                    <button onClick={()=>setEditId(editId===p.id?null:p.id)} style={{ fontSize:'0.72rem', padding:'3px 9px', borderRadius:'6px', border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.6)', cursor:'pointer' }}>
                      {editId===p.id?'완료':'편집'}
                    </button>
                    <button onClick={()=>delPlayer(p.id)} style={{ fontSize:'0.72rem', padding:'3px 8px', borderRadius:'6px', border:'1px solid rgba(255,80,80,0.2)', background:'rgba(255,80,80,0.07)', color:'rgba(255,100,100,0.7)', cursor:'pointer' }}>삭제</button>
                  </div>
                </div>

                {/* 챔피언 목록 */}
                <div style={{ padding:'10px 12px', display:'flex', flexDirection:'column', gap:'6px' }}>
                  {p.champs.map(pc => {
                    const tg = TAGS[pc.tag];
                    const nk = `${p.id}-${pc.champ.id}`;
                    return (
                      <div key={pc.champ.id} style={{ borderRadius:'10px', overflow:'hidden', border:`1px solid ${tg.border}`, background:tg.bg }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px' }}>
                          <img src={img(pc.champ)} alt={pc.champ.name}
                            onClick={() => pc.tag==='mustban' && quickBan(pc.champ)}
                            title={pc.tag==='mustban'?'클릭 → 밴 슬롯으로':pc.champ.name}
                            style={{ width:'36px', height:'36px', borderRadius:'7px', objectFit:'cover', cursor:pc.tag==='mustban'?'pointer':'default', flexShrink:0, border:`2px solid ${tg.color}` }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:800, fontSize:'0.85rem', color:'#fff' }}>{pc.champ.name}</div>
                            {pc.tag==='mustban' && <div style={{ fontSize:'0.6rem', color:tg.color, marginTop:'1px' }}>클릭 → 밴 슬롯</div>}
                          </div>
                          <select value={pc.tag} onChange={e=>updatePChamp(p.id,pc.champ.id,{tag:e.target.value as any})}
                            style={{ background:'rgba(0,0,0,0.25)', border:`1px solid ${tg.border}`, borderRadius:'6px', padding:'3px 6px', color:tg.color, fontSize:'0.7rem', fontWeight:700 }}>
                            {Object.entries(TAGS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                          </select>
                          <button onClick={()=>setNoteOpen(noteOpen===nk?null:nk)} style={{ fontSize:'0.65rem', padding:'3px 7px', borderRadius:'5px', border:`1px solid ${tg.border}`, background:'rgba(0,0,0,0.2)', color:tg.color, cursor:'pointer', fontWeight:700 }}>📝</button>
                          <button onClick={()=>removePChamp(p.id,pc.champ.id)} style={{ fontSize:'0.7rem', background:'none', border:'none', color:'rgba(255,100,100,0.6)', cursor:'pointer', padding:'0 2px' }}>✕</button>
                        </div>
                        {noteOpen===nk && (
                          <textarea value={pc.note} onChange={e=>updatePChamp(p.id,pc.champ.id,{note:e.target.value})}
                            placeholder="메모 (예: 레넥톤 잡으면 다이브 위주로 함, 갱 조심)"
                            style={{ width:'100%', background:'rgba(0,0,0,0.2)', border:'none', borderTop:`1px solid ${tg.border}`, padding:'8px 10px', color:'rgba(255,255,255,0.8)', fontSize:'0.78rem', lineHeight:1.5, resize:'vertical' as const, minHeight:'60px', boxSizing:'border-box' as const }} />
                        )}
                      </div>
                    );
                  })}

                  {/* 챔피언 추가 */}
                  {editId===p.id && (
                    <div>
                      <input placeholder="챔피언 이름 검색 후 클릭으로 추가" onChange={e=>setSearch(e.target.value)}
                        style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'7px 10px', color:'#fff', fontSize:'0.78rem', marginBottom:'6px', boxSizing:'border-box' as const }} />
                      <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', maxHeight:'120px', overflowY:'auto' }}>
                        {champs.filter(c=>c.name.includes(search)&&!p.champs.find(x=>x.champ.id===c.id)).slice(0,20).map(c=>(
                          <div key={c.id} onClick={()=>addChampToPlayer(p.id,c)} title={c.name}
                            style={{ cursor:'pointer', borderRadius:'5px', overflow:'hidden', width:'38px', height:'38px', flexShrink:0, opacity:0.8 }}>
                            <img src={img(c)} alt={c.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {players.length===0 && (
              <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'60px 20px', color:'rgba(255,255,255,0.2)' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:'12px' }}>📋</div>
                <p style={{ fontWeight:700, margin:0 }}>선수를 추가하고 챔피언 풀을 관리해보세요</p>
                <p style={{ fontSize:'0.82rem', marginTop:'6px', color:'rgba(255,255,255,0.15)' }}>필밴 챔피언 클릭 → 밴픽 시뮬레이터로 바로 이동</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
