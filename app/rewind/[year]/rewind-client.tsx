'use client'; // build:1785597211
import { useState, useEffect, useRef, Fragment } from 'react';
import type { Video, MonthData, RewindStats } from './page';

const ORANGE = '#EB701A';
const DARK   = '#0b0b0b';
const COMP   = '#00C9FF'; // 오렌지 보색: 전기 청록
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

// ── 정보 툴팁 아이콘 ──
function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '14px', height: '14px', borderRadius: '50%',
        border: '1px solid var(--rw-text3)', color: 'var(--rw-text3)',
        fontSize: '0.62rem', fontWeight: 700, fontStyle: 'italic' as const,
      }}>i</span>
      {open && (
        <span style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--rw-text)', color: 'var(--rw-bg)',
          fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.4,
          padding: '8px 12px', borderRadius: '10px', width: 'max-content', maxWidth: '200px',
          textAlign: 'center' as const, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', zIndex: 20,
          whiteSpace: 'normal' as const,
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

// ── 통계 카드 ──
function StatCard({ value, label, suffix = '', delay = 0, active, subText, tip }: {
  value: number; label: string; suffix?: string; delay?: number; active: boolean; subText?: string; tip?: string;
}) {
  const [go, setGo] = useState(false);
  useEffect(() => { if (active) { const t = setTimeout(() => setGo(true), delay); return () => clearTimeout(t); } }, [active, delay]);
  const count = useCountUp(value, 2400, go);
  const noData = value === 0;
  return (
    <div style={{ textAlign: 'center', padding: '24px 16px', background: 'rgba(235,112,26,0.07)', border: '1px solid rgba(235,112,26,0.13)', borderRadius: '20px', flex: 1, minWidth: '140px', overflow: 'hidden' }}>
      <div style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)', fontWeight: 900, letterSpacing: '-0.03em', color: ORANGE, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' as const, overflow: 'hidden', wordBreak: 'break-all' as const }}>
        {noData ? '-' : `${fmt(count)}${suffix}`}
      </div>
      {subText && (
        <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px',
          background: 'rgba(235,112,26,0.1)', border: '1px solid rgba(235,112,26,0.2)',
          borderRadius: '100px', padding: '2px 10px',
        }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--rw-text3)' }}>≈</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--rw-text2)' }}>{subText}</span>
        </div>
      )}
      <div style={{ fontSize: '0.8rem', color: 'var(--rw-text2)', marginTop: '8px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
        {label}
        {tip && <InfoTip text={tip} />}
      </div>
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


function UploadCalendar({ monthlyData, year, defaultMonth }: { monthlyData: MonthData[]; year: number; defaultMonth?: number | null }) {
  const firstMonth = monthlyData.find(m => m.topVideos.length > 0)?.month ?? null;
  const initialMonth = (defaultMonth != null && monthlyData.some(m => m.month === defaultMonth && m.topVideos.length > 0))
    ? defaultMonth
    : firstMonth;
  const [activeMonth, setActiveMonth] = useState<number | null>(initialMonth);
  const [dir, setDir] = useState<1 | -1>(1);
  // 1) 타임라인 제거 - 그리드(전체 보기) / 리스트(텍스트) 두 가지 보기 모드만 남김, 기본은 그리드
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  // 9) 타임라인이 사라지고 그리드가 메인 뷰가 되므로, 날짜순/조회수순 정렬 기준을 직접 선택 가능하게
  const [sortMode, setSortMode] = useState<'date' | 'views'>('date');
  const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const fmt = (n: number) => n >= 10000 ? (n / 10000).toFixed(1) + '만' : n.toLocaleString();

  function tier(ratio: number) {
    if (ratio > 0.7) return { dot: '#FFB800', stem: '#FFB800', border: 'rgba(255,184,0,0.55)', card: 'rgba(255,184,0,0.06)' };
    if (ratio > 0.35) return { dot: ORANGE, stem: ORANGE, border: 'rgba(235,112,26,0.45)', card: 'rgba(235,112,26,0.05)' };
    return { dot: 'rgba(255,255,255,0.5)', stem: 'rgba(255,255,255,0.15)', border: 'rgba(255,255,255,0.22)', card: 'rgba(255,255,255,0.05)' };
  }

  const activeData = monthlyData.find(m => m.month === activeMonth);
  const monthsWithVideos = monthlyData.filter(m => m.topVideos.length > 0).map(m => m.month);
  const activeIdx = activeMonth != null ? monthsWithVideos.indexOf(activeMonth) : -1;
  const goToMonth = (m: number, direction: 1 | -1) => { setDir(direction); setActiveMonth(m); };
  const goPrevMonth = () => { if (activeIdx > 0) goToMonth(monthsWithVideos[activeIdx - 1], -1); };
  const goNextMonth = () => { if (activeIdx !== -1 && activeIdx < monthsWithVideos.length - 1) goToMonth(monthsWithVideos[activeIdx + 1], 1); };

  return (
    <section style={{ padding: 'clamp(48px,8vw,80px) clamp(1.5rem,5vw,5rem)', borderTop: '1px solid var(--rw-border)', background: 'var(--rw-bg3)' }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
        <style>{`
          .tl-card { transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1); cursor: pointer; position: relative; }
          .tl-card:hover { transform: scale(1.05) !important; z-index: 30 !important; box-shadow: 0 10px 28px rgba(0,0,0,0.55) !important; }
          /* 10) 클릭 시 살짝 눌리는 느낌으로 클릭 반응성 표시 */
          .tl-card:active { transform: scale(0.97) !important; }
          /* 카드를 호버하면 날짜 배지만 살짝 확대/강조되어 날짜 확인을 유도 */
          .tl-card:hover .date-badge { transform: scale(1.18); filter: brightness(1.15); }
          /* 6) 카드는 고정한 채 썸네일 이미지만 살짝 확대되는 켄번즈 느낌의 모션 */
          .thumb-img { transition: transform 0.4s ease; }
          .tl-card:hover .thumb-img { transform: scale(1.08); }
          /* 8) 인기도 바가 로드 시 0%에서 실제 값까지 차오르는 애니메이션 */
          @keyframes growBar { from { width: 0; } to { width: var(--bar-w); } }
          .bar-fill { animation: growBar 0.7s cubic-bezier(0.22,1,0.36,1) both; }
          /* 9) 가장 최근 날짜 배지에만 은은한 펄스 효과로 최신임을 강조 */
          @keyframes badgePulse { 0%,100% { box-shadow: 0 0 0 0 rgba(235,112,26,0.55); } 50% { box-shadow: 0 0 0 5px rgba(235,112,26,0); } }
          .badge-latest { animation: badgePulse 1.8s ease-out infinite; }
        `}</style>

        {/* 헤더 */}
        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: ORANGE, marginBottom: '8px' }}>Upload Calendar</p>
          <h2 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.6rem)', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1.1, marginBottom: '6px' }}>
            {year}년 <em style={{ color: ORANGE, fontStyle: 'italic' }}>업로드 캘린더</em>
          </h2>
        </div>

        {/* 타임라인 */}
        {activeData && (
          <div key={activeMonth} className={dir === 1 ? 'cal-slide-next' : 'cal-slide-prev'} style={{ background: 'var(--rw-bg3)', border: '1px solid var(--rw-border)', borderRadius: '20px', padding: '20px 0 24px' }}>

            {/* 헤더 */}
            <div style={{ padding: '0 28px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 700, color: ORANGE }}>
                  {MONTH_KO[activeData.month - 1]} · {activeData.ytCount}개 업로드
                  {activeData.ytCount > activeData.topVideos.length && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--rw-text3)', marginLeft: '6px' }}>
                      (조회수 상위 {activeData.topVideos.length}개 표시)
                    </span>
                  )}
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                  {/* 카드 자체의 티어 색상(tier() 함수)과 동일한 색으로 맞춰서, 범례를 보고 바로 카드에서 같은 색을 찾을 수 있게 함 */}
                  {[
                    { label: '상위 30%', color: '#FFB800',              bg: 'rgba(255,184,0,0.12)',   border: 'rgba(255,184,0,0.4)',   dot: 11, glow: true },
                    { label: '중간',     color: ORANGE,                    bg: 'rgba(235,112,26,0.1)',   border: 'rgba(235,112,26,0.35)', dot: 9,  glow: false },
                    { label: '하위',     color: 'rgba(255,255,255,0.7)',  bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.22)', dot: 7, glow: false },
                  ].map((t, i) => (
                    <div key={i} style={{
                      background: t.bg,
                      border: `1px solid ${t.border}`,
                      borderRadius: '7px',
                      padding: '4px 10px',
                      display: 'flex', alignItems: 'center', gap: '5px',
                    }}>
                      <div style={{
                        width: `${t.dot}px`, height: `${t.dot}px`,
                        borderRadius: '50%', background: t.color, flexShrink: 0,
                        boxShadow: t.glow ? '0 0 6px rgba(255,184,0,0.55)' : 'none',
                      }} />
                      <span style={{ fontSize: '0.7rem', fontWeight: i === 0 ? 700 : 600, color: t.color, whiteSpace: 'nowrap' as const }}>
                        {t.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* 10) 아래 타임라인 안쪽 스크롤 화살표(원형, 영상 단위 이동)와 헷갈리지 않도록,
                       이 달 단위 이동 버튼은 텍스트 라벨이 있는 알약 모양으로 구분 */}
                <button
                  onClick={goPrevMonth}
                  disabled={activeIdx <= 0}
                  title="이전 달로 이동"
                  style={{
                    height: '32px', padding: '0 12px', borderRadius: '100px',
                    background: 'var(--rw-bg4)', border: '1px solid var(--rw-border2)',
                    color: 'var(--rw-text2)', cursor: activeIdx > 0 ? 'pointer' : 'default',
                    fontSize: '0.76rem', fontWeight: 700, fontFamily: 'inherit',
                    opacity: activeIdx > 0 ? 1 : 0.3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', whiteSpace: 'nowrap' as const,
                  }}
                >‹ 이전 달</button>
                <button
                  onClick={goNextMonth}
                  disabled={activeIdx === -1 || activeIdx >= monthsWithVideos.length - 1}
                  title="다음 달로 이동"
                  style={{
                    height: '32px', padding: '0 12px', borderRadius: '100px',
                    background: 'var(--rw-bg4)', border: '1px solid var(--rw-border2)',
                    color: 'var(--rw-text2)', cursor: (activeIdx !== -1 && activeIdx < monthsWithVideos.length - 1) ? 'pointer' : 'default',
                    fontSize: '0.76rem', fontWeight: 700, fontFamily: 'inherit',
                    opacity: (activeIdx !== -1 && activeIdx < monthsWithVideos.length - 1) ? 1 : 0.3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', whiteSpace: 'nowrap' as const,
                  }}
                >다음 달 ›</button>
                {/* 1) 타임라인 제거 - 그리드(전체 보기)/리스트(텍스트) 두 가지 보기 전환만 남김 */}
                <div style={{ display: 'flex', background: 'var(--rw-bg4)', border: '1px solid var(--rw-border2)', borderRadius: '8px', padding: '2px', marginLeft: '4px' }}>
                  {/* 6) 이름만으로는 차이를 예측하기 어려워서 각 모드를 상징하는 아이콘을 이름 앞에 추가 */}
                  {([['grid', '▦', '전체 보기'], ['list', '☰', '리스트']] as const).map(([mode, icon, label]) => (
                    <button key={mode} onClick={() => setViewMode(mode)} title={label} style={{
                      padding: '4px 9px', borderRadius: '6px', border: 'none',
                      background: viewMode === mode ? ORANGE : 'transparent',
                      color: viewMode === mode ? '#1a1200' : 'var(--rw-text3)',
                      fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const,
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                    }}><span aria-hidden="true">{icon}</span>{label}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2) 전체 보기 - 화살표 없이 그 달 업로드 전체를 격자로 한눈에 스캔 (날짜순 배치) */}
            {viewMode === 'grid' && (() => {
              const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
              const maxV = Math.max(...activeData.topVideos.map(x => x.views), 1);
              // 9) 정렬 기준을 날짜순/조회수순 중에서 직접 선택 (기본은 날짜순)
              const sorted = sortMode === 'date'
                ? [...activeData.topVideos].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
                : [...activeData.topVideos].sort((a, b) => b.views - a.views);
              // 3) 같은 날짜는 같은 배지 색으로 - 등장 순서대로 고유 날짜에 색상을 순환 배정
              const DATE_PALETTE = ['#EB701A', '#00C9FF', '#FF6B9D', '#7ED957', '#B18CFF', '#FFD93D'];
              const dateKeyOf = (v: typeof sorted[number]) => {
                const dd = new Date(v.publishedAt);
                return `${dd.getMonth() + 1}/${dd.getDate()}`;
              };
              const uniqueDateKeys: string[] = [];
              for (const v of [...activeData.topVideos].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())) {
                const k = dateKeyOf(v);
                if (!uniqueDateKeys.includes(k)) uniqueDateKeys.push(k);
              }
              const dateColorOf = (v: typeof sorted[number]) => DATE_PALETTE[uniqueDateKeys.indexOf(dateKeyOf(v)) % DATE_PALETTE.length];
              // 5) 가장 최근 날짜는 배지를 브랜드 오렌지로 강조
              const latestDateKey = uniqueDateKeys[uniqueDateKeys.length - 1];
              return (
                <div style={{ padding: '4px 28px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: '8px', marginBottom: '14px' }}>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--rw-text3)' }}>
                      {sortMode === 'date' ? '📅 업로드 날짜순으로 배치했어요 (오래된 순)' : '🔥 조회수 높은 순으로 배치했어요'}
                    </p>
                    {/* 9) 정렬 기준 토글 */}
                    <div style={{ display: 'flex', background: 'var(--rw-bg4)', border: '1px solid var(--rw-border2)', borderRadius: '7px', padding: '2px' }}>
                      {([['date', '날짜순'], ['views', '조회수순']] as const).map(([mode, label]) => (
                        <button key={mode} onClick={() => setSortMode(mode)} style={{
                          padding: '3px 8px', borderRadius: '5px', border: 'none',
                          background: sortMode === mode ? ORANGE : 'transparent',
                          color: sortMode === mode ? '#1a1200' : 'var(--rw-text3)',
                          fontSize: '0.66rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const,
                        }}>{label}</button>
                      ))}
                    </div>
                  </div>
                  {/* 한 줄에 항상 4개씩 고정 - 날짜별로 줄바꿈을 강제하지 않아 스크롤 길이를 줄이고,
                         같은 날짜인지는 카드 왼쪽 색 바 + 카드 안 날짜/요일 표기로 충분히 구분되게 함 */}
                  <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                      {sorted.map((v, i) => {
                        const ratio = v.views / maxV;
                        const t = tier(ratio);
                        const barPct = Math.max(4, Math.round(ratio * 100));
                        const d = new Date(v.publishedAt);
                        const dKey = dateKeyOf(v);
                        const dColor = dKey === latestDateKey ? ORANGE : dateColorOf(v);
                        // 8) 날짜순 정렬일 땐 날짜가 더 중요한 정보이므로 좌상단(눈에 잘 띄는 자리)에,
                        //    조회수순 정렬일 땐 순번이 더 중요하므로 순번을 좌상단에 두고 날짜는 좌하단으로
                        const dateBadgeTop = sortMode === 'date';
                        const isLatestDate = dKey === latestDateKey;
                        return (
                          <Fragment key={v.id}>
                            <div onClick={() => window.open(`https://youtube.com/watch?v=${v.id}`, '_blank')} className="tl-card" style={{
                              background: t.card, border: `1px solid ${t.border}`, borderRadius: '10px', overflow: 'hidden',
                              borderLeft: sortMode === 'date' ? `3px solid ${t.border}` : `1px solid ${t.border}`,
                              // 7) 카드가 순서대로 살짝 아래에서 올라오며 나타나는 등장 애니메이션
                              animation: `rwFadeUp 0.4s ${Math.min(i, 12) * 0.035}s both`,
                            }}>
                              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#0a0a0a', overflow: 'hidden' }}>
                                <img src={v.thumbnail} alt={v.title} className="thumb-img" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                {/* 상/하단 그라디언트로 코너 배지들이 어떤 썸네일 위에서도 잘 보이게 */}
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 45%), linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 30%)' }} />
                                {/* 1)+2)+3)+4)+9) 날짜 배지 - 하단 날짜 텍스트를 없앤 만큼 크게 키우고 완전 불투명 배경 + 그림자, 요일까지 함께 표기,
                                       같은 날짜는 같은 색, 가장 최근 날짜는 오렌지 + 펄스로 강조 */}
                                <span
                                  className={`date-badge${isLatestDate ? ' badge-latest' : ''}`}
                                  title={`${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()} (${WEEKDAY_KO[d.getDay()]})`}
                                  style={{
                                    position: 'absolute', left: '6px', [dateBadgeTop ? 'top' : 'bottom']: '6px',
                                    background: '#151515', border: `1.5px solid ${dColor}`, color: dColor,
                                    fontSize: '0.72rem', fontWeight: 900, padding: '2px 7px', borderRadius: '5px',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.5)', transition: 'transform 0.15s',
                                  } as React.CSSProperties}
                                >{d.getMonth() + 1}/{d.getDate()} {WEEKDAY_KO[d.getDay()]}</span>
                                {/* 업로드 순번 배지 */}
                                <span style={{
                                  position: 'absolute', left: '6px', [dateBadgeTop ? 'bottom' : 'top']: '6px', background: 'rgba(0,0,0,0.6)',
                                  border: '1px solid rgba(255,255,255,0.35)', color: '#fff', fontSize: '0.58rem', fontWeight: 800,
                                  padding: '1px 5px', borderRadius: '4px',
                                } as React.CSSProperties}>#{i + 1}</span>
                                {ratio > 0.7 && (
                                  <span style={{ position: 'absolute', top: '6px', right: '6px', background: '#FFB800', color: '#1a1200', fontSize: '0.56rem', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>TOP</span>
                                )}
                                <div title={`${v.views.toLocaleString('ko-KR')}회`} style={{ position: 'absolute', bottom: '5px', right: '6px', fontSize: '0.62rem', fontWeight: 900, color: t.dot }}>👁 {fmt(v.views)}</div>
                              </div>
                              <div style={{ padding: '9px 10px 10px' }}>
                                {/* 5) 하단 날짜 텍스트 삭제로 생긴 공간만큼 제목을 더 크고 굵게, 줄간격도 살짝 좁혀 가독성 강화 */}
                                <p title={v.title} style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.94)', lineHeight: 1.3, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{v.title}</p>
                                {/* 8) 인기도 바 - 로드 시 0%에서 실제 값까지 차오르는 애니메이션 */}
                                <div style={{ marginTop: '8px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                                  <div className="bar-fill" style={{ '--bar-w': `${barPct}%`, width: `${barPct}%`, height: '100%', background: t.dot, borderRadius: '2px' } as React.CSSProperties} />
                                </div>
                              </div>
                            </div>
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 10) 리스트 보기 - 그리드와 동일한 날짜 배지 스타일(색상 캡슐)을 적용해 뷰 전환 시 이질감 없게 */}
            {viewMode === 'list' && (() => {
              const listSorted = [...activeData.topVideos].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
              const DATE_PALETTE = ['#EB701A', '#00C9FF', '#FF6B9D', '#7ED957', '#B18CFF', '#FFD93D'];
              const dateKeyOf = (v: typeof listSorted[number]) => {
                const dd = new Date(v.publishedAt);
                return `${dd.getMonth() + 1}/${dd.getDate()}`;
              };
              const uniqueDateKeys: string[] = [];
              for (const v of listSorted) {
                const k = dateKeyOf(v);
                if (!uniqueDateKeys.includes(k)) uniqueDateKeys.push(k);
              }
              const latestDateKey = uniqueDateKeys[uniqueDateKeys.length - 1];
              const dateColorOf = (v: typeof listSorted[number]) => {
                const k = dateKeyOf(v);
                return k === latestDateKey ? ORANGE : DATE_PALETTE[uniqueDateKeys.indexOf(k) % DATE_PALETTE.length];
              };
              return (
                <div style={{ padding: '4px 28px 8px', display: 'flex', flexDirection: 'column' as const, gap: '2px' }}>
                  {listSorted.map(v => {
                    const maxV = Math.max(...activeData.topVideos.map(x => x.views), 1);
                    const t = tier(v.views / maxV);
                    const dColor = dateColorOf(v);
                    const d = new Date(v.publishedAt);
                    return (
                      <div key={v.id} onClick={() => window.open(`https://youtube.com/watch?v=${v.id}`, '_blank')} style={{
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 10px', borderRadius: '8px',
                        cursor: 'pointer', borderLeft: `3px solid ${t.dot}`, background: 'rgba(255,255,255,0.02)',
                      }}>
                        <span style={{
                          flexShrink: 0, fontSize: '0.66rem', fontWeight: 800, color: dColor,
                          background: `${dColor}1a`, border: `1px solid ${dColor}`, borderRadius: '100px',
                          padding: '2px 8px', textAlign: 'center' as const,
                        }}>{d.getMonth() + 1}/{d.getDate()}</span>
                        <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{v.title}</p>
                        <span title={`${v.views.toLocaleString('ko-KR')}회`} style={{ fontSize: '0.76rem', fontWeight: 800, color: t.dot, flexShrink: 0 }}>👁 {fmt(v.views)}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

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
  const [top10Ref, top10InView] = useInView(0.05);
  const [endRef, endInView]     = useInView(0.2);
  const [openRef, openInView]   = useInView(0.3);
  const [calRef, calInView]     = useInView(0.15);
  const [lightMode, setLightMode] = useState(false);

  // ── 섹션 진행 인디케이터 ──
  const SECTIONS = [
    { key: 'open',  label: '인트로',    inView: openInView,  ref: openRef },
    { key: 'stats', label: '숫자',      inView: statsInView, ref: statsRef },
    { key: 'cal',   label: '캘린더',    inView: calInView,   ref: calRef },
    { key: 'top10', label: 'TOP 10',    inView: top10InView, ref: top10Ref },
    { key: 'end',   label: '엔딩',      inView: endInView,   ref: endRef },
  ] as const;
  const activeSectionIdx = (() => {
    for (let i = SECTIONS.length - 1; i >= 0; i--) if (SECTIONS[i].inView) return i;
    return 0;
  })();
  const scrollToSection = (idx: number) => {
    const el = (SECTIONS[idx].ref as React.RefObject<HTMLElement>).current;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div data-rw={lightMode ? 'light' : 'dark'} style={{ background: 'var(--rw-bg)', color: 'var(--rw-text)', minHeight: '100vh', fontFamily: "'Pretendard', system-ui, -apple-system, sans-serif", overflowX: 'hidden', transition: 'background 0.3s, color 0.3s' }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
        [data-rw="dark"] {
          --rw-bg: #0b0b0b; --rw-bg2: #111; --rw-bg3: rgba(255,255,255,0.03); --rw-bg4: rgba(255,255,255,0.06);
          --rw-border: rgba(255,255,255,0.08); --rw-border2: rgba(255,255,255,0.14);
          --rw-text: #fff; --rw-text2: rgba(255,255,255,0.68); --rw-text3: rgba(255,255,255,0.5); --rw-text4: rgba(255,255,255,0.32);
          --rw-card: rgba(255,255,255,0.04); --rw-thumb: #0a0a0a;
        }
        [data-rw="light"] {
          --rw-bg: #f5f3ee; --rw-bg2: #e8e5dd; --rw-bg3: rgba(18,18,16,0.06); --rw-bg4: rgba(18,18,16,0.1);
          --rw-border: rgba(18,18,16,0.18); --rw-border2: rgba(18,18,16,0.32);
          --rw-text: #121210; --rw-text2: rgba(18,18,16,0.75); --rw-text3: rgba(18,18,16,0.6); --rw-text4: rgba(18,18,16,0.42);
          --rw-card: rgba(18,18,16,0.06); --rw-thumb: #d8d5cc;
          --rw-nav-bg: rgba(255,252,246,0.96); --rw-nav-border: rgba(18,18,16,0.14);
          --rw-btn-bg: rgba(18,18,16,0.08); --rw-btn-border: rgba(18,18,16,0.22); --rw-btn-color: #121210;
        }
        [data-rw="light"] section { border-color: rgba(18,18,16,0.14) !important; }
        @keyframes rwFadeUp   { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
        @keyframes rwScale    { from { opacity:0; transform:scale(0.82); } to { opacity:1; transform:scale(1); } }
        @keyframes rwGlow     { 0%,100%{filter:drop-shadow(0 0 32px rgba(255,255,255,0.5)) drop-shadow(0 0 70px rgba(255,210,140,0.4));} 50%{filter:drop-shadow(0 0 60px rgba(255,255,255,0.9)) drop-shadow(0 0 120px rgba(255,210,140,0.65));} }
        @keyframes rwBounce   { 0%,100%{transform:translateY(0);} 50%{transform:translateY(8px);} }
        @keyframes rwHeartbeat{ 0%,100%{transform:scale(1);} 30%{transform:scale(1.18);} 60%{transform:scale(1.05);} }
        @keyframes rwHotPulse { 0%,100%{box-shadow:0 0 0 2px rgba(0,201,255,0.35),0 0 16px rgba(0,201,255,0.2);} 50%{box-shadow:0 0 0 3px rgba(0,201,255,0.6),0 0 28px rgba(0,201,255,0.4);} }
        @keyframes rwHotShimmer { 0%{background-position:-200% 0;} 100%{background-position:200% 0;} }
      `}</style>

      {/* ───────────────── ① 오프닝 ───────────────── */}
      <section ref={openRef as React.RefObject<HTMLElement>} style={{
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' as const }}>
            <span style={{
              fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em',
              color: 'var(--rw-text3)', background: 'var(--rw-bg3)',
              border: '1px solid var(--rw-border)', borderRadius: '100px',
              padding: '4px 10px', whiteSpace: 'nowrap' as const, flexShrink: 0,
            }}>연간 리포트</span>
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
          <div style={{ fontSize: 'clamp(6rem, 24vw, 17rem)', fontWeight: 900, letterSpacing: '-0.06em', lineHeight: 0.85, color: '#fff', fontStyle: 'italic', animation: 'rwScale 0.85s cubic-bezier(0.22,1,0.36,1) both, rwGlow 3.5s 0.85s ease-in-out infinite' }}>
            {year}
          </div>
          <div style={{ fontSize: 'clamp(1rem, 2.8vw, 1.7rem)', fontWeight: 700, color: 'var(--rw-text)', marginTop: '20px', letterSpacing: '-0.02em', animation: 'rwFadeUp 0.7s 0.45s both' }}>
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
          <span style={{ fontSize: '0.68rem', color: 'var(--rw-text4)', letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>스크롤</span>
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
              <StatCard value={stats.ytUploads}  label="업로드 영상 수"    suffix="개" delay={0}   active={statsInView} tip="이 해에 유튜브에 올라온 영상 개수예요" />
              <StatCard value={stats.totalViews} label="총 조회수"          suffix="회" delay={150} active={statsInView} tip="이 해에 올라온 모든 영상 조회수의 합이에요" />
              <StatCard value={stats.avgViews}   label="영상당 평균 조회수" suffix="회" delay={300} active={statsInView} tip="총 조회수 ÷ 업로드 영상 수로 계산해요" />
            </div>
          </div>



          {/* ── 가장 바빴던 달 ── */}
          <div style={{ marginTop: '12px', padding: '18px 20px', background: 'var(--rw-bg3)', border: '1px solid var(--rw-border)', borderRadius: '16px', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '20px', width: '100%', boxSizing: 'border-box' as const, flexWrap: 'wrap' as const }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--rw-text3)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '4px' }}>가장 바빴던 달</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: ORANGE }}>{MONTH_KO[stats.peakMonth.month - 1]}</div>
              </div>
              <InfoTip text="유튜브 업로드와 SOOP 방송을 합쳐 가장 많았던 달이에요" />
            </div>
            {(() => {
              const yt = stats.peakMonth.ytCount, soop = stats.peakMonth.soopCount;
              const maxV = Math.max(yt, soop, 1);
              return (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '7px', flex: 1, minWidth: '140px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ff6b6b', width: '38px', flexShrink: 0 }}>YT</span>
                    <div style={{ flex: 1, height: '8px', borderRadius: '5px', background: 'var(--rw-bg4)', overflow: 'hidden' }}>
                      <div style={{ width: `${(yt / maxV) * 100}%`, height: '100%', background: '#ff6b6b', borderRadius: '5px', transition: 'width 0.6s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--rw-text3)', width: '38px', textAlign: 'right' as const, flexShrink: 0 }}>{yt}개</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#60a8ff', width: '38px', flexShrink: 0 }}>SOOP</span>
                    <div style={{ flex: 1, height: '8px', borderRadius: '5px', background: 'var(--rw-bg4)', overflow: 'hidden' }}>
                      <div style={{ width: `${(soop / maxV) * 100}%`, height: '100%', background: '#60a8ff', borderRadius: '5px', transition: 'width 0.6s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--rw-text3)', width: '38px', textAlign: 'right' as const, flexShrink: 0 }}>{soop}개</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </section>
      {/* ───────────────── ③ 업로드 캘린더 ───────────────── */}
      <div ref={calRef as React.RefObject<HTMLDivElement>}>
        <UploadCalendar monthlyData={monthlyData} year={year} defaultMonth={stats.peakMonth.month} />
      </div>

      {/* 섹션 진행 인디케이터 */}
      <div style={{
        position: 'fixed', right: '18px', top: '50%', transform: 'translateY(-50%)', zIndex: 150,
        display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '10px',
      }}>
        {SECTIONS.map((s, i) => (
          <button key={s.key} onClick={() => scrollToSection(i)} aria-label={s.label}
            title={s.label}
            style={{
              width: i === activeSectionIdx ? '10px' : '7px',
              height: i === activeSectionIdx ? '10px' : '7px',
              borderRadius: '50%', padding: 0, cursor: 'pointer',
              background: i === activeSectionIdx ? ORANGE : 'var(--rw-text4)',
              border: 'none', transition: 'all 0.25s ease',
              boxShadow: i === activeSectionIdx ? '0 0 10px rgba(235,112,26,0.6)' : 'none',
            }}
          />
        ))}
      </div>



      {/* ───────────────── ④ 올해의 TOP10 ───────────────── */}
      <section ref={top10Ref as React.RefObject<HTMLElement>} style={{ padding: 'clamp(60px,10vw,100px) clamp(1.5rem,5vw,3rem)', borderTop: '1px solid var(--rw-border)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '40px', animation: top10InView ? 'rwFadeUp 0.6s both' : 'none' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: ORANGE, marginBottom: '8px' }}>Annual TOP 10</p>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,3rem)', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--rw-text)', lineHeight: 1.1 }}>
              {year}년 <em style={{ color: ORANGE, fontStyle: 'italic' }}>TOP 10</em>
            </h2>
            <p style={{ color: 'var(--rw-text3)', fontSize: '0.88rem', marginTop: '10px' }}>연간 기준 최다 조회수 영상</p>
          </div>

          {top10InView && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'clamp(8px,1.2vw,16px)' }}>
              {(() => {
                const maxViews = Math.max(1, ...top10.map(v => v.views));
                return top10.map((v, i) => {
                const isTop3 = i < 3;
                const TOP3_BG = ['#FFB800', '#C0C0C0', '#CD7F32'];
                const TOP3_GLOW = ['rgba(255,184,0,0.5)', 'rgba(192,192,192,0.45)', 'rgba(205,127,50,0.4)'];
                const barPct = Math.max(4, Math.round((v.views / maxViews) * 100));
                return (
                  <div key={v.id}
                    onClick={() => window.open(`https://youtube.com/watch?v=${v.id}`, '_blank')}
                    style={{ cursor: 'pointer', animation: `rwFadeUp 0.4s ${i * 0.055}s both` }}
                  >
                    <div style={{
                      borderRadius: 'clamp(8px,1vw,12px)', overflow: 'hidden',
                      width: '100%', aspectRatio: '16/9', position: 'relative', background: 'var(--rw-thumb)',
                      boxShadow: isTop3
                        ? `0 0 0 2px ${TOP3_BG[i]}, 0 4px 16px ${TOP3_GLOW[i]}`
                        : '0 0 0 1px var(--rw-border2)',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                    }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
                    >
                      <img src={v.thumbnail} alt={v.title}
                        style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.15) 62%, transparent 78%)' }} />
                      {/* 순위 뱃지 — 모든 순위 동일한 원형 배지 스타일 */}
                      <div style={{
                        position:'absolute', top:'7px', left:'7px',
                        width: isTop3 ? '26px' : '22px', height: isTop3 ? '26px' : '22px',
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: isTop3 ? '0.72rem' : '0.64rem',
                        fontWeight: 900, color: isTop3 ? '#1A1A1A' : '#fff',
                        background: isTop3 ? TOP3_BG[i] : 'rgba(0,0,0,0.6)',
                        border: isTop3 ? 'none' : '1px solid rgba(255,255,255,0.35)',
                        letterSpacing:'-0.02em', lineHeight:1, flexShrink: 0,
                      }}>
                        {i+1}
                      </div>
                      {/* 조회수 + 제목 */}
                      <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'8px 10px' }}>
                        <p style={{
                          fontSize:'0.74rem', fontWeight:600, color:'rgba(255,255,255,0.92)',
                          lineHeight:1.35, margin:'0 0 4px',
                          display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
                        } as React.CSSProperties}>{v.title}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize:'0.65rem', fontWeight:800, color:ORANGE, flexShrink: 0 }}>{fmt(v.views)}회</span>
                          <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.18)', overflow: 'hidden', minWidth: '20px' }}>
                            <div style={{ width: `${barPct}%`, height: '100%', background: ORANGE, borderRadius: '2px' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
                });
              })()}
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

          <p style={{ fontSize: '1rem', color: 'var(--rw-text3)', maxWidth: '380px', lineHeight: 1.75, marginBottom: '52px' }}>
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
