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
  const [hovered, setHovered] = useState<number | null>(null);
  const [imgHov, setImgHov] = useState<number | null>(null);

  if (top10.length === 0) {
    return (
      <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text-muted)', fontSize:'0.9rem' }}>
        해당 월에 업로드된 영상이 없어요
      </div>
    );
  }

  const top4     = top10.slice(0, 4);
  const top5to10 = top10.slice(4, 10);
  const totalViews = top10.reduce((s, v) => s + v.views, 0);
  const avgViews   = Math.round(totalViews / top10.length);
  const RANK_COLOR: Record<number, string> = { 1:'#EB701A', 2:'#C0C0C0', 3:'#CD7F32', 4:'rgba(255,255,255,0.5)' };

  const stats = [
    { label: '이번달 영상', value: `${top10.length}개` },
    { label: '요 조회수', value: totalViews >= 10000 ? `${(totalViews/10000).toFixed(1)}만` : totalViews.toLocaleString() },
    { label: '1위 조회수', value: top10[0].views >= 10000 ? `${(top10[0].views/10000).toFixed(1)}만` : top10[0].views.toLocaleString() },
    { label: '평균 조회수', value: avgViews >= 10000 ? `${(avgViews/10000).toFixed(1)}만` : avgViews.toLocaleString() },
  ];

  return (
    <>
      {/* 근일 갤러리 그리드 (1~4위) */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:'12px' }}>
        {top4.map((video, i) => {
          const rank = i + 1;
          const isHov = imgHov === rank;
          return (
            <div key={video.id} onClick={() => onPlay(video.id)}
              onMouseEnter={() => setImgHov(rank)}
              onMouseLeave={() => setImgHov(null)}
              style={{ position:'relative', cursor:'pointer', borderRadius:'16px', overflow:'hidden', background:'#111',
                boxShadow: isHov ? '0 20px 48px rgba(0,0,0,0.35)' : '0 2px 12px rgba(0,0,0,0.15)',
                transform: isHov ? 'translateY(-6px)' : 'none',
                transition:'transform 0.3s cubic-bezier(0.22,1,0.36,1), box-shadow 0.3s',
              }}>
              <img src={video.thumbnail} alt={video.title}
                style={{ width:'100%', aspectRatio:'16/9', objectFit:'cover', display:'block',
                  transform: isHov ? 'scale(1.06)' : 'scale(1)',
                  transition:'transform 0.4s cubic-bezier(0.22,1,0.36,1)',
                }} />
              <div style={{ position:'absolute', inset:0,
                background: isHov
                  ? 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)'
                  : 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)',
                transition:'background 0.3s',
              }} />
              <div style={{ position:'absolute', top:'12px', left:'12px',
                background: rank === 1 ? '#EB701A' : 'rgba(0,0,0,0.55)', backdropFilter:'blur(8px)',
                color: rank === 1 ? '#fff' : (RANK_COLOR[rank] || '#fff'),
                fontWeight:900, fontSize: rank === 1 ? '0.9rem' : '0.82rem',
                width:'32px', height:'32px', borderRadius:'50%',
                display:'flex', alignItems:'center', justifyContent:'center',
                border: rank <= 3 ? `2px solid ${RANK_COLOR[rank]}` : '2px solid rgba(255,255,255,0.2)',
                boxShadow: rank === 1 ? '0 0 0 3px rgba(235,112,26,0.3)' : 'none',
              }}>{rank}</div>
              {rank === 1 && (
                <div style={{ position:'absolute', top:'12px', right:'12px',
                  background:'#EB701A', color:'#fff', fontSize:'0.6rem', fontWeight:800,
                  padding:'3px 8px', borderRadius:'4px', letterSpacing:'0.08em',
                }}>BEST</div>
              )}
              <div style={{ position:'absolute', bottom:'12px', left:'12px', right:'12px' }}>
                <p style={{ fontWeight:700, fontSize: isMobile ? '0.78rem' : '0.82rem', lineHeight:1.35, color:'#fff', marginBottom:'6px',
                  display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
                } as React.CSSProperties}>{video.title}</p>
                <span style={{ fontSize:'0.72rem', fontWeight:700, color:'rgba(255,255,255,0.75)' }}>👁 {video.views.toLocaleString()}회</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 통계 바 */}
      <div style={{ marginTop:'20px' }}>
        <div style={{ borderRadius:'16px', border:'1px solid var(--card-border)', background:'var(--card)', padding:'20px 24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'18px' }}>
            <span style={{ display:'block', width:'18px', height:'2px', background:'#EB701A', borderRadius:'2px' }} />
            <span style={{ fontSize:'0.68rem', fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase' as const, color:'#EB701A' }}>BY THE NUMBERS</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)' }}>
            {stats.map((s, i) => (
              <div key={i} style={{ paddingRight: i < 3 ? '20px' : '0', paddingLeft: i > 0 ? '20px' : '0',
                borderRight: i < 3 ? '1px dashed var(--card-border)' : 'none' }}>
                <p style={{ fontSize:'clamp(1.4rem,2.5vw,2rem)', fontWeight:900, letterSpacing:'-0.04em', color:'var(--text)', lineHeight:1, marginBottom:'6px' }}>{s.value}</p>
                <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:500, lineHeight:1.4 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

      {/* 5~10위 */}
      {top5to10.length > 0 && (
        <div style={{ marginTop:'16px', borderRadius:'16px', border:'1px solid var(--card-border)', background:'var(--card)', overflow:'hidden' }}>
          <div style={{ padding:'10px 18px', borderBottom:'1px solid var(--card-border)', display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ fontSize:'0.72rem', fontWeight:800, color:'#EB701A', letterSpacing:'0.08em', textTransform:'uppercase' as const }}>🎖 5위 ~ 10위</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)' }}>
            {top5to10.map((video, idx) => {
              const rank = idx + 5;
              const isHov = hovered === rank;
              const isLast = idx >= 4;
              const borderRight = (idx % 2) === 0;
              return (
                <div key={video.id} onClick={() => onPlay(video.id)}
                  onMouseEnter={() => setHovered(rank)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ display:'flex', gap:'14px', alignItems:'center', padding:'14px 18px', cursor:'pointer',
                    background: isHov ? 'rgba(235,112,26,0.04)' : 'transparent',
                    borderRight: (!isMobile && borderRight) ? '1px solid var(--card-border)' : 'none',
                    borderBottom: !isLast ? '1px solid var(--card-border)' : 'none',
                    transition:'background 0.15s' }}>
                  <span style={{ fontSize:'1.3rem', fontWeight:900, color:'var(--text-muted)', width:'28px', flexShrink:0, textAlign:'center' }}>{rank}</span>
                  <img src={video.thumbnail} alt="" style={{ width:'110px', aspectRatio:'16/9', objectFit:'cover', borderRadius:'8px', flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:'0.88rem', fontWeight:700, color:'var(--text)', lineHeight:1.4, marginBottom:'5px', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' } as React.CSSProperties}>{video.title}</p>
                    <p style={{ fontSize:'0.78rem', fontWeight:700, color:'#EB701A', margin:0 }}>👁 {video.views.toLocaleString()}회</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
















