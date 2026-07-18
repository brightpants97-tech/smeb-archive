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
        <div style={{ aspectRatio:'16/9', borderRadius:'28px', overflow:'hidden', boxShadow:'0 32px 100px rgba(0,0,0,0.8)' }}>
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
    <div style={{ borderRadius:'24px', overflow:'hidden', border:'1px solid var(--card-border)', background:'var(--card)', boxShadow:'var(--card-shadow,0 4px 24px rgba(0,0,0,0.09))', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', display:'flex', flexDirection:'column' }}>
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
  const avgViews = Math.round(totalViews / top10.length);
  const stats = [
    { label:'요 조회수', value: fmt(totalViews) },
    { label:'1위 조회수', value: fmt(top10[0].views) },
    { label:'평균 조회수', value: fmt(avgViews) },
  ];

  // ── 모바일: Apple iPhone 리스트 스타일 ──
  if (isMobile) {
    return (
      <>
        <style>{`
          @keyframes listFadeIn {
            from { opacity:0; transform:translateX(-12px); }
            to   { opacity:1; transform:translateX(0); }
          }
        `}</style>
        {/* 리스트 컨테이너 */}
        <div style={{
          background:'var(--card)',
          borderRadius:'24px',
          overflow:'hidden',
          border:'1px solid var(--card-border)',
          boxShadow:'0 2px 16px rgba(0,0,0,0.06)',
        }}>
          {top10.map((video, i) => {
            const rank = i + 1;
            const isFirst = rank === 1;
            const isTop3 = rank <= 3;
            const rowBg   = rank===1 ? 'rgba(255,190,0,0.06)' : rank===2 ? 'rgba(160,168,180,0.05)' : rank===3 ? 'rgba(180,110,50,0.05)' : 'transparent';
            const rowHover = rank===1 ? 'rgba(255,180,0,0.11)' : rank===2 ? 'rgba(160,168,180,0.09)' : rank===3 ? 'rgba(180,110,50,0.09)' : 'rgba(235,112,26,0.08)';
            return (
              <div key={video.id}
                onClick={() => onPlay(video.id)}
                style={{
                  display:'flex', alignItems:'center', gap:'12px',
                  padding: isTop3 ? '12px 14px' : '10px 14px',
                  borderBottom: i < top10.length - 1 ? '1px solid var(--card-border)' : 'none',
                  borderLeft: rank===1 ? '3.5px solid #FFB800' : rank===2 ? '3.5px solid #A0A8B8' : rank===3 ? '3.5px solid #CD7F32' : '3.5px solid transparent',
                  cursor:'pointer',
                  background: rowBg,
                  animation:`listFadeIn 0.4s ${i * 0.04}s both`,
                  transition:'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background=rowHover}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background=rowBg}
              >
                {/* 순위 */}
                <div style={{ flexShrink:0, width: isTop3 ? '42px' : '28px', textAlign:'center', lineHeight:1 }}>
                  {rank===1 ? (
                    <span style={{
                      fontSize:'2.2rem', fontWeight:900, display:'block', lineHeight:1, letterSpacing:'-0.04em',
                      background:'linear-gradient(160deg,#FFE566 0%,#FF8C00 55%,#FFD700 100%)',
                      WebkitBackgroundClip:'text', backgroundClip:'text', color:'transparent',
                      filter:'drop-shadow(0 2px 6px rgba(255,150,0,0.5))',
                    }}>1</span>
                  ) : rank===2 ? (
                    <span style={{
                      fontSize:'1.85rem', fontWeight:900, display:'block', lineHeight:1, letterSpacing:'-0.04em',
                      background:'linear-gradient(160deg,#FFFFFF 0%,#9AAAB8 55%,#D8DCE4 100%)',
                      WebkitBackgroundClip:'text', backgroundClip:'text', color:'transparent',
                    }}>2</span>
                  ) : rank===3 ? (
                    <span style={{
                      fontSize:'1.65rem', fontWeight:900, display:'block', lineHeight:1, letterSpacing:'-0.04em',
                      background:'linear-gradient(160deg,#F0A870 0%,#8B4513 55%,#CD7F32 100%)',
                      WebkitBackgroundClip:'text', backgroundClip:'text', color:'transparent',
                    }}>3</span>
                  ) : (
                    <span style={{
                      fontSize:'1.1rem', fontWeight:800, display:'block', lineHeight:1,
                      color:'var(--text-muted)',
                    }}>{rank}</span>
                  )}
                </div>
                {/* 썸네일 */}
                <div style={{ flexShrink:0, width:'80px', height:'45px', borderRadius:'12px', overflow:'hidden', position:'relative' }}>
                  <img src={video.thumbnail} alt={video.title}
                    style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                  {isFirst && (
                    <div style={{
                      position:'absolute', inset:0,
                      border:'2px solid #EB701A', borderRadius:'12px', pointerEvents:'none',
                    }} />
                  )}
                </div>
                {/* 텍스트 */}
                <div style={{ flex:1, minWidth:0, overflow:'hidden' }}>
                  <p style={{
                    fontSize:'0.82rem', fontWeight: isFirst ? 700 : 600,
                    color:'var(--text)', lineHeight:1.35, margin:0,
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                  }}>{video.title}</p>
                  <span style={{ fontSize:'0.72rem', color:'#EB701A', fontWeight:700 }}>
                    {fmt(video.views)}회
                  </span>
                </div>
                {/* 재생 아이콘 */}
                <div style={{
                  flexShrink:0, width:'28px', height:'28px', borderRadius:'50%',
                  background: isFirst ? '#EB701A' : 'var(--bg-deeper)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  <span style={{ fontSize:'0.6rem', marginLeft:'2px', color: isFirst ? '#fff' : 'var(--text-muted)' }}>▶</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* BY THE NUMBERS — Apple 카드 스타일 */}
        <div style={{ marginTop:'16px', background:'var(--bg-deeper)', borderRadius:'24px', padding:'16px' }}>
          <p style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'12px' }}>BY THE NUMBERS</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px' }}>
            {stats.map((s, i) => (
              <div key={i} style={{
                background:'var(--card)', borderRadius:'22px', padding:'14px 10px',
                textAlign:'center', border:'1px solid var(--card-border)',
                boxShadow:'0 1px 4px rgba(0,0,0,0.05)',
              }}>
                <p style={{ fontSize:'1.3rem', fontWeight:900, letterSpacing:'-0.04em', color:'var(--text)', lineHeight:1, marginBottom:'4px' }}>{s.value}</p>
                <p style={{ fontSize:'0.62rem', color:'var(--text-muted)', fontWeight:500 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  // ── 데스크탑: 5열 소형 썸네일 그리드 ──
  const fmt2 = fmt;
  return (
    <>
      <style>{`
        .top10-sm-card { transition: transform 0.18s, box-shadow 0.18s; }
        .top10-sm-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.22) !important; }
      `}</style>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '12px',
        background: 'var(--card)',
        padding: '16px',
        borderRadius: '20px',
      }}>
        {top10.map((video, i) => {
          const rank = i + 1;
          const rankColor = rank === 1 ? '#FFB800' : rank === 2 ? '#A0A8B8' : rank === 3 ? '#CD7F32' : 'rgba(0,0,0,0.5)';
          const ringColor = rank === 1 ? '0 0 0 2px #EB701A' : 'none';
          return (
            <div key={video.id}
              className="top10-sm-card"
              onClick={() => onPlay(video.id)}
              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: ringColor, borderRadius: '10px' }}
            >
              {/* 썸네일 */}
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: '10px', overflow: 'hidden', background: '#111', flexShrink: 0 }}>
                <img src={video.thumbnail} alt={video.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {/* 어두운 오버레이 */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />
                {/* 순위 뱃지 */}
                <div style={{
                  position: 'absolute', top: '5px', left: '6px',
                  fontSize: rank <= 3 ? '0.78rem' : '0.68rem',
                  fontWeight: 900, lineHeight: 1,
                  color: rank === 2 ? '#1A1A1A' : '#fff',
                  background: rankColor,
                  padding: rank <= 3 ? '3px 7px' : '2px 6px',
                  borderRadius: '5px',
                  letterSpacing: '-0.02em',
                }}>
                  {rank === 1 ? '🥇 1' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : `#${rank}`}
                </div>
                {/* 조회수 */}
                <div style={{ position: 'absolute', bottom: '5px', right: '6px', fontSize: '0.68rem', fontWeight: 800, color: '#EB701A' }}>
                  {fmt2(video.views)}
                </div>
              </div>
              {/* 제목 */}
              <p style={{
                fontSize: '0.76rem', fontWeight: 600, color: 'var(--text)',
                lineHeight: 1.35, margin: 0,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              } as React.CSSProperties}>{video.title}</p>
            </div>
          );
        })}
      </div>

      {/* BY THE NUMBERS */}
      <div style={{ marginTop: '10px', background: 'var(--bg-deeper)', borderRadius: '16px', padding: '14px 18px' }}>
        <p style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>BY THE NUMBERS</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              background: 'var(--card)', borderRadius: '12px', padding: '12px 16px',
              border: '1px solid var(--card-border)',
            }}>
              <p style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1, marginBottom: '4px' }}>{s.value}</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</p>
            </div>
          ))}
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
        <div style={{ display:'flex', flexDirection:'column', gap: isMobile ? '20px' : '40px' }}>
          <div>
            <div style={{ margin: isMobile ? '0 -1.2rem 16px' : '0 calc(-1 * clamp(1.5rem,5vw,3rem)) 20px', background:'#EB701A', padding: isMobile ? '20px 1.2rem' : '28px clamp(1.5rem,5vw,3rem)', overflow:'hidden', position:'relative', borderRadius:'20px' }}>
              <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(0,0,0,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.06) 1px,transparent 1px)', backgroundSize:'36px 36px', pointerEvents:'none' }} />
              <h2 style={{ fontSize: isMobile ? '2rem' : 'clamp(2rem,5vw,4rem)', fontWeight:900, letterSpacing:'-0.06em', lineHeight:1, color:'#1A1A1A', position:'relative', zIndex:1 }}>최신 영상</h2>
            </div>
            <div className="mob-video-grid" style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? '0' : '16px', width:'100%', overflow:'hidden', borderRadius: isMobile ? '22px' : '0', border: isMobile ? '1px solid var(--card-border)' : 'none', background: isMobile ? 'var(--card)' : 'transparent' }}>
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

          <div style={{ order: -1 }}>
            <div style={{ margin: isMobile ? '0 -1.2rem 16px' : '0 calc(-1 * clamp(1.5rem,5vw,3rem)) 20px', background:'#EB701A', padding: isMobile ? '20px 1.2rem' : '28px clamp(1.5rem,5vw,3rem)', overflow:'hidden', position:'relative', borderRadius:'20px' }}>
              <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(0,0,0,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.06) 1px,transparent 1px)', backgroundSize:'36px 36px', pointerEvents:'none' }} />
              <h2 style={{ fontSize: isMobile ? '2rem' : 'clamp(2rem,5vw,4rem)', fontWeight:900, letterSpacing:'-0.06em', lineHeight:1, color:'#1A1A1A', position:'relative', zIndex:1 }}>최신 공지</h2>
            </div>
            <div style={{ background:'var(--bg-deeper)', borderRadius:'18px', padding: isMobile ? '0' : '12px' }}>
              {isMobile ? (
                <div style={{ background:'var(--card)', borderRadius:'18px', overflow:'hidden', border:'1px solid var(--card-border)', boxShadow:'0 2px 16px rgba(0,0,0,0.06)' }}>
                  {notices.map((n, ni) => (
                    <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer"
                      style={{ display:'flex', alignItems:'center', gap:'14px', padding:'14px 16px', borderBottom: ni < notices.length - 1 ? '1px solid var(--card-border)' : 'none', textDecoration:'none', color:'inherit', background:'transparent', transition:'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(235,112,26,0.06)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}
                    >
                      <div style={{ flexShrink:0, width:'44px', height:'44px', borderRadius:'12px', background:'rgba(235,112,26,0.1)', border:'1px solid rgba(235,112,26,0.2)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1px' }}>
                        <span style={{ fontSize:'0.65rem', fontWeight:700, color:'#EB701A', lineHeight:1 }}>{n.date.split('-')[1]}월</span>
                        <span style={{ fontSize:'1rem', fontWeight:900, color:'#EB701A', lineHeight:1 }}>{n.date.split('-')[2]}</span>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', margin:0, marginBottom:'3px' }}>{n.title}</p>
                        <div style={{ display:'flex', gap:'8px' }}>
                          <span style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>❤️ {n.likes}</span>
                          <span style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>💬 {n.comments}</span>
                        </div>
                      </div>
                      <span style={{ flexShrink:0, fontSize:'0.9rem', color:'var(--text-muted)' }}>›</span>
                    </a>
                  ))}
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'14px' }}>
                  {notices.map((n, ni) => (
                    <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer"
                      style={{ display:'flex', flexDirection:'column', gap:'10px', padding:'20px 22px', background:'var(--card)', borderRadius:'16px', border:'1px solid var(--card-border)', textDecoration:'none', color:'inherit', boxShadow:'0 1px 6px rgba(0,0,0,0.06)', transition:'transform 0.18s, box-shadow 0.18s' } as React.CSSProperties}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 10px 28px rgba(0,0,0,0.1)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow='0 1px 6px rgba(0,0,0,0.06)'; }}
                    >
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'rgba(235,112,26,0.08)', border:'1px solid rgba(235,112,26,0.18)', borderRadius:'100px', padding:'4px 10px' }}>
                          <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#EB701A', display:'inline-block', flexShrink:0 }} />
                          <span style={{ fontSize:'0.72rem', fontWeight:700, color:'#EB701A' }}>{n.date.split('-')[1]}월 {n.date.split('-')[2]}일</span>
                        </div>
                        <div style={{ display:'flex', gap:'8px', fontSize:'0.72rem', color:'var(--text-muted)' }}>
                          <span>❤️ {n.likes}</span>
                          <span>💬 {n.comments}</span>
                        </div>
                      </div>
                      <p style={{ fontWeight:700, fontSize:'0.92rem', color:'var(--text)', lineHeight:1.4, margin:0, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' } as React.CSSProperties}>{n.title}</p>
                      <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', lineHeight:1.55, margin:0, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' } as React.CSSProperties}>{n.summary}</p>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', paddingTop:'8px', borderTop:'1px solid var(--card-border)' }}>
                        <span style={{ fontSize:'0.72rem', color:'#EB701A', fontWeight:700 }}>공지 보기 →</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
















