'use client';
import { useState, useEffect, useRef } from 'react';
import type { Video, MonthData, RewindStats } from './page';

const ORANGE = '#EB701A';
const DARK   = '#0b0b0b';
const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

function fmt(n: number) { return n.toLocaleString('ko-KR'); }
function fmtShort(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000)     return `${(n / 10000).toFixed(1)}만`;
  return n.toLocaleString('ko-KR');
}

// ── 카운터 훅 ──
function useCountUp(target: number, duration = 2200, active = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active || target === 0) return;
    let st = 0;
    let raf: number;
    const tick = (ts: number) => {
      if (!st) st = ts;
      const p = Math.min((ts - st) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active]);
  return val;
}

// ── InView 훅 ──
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

// ── 통계 카드 ──
function StatCard({ value, label, suffix = '', delay = 0, active, subText }: {
  value: number; label: string; suffix?: string; delay?: number; active: boolean; subText?: string;
}) {
  const [go, setGo] = useState(false);
  useEffect(() => { if (active) { const t = setTimeout(() => setGo(true), delay); return () => clearTimeout(t); } }, [active, delay]);
  const count = useCountUp(value, 2400, go);
  return (
    <div style={{ textAlign: 'center', padding: '24px 16px', background: 'rgba(235,112,26,0.05)', border: '1px solid rgba(235,112,26,0.13)', borderRadius: '20px', flex: 1, minWidth: '140px', overflow: 'hidden' }}>
      <div style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)', fontWeight: 900, letterSpacing: '-0.03em', color: ORANGE, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' as const, overflow: 'hidden', wordBreak: 'break-all' as const }}>
        {fmt(count)}{suffix}
      </div>
      {subText && (
        <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px',
          background: 'rgba(235,112,26,0.1)', border: '1px solid rgba(235,112,26,0.2)',
          borderRadius: '100px', padding: '2px 10px',
        }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>≈</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>{subText}</span>
        </div>
      )}
      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '8px', fontWeight: 500 }}>{label}</div>
    {/* ② 플로팅 홈 버튼 — 항상 고정 */}
      <a href="/"
        style={{
          position: 'fixed', bottom: '28px', left: '24px', zIndex: 999,
          display: 'inline-flex', alignItems: 'center', gap: '7px',
          background: 'rgba(15,15,15,0.85)',
          border: '1px solid rgba(255,255,255,0.15)',
          backdropFilter: 'blur(16px)',
          color: '#fff', padding: '10px 18px', borderRadius: '100px',
          textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = ORANGE;
          el.style.borderColor = ORANGE;
          el.style.boxShadow = `0 8px 32px rgba(235,112,26,0.45)`;
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = 'rgba(15,15,15,0.85)';
          el.style.borderColor = 'rgba(255,255,255,0.15)';
          el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
        스맵 아카이브
      </a>
    </div>
  );
}

// ── 월별 카드 ──
const RANK_STYLE = [
  { medal: '🥇', grad: 'linear-gradient(135deg,#FFE566,#FF8C00)', glow: 'rgba(255,160,0,0.3)' },
  { medal: '🥈', grad: 'linear-gradient(135deg,#E8ECF0,#8A9AAA)', glow: 'rgba(160,170,180,0.2)' },
  { medal: '🥉', grad: 'linear-gradient(135deg,#F0A060,#7A3A0A)', glow: 'rgba(180,100,40,0.2)' },
];

function MonthCard({ data, idx }: { data: MonthData; idx: number }) {
  const hasData = data.top3.length > 0;
  const [sel, setSel] = useState(0);
  const [hov, setHov] = useState(false);
  const video = data.top3[sel] || null;
  const rs = RANK_STYLE[sel];

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: '16px', overflow: 'hidden',
        background: hasData ? '#161616' : '#0f0f0f',
        border: `1px solid ${hov && hasData ? 'rgba(235,112,26,0.4)' : hasData ? 'rgba(235,112,26,0.15)' : 'rgba(255,255,255,0.05)'}`,
        animation: `rwFadeUp 0.5s ${idx * 0.04}s both`,
        transform: hov && hasData ? 'translateY(-5px)' : 'none',
        boxShadow: hov && hasData ? '0 16px 40px rgba(235,112,26,0.12)' : 'none',
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
        display: 'flex', flexDirection: 'column' as const,
      }}
    >
      {/* 탭 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px 0', gap: '6px' }}>
        {/* 월 라벨 */}
        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: hasData ? ORANGE : 'rgba(255,255,255,0.2)', marginRight: 'auto' }}>
          {MONTH_KO[data.month - 1]}
        </span>
        {/* 1·2·3위 탭 */}
        {data.top3.map((_, i) => {
          const rs2 = RANK_STYLE[i];
          const isActive = sel === i;
          return (
            <button
              key={i}
              onClick={() => setSel(i)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                padding: '4px 10px', borderRadius: '100px', border: 'none',
                cursor: 'pointer', transition: 'all 0.18s',
                background: isActive ? rs2.grad : 'rgba(255,255,255,0.06)',
                boxShadow: isActive ? `0 0 10px ${rs2.glow}` : 'none',
                fontSize: '0.68rem', fontWeight: 800,
                color: isActive ? (i === 1 ? '#1a1a1a' : '#fff') : 'rgba(255,255,255,0.35)',
              }}
            >
              {rs2.medal} {i + 1}위
            </button>
          );
        })}
      </div>

      {/* 썸네일 */}
      <div
        onClick={() => video && window.open(`https://youtube.com/watch?v=${video.id}`, '_blank')}
        style={{ width: '100%', aspectRatio: '16/9', position: 'relative', background: '#0a0a0a', cursor: video ? 'pointer' : 'default', marginTop: '10px', flexShrink: 0 }}
      >
        {video
          ? <img
              key={video.id}
              src={video.thumbnail} alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'opacity 0.2s' }}
            />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.1)', fontSize: '2rem' }}>📭</div>
        }
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)' }} />
        {/* 조회수 */}
        {video && (
          <div style={{ position: 'absolute', bottom: '10px', right: '12px', display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', borderRadius: '100px', padding: '3px 10px' }}>
            <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>👁</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: ORANGE }}>{fmtShort(video.views)}회</span>
          </div>
        )}
      </div>

      {/* 제목 */}
      <div style={{ padding: '12px 14px 16px', flex: 1 }}>
        {video
          ? <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.88)', lineHeight: 1.45, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
              {video.title}
            </p>
          : <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.2)', margin: 0 }}>업로드 없음</p>
        }
      </div>
    {/* ② 플로팅 홈 버튼 — 항상 고정 */}
      <a href="/"
        style={{
          position: 'fixed', bottom: '28px', left: '24px', zIndex: 999,
          display: 'inline-flex', alignItems: 'center', gap: '7px',
          background: 'rgba(15,15,15,0.85)',
          border: '1px solid rgba(255,255,255,0.15)',
          backdropFilter: 'blur(16px)',
          color: '#fff', padding: '10px 18px', borderRadius: '100px',
          textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = ORANGE;
          el.style.borderColor = ORANGE;
          el.style.boxShadow = `0 8px 32px rgba(235,112,26,0.45)`;
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = 'rgba(15,15,15,0.85)';
          el.style.borderColor = 'rgba(255,255,255,0.15)';
          el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
        스맵 아카이브
      </a>
    </div>
  );
}

// ── TOP10 아이템 ──
function Top10Item({ video, rank, delay }: { video: Video; rank: number; delay: number }) {
  const [hov, setHov] = useState(false);
  const TOP3_GRAD: Record<number, string> = {
    1: 'linear-gradient(160deg,#FFE566 0%,#FF8C00 55%,#FFD700 100%)',
    2: 'linear-gradient(160deg,#FFFFFF 0%,#9AAAB8 55%,#D8DCE4 100%)',
    3: 'linear-gradient(160deg,#F0A870 0%,#8B4513 55%,#CD7F32 100%)',
  };
  const BORDER_COLOR: Record<number, string> = { 1: '#FFB800', 2: '#A0A8B8', 3: '#CD7F32' };
  const MEDAL = ['🥇','🥈','🥉'];
  const isTop3 = rank <= 3;

  return (
    <div
      onClick={() => window.open(`https://youtube.com/watch?v=${video.id}`, '_blank')}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: isTop3 ? '16px 20px' : '12px 20px',
        borderBottom: rank < 10 ? '1px solid rgba(255,255,255,0.05)' : 'none',
        borderLeft: isTop3 ? `3.5px solid ${BORDER_COLOR[rank]}` : '3.5px solid transparent',
        background: hov ? 'rgba(235,112,26,0.07)' : rank === 1 ? 'rgba(255,190,0,0.04)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.15s',
        animation: `rwFadeUp 0.4s ${delay}s both`,
      }}
    >
      {/* 순위 */}
      <div style={{ flexShrink: 0, width: isTop3 ? '44px' : '28px', textAlign: 'center' }}>
        {isTop3 ? (
          <span style={{
            fontSize: rank === 1 ? '2.2rem' : rank === 2 ? '1.85rem' : '1.65rem',
            fontWeight: 900, display: 'block', lineHeight: 1, letterSpacing: '-0.04em',
            background: TOP3_GRAD[rank],
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            filter: rank === 1 ? 'drop-shadow(0 2px 8px rgba(255,150,0,0.55))' : 'none',
          }}>{rank}</span>
        ) : (
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)' }}>{rank}</span>
        )}
      </div>
      {/* 썸네일 */}
      <div style={{
        flexShrink: 0, width: '92px', height: '52px', borderRadius: '10px', overflow: 'hidden',
        boxShadow: rank === 1 ? '0 0 0 2px #FFB800, 0 4px 16px rgba(255,160,0,0.35)' : rank === 2 ? '0 0 0 1.5px #A0A8B8' : rank === 3 ? '0 0 0 1.5px #CD7F32' : 'none',
      }}>
        <img src={video.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
      {/* 텍스트 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.88rem', fontWeight: isTop3 ? 700 : 600, color: 'rgba(255,255,255,0.9)', lineHeight: 1.35, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{video.title}</p>
        <span style={{ fontSize: '0.75rem', color: ORANGE, fontWeight: 700 }}>{fmt(video.views)}회</span>
      </div>
      {isTop3 && <div style={{ flexShrink: 0, fontSize: '1.3rem' }}>{MEDAL[rank - 1]}</div>}
    {/* ② 플로팅 홈 버튼 — 항상 고정 */}
      <a href="/"
        style={{
          position: 'fixed', bottom: '28px', left: '24px', zIndex: 999,
          display: 'inline-flex', alignItems: 'center', gap: '7px',
          background: 'rgba(15,15,15,0.85)',
          border: '1px solid rgba(255,255,255,0.15)',
          backdropFilter: 'blur(16px)',
          color: '#fff', padding: '10px 18px', borderRadius: '100px',
          textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = ORANGE;
          el.style.borderColor = ORANGE;
          el.style.boxShadow = `0 8px 32px rgba(235,112,26,0.45)`;
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = 'rgba(15,15,15,0.85)';
          el.style.borderColor = 'rgba(255,255,255,0.15)';
          el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
        스맵 아카이브
      </a>
    </div>
  );
}

// ── 메인 컴포넌트 ──
interface Props { year: number; validYears: number[]; stats: RewindStats; monthlyData: MonthData[]; top10: Video[]; }

export default function RewindClient({ year, validYears, stats, monthlyData, top10 }: Props) {
  const [statsRef, statsInView] = useInView(0.2);
  const [monthRef, monthInView] = useInView(0.05);
  const [top10Ref, top10InView] = useInView(0.05);
  const [endRef, endInView]     = useInView(0.2);

  return (
    <div style={{ background: DARK, color: '#fff', minHeight: '100vh', fontFamily: 'system-ui,-apple-system,sans-serif', overflowX: 'hidden' }}>
      <style>{`
        @keyframes rwFadeUp   { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
        @keyframes rwScale    { from { opacity:0; transform:scale(0.82); } to { opacity:1; transform:scale(1); } }
        @keyframes rwGlow     { 0%,100%{filter:drop-shadow(0 0 32px rgba(235,112,26,0.45));} 50%{filter:drop-shadow(0 0 72px rgba(235,112,26,0.85));} }
        @keyframes rwBounce   { 0%,100%{transform:translateY(0);} 50%{transform:translateY(8px);} }
        @keyframes rwHeartbeat{ 0%,100%{transform:scale(1);} 30%{transform:scale(1.18);} 60%{transform:scale(1.05);} }
      `}</style>

      {/* ───────────────── ① 오프닝 ───────────────── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
        background: `radial-gradient(ellipse 80% 55% at 50% 50%, rgba(235,112,26,0.14) 0%, transparent 70%)`,
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(235,112,26,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(235,112,26,0.04) 1px,transparent 1px)', backgroundSize: '64px 64px', pointerEvents: 'none' }} />

        {/* 상단 바: 홈 + 연도 네비 */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px clamp(1.2rem,4vw,3rem)', zIndex: 10, flexWrap: 'wrap' as const, gap: '12px' }}>
          {/* 로고 + 홈 버튼 묶음 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', opacity: 0.9, transition: 'opacity 0.2s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity='1'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity='0.9'}
              aria-label="스맵 아카이브 홈"
            >
              <svg width="90" height="24" viewBox="0 0 340 90" xmlns="http://www.w3.org/2000/svg">
                <text x="0" y="76" fontFamily="'Arial Black','Helvetica Neue',Arial,sans-serif" fontWeight="900" fontSize="84" letterSpacing="-3" fill="#ffffff">SME</text>
                <text x="192" y="76" fontFamily="'Arial Black','Helvetica Neue',Arial,sans-serif" fontWeight="900" fontSize="84" fill="#EB701A">B</text>
                <rect x="0" y="80" width="248" height="2.5" fill="#ffffff" rx="1.5"/>
                <text x="2" y="93" fontFamily="'Helvetica Neue',Arial,sans-serif" fontWeight="400" fontSize="11" letterSpacing="4" fill="rgba(255,255,255,0.5)">ARCHIVE</text>
              </svg>
            </a>
            {/* 홈으로 버튼 — 클릭 가능함을 명시 */}
            <a href="/"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.75)',
                padding: '5px 12px', borderRadius: '100px',
                textDecoration: 'none', fontSize: '0.75rem', fontWeight: 700,
                transition: 'all 0.18s', whiteSpace: 'nowrap' as const,
                backdropFilter: 'blur(8px)',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = ORANGE;
                el.style.color = '#fff';
                el.style.borderColor = ORANGE;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'rgba(255,255,255,0.1)';
                el.style.color = 'rgba(255,255,255,0.75)';
                el.style.borderColor = 'rgba(255,255,255,0.2)';
              }}
            >
              ← 홈으로
            </a>
          </div>

          {/* 연도 탭 */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
            {validYears.map(y => {
              const isActive = y === year;
              return (
                <a key={y} href={`/rewind/${y}`}
                  style={{
                    padding: '6px 16px', borderRadius: '100px', textDecoration: 'none',
                    fontSize: '0.82rem', fontWeight: 800, transition: 'all 0.18s',
                    background: isActive ? ORANGE : 'rgba(255,255,255,0.07)',
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                    border: `1px solid ${isActive ? ORANGE : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: isActive ? '0 0 16px rgba(235,112,26,0.4)' : 'none',
                  }}
                  onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.color='#fff'; (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.12)'; }}}
                  onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.4)'; (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.07)'; }}}
                >{y}</a>
              );
            })}
          </div>

          {/* 이전/다음 연도 화살표 */}
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            {validYears.indexOf(year) > 0 && (
              <a href={`/rewind/${year - 1}`}
                style={{ padding: '6px 14px', borderRadius: '100px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.18s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#fff'; (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.12)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.4)'; (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.06)'; }}
              >← {year - 1}</a>
            )}
            {validYears.indexOf(year) < validYears.length - 1 && (
              <a href={`/rewind/${year + 1}`}
                style={{ padding: '6px 14px', borderRadius: '100px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.18s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#fff'; (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.12)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.4)'; (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.06)'; }}
              >{year + 1} →</a>
            )}
          </div>
        </div>

        {/* 연도 + 카피 */}
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, padding: '0 2rem' }}>
          <div style={{ fontSize: 'clamp(6rem, 24vw, 17rem)', fontWeight: 900, letterSpacing: '-0.06em', lineHeight: 0.85, color: ORANGE, fontStyle: 'italic', animation: 'rwScale 0.85s cubic-bezier(0.22,1,0.36,1) both, rwGlow 3.5s 0.85s ease-in-out infinite' }}>
            {year}
          </div>
          <div style={{ fontSize: 'clamp(1rem, 2.8vw, 1.7rem)', fontWeight: 700, color: 'rgba(255,255,255,0.82)', marginTop: '20px', letterSpacing: '-0.02em', animation: 'rwFadeUp 0.7s 0.45s both' }}>
            스맵과 함께한 365일
          </div>

          {/* 배지 */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '28px', flexWrap: 'wrap' as const, animation: 'rwFadeUp 0.7s 0.65s both' }}>
            <span style={{ background: 'rgba(235,112,26,0.14)', border: '1px solid rgba(235,112,26,0.28)', color: ORANGE, padding: '6px 18px', borderRadius: '100px', fontSize: '0.82rem', fontWeight: 700 }}>
              유튜브 {stats.ytUploads}개 업로드
            </span>
            <span style={{ background: 'rgba(30,120,255,0.1)', border: '1px solid rgba(30,120,255,0.22)', color: '#60a8ff', padding: '6px 18px', borderRadius: '100px', fontSize: '0.82rem', fontWeight: 700 }}>
              SOOP {stats.soopBroadcasts}개 방송
            </span>
          </div>
        </div>

        {/* 스크롤 인디케이터 */}
        <div style={{ position: 'absolute', bottom: '44px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '8px', animation: 'rwFadeUp 1s 1.2s both' }}>
          <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>스크롤</span>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '1.1rem', animation: 'rwBounce 1.6s ease-in-out infinite' }}>↓</div>
        </div>
      </section>

      {/* ───────────────── ② 숫자로 보는 한 해 ───────────────── */}
      <section ref={statsRef as React.RefObject<HTMLElement>} style={{ padding: 'clamp(60px,10vw,100px) clamp(1.5rem,5vw,5rem)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '48px', animation: statsInView ? 'rwFadeUp 0.6s both' : 'none' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: ORANGE, marginBottom: '8px' }}>Year in Numbers</p>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,3rem)', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1.1 }}>
              숫자로 보는 <em style={{ color: ORANGE, fontStyle: 'italic' }}>{year}</em>
            </h2>
          </div>

          {/* ── 유튜브 그룹 ── */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(255,0,0,0.12)', border: '1px solid rgba(255,0,0,0.22)', borderRadius: '100px', padding: '3px 10px' }}>
                <span style={{ fontSize: '0.6rem' }}>▶</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ff6b6b', letterSpacing: '0.06em' }}>YOUTUBE</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' as const }}>
              <StatCard value={stats.ytUploads}  label="업로드 영상 수"    suffix="개" delay={0}   active={statsInView} />
              <StatCard value={stats.totalViews} label="총 조회수"          suffix="회" delay={150} active={statsInView} />
              <StatCard value={stats.avgViews}   label="영상당 평균 조회수" suffix="회" delay={300} active={statsInView} />
            </div>
          </div>

          {/* ── SOOP 그룹 ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(30,120,255,0.1)', border: '1px solid rgba(30,120,255,0.22)', borderRadius: '100px', padding: '3px 10px' }}>
                <span style={{ fontSize: '0.6rem' }}>●</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#60a8ff', letterSpacing: '0.06em' }}>SOOP</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' as const }}>
              <StatCard value={stats.soopBroadcasts} label="방송 횟수"    suffix="개" delay={0}   active={statsInView} />
              <StatCard value={stats.broadcastHours} label="총 방송 시간" suffix="h"  delay={150} active={statsInView} subText={`${Math.floor(stats.broadcastHours / 24).toLocaleString('ko-KR')}일`} />
            </div>
          </div>

          {/* ── 올해의 영상 ── */}
          {top10[0] && (
            <div style={{ marginTop: '16px', padding: '20px 24px', background: 'rgba(255,190,0,0.04)', border: '1px solid rgba(255,190,0,0.14)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '1rem' }}>🏆</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,190,0,0.7)', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>올해의 영상</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' as const }}>
                {top10[0].thumbnail && (
                  <img src={top10[0].thumbnail} alt="" style={{ width: '120px', height: '68px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0, border: '1.5px solid rgba(255,190,0,0.25)' }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', lineHeight: 1.45, margin: '0 0 6px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{top10[0].title}</p>
                  <span style={{ fontSize: '0.82rem', color: '#FFB800', fontWeight: 700 }}>{fmt(top10[0].views)}회 조회</span>
                </div>
              </div>
            </div>
          )}

          {/* ── 가장 바빴던 달 ── */}
          <div style={{ marginTop: '12px', padding: '18px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: '16px', width: '100%', boxSizing: 'border-box' as const }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '4px' }}>가장 바빴던 달</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: ORANGE }}>{MONTH_KO[stats.peakMonth.month - 1]}</div>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.7 }}>
              <div><span style={{ color: '#ff6b6b' }}>YT</span> {stats.peakMonth.ytCount}개</div>
              <div><span style={{ color: '#60a8ff' }}>SOOP</span> {stats.peakMonth.soopCount}개</div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────── ③ 월별 하이라이트 ───────────────── */}
      <section ref={monthRef as React.RefObject<HTMLElement>} style={{ padding: 'clamp(60px,10vw,100px) clamp(1.5rem,5vw,5rem)', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
          <div style={{ marginBottom: '48px', animation: monthInView ? 'rwFadeUp 0.6s both' : 'none' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: ORANGE, marginBottom: '8px' }}>Monthly Highlights</p>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,3rem)', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1.1 }}>
              월별 <em style={{ color: ORANGE, fontStyle: 'italic' }}>하이라이트</em>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.88rem', marginTop: '10px' }}>각 달의 최다 조회 영상 · 클릭하면 유튜브로 이동해요</p>
          </div>
          {monthInView && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))', gap: '14px' }}>
              {monthlyData.map((m, i) => <MonthCard key={m.key} data={m} idx={i} />)}
            </div>
          )}
        </div>
      </section>

      {/* ───────────────── ④ 올해의 TOP10 ───────────────── */}
      <section ref={top10Ref as React.RefObject<HTMLElement>} style={{ padding: 'clamp(60px,10vw,100px) clamp(1.5rem,5vw,5rem)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div style={{ marginBottom: '40px', animation: top10InView ? 'rwFadeUp 0.6s both' : 'none' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: ORANGE, marginBottom: '8px' }}>Annual TOP 10</p>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,3rem)', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1.1 }}>
              {year}년 <em style={{ color: ORANGE, fontStyle: 'italic' }}>TOP 10</em>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.88rem', marginTop: '10px' }}>연간 기준 최다 조회수 영상</p>
          </div>

          {top10InView && (
            <div style={{ background: '#111', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
              {top10.map((v, i) => <Top10Item key={v.id} video={v} rank={i + 1} delay={i * 0.055} />)}
              {top10.length === 0 && (
                <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem' }}>데이터를 불러오는 중이에요</div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ───────────────── ⑦ 엔딩 카드 ───────────────── */}
      <section ref={endRef as React.RefObject<HTMLElement>} style={{
        minHeight: '80vh',
        display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: `radial-gradient(ellipse 65% 55% at 50% 100%, rgba(235,112,26,0.16) 0%, transparent 70%)`,
        padding: 'clamp(60px,10vw,100px) clamp(1.5rem,5vw,5rem)',
        textAlign: 'center' as const,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(235,112,26,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(235,112,26,0.03) 1px,transparent 1px)', backgroundSize: '64px 64px', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, animation: endInView ? 'rwFadeUp 0.8s both' : 'none' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '20px', display: 'inline-block', animation: endInView ? 'rwHeartbeat 1.8s 0.5s ease-in-out infinite' : 'none' }}>🧡</div>

          <h2 style={{ fontSize: 'clamp(2.2rem,7vw,5rem)', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1.1, marginBottom: '20px' }}>
            {year}년도<br />
            <em style={{ color: ORANGE, fontStyle: 'italic' }}>고마웠어요</em>
          </h2>

          <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.42)', maxWidth: '380px', lineHeight: 1.75, marginBottom: '52px' }}>
            스맵과 함께한 {year}년,<br />
            모든 순간이 이 아카이브에 담겼어요.<br />
            {validYears.includes(year + 1) ? `${year + 1}년에도 함께해요.` : '앞으로도 함께해요.'}
          </p>

          {/* 버튼 */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' as const }}>
            <a href="/"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: ORANGE, color: '#fff', padding: '14px 30px', borderRadius: '100px', textDecoration: 'none', fontWeight: 700, fontSize: '0.92rem', transition: 'opacity 0.2s, transform 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity='0.88'; (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity='1'; (e.currentTarget as HTMLElement).style.transform='none'; }}
            >← 스맵 아카이브 홈</a>
            <a href="https://www.sooplive.com/townboy" target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.06)', color: '#fff', padding: '14px 30px', borderRadius: '100px', textDecoration: 'none', fontWeight: 700, fontSize: '0.92rem', border: '1px solid rgba(255,255,255,0.1)', transition: 'background 0.2s, transform 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.12)'; (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.transform='none'; }}
            >SOOP 바로가기 →</a>
          </div>

          {/* 저작권 */}
          <p style={{ marginTop: '80px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.18)', letterSpacing: '0.1em' }}>
            SMEB ARCHIVE · {year} ANNUAL REPORT
          </p>
        </div>
      </section>
    {/* ② 플로팅 홈 버튼 — 항상 고정 */}
      <a href="/"
        style={{
          position: 'fixed', bottom: '28px', left: '24px', zIndex: 999,
          display: 'inline-flex', alignItems: 'center', gap: '7px',
          background: 'rgba(15,15,15,0.85)',
          border: '1px solid rgba(255,255,255,0.15)',
          backdropFilter: 'blur(16px)',
          color: '#fff', padding: '10px 18px', borderRadius: '100px',
          textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = ORANGE;
          el.style.borderColor = ORANGE;
          el.style.boxShadow = `0 8px 32px rgba(235,112,26,0.45)`;
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = 'rgba(15,15,15,0.85)';
          el.style.borderColor = 'rgba(255,255,255,0.15)';
          el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
        스맵 아카이브
      </a>
    </div>
  );
}
