'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';

// ── 타입 ──────────────────────────────────────────────

type Position = 'TOP' | 'JGL' | 'MID' | 'ADC' | 'SUP';
type Slot = Position | 'SIX';
type Tab = 'builder' | 'db' | 'settings';

interface TierDef { id: string; label: string; abbr: string; pts: number; color: string; }
interface Player { id: number; name: string; sub: string; tier: string; pos: Position[]; isPro: boolean; }
interface Team { TOP: Player|null; JGL: Player|null; MID: Player|null; ADC: Player|null; SUP: Player|null; SIX: Player|null; }
interface Rules { cap: number; penalty: number; maxPro: number; }

// ── 상수 ──────────────────────────────────────────────

const POSITIONS: Position[] = ['TOP','JGL','MID','ADC','SUP'];
const POS_KOR: Record<Slot|'ALL',string> = { TOP:'탑',JGL:'정글',MID:'미드',ADC:'원딜',SUP:'서폿',SIX:'식스맨',ALL:'전체' };
const POS_ICON: Record<Slot,string> = { TOP:'🛡',JGL:'🌿',MID:'⚡',ADC:'🏹',SUP:'💎',SIX:'✦' };
const ACCENT = '#EB701A';

const TIER_DATA: TierDef[] = [
  { id:'c1000',label:'챌린저 1000+LP',abbr:'C1000+',pts:70,color:'#f0c060' },
  { id:'c700', label:'챌린저 700-999',abbr:'C700',  pts:67,color:'#f0c060' },
  { id:'c400', label:'챌린저 400-699',abbr:'C400',  pts:64,color:'#f0c060' },
  { id:'c100', label:'챌린저 100-399',abbr:'C100',  pts:61,color:'#f0c060' },
  { id:'gm700',label:'그마 700+',     abbr:'GM700', pts:59,color:'#e07070' },
  { id:'gm400',label:'그마 400-699',  abbr:'GM400', pts:57,color:'#e07070' },
  { id:'gm100',label:'그마 100-399',  abbr:'GM100', pts:55,color:'#e07070' },
  { id:'m600', label:'마스터 600+',   abbr:'M600',  pts:53,color:'#b07de0' },
  { id:'m400', label:'마스터 400-599',abbr:'M400',  pts:51,color:'#b07de0' },
  { id:'m200', label:'마스터 200-399',abbr:'M200',  pts:49,color:'#b07de0' },
  { id:'m100', label:'마스터 100-199',abbr:'M100',  pts:47,color:'#b07de0' },
  { id:'m0',   label:'마스터 0-99',   abbr:'M0',    pts:45,color:'#b07de0' },
  { id:'d1',   label:'다이아 1',      abbr:'D1',    pts:40,color:'#60a8e8' },
  { id:'d2',   label:'다이아 2',      abbr:'D2',    pts:37,color:'#60a8e8' },
  { id:'d3',   label:'다이아 3',      abbr:'D3',    pts:34,color:'#60a8e8' },
  { id:'d4',   label:'다이아 4',      abbr:'D4',    pts:31,color:'#60a8e8' },
  { id:'e1',   label:'에메랄드 1',    abbr:'E1',    pts:27,color:'#50c880' },
  { id:'e2',   label:'에메랄드 2',    abbr:'E2',    pts:24,color:'#50c880' },
  { id:'e3',   label:'에메랄드 3',    abbr:'E3',    pts:21,color:'#50c880' },
  { id:'e4',   label:'에메랄드 4',    abbr:'E4',    pts:18,color:'#50c880' },
  { id:'p1',   label:'플래티넘 1',    abbr:'P1',    pts:16,color:'#30c0a0' },
  { id:'p2',   label:'플래티넘 2',    abbr:'P2',    pts:14,color:'#30c0a0' },
  { id:'p3',   label:'플래티넘 3',    abbr:'P3',    pts:12,color:'#30c0a0' },
  { id:'p4',   label:'플래티넘 4',    abbr:'P4',    pts:10,color:'#30c0a0' },
  { id:'g1',   label:'골드 1',        abbr:'G1',    pts:8, color:'#d4a820' },
  { id:'g2',   label:'골드 2',        abbr:'G2',    pts:7, color:'#d4a820' },
  { id:'g3',   label:'골드 3',        abbr:'G3',    pts:6, color:'#d4a820' },
  { id:'g4',   label:'골드 4',        abbr:'G4',    pts:5, color:'#d4a820' },
  { id:'s',    label:'실버',          abbr:'S',     pts:3, color:'#909090' },
  { id:'b',    label:'브론즈',        abbr:'B',     pts:2, color:'#a07040' },
  { id:'i',    label:'아이언',        abbr:'I',     pts:1, color:'#666666' },
  { id:'u',    label:'언랭',          abbr:'?',     pts:1, color:'#999999' },
];

const DEFAULT_TIER_PTS: Record<string,number> = Object.fromEntries(TIER_DATA.map(t=>[t.id,t.pts]));

const INIT_PLAYERS: Player[] = [
  {id:1,  name:'스맵',    sub:'송경호',tier:'d1',  pos:['TOP'],       isPro:true },
  {id:2,  name:'클리드',  sub:'',      tier:'c700', pos:['JGL'],       isPro:false},
  {id:3,  name:'나탈리',  sub:'',      tier:'c400', pos:['JGL','TOP'], isPro:false},
  {id:4,  name:'강주연',  sub:'',      tier:'c400', pos:['JGL'],       isPro:false},
  {id:5,  name:'저라뎃',  sub:'',      tier:'c400', pos:['JGL'],       isPro:false},
  {id:6,  name:'병현',    sub:'',      tier:'c100', pos:['JGL','MID'], isPro:false},
  {id:7,  name:'자르반킹',sub:'',      tier:'gm400',pos:['JGL'],       isPro:false},
  {id:8,  name:'서도일',  sub:'',      tier:'gm100',pos:['JGL'],       isPro:false},
  {id:9,  name:'애디',    sub:'',      tier:'gm700',pos:['TOP'],       isPro:false},
  {id:10, name:'칸',      sub:'김동하',tier:'gm700',pos:['TOP'],       isPro:true },
  {id:11, name:'트할',    sub:'',      tier:'gm400',pos:['MID'],       isPro:false},
  {id:12, name:'전수찬',  sub:'',      tier:'m200', pos:['ADC'],       isPro:false},
  {id:13, name:'그냥칼',  sub:'',      tier:'m200', pos:['TOP','JGL'], isPro:false},
  {id:14, name:'류창',    sub:'',      tier:'m0',   pos:['MID'],       isPro:false},
  {id:15, name:'박사장',  sub:'',      tier:'d2',   pos:['TOP'],       isPro:false},
  {id:16, name:'엊우진',  sub:'',      tier:'d2',   pos:['ADC'],       isPro:false},
  {id:17, name:'킴성태',  sub:'',      tier:'d3',   pos:['TOP'],       isPro:false},
  {id:18, name:'염보성',  sub:'',      tier:'e1',   pos:['ADC','TOP'], isPro:false},
  {id:19, name:'용후니',  sub:'',      tier:'e2',   pos:['MID','SUP'], isPro:false},
  {id:20, name:'수주',    sub:'',      tier:'e4',   pos:['MID'],       isPro:false},
  {id:21, name:'디임',    sub:'',      tier:'e4',   pos:['SUP'],       isPro:false},
  {id:22, name:'주보리',  sub:'',      tier:'gm100',pos:['SUP'],       isPro:false},
  {id:23, name:'강만식',  sub:'',      tier:'gm400',pos:['ADC'],       isPro:false},
  {id:24, name:'하이요',  sub:'',      tier:'gm100',pos:['ADC'],       isPro:false},
  {id:25, name:'임아니',  sub:'',      tier:'m200', pos:['ADC'],       isPro:false},
  {id:26, name:'이상호',  sub:'',      tier:'d1',   pos:['JGL','TOP'], isPro:true },
  {id:27, name:'김민교',  sub:'',      tier:'m100', pos:['SUP','MID'], isPro:false},
  {id:28, name:'피넛',    sub:'한왕호',tier:'d1',   pos:['JGL'],       isPro:true },
  {id:29, name:'권지인',  sub:'',      tier:'c100', pos:['MID'],       isPro:false},
  {id:30, name:'나는상윤',sub:'',      tier:'gm100',pos:['ADC'],       isPro:false},
  {id:31, name:'힐링동키',sub:'',      tier:'m400', pos:['MID'],       isPro:false},
  {id:32, name:'장하니',  sub:'',      tier:'e1',   pos:['SUP'],       isPro:false},
  {id:33, name:'김군',    sub:'김한샘',tier:'d1',   pos:['MID','JGL'], isPro:true },
];

const INIT_TEAM: Team = { TOP:null,JGL:null,MID:null,ADC:null,SUP:null,SIX:null };
const INIT_RULES: Rules = { cap:187, penalty:5, maxPro:1 };

// ── 유틸 ──────────────────────────────────────────────

const getTier = (id: string) => TIER_DATA.find(t=>t.id===id) ?? TIER_DATA[TIER_DATA.length-1];
const nextId  = (arr: Player[]) => Math.max(0,...arr.map(p=>p.id)) + 1;

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window==='undefined') return fallback;
  try { const r=localStorage.getItem(key); return r ? JSON.parse(r) as T : fallback; } catch { return fallback; }
}
function saveLS(key: string, val: unknown) { try { localStorage.setItem(key,JSON.stringify(val)); } catch {} }

// ── 작은 컴포넌트 ──────────────────────────────────────

function TierBadge({tierId}:{tierId:string}) {
  const t = getTier(tierId);
  return (
    <span style={{fontSize:10,fontWeight:700,padding:'2px 5px',borderRadius:4,whiteSpace:'nowrap',
      background:t.color+'22',color:t.color,border:`1px solid ${t.color}50`}}>
      {t.abbr}
    </span>
  );
}
function PosBadge({p}:{p:Position}) {
  return (
    <span style={{fontSize:10,fontWeight:700,padding:'1px 5px',borderRadius:3,marginRight:2,
      background:'rgba(235,112,26,0.1)',color:'rgba(235,112,26,0.7)'}}>
      {POS_KOR[p]}
    </span>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────

export default function TeamBuilder() {
  const [tab,        setTab]        = useState<Tab>('builder');
  const [team,       setTeam]       = useState<Team>(INIT_TEAM);
  const [players,    setPlayers]    = useState<Player[]>(INIT_PLAYERS);
  const [rules,      setRules]      = useState<Rules>(INIT_RULES);
  const [tierPts,    setTierPts]    = useState<Record<string,number>>(DEFAULT_TIER_PTS);
  const [search,     setSearch]     = useState('');
  const [posFilter,  setPosFilter]  = useState<Position|'ALL'>('ALL');
  const [activeSlot, setActiveSlot] = useState<Slot|null>(null);
  const [showAdd,    setShowAdd]    = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [newP,       setNewP]       = useState<Omit<Player,'id'>>({name:'',sub:'',tier:'d1',pos:['MID'],isPro:false});

  useEffect(() => {
    setPlayers(loadLS('mml:players', INIT_PLAYERS));
    setRules(  loadLS('mml:rules',   INIT_RULES));
    setTierPts(loadLS('mml:tierpts', DEFAULT_TIER_PTS));
  }, []);
  useEffect(() => { saveLS('mml:players', players); }, [players]);
  useEffect(() => { saveLS('mml:rules',   rules);   }, [rules]);
  useEffect(() => { saveLS('mml:tierpts', tierPts); }, [tierPts]);

  const getScore = useCallback((player: Player, slot: Slot) => {
    const base = tierPts[player.tier] ?? getTier(player.tier).pts;
    const isOff = slot!=='SIX' && !player.pos.includes(slot as Position);
    return base + (isOff ? rules.penalty : 0);
  }, [tierPts, rules.penalty]);

  const teamScore = useMemo(() =>
    Object.entries(team).reduce((s,[sl,p]) => s+(p?getScore(p,sl as Slot):0), 0),
    [team, getScore]);
  const proCnt   = useMemo(() => Object.values(team).filter(p=>p?.isPro).length, [team]);
  const isOver   = teamScore > rules.cap;
  const isProVio = proCnt > rules.maxPro;
  const pct      = Math.min((teamScore/rules.cap)*100, 105);
  const assigned = useMemo(() => new Set(Object.values(team).filter(Boolean).map(p=>p!.id)), [team]);

  const filtered = useMemo(() =>
    players
      .filter(p => {
        const ms = !search || p.name.includes(search) || p.sub.includes(search);
        const mp = posFilter==='ALL' || p.pos.includes(posFilter);
        return ms && mp;
      })
      .sort((a,b) => (tierPts[b.tier]??0)-(tierPts[a.tier]??0)),
    [players, search, posFilter, tierPts]);

  const assignPlayer = (player: Player) => {
    if (!activeSlot) return;
    setTeam(t => {
      const nt={...t};
      (Object.keys(nt) as Slot[]).forEach(s=>{if(nt[s]?.id===player.id) nt[s]=null;});
      nt[activeSlot]=player;
      return nt;
    });
    setActiveSlot(null);
  };
  const removeSlot  = (slot: Slot) => { setTeam(t=>({...t,[slot]:null})); if(activeSlot===slot) setActiveSlot(null); };
  const resetTeam   = () => { setTeam(INIT_TEAM); setActiveSlot(null); };
  const deletePlayer = (id: number) => {
    setPlayers(a=>a.filter(x=>x.id!==id));
    setTeam(t=>{const nt={...t};(Object.keys(nt) as Slot[]).forEach(s=>{if(nt[s]?.id===id) nt[s]=null;});return nt;});
  };

  const copyTeam = async () => {
    const lines=['📋 멸망전 팀 구성',''];
    ([...POSITIONS,'SIX'] as Slot[]).forEach(sl=>{
      const p=team[sl]; if(!p) return;
      const score=getScore(p,sl);
      const off=sl!=='SIX'&&!p.pos.includes(sl as Position);
      lines.push(`${POS_ICON[sl]} ${POS_KOR[sl]}: ${p.name}${p.sub?` (${p.sub})`:''}  ${score}pt${off?' ⚠비주':''}`);
    });
    lines.push('',`총 ${teamScore}pt / ${rules.cap}pt  잔여 ${rules.cap-teamScore}pt  전프로 ${proCnt}/${rules.maxPro}명`);
    await navigator.clipboard.writeText(lines.join('\n')).catch(()=>{});
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  };

  const addPlayer = () => {
    if (!newP.name.trim()) return;
    setPlayers(prev=>[...prev,{...newP,id:nextId(prev),name:newP.name.trim()}]);
    setNewP({name:'',sub:'',tier:'d1',pos:['MID'],isPro:false});
    setShowAdd(false);
  };

  const gaugeColor = isOver ? '#e74c3c' : pct>85 ? '#f39c12' : ACCENT;

  const sBtn = (active:boolean,danger=false) => ({
    padding:'5px 12px',borderRadius:100,border:'none',cursor:'pointer',
    fontSize:11,fontWeight:700,transition:'all .15s',
    background: danger ? 'rgba(231,76,60,0.1)' : active ? ACCENT : 'var(--card)',
    color:       danger ? '#e74c3c'              : active ? '#fff'  : 'var(--text-muted)',
    border:      danger ? '1px solid rgba(231,76,60,0.3)' : active ? 'none' : '1px solid var(--card-border)',
  } as React.CSSProperties);

  return (
    <>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
        :root{
          --bg:#F5EFE2;--card:rgba(255,251,244,0.9);--card-border:rgba(0,0,0,0.09);
          --card-shadow:0 2px 16px rgba(0,0,0,0.08);--text:#1A1A1A;--text-muted:#888888;
          --input-bg:#ffffff;--input-border:rgba(0,0,0,0.13);
        }
        [data-theme="dark"]{
          --bg:#0a0a0a;--card:rgba(28,28,28,0.9);--card-border:rgba(255,255,255,0.08);
          --card-shadow:0 2px 16px rgba(0,0,0,0.4);--text:#EDEDED;--text-muted:#666666;
          --input-bg:rgba(255,255,255,0.05);--input-border:rgba(255,255,255,0.1);
        }
        .mml-page{min-height:100vh;background:var(--bg);font-family:'Pretendard Variable',Pretendard,system-ui,'Noto Sans KR',sans-serif;}
        .mml-nav{position:sticky;top:0;z-index:100;background:var(--card);border-bottom:1px solid var(--card-border);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);}
        .mml-card{background:var(--card);border:1px solid var(--card-border);border-radius:16px;box-shadow:var(--card-shadow);}
        .mml-input{width:100%;padding:9px 12px;border-radius:10px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);font-size:13px;outline:none;font-family:inherit;box-sizing:border-box;}
        .mml-input:focus{border-color:${ACCENT}80;}
        .mml-slot{display:flex;align-items:center;gap:8px;padding:10px 14px;margin-bottom:6px;border-radius:12px;min-height:50px;transition:all .15s;border:1px solid var(--card-border);}
        .mml-slot:hover{border-color:${ACCENT}50;}
        .mml-row{display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:4px;border-radius:10px;border:1px solid var(--card-border);transition:border-color .1s;}
        .mml-row:hover{border-color:${ACCENT}40;}
        .mml-footer{margin-top:80px;padding:32px;text-align:center;font-size:12px;color:var(--text-muted);border-top:1px solid var(--card-border);}
        @media(max-width:700px){.mml-split{grid-template-columns:1fr!important;}}
      `}</style>

      <div className="mml-page">
        {/* ── NAV ── */}
        <nav className="mml-nav">
          <div style={{maxWidth:1080,margin:'0 auto',padding:'10px 20px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <a href="/" style={{textDecoration:'none',fontWeight:900,letterSpacing:-0.5,fontSize:15,color:'var(--text)'}}>
              SMEB<span style={{color:ACCENT}}>.</span>
            </a>
            <a href="/" style={{fontSize:12,color:'var(--text-muted)',textDecoration:'none'}}>← 홈으로</a>
            <span style={{color:'var(--card-border)'}}>|</span>
            <span style={{fontSize:12,fontWeight:700,color:ACCENT}}>⚔ 멸망전 빌더</span>

            {/* 점수 게이지 */}
            <div style={{position:'relative',height:24,flex:'1 1 180px',maxWidth:260}}>
              <div style={{position:'absolute',inset:0,background:'var(--card)',borderRadius:12,border:'1px solid var(--card-border)',overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.min(pct,100)}%`,background:gaugeColor,transition:'width .3s,background .3s',opacity:.85}}/>
              </div>
              <span style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'var(--text)'}}>
                {teamScore} / {rules.cap} pt
              </span>
            </div>

            {isOver   &&<Badge c={ACCENT} bg="rgba(231,76,60,0.12)" bd="rgba(231,76,60,0.3)" text="#e74c3c">⚠ 점수 초과</Badge>}
            {isProVio &&<Badge c={ACCENT} bg="rgba(243,156,18,0.12)" bd="rgba(243,156,18,0.3)" text="#f39c12">⚠ 전프로 초과</Badge>}
            {!isOver&&!isProVio&&Object.values(team).some(Boolean)&&
              <Badge c={ACCENT} bg="rgba(39,174,96,0.12)" bd="rgba(39,174,96,0.3)" text="#27ae60">✓ 유효</Badge>}

            <div style={{display:'flex',gap:4,marginLeft:'auto'}}>
              {(['builder','db','settings'] as Tab[]).map(id=>(
                <button key={id} style={sBtn(tab===id)} onClick={()=>setTab(id)}>
                  {id==='builder'?'팀 빌더':id==='db'?'선수 DB':'규칙 설정'}
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div style={{maxWidth:1080,margin:'0 auto',padding:'20px'}}>

          {/* ────── 팀 빌더 ────── */}
          {tab==='builder' && (
            <div className="mml-split" style={{display:'grid',gridTemplateColumns:'minmax(300px,420px) 1fr',gap:20}}>

              {/* 팀 슬롯 */}
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <span style={{fontSize:11,fontWeight:800,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1}}>팀 구성</span>
                  <div style={{display:'flex',gap:6}}>
                    <button style={sBtn(false)} onClick={copyTeam}>{copied?'✓ 복사됨':'📋 복사'}</button>
                    <button style={sBtn(false,true)} onClick={resetTeam}>초기화</button>
                  </div>
                </div>

                {activeSlot&&(
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',marginBottom:10,borderRadius:10,background:`${ACCENT}12`,border:`1px solid ${ACCENT}40`}}>
                    <span style={{fontSize:13,color:ACCENT,fontWeight:700}}>{POS_ICON[activeSlot]} {POS_KOR[activeSlot]} 배치 중</span>
                    <span style={{fontSize:11,color:'var(--text-muted)'}}>오른쪽 선수를 클릭해 배치</span>
                    <button onClick={()=>setActiveSlot(null)} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',fontSize:18,color:'var(--text-muted)',lineHeight:1}}>×</button>
                  </div>
                )}

                {([...POSITIONS,'SIX'] as Slot[]).map(slot=>{
                  const p=team[slot];
                  const isActive=activeSlot===slot;
                  const score=p?getScore(p,slot):0;
                  const offPos=p&&slot!=='SIX'&&!p.pos.includes(slot as Position);
                  return (
                    <div key={slot} className="mml-slot"
                      onClick={()=>{if(!p)setActiveSlot(isActive?null:slot);}}
                      style={{
                        background: isActive?`${ACCENT}10`:'var(--card)',
                        borderColor: isActive?`${ACCENT}60`:p?'var(--card-border)':'var(--card-border)',
                        cursor: p?'default':'pointer',
                        boxShadow: isActive?`0 0 0 2px ${ACCENT}30`:'none',
                      }}>
                      <span style={{fontSize:18,width:24,textAlign:'center',flexShrink:0}}>{POS_ICON[slot]}</span>
                      <span style={{fontSize:10,fontWeight:800,color:'var(--text-muted)',width:30,textTransform:'uppercase',flexShrink:0}}>{POS_KOR[slot].slice(0,2)}</span>
                      {p?(
                        <>
                          <TierBadge tierId={p.tier}/>
                          <span style={{fontWeight:700,fontSize:14,color:'var(--text)'}}>{p.name}</span>
                          {p.sub&&<span style={{fontSize:11,color:'var(--text-muted)'}}>{p.sub}</span>}
                          {p.isPro&&<span style={{fontSize:9,fontWeight:700,padding:'1px 4px',borderRadius:3,background:'rgba(235,112,26,0.15)',color:ACCENT,border:`1px solid ${ACCENT}40`}}>전프</span>}
                          {offPos&&<span style={{fontSize:10,color:'#f39c12'}}>+{rules.penalty}⚠</span>}
                          <span style={{marginLeft:'auto',fontWeight:800,fontSize:14,color:offPos?'#f39c12':ACCENT}}>{score}pt</span>
                          <button onClick={e=>{e.stopPropagation();removeSlot(slot);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#e74c3c',opacity:.5,lineHeight:1,padding:'0 4px'}}>×</button>
                        </>
                      ):(
                        <span style={{fontSize:12,color:isActive?`${ACCENT}80`:'var(--text-muted)',opacity:.6}}>
                          {isActive?'→ 우측에서 선수 클릭':'+ 선수 배치'}
                        </span>
                      )}
                    </div>
                  );
                })}

                <div className="mml-card" style={{marginTop:12,padding:16,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                  {[['총 점수',`${teamScore}pt`,isOver?'#e74c3c':ACCENT],
                    ['잔여',`${rules.cap-teamScore}pt`,isOver?'#e74c3c':'#27ae60'],
                    ['전프로',`${proCnt}/${rules.maxPro}명`,isProVio?'#e74c3c':'var(--text-muted)']
                  ].map(([lbl,val,col])=>(
                    <div key={lbl} style={{textAlign:'center'}}>
                      <div style={{fontSize:10,color:'var(--text-muted)',marginBottom:4}}>{lbl}</div>
                      <div style={{fontSize:16,fontWeight:800,color:col as string}}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 선수 검색 */}
              <div>
                <input className="mml-input" placeholder="🔍 선수 검색" value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:8}}/>
                <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:12}}>
                  {(['ALL',...POSITIONS] as (Position|'ALL')[]).map(pos=>(
                    <button key={pos} style={sBtn(posFilter===pos)} onClick={()=>setPosFilter(pos)}>
                      {pos==='ALL'?'전체':POS_KOR[pos]}
                    </button>
                  ))}
                </div>
                <div style={{maxHeight:500,overflowY:'auto'}}>
                  {filtered.map(player=>{
                    const pts=tierPts[player.tier]??getTier(player.tier).pts;
                    const isAssigned=assigned.has(player.id);
                    const wouldOver=!isAssigned&&!!activeSlot&&(teamScore+pts>rules.cap);
                    return (
                      <div key={player.id} className="mml-row"
                        onClick={()=>activeSlot&&!isAssigned&&assignPlayer(player)}
                        style={{background:'var(--card)',opacity:isAssigned?.35:1,cursor:activeSlot&&!isAssigned?'pointer':'default',borderColor:wouldOver?'rgba(231,76,60,0.3)':'var(--card-border)'}}>
                        <TierBadge tierId={player.tier}/>
                        <span style={{fontWeight:700,fontSize:14,color:'var(--text)'}}>{player.name}</span>
                        {player.sub&&<span style={{fontSize:11,color:'var(--text-muted)'}}>{player.sub}</span>}
                        <div style={{display:'flex',flexWrap:'wrap'}}>
                          {player.pos.map(po=><PosBadge key={po} p={po}/>)}
                        </div>
                        {player.isPro&&<span style={{fontSize:9,fontWeight:700,padding:'1px 4px',borderRadius:3,background:`${ACCENT}15`,color:ACCENT,border:`1px solid ${ACCENT}35`}}>전프</span>}
                        <span style={{marginLeft:'auto',fontWeight:800,fontSize:14,color:wouldOver?'#e74c3c':ACCENT}}>{pts}pt</span>
                        {isAssigned&&<span style={{fontSize:10,color:'var(--text-muted)'}}>배치됨</span>}
                      </div>
                    );
                  })}
                  {filtered.length===0&&<p style={{textAlign:'center',padding:40,color:'var(--text-muted)',fontSize:13}}>검색 결과 없음</p>}
                </div>
              </div>
            </div>
          )}

          {/* ────── 선수 DB ────── */}
          {tab==='db' && (
            <div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:14,alignItems:'center'}}>
                <input className="mml-input" placeholder="🔍 선수 검색" value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,maxWidth:260}}/>
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                  {(['ALL',...POSITIONS] as (Position|'ALL')[]).map(pos=>(
                    <button key={pos} style={sBtn(posFilter===pos)} onClick={()=>setPosFilter(pos)}>
                      {pos==='ALL'?'전체':POS_KOR[pos]}
                    </button>
                  ))}
                </div>
                <span style={{fontSize:11,color:'var(--text-muted)',marginLeft:'auto'}}>총 {players.length}명</span>
                <button style={{...sBtn(showAdd),padding:'7px 14px'}} onClick={()=>setShowAdd(v=>!v)}>
                  {showAdd?'✕ 닫기':'+ 선수 추가'}
                </button>
              </div>

              {showAdd&&(
                <div className="mml-card" style={{padding:20,marginBottom:16}}>
                  <p style={{fontSize:14,fontWeight:700,marginBottom:16,color:'var(--text)'}}>새 선수 등록</p>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <div>
                      <p style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>스트리머명 *</p>
                      <input className="mml-input" value={newP.name} onChange={e=>setNewP(p=>({...p,name:e.target.value}))} placeholder="이름" autoFocus/>
                    </div>
                    <div>
                      <p style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>실명 (선택)</p>
                      <input className="mml-input" value={newP.sub} onChange={e=>setNewP(p=>({...p,sub:e.target.value}))} placeholder="실제 이름"/>
                    </div>
                    <div>
                      <p style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>티어</p>
                      <select className="mml-input" value={newP.tier} onChange={e=>setNewP(p=>({...p,tier:e.target.value}))} style={{cursor:'pointer'}}>
                        {TIER_DATA.map(t=><option key={t.id} value={t.id}>{t.label} — {tierPts[t.id]??t.pts}pt</option>)}
                      </select>
                    </div>
                    <div>
                      <p style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>포지션</p>
                      <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                        {POSITIONS.map(pos=>(
                          <button key={pos} style={sBtn(newP.pos.includes(pos))} onClick={()=>setNewP(p=>({
                            ...p,pos:p.pos.includes(pos)?(p.pos.length>1?p.pos.filter(x=>x!==pos):p.pos):[...p.pos,pos]
                          }))}>
                            {POS_KOR[pos]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <label style={{display:'flex',alignItems:'center',gap:8,marginTop:12,cursor:'pointer',fontSize:13,color:'var(--text)'}}>
                    <input type="checkbox" checked={newP.isPro} onChange={e=>setNewP(p=>({...p,isPro:e.target.checked}))}/>
                    전 프로게이머
                  </label>
                  <div style={{display:'flex',gap:8,marginTop:16}}>
                    <button style={sBtn(false)} onClick={()=>setShowAdd(false)}>취소</button>
                    <button disabled={!newP.name.trim()} onClick={addPlayer}
                      style={{flex:2,padding:9,borderRadius:10,border:'none',fontWeight:700,cursor:newP.name?'pointer':'not-allowed',
                        background:newP.name?ACCENT:'var(--card)',color:newP.name?'#fff':'var(--text-muted)',opacity:newP.name?1:.5,fontSize:13}}>
                      추가하기
                    </button>
                  </div>
                </div>
              )}

              <div className="mml-card" style={{overflow:'hidden'}}>
                <div style={{display:'grid',gridTemplateColumns:'28px 1fr 88px 68px minmax(0,1fr) 58px 52px',
                  background:'var(--card)',padding:'9px 14px',fontSize:10,fontWeight:700,
                  textTransform:'uppercase',letterSpacing:.8,color:'var(--text-muted)',borderBottom:'1px solid var(--card-border)'}}>
                  <span/><span>이름</span><span>티어</span><span>점수</span><span>포지션</span><span>전프</span><span/>
                </div>
                {filtered.map((p,i)=>{
                  const score=tierPts[p.tier]??getTier(p.tier).pts;
                  return (
                    <div key={p.id} style={{display:'grid',gridTemplateColumns:'28px 1fr 88px 68px minmax(0,1fr) 58px 52px',
                      padding:'8px 14px',alignItems:'center',fontSize:13,
                      borderBottom:'1px solid var(--card-border)',background:i%2===0?'var(--card)':'transparent'}}>
                      <span style={{fontSize:10,color:'var(--text-muted)'}}>{i+1}</span>
                      <div>
                        <span style={{fontWeight:700,color:'var(--text)'}}>{p.name}</span>
                        {p.sub&&<span style={{fontSize:11,color:'var(--text-muted)',marginLeft:5}}>{p.sub}</span>}
                      </div>
                      <TierBadge tierId={p.tier}/>
                      <span style={{fontWeight:800,color:ACCENT}}>{score}pt</span>
                      <div style={{display:'flex',flexWrap:'wrap'}}>{p.pos.map(po=><PosBadge key={po} p={po}/>)}</div>
                      <span style={{fontSize:11,fontWeight:700,color:ACCENT}}>{p.isPro?'전프로':''}</span>
                      <button onClick={()=>deletePlayer(p.id)} style={{fontSize:11,padding:'2px 6px',borderRadius:5,cursor:'pointer',background:'none',border:'1px solid rgba(231,76,60,0.35)',color:'rgba(231,76,60,.7)'}}>삭제</button>
                    </div>
                  );
                })}
                {filtered.length===0&&<p style={{textAlign:'center',padding:40,color:'var(--text-muted)',fontSize:13}}>선수 없음</p>}
              </div>
            </div>
          )}

          {/* ────── 규칙 설정 ────── */}
          {tab==='settings' && (
            <div style={{display:'grid',gridTemplateColumns:'300px 1fr',gap:16,maxWidth:800}}>
              <div className="mml-card" style={{padding:20}}>
                <p style={{fontSize:11,fontWeight:800,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1,marginBottom:20}}>팀 규칙</p>
                {[
                  ['팀 최대 점수','5명 합산 상한선','cap'],
                  ['비주 포지션 패널티','주포지션 외 플레이 추가점','penalty'],
                  ['전프로 최대 인원','한 팀 내 허용 수','maxPro'],
                ].map(([lbl,desc,key])=>(
                  <div key={key} style={{marginBottom:16}}>
                    <p style={{fontSize:13,fontWeight:600,color:'var(--text)',margin:0}}>{lbl}</p>
                    <p style={{fontSize:10,color:'var(--text-muted)',marginTop:3,marginBottom:6}}>{desc}</p>
                    <input type="number" className="mml-input" value={rules[key as keyof Rules]}
                      onChange={e=>setRules(r=>({...r,[key]:Number(e.target.value)}))}
                      style={{width:72,textAlign:'center'}}/>
                  </div>
                ))}
                <p style={{fontSize:10,color:'var(--text-muted)',marginTop:12,paddingTop:12,borderTop:'1px solid var(--card-border)'}}>변경사항은 자동 저장됩니다</p>
              </div>

              <div className="mml-card" style={{padding:20,maxHeight:520,overflowY:'auto'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                  <p style={{fontSize:11,fontWeight:800,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1,margin:0}}>티어별 점수표</p>
                  <button style={sBtn(false)} onClick={()=>setTierPts(DEFAULT_TIER_PTS)}>기본값 복원</button>
                </div>
                {TIER_DATA.map(tier=>(
                  <div key={tier.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5,paddingBottom:5,borderBottom:'1px solid var(--card-border)'}}>
                    <span style={{flex:1,fontSize:12,color:tier.color}}>{tier.label}</span>
                    <input type="number" min="0" max="200" className="mml-input"
                      value={tierPts[tier.id]??tier.pts}
                      onChange={e=>setTierPts(p=>({...p,[tier.id]:Number(e.target.value)}))}
                      style={{width:54,textAlign:'center',padding:'3px 6px'}}/>
                    <span style={{fontSize:10,color:'var(--text-muted)',width:14}}>pt</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="mml-footer">
          <a href="/" style={{color:'var(--text-muted)',textDecoration:'none'}}>스맵 아카이브</a>
          {' · '}
          <span>멸망전 팀 빌더</span>
        </footer>
      </div>
    </>
  );
}

function Badge({children,bg,bd,text}:{children:React.ReactNode;c:string;bg:string;bd:string;text:string}) {
  return (
    <span style={{fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:100,background:bg,color:text,border:`1px solid ${bd}`}}>
      {children}
    </span>
  );
}
