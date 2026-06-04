'use client';
import { useState, useEffect, useRef } from 'react';
import type { Video, MonthData, RewindStats } from './page';

const ORANGE = '#EB701A';
const DARK   = '#0b0b0b';
const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

function fmt(n: number) { return n.toLocaleString('ko-KR'); }

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
function StatCard({ value, label, suffix = '', delay = 0, active }: {
  value: number; label: string; suffix?: string; delay?: number; active: boolean;
}) {
  const [go, setGo] = useState(false);
  useEffect(() => { if (active) { const t = setTimeout(() => setGo(true), delay); return () => clearTimeout(t); } }, [active, delay]);
  const count = useCountUp(value, 2400, go);
  return (
    <div style={{ textAlign: 'center', padding: '24px 16px', background: 'rgba(235,112,26,0.05)', border: '1px solid rgba(235,112,26,0.13)', borderRadius: '20px', flex: 1, minWidth: '140px', overflow: 'hidden' }}>
      <div style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)', fontWeight: 900, letterSpacing: '-0.03em', color: ORANGE, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' as const, overflow: 'hidden', wordBreak: 'break-all' as const }}>
        {fmt(count)}{suffix}
      </div>
      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '10px', fontWeight: 500 }}>{label}</div>
    </div>
  );
}

// ── 월별 카드 ──
function MonthCard({ data, idx }: { data: MonthData; idx: number }) {
  const hasData = data.ytCount > 0 || data.soopCount > 0;
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={() => data.topYT && window.open(`https://youtube.com/watch?v=${data.topYT.id}`, '_blank')}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: '16px', overflow: 'hidden',
        background: hasData ? '#161616' : '#0f0f0f',
        border: `1px solid ${hov && hasData ? 'rgba(235,112,26,0.4)' : hasData ? 'rgba(235,112,26,0.15)' : 'rgba(255,255,255,0.05)'}`,
        animation: `rwFadeUp 0.5s ${idx * 0.04}s both`,
        transform: hov && hasData ? 'translateY(-5px)' : 'none',
        boxShadow: hov && hasData ? '0 16px 40px rgba(235,112,26,0.15)' : 'none',
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
        cursor: data.topYT ? 'pointer' : 'default',
      }}
    >
      {/* 썸네일 */}
      <div style={{ width: '100%', aspectRatio: '16/9', position: 'relative', background: '#0a0a0a' }}>
        {data.topYT
          ? <img src={data.topYT.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.1)', fontSize: '2rem' }}>📭</div>
        }
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)' }} />
        <div style={{
          position: 'absolute', top: '10px', left: '12px',
          background: hasData ? ORANGE : 'rgba(255,255,255,0.12)',
          color: '#fff', fontSize: '0.72rem', fontWeight: 800,
          padding: '3px 10px', borderRadius: '100px',
        }}>{MONTH_KO[data.month - 1]}</div>
      </div>
      {/* 정보 */}
      <div style={{ padding: '14px 16px 18px' }}>
        <p style={{
          fontSize: '0.82rem', fontWeight: 600,
          color: hasData ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)',
          lineHeight: 1.4, margin: '0 0 10px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}>
          {data.topYT?.title || '업로드 없음'}
        </p>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' as const }}>
          {data.ytCount > 0 && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', background: 'rgba(255,50,50,0.12)', color: '#ff7878' }}>YT {data.ytCount}</span>}
          {data.soopCount > 0 && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', background: 'rgba(0,150,255,0.12)', color: '#60b8ff' }}>SOOP {data.soopCount}</span>}
          {data.topYT && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', background: 'rgba(235,112,26,0.12)', color: ORANGE }}>{fmt(data.topYT.views)}회</span>}
        </div>
      </div>
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
    </div>
  );
}

// ── 메인 컴포넌트 ──
interface Props { year: number; stats: RewindStats; monthlyData: MonthData[]; top10: Video[]; }

export default function RewindClient({ year, stats, monthlyData, top10 }: Props) {
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

        {/* 홈 링크 */}
        <a href="/" style={{ position: 'absolute', top: '24px', left: '24px', display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600, transition: 'color 0.2s', zIndex: 10 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#fff'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.4)'}
        >← 스맵 아카이브</a>

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

          {/* 메인 스탯 4개 */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' as const }}>
            <StatCard value={stats.ytUploads}      label="유튜브 업로드"   suffix="개" delay={0}   active={statsInView} />
            <StatCard value={stats.totalViews}     label="총 조회수"       suffix="회" delay={200} active={statsInView} />
            <StatCard value={stats.soopBroadcasts} label="SOOP 방송"       suffix="개" delay={400} active={statsInView} />
            <StatCard value={stats.broadcastHours} label="총 방송 시간"    suffix="h"  delay={600} active={statsInView} />
          </div>

          {/* 서브 스탯 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '14px', marginTop: '14px' }}>
            <div style={{ padding: '18px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>활동 개월 수</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff' }}>{stats.activeMonths}개월 <span style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.3)' }}>/ 12</span></div>
            </div>
            <div style={{ padding: '18px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>가장 바빴던 달</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: ORANGE }}>{MONTH_KO[stats.peakMonth.month - 1]}</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>YT {stats.peakMonth.ytCount} · SOOP {stats.peakMonth.soopCount}</div>
            </div>
            {top10[0] && (
              <div style={{ padding: '18px 20px', background: 'rgba(255,190,0,0.04)', border: '1px solid rgba(255,190,0,0.14)', borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,190,0,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>🏆 올해의 영상</div>
                <p style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff', lineHeight: 1.45, margin: '0 0 6px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{top10[0].title}</p>
                <span style={{ fontSize: '0.78rem', color: '#FFB800', fontWeight: 700 }}>{fmt(top10[0].views)}회 조회</span>
              </div>
            )}
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
            {year + 1}년에도 함께해요.
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
    </div>
  );
}
