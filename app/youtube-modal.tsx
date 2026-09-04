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
              background: selectedYear === y ? '#EB701A' : 'transparent',
              color: selectedYear === y ? '#fff' : 'var(--text-muted)',
              border: selectedYear === y ? '1px solid #EB701A' : '1px solid transparent',
              boxShadow: 'none',
            }}>
            {y}년
          </button>
        ))}
      </div>
      {/* 월 탭 */}
      <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', alignItems:'center', padding:'8px 0', overflowX:'auto' }}>
        <span style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--text-muted)', marginRight:'4px' }}>월</span>
        {monthsInYear.sort().map(ym => {
          const mo = parseInt(ym.split('-')[1]);
          const isSelected = ym === selectedMonth;
          return (
            <button key={ym} onClick={() => onSelect(ym)}
              style={{
                padding:'4px 12px', borderRadius:'100px', cursor:'pointer',
                fontWeight: isSelected ? 700 : 500, fontSize:'0.8rem', transition:'all 0.15s',
                background: isSelected ? '#EB701A' : 'transparent',
                color: isSelected ? '#fff' : 'var(--text-muted)',
                border: isSelected ? '1px solid #EB701A' : '1px solid transparent',
                boxShadow: 'none',
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
    { label:'총 조회수', value: fmt(totalViews) },
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
            const rowBg   = rank===1 ? 'rgba(255,190,0,0.06)' : rank===2 ? 'rgba(192,192,192,0.08)' : rank===3 ? 'rgba(180,110,50,0.05)' : 'transparent';
            const rowHover = rank===1 ? 'rgba(255,180,0,0.11)' : rank===2 ? 'rgba(192,192,192,0.14)' : rank===3 ? 'rgba(180,110,50,0.09)' : 'rgba(235,112,26,0.08)';
            return (
              <div key={video.id}
                onClick={() => onPlay(video.id)}
                style={{
                  display:'flex', alignItems:'center', gap:'12px',
                  padding: isTop3 ? '12px 14px' : '10px 14px',
                  borderBottom: i < top10.length - 1 ? '1px solid var(--card-border)' : 'none',
                  borderLeft: rank===1 ? '3.5px solid #FFB800' : rank===2 ? '3.5px solid #C0C0C0' : rank===3 ? '3.5px solid #CD7F32' : '3.5px solid transparent',
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

        {/* BY THE NUMBERS */}
        <div style={{ marginTop:'12px', borderTop:'1px solid var(--card-border)', paddingTop:'12px' }}>
          <p style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase' as const, color:'var(--text-muted)', marginBottom:'16px' }}>BY THE NUMBERS</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)' }}>
            {stats.map((s, i) => (
              <div key={i} style={{ textAlign:'center' as const, borderRight: i < stats.length-1 ? '1px solid var(--card-border)' : 'none', padding:'6px 0' }}>
                <p style={{ fontSize:'1.5rem', fontWeight:900, letterSpacing:'-0.04em', color:'var(--text)', lineHeight:1, margin:0 }}>{s.value}</p>
                <p style={{ fontSize:'0.6rem', color:'var(--text-muted)', fontWeight:500, marginTop:'4px' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  // ── 데스크탑: 5열 소형 썸네일 그리드 (rewind와 동일 스타일) ──
  const fmt2 = fmt;
  const MEDAL = ['🥇','🥈','🥉'];
  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '12px',
        background: 'var(--card)',
        padding: '16px',
        borderRadius: '20px',
        alignItems: 'stretch',
      }}>
        {top10.map((video, i) => {
          const rank = i + 1;
          const isTop3 = rank <= 3;
          const rankColor = rank === 1 ? '#FFB800' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'rgba(0,0,0,0.5)';
          return (
            <div key={video.id}
              onClick={() => onPlay(video.id)}
              style={{
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: '8px',
                background: 'var(--bg-deeper)',
                border: `1px solid ${isTop3 ? rankColor + '55' : 'var(--card-border)'}`,
                borderRadius: '10px', overflow: 'hidden',
                boxShadow: isTop3 ? `0 0 0 1px ${rankColor}44` : 'none',
                transition: 'transform 0.18s, box-shadow 0.18s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 28px rgba(0,0,0,0.18)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = isTop3 ? `0 0 0 1px ${rankColor}44` : 'none'; }}
            >
              {/* 썸네일 */}
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#111', flexShrink: 0 }}>
                <img src={video.thumbnail} alt={video.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />
                {/* 순위 뱃지 */}
                <div style={{
                  position: 'absolute', top: '5px', left: '6px',
                  fontSize: isTop3 ? '0.78rem' : '0.68rem',
                  fontWeight: 900, lineHeight: 1,
                  color: rank === 2 ? '#1A1A1A' : '#fff',
                  background: rankColor,
                  padding: isTop3 ? '3px 7px' : '2px 6px',
                  borderRadius: '5px', letterSpacing: '-0.02em',
                }}>
                  {isTop3 ? `${MEDAL[rank-1]} ${rank}` : `#${rank}`}
                </div>
                {/* 조회수 */}
                <div style={{ position: 'absolute', bottom: '5px', right: '6px', fontSize: '0.68rem', fontWeight: 800, color: '#EB701A' }}>
                  {fmt2(video.views)}
                </div>
              </div>
              {/* 제목 */}
              <p style={{
                fontSize: '0.76rem', fontWeight: 600, color: 'var(--text)',
                lineHeight: 1.4, margin: 0, padding: '6px 10px 8px',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                minHeight: '2.2rem',
              } as React.CSSProperties}>{video.title}</p>
            </div>
          );
        })}

        {/* 빈 자리 placeholder: 항상 10칸을 채우지 않고, 현재 진행 중인 행만 자연스럽게 채움 */}
        {Array.from({ length: Math.max(0, Math.min(10, Math.ceil(top10.length / 5) * 5) - top10.length) }).map((_, i) => (
          <div key={`ph-${i}`} style={{
            borderRadius: '10px',
            border: '1px dashed var(--card-border)',
            background: 'var(--bg-deeper)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* 썸네일 영역 */}
            <div style={{
              width: '100%',
              aspectRatio: '16/9',
              background: 'var(--card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                letterSpacing: '0.06em',
              }}>집계 중</span>
            </div>
            {/* 제목 영역 */}
            <div style={{
              padding: '6px 10px 8px',
              minHeight: '2.2rem',
            }} />
          </div>
        ))}
      </div>

      {/* BY THE NUMBERS */}
      <div style={{ marginTop: '8px', borderTop: '1px solid var(--card-border)', paddingTop: '16px', paddingBottom: '4px' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--text-muted)', marginBottom: '16px' }}>BY THE NUMBERS</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
          {stats.map((s, i) => (
            <div key={i} style={{ borderRight: i < stats.length-1 ? '1px solid var(--card-border)' : 'none', padding: '0 24px 0 0', marginRight: i < stats.length-1 ? '24px' : '0' }}>
              <p style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.05em', color: 'var(--text)', lineHeight: 1, margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '5px' }}>{s.label}</p>
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

      {/* ── 최신 공지 ── */}
      <div id="videos" className="sec-light" style={{ margin: isMobile ? '20px 0 0' : '0 calc(-1 * clamp(1.5rem, 5vw, 3rem)) 0', padding: isMobile ? '48px 0 0' : '48px clamp(1.5rem, 5vw, 3rem) 40px', borderTop: isMobile ? '1px solid var(--card-border)' : '1px solid var(--card-border)' }}>
        <div style={{ display:'flex', flexDirection:'column', gap: isMobile ? '20px' : '40px' }}>

          <div style={{ order: -1 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px', marginBottom: '24px', paddingBottom:'16px', borderBottom:'3px solid #EB701A', width:'fit-content' }}>
              <span style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.18em', color:'var(--text-muted)', textTransform:'uppercase' as const }}>NOTICE</span>
              <h2 style={{ fontSize:'clamp(1.6rem,3.5vw,2.6rem)', fontWeight:900, letterSpacing:'-0.04em', lineHeight:1, color:'var(--text)', margin:0 }}>최신 공지</h2>
            </div>
            <div>
              {isMobile ? (
                <div style={{ background:'var(--card)', borderRadius:'12px', overflow:'hidden', border:'1px solid var(--card-border)' }}>
                  {notices.map((n, ni) => (
                    <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer"
                      style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px 16px', borderBottom: ni < notices.length - 1 ? '1px solid var(--card-border)' : 'none', textDecoration:'none', color:'inherit', background:'transparent', transition:'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(235,112,26,0.04)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}
                    >
                      <div style={{ flex:1, minWidth:0 }}>
                        <span style={{ fontSize:'0.65rem', color:'var(--text-muted)', display:'block', marginBottom:'3px' }}>{n.date.split('-')[1]}월 {n.date.split('-')[2]}일</span>
                        <p style={{ fontSize:'0.86rem', fontWeight:700, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', margin:0 }}>{n.title}</p>
                      </div>
                      <span style={{ flexShrink:0, fontSize:'0.82rem', color:'var(--text-muted)' }}>›</span>
                    </a>
                  ))}
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'12px' }}>
                  {notices.map((n, ni) => (
                    <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer"
                      style={{ display:'flex', flexDirection:'column', gap:'8px', padding:'18px 20px', background:'var(--card)', borderRadius:'12px', border:'1px solid var(--card-border)', textDecoration:'none', color:'inherit', transition:'border-color 0.18s, transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s' } as React.CSSProperties}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='rgba(235,112,26,0.45)'; el.style.transform='translateY(-4px)'; el.style.boxShadow='0 8px 24px rgba(0,0,0,0.1)'; }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='var(--card-border)'; el.style.transform=''; el.style.boxShadow=''; }}
                    >
                      <span style={{ fontSize:'0.68rem', color:'var(--text-muted)', fontWeight:500 }}>{n.date.split('-')[1]}월 {n.date.split('-')[2]}일</span>
                      {/* 제목: 1줄이든 2줄이든 항상 2줄 높이만큼 확보해 카드 높이 통일 */}
                      <p style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--text)', lineHeight:1.4, height:'2.8em', margin:0, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' } as React.CSSProperties}>{n.title}</p>
                      {/* 요약: 내용이 없어도 자리(1줄)는 항상 확보 */}
                      <p style={{ fontSize:'0.76rem', color:'var(--text-muted)', lineHeight:1.5, height:'1.5em', margin:0, display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical', overflow:'hidden' } as React.CSSProperties}>{n.summary || '\u00A0'}</p>
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
















