'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  views: number;
}

interface Notice {
  id: number;
  title: string;
  summary: string;
  date: string;
  likes: number;
  comments: number;
  url: string;
}

interface Props {
  videos: Video[];
  top10: Video[];
  notices: Notice[];
  monthlyTop10: Record<string, Video[]>; // "YYYY-MM" → 상위 10개
  today: string;
}

function VideoModal({ activeId, onClose }: { activeId: string; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh', zIndex:99999, background:'rgba(0,0,0,0.9)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:'960px', position:'relative' }}>
        <button onClick={onClose}
          style={{ position:'absolute', top:'-48px', right:0, background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff', borderRadius:'10px', padding:'8px 18px', cursor:'pointer', fontSize:'0.85rem', fontWeight:700 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.22)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.12)'}>
          ✕ 닫기
        </button>
        <div style={{ aspectRatio:'16/9', borderRadius:'18px', overflow:'hidden', boxShadow:'0 32px 100px rgba(0,0,0,0.8)' }}>
          <iframe src={`https://www.youtube.com/embed/${activeId}?autoplay=1&rel=0`}
            width="100%" height="100%"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen style={{ border:'none', display:'block', width:'100%', height:'100%' }} />
        </div>
      </div>
    </div>,
    document.body
  );
}

function LiveSection() {
  const BJID = 'townboy';
  const PLAY_URL = `https://play.sooplive.com/${BJID}`;
  const PROFILE = `https://profile.img.sooplive.com/LOGO/to/${BJID}/${BJID}.jpg`;
  const [broadStart, setBroadStart] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/live').then(r => r.json()).then(d => {
      if (d.broadStart) setBroadStart(d.broadStart);
    }).catch(() => {});
  }, []);

  return (
    <div style={{ borderRadius:'16px', overflow:'hidden', border:'1px solid var(--card-border)', background:'var(--card)', display:'flex', flexDirection:'column' }}>
      <a href={PLAY_URL} target="_blank" rel="noopener noreferrer" style={{ display:'block', textDecoration:'none' }}>
        <div style={{ width:'100%', aspectRatio:'16/9', background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <img src={PROFILE} alt="스맵" style={{ width:'72px', height:'72px', borderRadius:'50%', border:'3px solid rgba(235,112,26,0.7)', objectFit:'cover' }} />
        </div>
      </a>
      <div style={{ padding:'12px 14px', flex:1, display:'flex', flexDirection:'column', gap:'8px' }}>
        {broadStart && (
          <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', margin:0 }}>
            마지막 방송: {new Date(broadStart).toLocaleDateString('ko-KR', { month:'long', day:'numeric' })}
          </p>
        )}
        <a href={PLAY_URL} target="_blank" rel="noopener noreferrer"
          style={{ display:'block', textAlign:'center', background:'#EB701A', color:'#fff', fontSize:'0.8rem', fontWeight:700, padding:'8px', borderRadius:'10px', textDecoration:'none' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity='0.85'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity='1'}>
          생방송 바로가기 →
        </a>
      </div>
    </div>
  );
}

const RANK_BADGE: Record<number, string> = { 1:'#EB701A', 2:'#C0C0C0', 3:'#CD7F32' };

// ── 월 선택기 ──────────────────────────────────────────────────────────────
function MonthPicker({
  months, selectedMonth, onSelect,
}: {
  months: string[];
  selectedMonth: string;
  onSelect: (m: string) => void;
}) {
  const years = useMemo(() => [...new Set(months.map(m => m.slice(0, 4)))].sort(), [months]);
  const [selectedYear, setSelectedYear] = useState(() => selectedMonth.slice(0, 4));
  const [isMob, setIsMob] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const check = () => setIsMob(window.innerWidth < 768);
    check(); window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  const BORDER = '1px solid var(--card-border)';

  const monthsInYear = useMemo(
    () => months.filter(m => m.startsWith(selectedYear)),
    [months, selectedYear]
  );

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* 연도 탭 */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'10px', flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--text-muted)', marginRight:'4px' }}>연도</span>
        {years.map(y => (
          <button key={y} onClick={() => {
            setSelectedYear(y);
            const first = months.filter(m => m.startsWith(y)).sort()[0];
            if (first) onSelect(first);
          }}
            style={{
              padding: isMob ? '4px 12px' : '5px 16px', borderRadius:'100px', cursor:'pointer', fontWeight:700, fontSize: isMob ? '0.78rem' : '0.85rem', transition:'all 0.15s',
              background: selectedYear === y ? '#EB701A' : 'var(--card)',
              color: selectedYear === y ? '#fff' : 'var(--text-muted)',
              border: selectedYear === y ? '1px solid #EB701A' : BORDER,
              boxShadow: selectedYear === y ? '0 4px 14px rgba(235,112,26,0.3)' : 'none',
            }}>
            {y}년
          </button>
        ))}
      </div>
      {/* 월 탭 */}
      <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', alignItems:'center', padding:'10px 14px', background:'var(--bg-deeper)', borderRadius:'12px', overflowX:'auto' }}>
        <span style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--text-muted)', marginRight:'4px' }}>월</span>
        {monthsInYear.sort().map(ym => {
          const mo = parseInt(ym.split('-')[1]);
          const isSelected = ym === selectedMonth;
          return (
            <button key={ym} onClick={() => onSelect(ym)}
              style={{
                padding:'4px 12px', borderRadius:'100px', cursor:'pointer',
                fontWeight: isSelected ? 700 : 500, fontSize:'0.8rem', transition:'all 0.15s',
                background: isSelected ? '#1A1A1A' : 'var(--card)',
                color: isSelected ? '#fff' : 'var(--text)',
                border: isSelected ? '1px solid #1A1A1A' : BORDER,
              }}>
              {mo}월
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── TOP 10 렌더러 ──────────────────────────────────────────────────────────
function Top10Grid({ top10, onPlay, isMobile }: { top10: Video[]; onPlay: (id: string) => void; isMobile: boolean }) {
  if (top10.length === 0) {
    return <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text-muted)', fontSize:'0.9rem' }}>해당 월에 업로드된 영상이 없어요</div>;
  }

  const fmt = (n: number) => n >= 10000 ? `${(n/10000).toFixed(1)}만` : n.toLocaleString();
  const totalViews = top10.reduce((s, v) => s + v.views, 0);
  const avgViews   = Math.round(totalViews / top10.length);
  const stats = [
    { label:'총 조회수',   value: fmt(totalViews) },
    { label:'1위 조회수',  value: fmt(top10[0].views) },
    { label:'평균 조회수', value: fmt(avgViews) },
  ];

  // 카드별 테마
  const THEMES: Record<number,{bg:string;fg:string;accent:string}> = {
    1:  { bg:'#0d0d0d', fg:'#fff',    accent:'#EB701A' },
    2:  { bg:'#FAF4E8', fg:'#0d0d0d', accent:'#0d0d0d' },
    3:  { bg:'#EB701A', fg:'#fff',    accent:'rgba(255,255,255,0.7)' },
    4:  { bg:'#111',    fg:'#EB701A', accent:'rgba(255,255,255,0.45)' },
    5:  { bg:'#F2EBD9', fg:'#0d0d0d', accent:'#0d0d0d' },
    6:  { bg:'#16213e', fg:'#fff',    accent:'#EB701A' },
    7:  { bg:'#1a1a1a', fg:'#fff',    accent:'#EB701A' },
    8:  { bg:'#EB701A', fg:'#0d0d0d', accent:'rgba(0,0,0,0.5)' },
    9:  { bg:'#0d0d0d', fg:'#EB701A', accent:'rgba(255,255,255,0.5)' },
    10: { bg:'#F2EBD9', fg:'#0d0d0d', accent:'#EB701A' },
  };

  // 데스크탑 그리드 위치
  const DPOS: Record<number, React.CSSProperties> = {
    1:  { gridColumn:'1/3', gridRow:'1' },
    2:  { gridColumn:'3',   gridRow:'1' },
    3:  { gridColumn:'1',   gridRow:'2' },
    4:  { gridColumn:'2',   gridRow:'2' },
    5:  { gridColumn:'3',   gridRow:'2' },
    6:  { gridColumn:'1',   gridRow:'3' },
    7:  { gridColumn:'2/4', gridRow:'3' },
    8:  { gridColumn:'1',   gridRow:'4' },
    9:  { gridColumn:'2',   gridRow:'4' },
    10: { gridColumn:'3',   gridRow:'4' },
  };

  const hov = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget as HTMLElement;
    el.style.transform = 'scale(1.03)';
    el.style.boxShadow = '0 20px 50px rgba(0,0,0,0.35)';
    el.style.zIndex = '10';
  };
  const unhov = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget as HTMLElement;
    el.style.transform = '';
    el.style.boxShadow = '';
    el.style.zIndex = '';
  };

  return (
    <>
      <style>{`
        @keyframes smebSlideUp {
          from { opacity:0; transform:translateY(32px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>

      <div style={{
        display:'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3,1fr)',
        gridAutoRows: isMobile ? 'clamp(150px,40vw,200px)' : 'clamp(180px,17vw,240px)',
        gap:'10px',
      }}>
        {top10.map((video, i) => {
          const rank = i + 1;
          const th = THEMES[rank];
          const pos = isMobile ? {} : DPOS[rank];
          const delay = `${i * 0.055}s`;
          const dateStr = new Date(video.publishedAt).toLocaleDateString('ko-KR',{month:'short',day:'numeric'});

          /* ── 카드 콘텐츠 ── */
          let inner: React.ReactNode;

          if (rank === 1) {
            /* 콜라주형 wide */
            inner = (
              <div style={{ position:'relative', width:'100%', height:'100%', display:'flex', gap:'16px', padding:'20px', overflow:'hidden' }}>
                <span style={{ position:'absolute', top:'-15px', left:'-5px', fontSize:'clamp(120px,16vw,190px)', fontWeight:900, lineHeight:1, color:'rgba(235,112,26,0.1)', pointerEvents:'none', userSelect:'none' as const }}>1</span>
                <div style={{ width:'48%', flexShrink:0, position:'relative', zIndex:1 }}>
                  <img src={video.thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'10px', transform:'rotate(-2.5deg)', boxShadow:'6px 10px 28px rgba(0,0,0,0.6)' }} />
                  <div style={{ position:'absolute', top:'8px', left:'8px', background:'#EB701A', color:'#fff', fontWeight:900, fontSize:'0.55rem', padding:'3px 8px', borderRadius:'4px', letterSpacing:'0.1em' }}>BEST</div>
                </div>
                <div style={{ flex:1, display:'flex', flexDirection:'column' as const, justifyContent:'flex-end', position:'relative', zIndex:1 }}>
                  <div style={{ fontSize:'0.58rem', fontWeight:800, color:'#EB701A', letterSpacing:'0.15em', marginBottom:'8px', textTransform:'uppercase' as const }}>No.1 · 이번달</div>
                  <p style={{ fontSize:'clamp(0.85rem,1.6vw,1.1rem)', fontWeight:900, color:'#fff', lineHeight:1.3, marginBottom:'10px', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' } as React.CSSProperties}>{video.title}</p>
                  <span style={{ fontSize:'0.72rem', fontWeight:700, color:'rgba(255,255,255,0.55)' }}>👁 {video.views.toLocaleString()}회</span>
                </div>
              </div>
            );
          } else if (rank === 4) {
            /* 조회수 통계형 */
            inner = (
              <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column' as const, justifyContent:'space-between', padding:'16px', position:'relative', overflow:'hidden' }}>
                <div>
                  <div style={{ fontSize:'0.55rem', fontWeight:800, letterSpacing:'0.15em', color:'rgba(235,112,26,0.5)', marginBottom:'4px' }}>RANK · {rank}</div>
                  <div style={{ fontSize:'0.58rem', fontWeight:800, letterSpacing:'0.12em', color:'#EB701A', marginBottom:'4px' }}>조회수</div>
                  <p style={{ fontSize:'clamp(1.6rem,3.5vw,2.6rem)', fontWeight:900, color:'#EB701A', letterSpacing:'-0.04em', lineHeight:1 }}>{fmt(video.views)}</p>
                </div>
                <p style={{ fontSize:'0.75rem', fontWeight:700, color:'rgba(255,255,255,0.6)', lineHeight:1.35, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' } as React.CSSProperties}>{video.title}</p>
              </div>
            );
          } else if (rank === 7) {
            /* 와이드 썸네일형 */
            inner = (
              <div style={{ position:'relative', width:'100%', height:'100%' }}>
                <img src={video.thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', filter:'grayscale(25%)' }} />
                <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg, rgba(235,112,26,0.72) 0%, rgba(0,0,0,0.25) 55%, transparent 100%)' }} />
                <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column' as const, justifyContent:'space-between', padding:'16px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:'0.58rem', fontWeight:900, letterSpacing:'0.15em', color:'#fff', opacity:.85 }}>NO.{rank}</span>
                    <span style={{ fontSize:'0.65rem', fontWeight:700, color:'#fff', opacity:.75 }}>👁 {fmt(video.views)}</span>
                  </div>
                  <p style={{ fontSize:'clamp(0.85rem,1.6vw,1.15rem)', fontWeight:900, color:'#fff', lineHeight:1.3, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' } as React.CSSProperties}>{video.title}</p>
                </div>
              </div>
            );
          } else if (rank === 8) {
            /* 순위 숫자 강조형 */
            inner = (
              <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column' as const, justifyContent:'space-between', padding:'14px 16px', position:'relative', overflow:'hidden' }}>
                <span style={{ position:'absolute', bottom:'-20px', right:'-8px', fontSize:'clamp(90px,14vw,140px)', fontWeight:900, lineHeight:1, color:'rgba(0,0,0,0.12)', pointerEvents:'none' }}>8</span>
                <span style={{ fontSize:'0.55rem', fontWeight:900, letterSpacing:'0.15em', color:'rgba(0,0,0,0.4)' }}>RANK</span>
                <div style={{ position:'relative', zIndex:1 }}>
                  <p style={{ fontSize:'clamp(3rem,6vw,5.5rem)', fontWeight:900, letterSpacing:'-0.05em', lineHeight:0.9, color:'#0d0d0d', marginBottom:'8px' }}>8</p>
                  <p style={{ fontSize:'0.72rem', fontWeight:700, color:'rgba(0,0,0,0.65)', lineHeight:1.3, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' } as React.CSSProperties}>{video.title}</p>
                </div>
              </div>
            );
          } else if (rank === 3 || rank === 6 || rank === 9) {
            /* 타이틀 강조형 (컬러 배경) */
            inner = (
              <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column' as const, justifyContent:'space-between', padding:'14px 16px', position:'relative', overflow:'hidden' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:'0.55rem', fontWeight:900, letterSpacing:'0.15em', color: th.accent }}>NO.{rank}</span>
                  <span style={{ fontSize:'0.6rem', color: th.accent }}>👁 {fmt(video.views)}</span>
                </div>
                <p style={{ fontSize:'clamp(0.88rem,1.8vw,1.2rem)', fontWeight:900, color: th.fg, lineHeight:1.25, display:'-webkit-box', WebkitLineClamp:4, WebkitBoxOrient:'vertical', overflow:'hidden' } as React.CSSProperties}>{video.title}</p>
                <span style={{ fontSize:'0.58rem', fontWeight:600, color: th.accent, letterSpacing:'0.04em' }}>{dateStr}</span>
              </div>
            );
          } else {
            /* 썸네일형 (2, 5, 10) */
            inner = (
              <div style={{ position:'relative', width:'100%', height:'100%', display:'flex', flexDirection:'column' as const }}>
                <div style={{ flex:1, overflow:'hidden', minHeight:0 }}>
                  <img src={video.thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </div>
                <div style={{ padding:'10px 12px', background: th.bg, flexShrink:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                    <span style={{ fontSize:'0.55rem', fontWeight:900, letterSpacing:'0.15em', color: th.accent }}>NO.{rank}</span>
                    <span style={{ fontSize:'0.6rem', fontWeight:700, color: th.fg, opacity:.6 }}>👁 {fmt(video.views)}</span>
                  </div>
                  <p style={{ fontSize:'0.75rem', fontWeight:800, color: th.fg, lineHeight:1.3, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' } as React.CSSProperties}>{video.title}</p>
                </div>
              </div>
            );
          }

          return (
            <div key={video.id}
              onClick={() => onPlay(video.id)}
              onMouseEnter={hov}
              onMouseLeave={unhov}
              style={{
                ...pos,
                background: th.bg,
                borderRadius:'14px',
                overflow:'hidden',
                cursor:'pointer',
                animation:`smebSlideUp 0.6s ${delay} cubic-bezier(0.22,1,0.36,1) both`,
                transition:'transform 0.25s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s ease',
                boxShadow:'0 2px 12px rgba(0,0,0,0.1)',
                position:'relative',
              }}
            >
              {inner}
            </div>
          );
        })}
      </div>

      {/* BY THE NUMBERS */}
      <div style={{ marginTop:'20px' }}>
        <div style={{ borderRadius:'16px', border:'1px solid var(--card-border)', background:'var(--card)', padding:'20px 24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'18px' }}>
            <span style={{ display:'block', width:'18px', height:'2px', background:'#EB701A', borderRadius:'2px' }} />
            <span style={{ fontSize:'0.68rem', fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase' as const, color:'#EB701A' }}>BY THE NUMBERS</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)' }}>
            {stats.map((s, i) => (
              <div key={i} style={{ paddingRight: i<2 ? '20px' : '0', paddingLeft: i>0 ? '20px' : '0', borderRight: i<2 ? '1px dashed var(--card-border)' : 'none' }}>
                <p style={{ fontSize:'clamp(2rem,3.5vw,3rem)', fontWeight:900, letterSpacing:'-0.04em', color:'var(--text)', lineHeight:1, marginBottom:'6px' }}>{s.value}</p>
                <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', fontWeight:500, lineHeight:1.4 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}


export default function YoutubeSection({ videos, top10, notices, monthlyTop10, today }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const todayDate = new Date(today);
  const currentMonth = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}`;

  // 월별 탭에 표시할 달 목록 (데이터 있는 달만)
  const availableMonths = useMemo(
    () => Object.keys(monthlyTop10).filter(m => monthlyTop10[m].length > 0).sort().reverse(),
    [monthlyTop10]
  );

  const [selectedMonth, setSelectedMonth] = useState(
    availableMonths.includes(currentMonth) ? currentMonth : (availableMonths[0] || currentMonth)
  );

  const selectedTop10 = monthlyTop10[selectedMonth] || [];
  const [y, m] = selectedMonth.split('-');
  const monthLabel = `${y}년 ${parseInt(m)}월`;

  return (
    <>
      {activeId && <VideoModal activeId={activeId} onClose={() => setActiveId(null)} />}

      {/* ── 월 선택기 ── */}
      <MonthPicker
        months={availableMonths}
        selectedMonth={selectedMonth}
        onSelect={setSelectedMonth}
      />

      {/* ── 선택된 달 TOP 10 ── */}
      <div style={{ marginBottom:'8px', display:'flex', alignItems:'center', gap:'10px' }}>
        <span style={{
          fontSize:'0.72rem', fontWeight:800, color:'#EB701A',
          background:'rgba(235,112,26,0.1)', border:'1px solid rgba(235,112,26,0.25)',
          padding:'4px 12px', borderRadius:'100px', letterSpacing:'0.06em',
        }}>
          🏆 {monthLabel} TOP {selectedTop10.length}
        </span>
        <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>조회수 기준</span>
      </div>

      <Top10Grid top10={selectedTop10} onPlay={id => setActiveId(id)} isMobile={isMobile} />

      {/* ── 최신 영상 + 공지 ── */}
      <div id="videos" className="sec-light" style={{ margin: isMobile ? '20px 0 0' : '40px calc(-1 * clamp(1.5rem, 5vw, 3rem)) 0', padding: isMobile ? '0' : '40px clamp(1.5rem, 5vw, 3rem)' }}>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: isMobile ? '20px' : '40px', alignItems:'start' }}>
          <div>
            <p style={{ fontSize:'0.72rem', fontWeight:700, color:'#EB701A', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom: isMobile ? '4px' : '8px', display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ display:'block', width:'24px', height:'2px', background:'#EB701A', borderRadius:'2px' }} />최신 업로드
            </p>
            <h2 style={{ fontSize: isMobile ? '1.3rem' : 'clamp(1.4rem, 2.5vw, 2rem)', fontWeight:900, letterSpacing:'-0.04em', color:'var(--text)', marginBottom: isMobile ? '10px' : '16px' }}>최신 영상</h2>
            <div className="mob-video-grid" style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? '0' : '14px', width:'100%', overflow:'hidden', borderRadius: isMobile ? '16px' : '0', border: isMobile ? '1px solid var(--card-border)' : 'none', background: isMobile ? 'var(--card)' : 'transparent' }}>
              {videos.slice(0, 6).map((video, i) => (
                <div key={video.id} onClick={() => setActiveId(video.id)}
                  className="card fade-in-up"
                  style={{ cursor:'pointer', transitionDelay:`${(i % 3) * 0.08}s`, display: isMobile ? 'flex' : 'block', flexDirection: 'row', overflow:'hidden', width:'100%', minWidth:0, boxSizing:'border-box', borderRadius: isMobile ? '0' : '16px', border: isMobile ? 'none' : '1px solid var(--card-border)', borderBottom: isMobile && i < 5 ? '1px solid var(--card-border)' : 'none' } as React.CSSProperties}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 16px 40px rgba(0,0,0,0.15)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow=''; }}>
                  <div style={{ position:'relative', flexShrink: 0, width: isMobile ? '110px' : '100%' }}>
                    <img src={video.thumbnail} alt={video.title} style={{ width: isMobile ? '110px' : '100%', height: isMobile ? '100%' : 'auto', aspectRatio: '16/9', objectFit:'cover', display:'block' }} />
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0)', transition:'background 0.2s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(0,0,0,0.25)'; const btn=(e.currentTarget as HTMLElement).querySelector('.play-btn') as HTMLElement; if(btn) btn.style.opacity='1'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='rgba(0,0,0,0)'; const btn=(e.currentTarget as HTMLElement).querySelector('.play-btn') as HTMLElement; if(btn) btn.style.opacity='0'; }}>
                      <div className="play-btn" style={{ width:'44px', height:'44px', borderRadius:'50%', background:'rgba(235,112,26,0.9)', display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'opacity 0.2s' }}>
                        <span style={{ fontSize:'1rem', marginLeft:'3px', color:'#fff' }}>▶</span>
                      </div>
                    </div>
                  </div>
                  {isMobile ? (
                    <div style={{ padding:'14px 18px', flex:1, minWidth:0, overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'center', gap:'4px' }}>
                      <p style={{ fontWeight:700, fontSize:'0.88rem', lineHeight:1.35, marginBottom:'4px', color:'var(--text)', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' } as React.CSSProperties}>{video.title}</p>
                      <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                        <span style={{ fontSize:'0.78rem', fontWeight:700, color:'#EB701A' }}>👁 {video.views.toLocaleString()}회</span>
                        <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{new Date(video.publishedAt).toLocaleDateString('ko-KR')}</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ padding:'10px 12px 8px', flex:1, minWidth:0, overflow:'hidden' }}>
                        <p style={{ fontWeight:700, fontSize:'0.85rem', lineHeight:1.35, color:'var(--text)', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' } as React.CSSProperties}>{video.title}</p>
                      </div>
                      <div style={{ background:'#EB701A', padding:'8px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'6px', flexShrink:0 }}>
                        <span style={{ fontSize:'0.78rem', fontWeight:800, color:'#fff' }}>👁 {video.views.toLocaleString()}회</span>
                        <span style={{ fontSize:'0.70rem', color:'rgba(255,255,255,0.8)', fontWeight:500 }}>{new Date(video.publishedAt).toLocaleDateString('ko-KR')}</span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize:'0.72rem', fontWeight:700, color:'#EB701A', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'8px', display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ display:'block', width:'24px', height:'2px', background:'#EB701A', borderRadius:'2px' }} />SOOP 공지
            </p>
            <h2 style={{ fontSize: isMobile ? '1.3rem' : 'clamp(1.4rem, 2.5vw, 2rem)', fontWeight:900, letterSpacing:'-0.04em', color:'var(--text)', marginBottom: isMobile ? '10px' : '16px' }}>최신 공지</h2>
            <div className="mob-notice-list" style={{ display:'flex', flexDirection:'column', gap: isMobile ? '0' : '10px', borderRadius: isMobile ? '16px' : '0', border: isMobile ? '1px solid var(--card-border)' : 'none', overflow: 'hidden', background: isMobile ? 'var(--card)' : 'transparent' }}>
              {notices.map((n, ni) => (
                <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="notice-card"
                  style={{ display:'flex', flexDirection:'column', gap:'6px', padding: isMobile ? '14px 18px' : '16px', background:'var(--card)', borderRadius: isMobile ? '0' : '14px', border: isMobile ? 'none' : '1px solid var(--card-border)', borderBottom: isMobile ? '1px solid var(--card-border)' : 'none', textDecoration:'none', transition:'transform 0.15s, box-shadow 0.15s' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent: isMobile ? 'flex-start' : 'space-between', gap:'6px' }}>
                    <span style={{ fontSize:'0.72rem', fontWeight:700, color:'#EB701A' }}>
                      {n.date.split('-')[1]}월 {n.date.split('-')[2]}일
                    </span>
                    <div style={{ display:'flex', gap:'8px', fontSize:'0.72rem', color:'var(--text-muted)' }}>
                      <span>❤️ {n.likes}</span>
                      <span>💬 {n.comments}</span>
                    </div>
                  </div>
                  <p style={{ fontWeight:700, fontSize: isMobile ? '0.82rem' : '0.9rem', color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', margin:0 }}>{n.title}</p>
                  <p style={{ color:'var(--text-muted)', display:'-webkit-box', WebkitLineClamp: isMobile ? 1 : 2, WebkitBoxOrient:'vertical', overflow:'hidden', margin:0, lineHeight:1.5, fontSize: isMobile ? '0.72rem' : '0.78rem' } as React.CSSProperties}>{n.summary}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
















