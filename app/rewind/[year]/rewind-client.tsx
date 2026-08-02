'use client'; // build:1785597211
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
    <div style={{ textAlign: 'center', padding: '24px 16px', background: 'rgba(235,112,26,0.07)', border: '1px solid rgba(235,112,26,0.13)', borderRadius: '20px', flex: 1, minWidth: '140px', overflow: 'hidden' }}>
      <div style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)', fontWeight: 900, letterSpacing: '-0.03em', color: ORANGE, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' as const, overflow: 'hidden', wordBreak: 'break-all' as const }}>
        {fmt(count)}{suffix}
      </div>
      {subText && (
        <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px',
          background: 'rgba(235,112,26,0.1)', border: '1px solid rgba(235,112,26,0.2)',
          borderRadius: '100px', padding: '2px 10px',
        }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--rw-text3)' }}>≈</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>{subText}</span>
        </div>
      )}
      <div style={{ fontSize: '0.8rem', color: 'var(--rw-text2)', marginTop: '8px', fontWeight: 500 }}>{label}</div>
    </div>
  );
}

// ── 월별 카드 ──


// ── 연도별 비교 차트 ──
interface YearStat { year: number; totalViews: number; ytUploads: number; avgViews: number; }

function YearCompareChart({ validYears, currentYear }: { validYears: number[]; currentYear: number }) {
  const [data, setData]   = useState<YearStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode]   = useState<'total' | 'avg'>('total');
  const [hov, setHov]     = useState<number | null>(null);
  const [ref, inView]     = useInView(0.2);
  const BAR_H = 180;

  useEffect(() => {
    Promise.all(
      validYears.map(y =>
        fetch(`/api/rewind-stats?year=${y}`)
          .then(r => r.json())
          .catch(() => null)
      )
    ).then(results => {
      setData(results.filter(Boolean) as YearStat[]);
      setLoading(false);
    });
  }, []);

  const getValue = (d: YearStat) => mode === 'total' ? d.totalViews : d.avgViews;
  const maxVal   = Math.max(...data.map(getValue), 1);

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>}>
      {/* 토글 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
        {(['total', 'avg'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '7px 18px', borderRadius: '100px', border: 'none', cursor: 'pointer',
            fontSize: '0.78rem', fontWeight: 700, transition: 'all 0.18s',
            background: mode === m ? ORANGE : 'rgba(255,255,255,0.07)',
            color: mode === m ? '#fff' : 'rgba(255,255,255,0.4)',
            boxShadow: mode === m ? '0 0 14px rgba(235,112,26,0.35)' : 'none',
          }}>
            {m === 'total' ? '총 조회수' : '평균 조회수'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ height: `${BAR_H + 52}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rw-text3)', fontSize: '0.85rem' }}>
          데이터 불러오는 중...
        </div>
      ) : (
        <div style={{ width: '100%' }}>
          <div style={{ position: 'relative' }}>
            {/* Y축 */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between', pointerEvents: 'none', paddingBottom: '52px' }}>
              {[100, 75, 50, 25, 0].map(pct => (
                <div key={pct} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.62rem', color: 'var(--rw-text4)', width: '40px', textAlign: 'right' as const, flexShrink: 0 }}>
                    {pct > 0 ? fmtShort(Math.round(maxVal * pct / 100)) : '0'}
                  </span>
                  <div style={{ flex: 1, height: '1px', background: pct === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)' }} />
                </div>
              ))}
            </div>

            {/* 바 */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'clamp(8px,2vw,24px)', height: `${BAR_H + 52}px`, paddingLeft: '52px', paddingTop: '32px', boxSizing: 'border-box' as const }}>
              {data.map((d, i) => {
                const val    = getValue(d);
                const ratio  = maxVal > 0 ? val / maxVal : 0;
                const barH   = Math.max(ratio * BAR_H, val > 0 ? 4 : 0);
                const isCur  = d.year === currentYear;
                const isPeak = val === maxVal && maxVal > 0;
                const isHov  = hov === i;
                return (
                  <div key={d.year}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '6px', cursor: 'pointer', position: 'relative' }}
                    onMouseEnter={() => setHov(i)}
                    onMouseLeave={() => setHov(null)}
                    onClick={() => window.location.href = `/rewind/${d.year}`}
                  >
                    {/* 바 */}
                    <div style={{
                      width: '100%', borderRadius: '6px 6px 0 0',
                      height: inView ? `${barH}px` : '0px',
                      transition: `height 0.7s cubic-bezier(0.22,1,0.36,1) ${i * 0.08}s`,
                      background: isPeak
                        ? 'linear-gradient(to top, #FF8C00, #FFE566)'
                        : isCur
                          ? `linear-gradient(to top, ${ORANGE}, rgba(235,112,26,0.5))`
                          : isHov
                            ? 'linear-gradient(to top, rgba(255,255,255,0.4), rgba(255,255,255,0.15))'
                            : 'linear-gradient(to top, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                      boxShadow: isPeak ? '0 0 20px rgba(255,184,0,0.35)' : isCur ? '0 0 14px rgba(235,112,26,0.3)' : 'none',
                      position: 'relative', overflow: 'visible',
                    }}>
                      {(isPeak || isHov) && barH >= 28 && (
                        <div style={{
                          position: 'absolute', top: '6px', left: '50%', transform: 'translateX(-50%)',
                          fontSize: '0.7rem', fontWeight: 900, whiteSpace: 'nowrap' as const,
                          color: 'var(--rw-text)', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                          padding: '2px 7px', borderRadius: '4px',
                          border: isPeak ? '1px solid rgba(255,184,0,0.5)' : '1px solid rgba(255,255,255,0.15)',
                          pointerEvents: 'none', letterSpacing: '-0.02em',
                        }}>
                          {fmtShort(val)}회
                        </div>
                      )}
                    </div>

                    {/* 연도 라벨 */}
                    <div style={{ textAlign: 'center' as const }}>
                      <span style={{
                        fontSize: 'clamp(0.7rem,1.2vw,0.85rem)', fontWeight: isCur || isPeak ? 900 : 600,
                        color: isPeak ? '#FFB800' : isCur ? ORANGE : isHov ? '#fff' : 'rgba(255,255,255,0.4)',
                        display: 'block', transition: 'color 0.15s',
                      }}>
                        {d.year}
                      </span>
                      {isCur && <span style={{ fontSize: '0.55rem', color: ORANGE, fontWeight: 700 }}>●</span>}
                      {isPeak && !isCur && <span style={{ fontSize: '0.55rem', color: '#FFB800', fontWeight: 700 }}>👑</span>}
                      {(isPeak || isHov) && barH < 28 && (
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, display: 'block', marginTop: '2px', color: isPeak ? '#FFB800' : ORANGE }}>
                          {fmtShort(val)}회
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p style={{ marginTop: '12px', fontSize: '0.72rem', color: 'var(--rw-text4)', textAlign: 'center' as const }}>
            ● 현재 연도 · 👑 최고 기록 · 클릭하면 해당 연도 리와인드로 이동
          </p>
        </div>
      )}
    </div>
  );
}


// ── 조회수 비교 차트 섹션 (탭) ──
function ChartSection({ monthlyData, validYears, year }: { monthlyData: MonthData[]; validYears: number[]; year: number }) {
  const [tab, setTab] = useState<'monthly' | 'yearly'>('monthly');
  return (
    <section style={{ padding: 'clamp(60px,10vw,100px) clamp(1.5rem,5vw,5rem)', borderTop: '1px solid var(--rw-border)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: ORANGE, marginBottom: '8px' }}>Views Analysis</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: '16px' }}>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,3rem)', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--rw-text)', lineHeight: 1.1 }}>
              {tab === 'monthly' ? <>월별 <em style={{ color: ORANGE, fontStyle: 'italic' }}>조회수</em> 비교</> : <>연도별 <em style={{ color: ORANGE, fontStyle: 'italic' }}>조회수</em> 비교</>}
            </h2>
            {/* 탭 */}
            <div style={{ display: 'flex', gap: '0', background: 'var(--rw-bg4)', borderRadius: '14px', padding: '4px', border: '1px solid var(--rw-border)' }}>
              {([['monthly', '📅 월별'], ['yearly', '📊 연도별']] as const).map(([t, label]) => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '10px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontSize: '0.85rem', fontWeight: 800, transition: 'all 0.2s',
                  background: tab === t
                    ? `linear-gradient(135deg, ${ORANGE}, #ff8c3a)`
                    : 'transparent',
                  color: tab === t ? '#fff' : 'rgba(255,255,255,0.4)',
                  boxShadow: tab === t ? '0 2px 12px rgba(235,112,26,0.4)' : 'none',
                  letterSpacing: '-0.01em',
                  minWidth: '100px',
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p style={{ color: 'var(--rw-text3)', fontSize: '0.88rem', marginTop: '10px' }}>
            {tab === 'monthly' ? '월별 유튜브 총 조회수 추이' : '연도별 유튜브 조회수 비교'}
          </p>
        </div>
        {tab === 'monthly'
          ? <MonthlyChart monthlyData={monthlyData} />
          : <YearCompareChart validYears={validYears} currentYear={year} />
        }
      </div>
    </section>
  );
}

// ── 월별 조회수 차트 ──
function MonthlyChart({ monthlyData }: { monthlyData: MonthData[] }) {
  const [hov, setHov]   = useState<number | null>(null);
  const [mode, setMode] = useState<'total' | 'avg'>('total');
  const [ref, inView]   = useInView(0.2);
  const BAR_H = 180;

  const getValue = (m: MonthData) =>
    mode === 'total' ? m.totalMonthViews : (m.ytCount > 0 ? Math.round(m.totalMonthViews / m.ytCount) : 0);

  const maxVal = Math.max(...monthlyData.map(getValue), 1);

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>}>
      {/* 토글 버튼 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
        {(['total', 'avg'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '7px 18px', borderRadius: '100px', border: 'none', cursor: 'pointer',
            fontSize: '0.78rem', fontWeight: 700, transition: 'all 0.18s',
            background: mode === m ? ORANGE : 'rgba(255,255,255,0.07)',
            color: mode === m ? '#fff' : 'rgba(255,255,255,0.4)',
            boxShadow: mode === m ? '0 0 14px rgba(235,112,26,0.35)' : 'none',
          }}>
            {m === 'total' ? '총 조회수' : '평균 조회수'}
          </button>
        ))}
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <div style={{ minWidth: '560px', position: 'relative' }}>
          {/* Y축 가이드라인 */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between', pointerEvents: 'none', paddingBottom: '52px' }}>
            {[100, 75, 50, 25, 0].map(pct => (
              <div key={pct} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.62rem', color: 'var(--rw-text4)', width: '40px', textAlign: 'right' as const, flexShrink: 0 }}>
                  {pct > 0 ? fmtShort(Math.round(maxVal * pct / 100)) : '0'}
                </span>
                <div style={{ flex: 1, height: '1px', background: pct === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)' }} />
              </div>
            ))}
          </div>

          {/* 바 차트 */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'clamp(4px,1vw,10px)', height: `${BAR_H + 52}px`, paddingLeft: '52px', paddingTop: '32px', boxSizing: 'border-box' as const }}>
            {monthlyData.map((m, i) => {
              const val     = getValue(m);
              const ratio   = maxVal > 0 ? val / maxVal : 0;
              const barH    = Math.max(ratio * BAR_H, val > 0 ? 4 : 0);
              const isPeak  = val === maxVal && maxVal > 0;
              const isHov   = hov === i;
              const isEmpty = val === 0;
              return (
                <div key={m.key}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '6px', cursor: isEmpty ? 'default' : 'pointer', position: 'relative' }}
                  onMouseEnter={() => !isEmpty && setHov(i)}
                  onMouseLeave={() => setHov(null)}
                >
                  {/* 바 */}
                  <div style={{
                    width: '100%', borderRadius: '6px 6px 0 0',
                    height: inView ? `${barH}px` : '0px',
                    transition: `height 0.7s cubic-bezier(0.22,1,0.36,1) ${i * 0.05}s`,
                    background: isEmpty
                      ? 'rgba(255,255,255,0.05)'
                      : isPeak
                        ? 'linear-gradient(to top, #FF8C00, #FFE566)'
                        : isHov
                          ? `linear-gradient(to top, ${ORANGE}, rgba(235,112,26,0.6))`
                          : `linear-gradient(to top, rgba(235,112,26,0.8), rgba(235,112,26,0.35))`,
                    boxShadow: isPeak && inView ? '0 0 20px rgba(255,184,0,0.4)' : isHov ? '0 0 12px rgba(235,112,26,0.3)' : 'none',
                    minHeight: isEmpty ? '4px' : '0',
                    position: 'relative', overflow: 'visible',
                  }}>
                    {/* 바 안 상단 — 피크·호버 시 숫자 표시 */}
                    {(isPeak || isHov) && !isEmpty && barH >= 28 && (
                      <div style={{
                        position: 'absolute', top: '6px', left: '50%', transform: 'translateX(-50%)',
                        fontSize: '0.7rem', fontWeight: 900, whiteSpace: 'nowrap' as const,
                        color: 'var(--rw-text)',
                        background: 'rgba(0,0,0,0.55)',
                        backdropFilter: 'blur(4px)',
                        padding: '2px 7px', borderRadius: '4px',
                        border: isPeak ? '1px solid rgba(255,184,0,0.5)' : '1px solid rgba(255,255,255,0.15)',
                        pointerEvents: 'none',
                        letterSpacing: '-0.02em',
                      }}>
                        {fmtShort(val)}회
                      </div>
                    )}
                  </div>

                  {/* 월 라벨 */}
                  <div style={{ textAlign: 'center' as const }}>
                    <span style={{ fontSize: 'clamp(0.6rem,1vw,0.72rem)', fontWeight: isPeak ? 900 : 600, color: isPeak ? '#FFB800' : isHov ? '#fff' : 'rgba(255,255,255,0.4)', display: 'block', transition: 'color 0.15s' }}>
                      {MONTH_KO[m.month - 1]}
                    </span>
                    {isPeak && <span style={{ fontSize: '0.55rem', color: '#FFB800', fontWeight: 700 }}>👑</span>}
                    {/* 바가 너무 낮을 때 숫자를 라벨 아래에 표시 */}
                    {(isPeak || isHov) && !isEmpty && barH < 28 && (
                      <span style={{
                        fontSize: '0.62rem', fontWeight: 800, display: 'block', marginTop: '2px',
                        color: isPeak ? '#FFB800' : ORANGE,
                      }}>
                        {fmtShort(val)}회
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}

// ── 월별 타임라인 행 ──
const RANK_INFO = [
  { medal: '🥇', grad: 'linear-gradient(135deg,#FFE566,#FF8C00)', tc: '#000' },
  { medal: '🥈', grad: 'linear-gradient(135deg,#D8DCE4,#8A9AAA)',  tc: '#111' },
  { medal: '🥉', grad: 'linear-gradient(135deg,#F0A060,#7A3A0A)',  tc: '#fff' },
  { medal: '4', grad: 'transparent', tc: 'rgba(255,255,255,0.5)' },
  { medal: '5', grad: 'transparent', tc: 'rgba(255,255,255,0.5)' },
  { medal: '6', grad: 'transparent', tc: 'rgba(255,255,255,0.5)' },
  { medal: '7', grad: 'transparent', tc: 'rgba(255,255,255,0.5)' },
  { medal: '8', grad: 'transparent', tc: 'rgba(255,255,255,0.5)' },
  { medal: '9', grad: 'transparent', tc: 'rgba(255,255,255,0.5)' },
  { medal: '10', grad: 'transparent', tc: 'rgba(255,255,255,0.5)' },
];

function MonthRow({ data, idx }: { data: MonthData; idx: number }) {
  const videos = (data.topVideos || data.top3).slice(0, 10);
  if (!videos.length) return null;

  const RANK_COLOR = ['#FFB800', '#A0A8B8', '#CD7F32'];
  const fmt = (n: number) => n >= 10000 ? (n / 10000).toFixed(1) + '만' : n.toLocaleString();

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start',
      gap: 'clamp(12px,2vw,24px)',
      padding: '20px 0',
      borderBottom: '1px solid var(--rw-border)',
      animation: `rwFadeUp 0.4s ${idx * 0.045}s both`,
    }}>
      {/* 월 라벨 */}
      <div style={{ flexShrink: 0, width: 'clamp(34px,5vw,52px)', paddingTop: '8px', textAlign: 'center' as const }}>
        <span style={{ fontSize: 'clamp(0.7rem,1.2vw,0.85rem)', fontWeight: 800, color: ORANGE, display: 'block' }}>
          {MONTH_KO[data.month - 1]}
        </span>
      </div>

      {/* 5열 그리드 */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'clamp(6px,1vw,10px)', minWidth: 0 }}>
        {videos.map((v, i) => {
          const isTop3 = i < 3;
          const borderColor = isTop3 ? RANK_COLOR[i] : 'rgba(255,255,255,0.08)';
          const glow = isTop3 ? `0 0 0 1.5px ${RANK_COLOR[i]}55` : 'none';

          return (
            <div
              key={v.id}
              onClick={() => window.open(`https://youtube.com/watch?v=${v.id}`, '_blank')}
              style={{
                cursor: 'pointer',
                borderRadius: '8px',
                overflow: 'hidden',
                border: `1px solid ${borderColor}`,
                boxShadow: glow,
                background: 'var(--rw-bg2)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLElement).style.boxShadow = isTop3 ? `0 0 0 2px ${RANK_COLOR[i]}, 0 8px 20px rgba(0,0,0,0.3)` : '0 8px 20px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = glow;
              }}
            >
              {/* 썸네일 16:9 고정 */}
              <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', height: 0, background: '#111', flexShrink: 0 }}>
                <img
                  src={v.thumbnail}
                  alt={v.title}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  loading="lazy"
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)' }} />
                {/* 순위 뱃지 */}
                <span style={{
                  position: 'absolute', top: '5px', left: '5px',
                  fontSize: '0.65rem', fontWeight: 900, lineHeight: 1,
                  background: isTop3 ? RANK_COLOR[i] : 'rgba(0,0,0,0.55)',
                  color: i === 1 ? '#111' : '#fff',
                  padding: '2px 6px', borderRadius: '4px',
                }}>
                  {isTop3 ? `${i + 1}위` : `${i + 1}`}
                </span>
                {/* 조회수 */}
                <span style={{ position: 'absolute', bottom: '4px', right: '5px', fontSize: '0.62rem', fontWeight: 800, color: ORANGE }}>
                  {fmt(v.views)}
                </span>
              </div>

              {/* 제목 */}
              <p style={{
                fontSize: '0.72rem', fontWeight: 600,
                color: 'var(--rw-text)',
                lineHeight: 1.35, margin: 0,
                padding: '6px 8px 8px',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                minHeight: '2.3rem',
              } as React.CSSProperties}>
                {v.title}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function UploadCalendar({ monthlyData, year }: { monthlyData: MonthData[]; year: number }) {
  const firstMonth = monthlyData.find(m => m.topVideos.length > 0)?.month ?? null;
  const [activeMonth, setActiveMonth] = useState<number | null>(firstMonth);
  const [hovered, setHovered] = useState<{ id: string; rect: DOMRect; above: boolean } | null>(null);
  const tlRef = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState({ left: false, right: false });

  const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const fmt = (n: number) => n >= 10000 ? (n / 10000).toFixed(1) + '만' : n.toLocaleString();

  function getOpacity(m: MonthData) {
    if (!m.topVideos.length) return 0.07;
    const max = Math.max(...m.topVideos.map(v => v.views));
    if (max > 500000) return 1;
    if (max > 200000) return 0.75;
    if (max > 100000) return 0.5;
    return 0.3;
  }

  function tier(ratio: number) {
    if (ratio > 0.7) return { dot: '#FFB800', stem: '#FFB800', border: 'rgba(255,184,0,0.55)', card: 'rgba(255,184,0,0.06)' };
    if (ratio > 0.35) return { dot: ORANGE, stem: ORANGE, border: 'rgba(235,112,26,0.45)', card: 'rgba(235,112,26,0.05)' };
    return { dot: 'rgba(255,255,255,0.32)', stem: 'rgba(255,255,255,0.15)', border: 'rgba(255,255,255,0.1)', card: 'rgba(255,255,255,0.03)' };
  }

  function updateScrollState() {
    const el = tlRef.current;
    if (!el) return;
    setScrollable({ left: el.scrollLeft > 8, right: el.scrollLeft < el.scrollWidth - el.clientWidth - 8 });
  }

  useEffect(() => {
    const el = tlRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    setTimeout(updateScrollState, 100);
    return () => el.removeEventListener('scroll', updateScrollState);
  }, [activeMonth]);

  function scroll(dir: 'left' | 'right') {
    const el = tlRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
  }

  const activeData = monthlyData.find(m => m.month === activeMonth);
  const CARD_W = 148;
  const STEM_H = 40;
  const CARD_H = Math.round(CARD_W * 9 / 16) + 56;
  const TL_HEIGHT = CARD_H * 2 + STEM_H * 2 + 20;

  return (
    <section style={{ padding: 'clamp(48px,8vw,80px) clamp(1.5rem,5vw,5rem)', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
        <style>{`
          .tl-wrap::-webkit-scrollbar { display: none; }
          .tl-wrap { -ms-overflow-style: none; scrollbar-width: none; }
          .tl-card { transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1); cursor: pointer; }
          .tl-card:hover { transform: scale(1.1) !important; z-index: 30 !important; }
          .scroll-btn { transition: background 0.15s, opacity 0.15s; }
          .scroll-btn:hover { background: rgba(235,112,26,0.25) !important; }
        `}</style>

        {/* 헤더 */}
        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: ORANGE, marginBottom: '8px' }}>Upload Calendar</p>
          <h2 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.6rem)', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1.1, marginBottom: '6px' }}>
            {year}년 <em style={{ color: ORANGE, fontStyle: 'italic' }}>업로드 캘린더</em>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.84rem' }}>월을 클릭하면 타임라인이 펼쳐져요 · 썸네일에 마우스를 올리면 확대돼요</p>
        </div>

        {/* 히트맵 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '8px', marginBottom: '12px' }}>
          {monthlyData.map(m => {
            const op = getOpacity(m);
            const isActive = activeMonth === m.month;
            const hasVideos = m.topVideos.length > 0;
            return (
              <div key={m.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{MONTH_KO[m.month - 1]}</span>
                <div
                  onClick={() => hasVideos && setActiveMonth(isActive ? null : m.month)}
                  style={{
                    width: '100%', aspectRatio: '1', borderRadius: '6px',
                    background: '#EB701A', opacity: op,
                    cursor: hasVideos ? 'pointer' : 'default',
                    outline: isActive ? '2.5px solid #EB701A' : '2.5px solid transparent',
                    outlineOffset: '2px',
                    transition: 'opacity 0.15s, outline 0.1s, transform 0.1s',
                    transform: isActive ? 'scale(1.08)' : 'scale(1)',
                  }}
                  title={hasVideos ? `${m.topVideos.length}개 영상 · 최고 ${fmt(Math.max(...m.topVideos.map(v => v.views)))}` : '업로드 없음'}
                />
                <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.22)' }}>
                  {m.topVideos.length > 0 ? `${m.topVideos.length}개` : '-'}
                </span>
              </div>
            );
          })}
        </div>

        {/* 범례 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '28px' }}>
          <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>낮음</span>
          {[0.3, 0.5, 0.75, 1].map((o, i) => (
            <div key={i} style={{ width: '14px', height: '14px', borderRadius: '3px', background: '#EB701A', opacity: o }} />
          ))}
          <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>높음</span>
        </div>

        {/* 타임라인 */}
        {activeData && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '20px 0 24px' }}>

            {/* 헤더 */}
            <div style={{ padding: '0 28px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 700, color: ORANGE }}>
                  {MONTH_KO[activeData.month - 1]} · {activeData.topVideos.length}개 영상
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[{ label: '금', color: '#FFB800' }, { label: '오렌지', color: ORANGE }, { label: '회색', color: 'rgba(255,255,255,0.38)' }].map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: [10,8,6][i] + 'px', height: [10,8,6][i] + 'px', borderRadius: '50%', background: c.color }} />
                      <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)' }}>{['상위','중간','하위'][i]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setActiveMonth(null)}
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: '0.78rem', padding: '5px 12px', borderRadius: '8px', fontFamily: 'inherit' }}
              >닫기</button>
            </div>

            {/* 스크롤 컨트롤 */}
            <div style={{ position: 'relative' }}>
              {/* 왼쪽 화살표 */}
              {scrollable.left && (
                <button
                  className="scroll-btn"
                  onClick={() => scroll('left')}
                  style={{
                    position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)',
                    zIndex: 20, background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '50%', width: '40px', height: '40px',
                    color: '#fff', fontSize: '1rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >‹</button>
              )}
              {/* 오른쪽 화살표 */}
              {scrollable.right && (
                <button
                  className="scroll-btn"
                  onClick={() => scroll('right')}
                  style={{
                    position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                    zIndex: 20, background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '50%', width: '40px', height: '40px',
                    color: '#fff', fontSize: '1rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >›</button>
              )}
              {/* 왼쪽 페이드 */}
              {scrollable.left && (
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '60px', background: 'linear-gradient(to right, rgba(0,0,0,0.4), transparent)', zIndex: 10, pointerEvents: 'none', borderRadius: '0 0 0 20px' }} />
              )}
              {/* 오른쪽 페이드 */}
              {scrollable.right && (
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '60px', background: 'linear-gradient(to left, rgba(0,0,0,0.4), transparent)', zIndex: 10, pointerEvents: 'none', borderRadius: '0 0 20px 0' }} />
              )}

              {/* 타임라인 스크롤 영역 */}
              <div
                ref={tlRef}
                className="tl-wrap"
                style={{
                  overflowX: 'auto',
                  overflowY: 'visible',
                  padding: `20px 32px`,
                }}
              >
                {(() => {
                  const videos = activeData.topVideos;
                  const W = Math.max(700, videos.length * (CARD_W + 28) + 120);
                  const step = (W - 100) / (videos.length + 1);
                  const maxV = Math.max(...videos.map(v => v.views), 1);

                  return (
                    <div style={{ position: 'relative', minWidth: `${W}px`, height: `${TL_HEIGHT}px` }}>
                      {/* 중앙선 */}
                      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: '1.5px', background: 'rgba(255,255,255,0.08)', transform: 'translateY(-50%)' }} />

                      {videos.map((v, i) => {
                        const x = 50 + step * (i + 1);
                        const above = i % 2 === 0;
                        const ratio = v.views / maxV;
                        const t = tier(ratio);
                        const dotSz = ratio > 0.7 ? 14 : ratio > 0.35 ? 10 : 7;
                        const isHov = hovered?.id === v.id;

                        return (
                          <div key={v.id} style={{ position: 'absolute', left: `${x}px`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: isHov ? 50 : 1 }}>
                            {/* 줄기 */}
                            <div style={{
                              position: 'absolute', left: '50%', transform: 'translateX(-50%)',
                              width: '1.5px', height: `${STEM_H}px`, background: t.stem,
                              ...(above ? { bottom: `${dotSz / 2}px` } : { top: `${dotSz / 2}px` }),
                            }} />

                            {/* 점 */}
                            <div style={{
                              width: `${dotSz}px`, height: `${dotSz}px`, borderRadius: '50%',
                              background: t.dot, position: 'relative', zIndex: 2,
                              boxShadow: `0 0 0 ${Math.ceil(dotSz / 2)}px ${t.dot === '#FFB800' ? 'rgba(255,184,0,0.2)' : t.dot === ORANGE ? 'rgba(235,112,26,0.2)' : 'rgba(255,255,255,0.08)'}`,
                              transition: 'transform 0.15s',
                              transform: isHov ? 'scale(1.6)' : 'scale(1)',
                            }} />

                            {/* 썸네일 카드 */}
                            <div
                              className="tl-card"
                              onClick={() => window.open(`https://youtube.com/watch?v=${v.id}`, '_blank')}
                              onMouseEnter={(e) => setHovered({ id: v.id, rect: (e.currentTarget as HTMLElement).getBoundingClientRect(), above })}
                              onMouseLeave={() => setHovered(null)}
                              style={{
                                position: 'absolute',
                                left: `${-CARD_W / 2}px`,
                                ...(above
                                  ? { bottom: `${dotSz / 2 + STEM_H + 10}px` }
                                  : { top: `${dotSz / 2 + STEM_H + 10}px` }),
                                width: `${CARD_W}px`,
                                background: t.card,
                                border: `1px solid ${isHov ? t.dot : t.border}`,
                                borderRadius: '10px', overflow: 'hidden',
                                transformOrigin: above ? 'bottom center' : 'top center',
                              }}
                            >
                              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#0a0a0a' }}>
                                <img src={v.thumbnail} alt={v.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%)' }} />
                                <div style={{ position: 'absolute', bottom: '5px', right: '6px', fontSize: '0.65rem', fontWeight: 900, color: t.dot }}>{fmt(v.views)}</div>
                              </div>
                              <div style={{ padding: '7px 9px 9px' }}>
                                <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.88)', lineHeight: 1.35, margin: '0 0 3px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{v.title}</p>
                                <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.32)' }}>{new Date(v.publishedAt).getDate()}일</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ── 타임라인 호버 프리뷰 팝업 (position: fixed) ── */}
        {hovered && (() => {
          const activeVideos = monthlyData.find(m => m.month === activeMonth)?.topVideos ?? [];
          const v = activeVideos.find(x => x.id === hovered.id);
          if (!v) return null;
          const PW = 400;
          const r = hovered.rect;
          const left = Math.min(Math.max(r.left + r.width / 2 - PW / 2, 12), window.innerWidth - PW - 12);
          const top = hovered.above ? r.top - (PW * 9 / 16) - 90 : r.bottom + 14;
          const fmt2 = (n: number) => n >= 10000 ? (n / 10000).toFixed(1) + '만' : n.toLocaleString();
          return (
            <div style={{
              position: 'fixed', left: `${left}px`, top: `${Math.max(8, top)}px`,
              width: `${PW}px`, zIndex: 9999, pointerEvents: 'none',
              background: '#1e1e1e', border: '1px solid rgba(235,112,26,0.5)',
              borderRadius: '12px', overflow: 'hidden',
              boxShadow: '0 20px 48px rgba(0,0,0,0.7)',
              animation: 'rwFadeUp 0.18s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
                <img src={v.thumbnail} alt={v.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 55%)' }} />
                <div style={{ position: 'absolute', bottom: '8px', left: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 900, color: ORANGE, letterSpacing: '-0.03em' }}>{fmt2(v.views)}</span>
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>조회</span>
                </div>
              </div>
              <div style={{ padding: '10px 14px 14px' }}>
                <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgba(255,255,255,0.92)', lineHeight: 1.4, margin: '0 0 6px' }}>{v.title}</p>
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
                  {new Date(v.publishedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 업로드
                </span>
              </div>
            </div>
          );
        })()}
      </div>
    </section>
  );
}


interface Props {
  year: number;
  validYears: number[];
  stats: RewindStats;
  monthlyData: MonthData[];
  top10: Video[];
}

export default function RewindClient({ year, validYears, stats, monthlyData, top10 }: Props) {
  // 현재 연도면 경과 일수, 과거 연도면 윤년 여부 반영한 연간 일수
  const dayCount = (() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    if (year < currentYear) {
      return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
    }
    const start = new Date(year, 0, 1);
    return Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
  })();
  const [statsRef, statsInView] = useInView(0.2);
  const [monthRef, monthInView] = useInView(0.05);
  const [top10Ref, top10InView] = useInView(0.05);
  const [endRef, endInView]     = useInView(0.2);
  const [lightMode, setLightMode] = useState(false);

  return (
    <div data-rw={lightMode ? 'light' : 'dark'} style={{ background: 'var(--rw-bg)', color: 'var(--rw-text)', minHeight: '100vh', fontFamily: 'system-ui,-apple-system,sans-serif', overflowX: 'hidden', transition: 'background 0.3s, color 0.3s' }}>
      <style>{`
        [data-rw="dark"] {
          --rw-bg: #0b0b0b; --rw-bg2: #111; --rw-bg3: rgba(255,255,255,0.03); --rw-bg4: rgba(255,255,255,0.06);
          --rw-border: rgba(255,255,255,0.08); --rw-border2: rgba(255,255,255,0.14);
          --rw-text: #fff; --rw-text2: rgba(255,255,255,0.65); --rw-text3: rgba(255,255,255,0.38); --rw-text4: rgba(255,255,255,0.22);
          --rw-card: rgba(255,255,255,0.04); --rw-thumb: #0a0a0a;
        }
        [data-rw="light"] {
          --rw-bg: #f5f3ee; --rw-bg2: #e8e5dd; --rw-bg3: rgba(18,18,16,0.06); --rw-bg4: rgba(18,18,16,0.1);
          --rw-border: rgba(18,18,16,0.18); --rw-border2: rgba(18,18,16,0.32);
          --rw-text: #121210; --rw-text2: rgba(18,18,16,0.72); --rw-text3: rgba(18,18,16,0.5); --rw-text4: rgba(18,18,16,0.32);
          --rw-card: rgba(18,18,16,0.06); --rw-thumb: #d8d5cc;
          --rw-nav-bg: rgba(255,252,246,0.96); --rw-nav-border: rgba(18,18,16,0.14);
          --rw-btn-bg: rgba(18,18,16,0.08); --rw-btn-border: rgba(18,18,16,0.22); --rw-btn-color: #121210;
        }
        [data-rw="light"] section { border-color: rgba(18,18,16,0.14) !important; }
        @keyframes rwFadeUp   { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
        @keyframes rwScale    { from { opacity:0; transform:scale(0.82); } to { opacity:1; transform:scale(1); } }
        @keyframes rwGlow     { 0%,100%{filter:drop-shadow(0 0 32px rgba(235,112,26,0.45));} 50%{filter:drop-shadow(0 0 72px rgba(235,112,26,0.85));} }
        @keyframes rwBounce   { 0%,100%{transform:translateY(0);} 50%{transform:translateY(8px);} }
        @keyframes rwHeartbeat{ 0%,100%{transform:scale(1);} 30%{transform:scale(1.18);} 60%{transform:scale(1.05);} }
        @keyframes rwHotPulse { 0%,100%{box-shadow:0 0 0 2px rgba(0,201,255,0.35),0 0 16px rgba(0,201,255,0.2);} 50%{box-shadow:0 0 0 3px rgba(0,201,255,0.6),0 0 28px rgba(0,201,255,0.4);} }
        @keyframes rwHotShimmer { 0%{background-position:-200% 0;} 100%{background-position:200% 0;} }
      `}</style>

      {/* ───────────────── ① 오프닝 ───────────────── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden', paddingTop: '72px',
        background: `radial-gradient(ellipse 80% 55% at 50% 50%, rgba(235,112,26,0.14) 0%, transparent 70%)`,
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(235,112,26,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(235,112,26,0.04) 1px,transparent 1px)', backgroundSize: '64px 64px', pointerEvents: 'none' }} />

        {/* 상단 바: 홈 + 연도 네비 */}
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px clamp(1.2rem,4vw,3rem)', zIndex: 100, flexWrap: 'wrap' as const, gap: '12px', background: lightMode ? 'var(--rw-nav-bg)' : 'rgba(11,11,11,0.88)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: lightMode ? '1px solid var(--rw-nav-border)' : '1px solid rgba(255,255,255,0.07)' }}>
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
                background: 'var(--rw-btn-bg)',
                border: '1px solid var(--rw-btn-border)',
                color: 'var(--rw-btn-color)',
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
                    background: isActive ? ORANGE : 'var(--rw-btn-bg)',
                    color: isActive ? '#fff' : 'var(--rw-text2)',
                    border: `1px solid ${isActive ? ORANGE : 'var(--rw-btn-border)'}`,
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
                style={{ padding: '6px 14px', borderRadius: '100px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 700, color: 'var(--rw-text3)', background: 'var(--rw-bg4)', border: '1px solid var(--rw-border)', transition: 'all 0.18s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#fff'; (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.12)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.4)'; (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.06)'; }}
              >← {year - 1}</a>
            )}
            {validYears.indexOf(year) < validYears.length - 1 && (
              <a href={`/rewind/${year + 1}`}
                style={{ padding: '6px 14px', borderRadius: '100px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 700, color: 'var(--rw-text3)', background: 'var(--rw-bg4)', border: '1px solid var(--rw-border)', transition: 'all 0.18s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#fff'; (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.12)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.4)'; (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.06)'; }}
              >{year + 1} →</a>
            )}
          </div>

        </div>

      {/* 독립 fixed 테마 토글 */}
      <button
        onClick={() => setLightMode((m: boolean) => !m)}
        style={{
          position: 'fixed', top: '14px', right: 'clamp(1.2rem,4vw,3rem)',
          zIndex: 200,
          background: lightMode ? '#121210' : 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: lightMode ? '1px solid #121210' : '1px solid rgba(255,255,255,0.3)',
          color: '#fff',
          borderRadius: '100px', padding: '7px 16px',
          fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer',
          fontFamily: 'inherit', whiteSpace: 'nowrap' as const,
          transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', gap: '5px',
        }}
      >
        {lightMode ? '🌙 다크' : '☀️ 라이트'}
      </button>


        {/* 연도 + 카피 */}
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, padding: '0 2rem' }}>
          <div style={{ fontSize: 'clamp(6rem, 24vw, 17rem)', fontWeight: 900, letterSpacing: '-0.06em', lineHeight: 0.85, color: ORANGE, fontStyle: 'italic', animation: 'rwScale 0.85s cubic-bezier(0.22,1,0.36,1) both, rwGlow 3.5s 0.85s ease-in-out infinite' }}>
            {year}
          </div>
          <div style={{ fontSize: 'clamp(1rem, 2.8vw, 1.7rem)', fontWeight: 700, color: 'rgba(255,255,255,0.82)', marginTop: '20px', letterSpacing: '-0.02em', animation: 'rwFadeUp 0.7s 0.45s both' }}>
            {`스맵과 함께한 ${dayCount}일`}
          </div>

          {/* 배지 */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '28px', flexWrap: 'wrap' as const, animation: 'rwFadeUp 0.7s 0.65s both' }}>
            <span style={{ background: 'rgba(235,112,26,0.14)', border: '1px solid rgba(235,112,26,0.28)', color: ORANGE, padding: '6px 18px', borderRadius: '100px', fontSize: '0.92rem', fontWeight: 700 }}>
              유튜브 {stats.ytUploads}개 업로드
            </span>
            <span style={{ background: 'rgba(30,120,255,0.1)', border: '1px solid rgba(30,120,255,0.22)', color: '#60a8ff', padding: '6px 18px', borderRadius: '100px', fontSize: '0.92rem', fontWeight: 700 }}>
              SOOP {stats.soopBroadcasts}개 방송
            </span>
          </div>
        </div>

        {/* 스크롤 인디케이터 */}
        <div style={{ position: 'absolute', bottom: '44px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '8px', animation: 'rwFadeUp 1s 1.2s both' }}>
          <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>스크롤</span>
          <div style={{ color: 'var(--rw-text4)', fontSize: '1.1rem', animation: 'rwBounce 1.6s ease-in-out infinite' }}>↓</div>
        </div>
      </section>

      {/* ───────────────── ② 숫자로 보는 한 해 ───────────────── */}
      <section ref={statsRef as React.RefObject<HTMLElement>} style={{ padding: 'clamp(60px,10vw,100px) clamp(1.5rem,5vw,5rem)', borderTop: '1px solid var(--rw-border)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '48px', animation: statsInView ? 'rwFadeUp 0.6s both' : 'none' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: ORANGE, marginBottom: '8px' }}>Year in Numbers</p>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,3rem)', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--rw-text)', lineHeight: 1.1 }}>
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



          {/* ── 가장 바빴던 달 ── */}
          <div style={{ marginTop: '12px', padding: '18px 20px', background: 'var(--rw-bg3)', border: '1px solid var(--rw-border)', borderRadius: '16px', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: '16px', width: '100%', boxSizing: 'border-box' as const }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--rw-text3)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '4px' }}>가장 바빴던 달</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: ORANGE }}>{MONTH_KO[stats.peakMonth.month - 1]}</div>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--rw-text3)', lineHeight: 1.7 }}>
              <div><span style={{ color: '#ff6b6b' }}>YT</span> {stats.peakMonth.ytCount}개</div>
              <div><span style={{ color: '#60a8ff' }}>SOOP</span> {stats.peakMonth.soopCount}개</div>
            </div>
          </div>
        </div>
      </section>


      {/* ───────────────── ②-b 업로드 캘린더 ───────────────── */}
      <UploadCalendar monthlyData={monthlyData} year={year} />

      {/* ───────────────── ③ 월별 하이라이트 ───────────────── */}
      <section ref={monthRef as React.RefObject<HTMLElement>} style={{ padding: 'clamp(60px,10vw,100px) clamp(1.5rem,5vw,5rem)', borderTop: '1px solid var(--rw-border)', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
          <div style={{ marginBottom: '48px', animation: monthInView ? 'rwFadeUp 0.6s both' : 'none' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: ORANGE, marginBottom: '8px' }}>Monthly TOP 10</p>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,3rem)', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--rw-text)', lineHeight: 1.1 }}>
              월별 <em style={{ color: ORANGE, fontStyle: 'italic' }}>TOP 10</em>
            </h2>
            <p style={{ color: 'var(--rw-text3)', fontSize: '0.88rem', marginTop: '10px' }}>각 달의 최다 조회 영상 TOP 10 · 클릭하면 유튜브로 이동해요</p>
          </div>
          {monthInView && (
            <div style={{ display: 'flex', flexDirection: 'column' as const }}>
              {monthlyData.map((m, i) => <MonthRow key={m.key} data={m} idx={i} />)}
            </div>
          )}
        </div>
      </section>

      {/* ───────────────── ④ 올해의 TOP10 ───────────────── */}
      <section ref={top10Ref as React.RefObject<HTMLElement>} style={{ padding: 'clamp(60px,10vw,100px) clamp(1.5rem,5vw,5rem)', borderTop: '1px solid var(--rw-border)' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div style={{ marginBottom: '40px', animation: top10InView ? 'rwFadeUp 0.6s both' : 'none' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: ORANGE, marginBottom: '8px' }}>Annual TOP 10</p>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,3rem)', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--rw-text)', lineHeight: 1.1 }}>
              {year}년 <em style={{ color: ORANGE, fontStyle: 'italic' }}>TOP 10</em>
            </h2>
            <p style={{ color: 'var(--rw-text3)', fontSize: '0.88rem', marginTop: '10px' }}>연간 기준 최다 조회수 영상</p>
          </div>

          {top10InView && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'clamp(6px,1vw,12px)' }}>
              {top10.map((v, i) => {
                const isTop3 = i < 3;
                const TOP3_BORDER = ['#FFB800', '#A0A8B8', '#CD7F32'];
                const TOP3_GLOW   = ['rgba(255,184,0,0.5)', 'rgba(160,168,184,0.4)', 'rgba(205,127,50,0.4)'];
                const MEDAL = ['🥇','🥈','🥉'];
                return (
                  <div key={v.id}
                    onClick={() => window.open(`https://youtube.com/watch?v=${v.id}`, '_blank')}
                    style={{ cursor: 'pointer', animation: `rwFadeUp 0.4s ${i * 0.055}s both` }}
                  >
                    <div style={{
                      borderRadius: 'clamp(8px,1vw,12px)', overflow: 'hidden',
                      width: '100%', aspectRatio: '16/9', position: 'relative', background: 'var(--rw-thumb)',
                      boxShadow: isTop3
                        ? `0 0 0 2px ${TOP3_BORDER[i]}, 0 4px 16px ${TOP3_GLOW[i]}`
                        : 'none',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                    }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
                    >
                      <img src={v.thumbnail} alt={v.title}
                        style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)' }} />
                      {/* 순위 뱃지 */}
                      <div style={{
                        position:'absolute', top:'6px', left:'7px',
                        fontSize: isTop3 ? '0.78rem' : '0.68rem',
                        fontWeight:900, color: i === 1 ? '#1A1A1A' : '#fff',
                        background: isTop3 ? TOP3_BORDER[i] : 'rgba(0,0,0,0.55)',
                        padding: isTop3 ? '3px 7px' : '2px 6px',
                        borderRadius:'5px', letterSpacing:'-0.02em', lineHeight:1,
                      }}>
                        {isTop3 ? `${MEDAL[i]} ${i+1}` : `#${i+1}`}
                      </div>
                      {/* 조회수 + 제목 */}
                      <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'8px 10px' }}>
                        <p style={{
                          fontSize:'0.74rem', fontWeight:600, color:'rgba(255,255,255,0.92)',
                          lineHeight:1.35, margin:'0 0 3px',
                          display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
                        } as React.CSSProperties}>{v.title}</p>
                        <span style={{ fontSize:'0.65rem', fontWeight:800, color:ORANGE }}>{fmt(v.views)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {top10.length === 0 && (
                <div style={{ gridColumn: '1/-1', padding: '60px', textAlign: 'center', color: 'var(--rw-text3)', fontSize: '0.9rem' }}>데이터를 불러오는 중이에요</div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ───────────────── ⑦ 엔딩 카드 ───────────────── */}
      <section ref={endRef as React.RefObject<HTMLElement>} style={{
        minHeight: '80vh',
        display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
        borderTop: '1px solid var(--rw-border)',
        background: `radial-gradient(ellipse 65% 55% at 50% 100%, rgba(235,112,26,0.16) 0%, transparent 70%)`,
        padding: 'clamp(60px,10vw,100px) clamp(1.5rem,5vw,5rem)',
        textAlign: 'center' as const,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(235,112,26,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(235,112,26,0.03) 1px,transparent 1px)', backgroundSize: '64px 64px', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, animation: endInView ? 'rwFadeUp 0.8s both' : 'none' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '20px', display: 'inline-block', animation: endInView ? 'rwHeartbeat 1.8s 0.5s ease-in-out infinite' : 'none' }}>🧡</div>

          <h2 style={{ fontSize: 'clamp(2.2rem,7vw,5rem)', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--rw-text)', lineHeight: 1.1, marginBottom: '20px' }}>
            {year}년도<br />
            <em style={{ color: ORANGE, fontStyle: 'italic' }}>고마웠어요</em>
          </h2>

          <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.42)', maxWidth: '380px', lineHeight: 1.75, marginBottom: '52px' }}>
            스맵과 함께한 {year}년 {dayCount}일,<br />
            모든 순간이 이 아카이브에 담겼어요.<br />
            {validYears.includes(year + 1) ? `${year + 1}년에도 함께해요.` : '앞으로도 함께해요.'}
          </p>

          {/* 버튼 */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' as const }}>
            <a href="/"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: ORANGE, color: 'var(--rw-text)', padding: '14px 30px', borderRadius: '100px', textDecoration: 'none', fontWeight: 700, fontSize: '0.92rem', transition: 'opacity 0.2s, transform 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity='0.88'; (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity='1'; (e.currentTarget as HTMLElement).style.transform='none'; }}
            >← 스맵 아카이브 홈</a>
            <a href="https://www.sooplive.com/townboy" target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--rw-bg4)', color: 'var(--rw-text)', padding: '14px 30px', borderRadius: '100px', textDecoration: 'none', fontWeight: 700, fontSize: '0.92rem', border: '1px solid var(--rw-border)', transition: 'background 0.2s, transform 0.2s' }}
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
          border: '1px solid var(--rw-border2)',
          backdropFilter: 'blur(16px)',
          color: 'var(--rw-text)', padding: '10px 18px', borderRadius: '100px',
          textDecoration: 'none', fontSize: '0.92rem', fontWeight: 700,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          transition: 'all 0.2s',
          whiteSpace: 'nowrap' as const,
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = ORANGE;
          el.style.borderColor = ORANGE;
          el.style.boxShadow = '0 8px 32px rgba(235,112,26,0.45)';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = 'rgba(15,15,15,0.85)';
          el.style.borderColor = 'rgba(255,255,255,0.15)';
          el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{flexShrink:0}}>
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
        스맵 아카이브
      </a>
    </div>
  );
}
