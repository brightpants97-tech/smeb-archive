'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  sortedMonths: string[];
  monthMap: Record<string, Record<number, any[]>>;
  monthTop5: Record<string, any[]>; // ← 추가
  today: string;
}

// ── 스크롤 진입 시 0→목표값으로 올라가는 카운트업 ──────────────────────────
function CountUp({ value, formatFn, duration = 900 }: { value: number; formatFn: (n: number) => string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !startedRef.current) {
        startedRef.current = true;
        const start = performance.now();
        const animate = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
          setDisplay(Math.round(value * eased));
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [value, duration]);

  return <span ref={ref}>{formatFn(display)}</span>;
}

// ── 조회수·재생시간을 아이콘 chip 스타일로 보여주는 공용 컴포넌트 ──────────────
function VodStats({ views, duration, fmtDuration, size = 'sm' }: {
  views?: number | null; duration?: number; fmtDuration: (s: number) => string; size?: 'xs' | 'sm' | 'md';
}) {
  const fontSize = size === 'md' ? '0.82rem' : size === 'sm' ? '0.72rem' : '0.68rem';
  const iconSize = size === 'md' ? 13 : size === 'sm' ? 11 : 10;
  const viewsColor = size === 'xs' ? 'var(--text-muted)' : '#EB701A';
  const viewsWeight = size === 'xs' ? 500 : 700;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size === 'xs' ? '8px' : '11px', flexWrap: 'wrap' }}>
      {views != null && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize, fontWeight: viewsWeight, color: viewsColor }}>
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-7.5 11-7.5S23 12 23 12s-4 7.5-11 7.5S1 12 1 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <CountUp value={views} formatFn={n => n.toLocaleString()} />회
        </span>
      )}
      {duration ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize, fontWeight: 500, color: 'var(--text-muted)' }}>
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3.5 2" />
          </svg>
          {fmtDuration(duration)}
        </span>
      ) : null}
    </div>
  );
}

// ─── SOOP VOD 재생 팝업 ────────────────────────────────────────────────────────
function VodPlayerModal({ id, title, onClose }: { id: string; title: string; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  return createPortal(
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        background: visible ? 'rgba(0,0,0,0.78)' : 'rgba(0,0,0,0)',
        backdropFilter: visible ? 'blur(9px)' : 'blur(0px)',
        WebkitBackdropFilter: visible ? 'blur(9px)' : 'blur(0px)',
        transition: 'background 0.4s ease-out, backdrop-filter 0.6s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: '960px',
          background: '#000', borderRadius: '16px', overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          transform: visible ? 'scale(1)' : 'scale(0.95)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.25s cubic-bezier(0.22,1,0.36,1), opacity 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 16px', background: '#111' }}>
          <p style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
          <button
            onClick={handleClose}
            style={{
              flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%',
              border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff',
              cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000' }}>
          <iframe
            src={`https://vod.sooplive.com/player/${id}/embed?autoPlay=true&showChat=false&mutePlay=false`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

// 슬라이드오버 패널
function DayPanel({
  date, vods, onClose, fmtDuration, onPrev, onNext, hasPrev, hasNext, isMobile, origin, onPlayVod,
}: {
  date: string; vods: any[]; onClose: () => void; fmtDuration: (s: number) => string;
  onPrev: () => void; onNext: () => void; hasPrev: boolean; hasNext: boolean; isMobile: boolean;
  origin: { x: number; y: number } | null; onPlayVod: (id: string, title: string) => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
      if (e.key === 'ArrowRight' && hasNext) onNext();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  // 스크롤 가능 여부 감지 (하단 페이드 힌트용)
  const listRef = useRef<HTMLDivElement>(null);
  const [canScrollMore, setCanScrollMore] = useState(false);
  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    setCanScrollMore(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  };
  useEffect(() => {
    // 목록(날짜)이 바뀔 때마다 스크롤 가능 여부 재계산
    const id = requestAnimationFrame(handleScroll);
    return () => cancelAnimationFrame(id);
  }, [vods]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const label = (() => {
    const d = new Date(date + 'T00:00:00');
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  })();

  // 클릭한 날짜 셀 위치에서 모달이 확장되어 나오는 것처럼 보이도록 초기 transform 계산
  const originTransform = (() => {
    if (!origin || typeof window === 'undefined') return 'scale(0.94) translateY(12px)';
    const dx = origin.x - window.innerWidth / 2;
    const dy = origin.y - window.innerHeight / 2;
    return `translate(${dx}px, ${dy}px) scale(0.35)`;
  })();

  return createPortal(
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99998,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '12px' : '24px',
        background: visible ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)',
        backdropFilter: visible ? 'blur(7px)' : 'blur(0px)',
        WebkitBackdropFilter: visible ? 'blur(7px)' : 'blur(0px)',
        transition: 'background 0.35s ease-out, backdrop-filter 0.55s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%', maxWidth: '580px', maxHeight: '82vh',
          borderRadius: '20px',
          background: 'var(--card)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          transform: visible ? 'translate(0,0) scale(1)' : originTransform,
          opacity: visible ? 1 : 0,
          transition: 'transform 0.3s cubic-bezier(0.22,1,0.36,1), opacity 0.22s',
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: '20px 20px 16px', borderBottom: '1px solid var(--card-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <button
              onClick={onPrev} disabled={!hasPrev} title="이전 날"
              style={{
                width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                border: '1px solid var(--card-border)', background: 'var(--bg-deeper)',
                color: 'var(--text)', cursor: hasPrev ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.95rem', fontWeight: 700, opacity: hasPrev ? 1 : 0.3,
              }}
            >‹</button>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '0.72rem', color: '#EB701A', fontWeight: 700, marginBottom: '2px', letterSpacing: '0.04em' }}>다시보기</p>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap' }}>{label}</h3>
            </div>
            <button
              onClick={onNext} disabled={!hasNext} title="다음 날"
              style={{
                width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                border: '1px solid var(--card-border)', background: 'var(--bg-deeper)',
                color: 'var(--text)', cursor: hasNext ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.95rem', fontWeight: 700, opacity: hasNext ? 1 : 0.3,
              }}
            >›</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, background: 'rgba(235,112,26,0.12)', color: '#EB701A', padding: '4px 10px', borderRadius: '100px', whiteSpace: 'nowrap' }}>
              총 {vods.length}개
            </span>
            <button
              onClick={handleClose}
              style={{
                width: '32px', height: '32px', borderRadius: '50%',
                border: '1px solid var(--card-border)', background: 'var(--bg-deeper)',
                color: 'var(--text)', cursor: 'pointer', fontSize: '1rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(235,112,26,0.15)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-deeper)'}
            >✕</button>
          </div>
        </div>

        {/* 목록 */}
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <div
            ref={listRef}
            onScroll={handleScroll}
            style={{ height: '100%', overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            {[...vods].sort((a, b) => Number(a.id) - Number(b.id)).map((vod: any, i: number) => (
              <div
                key={i}
                onClick={() => onPlayVod(vod.id, vod.title)}
                style={{
                  display: 'flex', gap: '12px', alignItems: 'flex-start',
                  padding: '12px', borderRadius: '12px',
                  border: '1px solid var(--card-border)',
                  background: 'var(--bg-deeper)',
                  textDecoration: 'none', color: 'var(--text)',
                  cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = '';
                  (e.currentTarget as HTMLElement).style.boxShadow = '';
                }}
              >
                {vod.thumb ? (
                  <div className="vod-thumb-wrap" style={{ width: '190px', aspectRatio: '16/9', borderRadius: '10px', flexShrink: 0 }}>
                    <img
                      src={vod.thumb} alt=""
                      style={{ width: '100%', height: '100%', borderRadius: '10px', objectFit: 'cover' }}
                    />
                  </div>
                ) : (
                  <div style={{
                    width: '190px', aspectRatio: '16/9', borderRadius: '10px', flexShrink: 0,
                    background: 'var(--card)', border: '1px solid var(--card-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.6rem', color: 'var(--text-muted)', opacity: 0.6,
                  }}>🎬</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)',
                    opacity: 0.75, marginBottom: '3px', display: 'block',
                  }} title="인기순이 아닌 방송 시작 순서입니다">
                    {vod.time ? `${vod.time} 시작` : `${i + 1}번째 방송`}
                  </span>
                  <p style={{ fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.45, color: 'var(--text)', marginBottom: '6px', wordBreak: 'break-all' }}>
                    {vod.title}
                  </p>
                  <VodStats views={vod.views} duration={vod.duration} fmtDuration={fmtDuration} size="xs" />
                </div>
              </div>
            ))}
          </div>
          {/* 스크롤 가능함을 알리는 하단 페이드 힌트 */}
          {canScrollMore && (
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, height: '36px',
              background: 'linear-gradient(to bottom, transparent, var(--card))',
              pointerEvents: 'none',
            }} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── 이달의 TOP 5 컴포넌트 ─────────────────────────────────────────────────────
function MonthTop5({ vods, month, fmtDuration, onPlayVod }: { vods: any[]; month: string; fmtDuration: (s: number) => string; onPlayVod: (id: string, title: string) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (!vods || vods.length === 0) return null;

  const [y, m] = month.split('-');
  const label = `${y}년 ${parseInt(m)}월`;

  const RANK_COLORS = ['#EB701A', '#8A8A8A', '#CD7F32', 'var(--text-muted)', 'var(--text-muted)'];
  const RANK_BG = [
    'linear-gradient(135deg,rgba(235,112,26,0.18),rgba(235,112,26,0.06))',
    'linear-gradient(135deg,rgba(140,140,140,0.20),rgba(140,140,140,0.07))',
    'linear-gradient(135deg,rgba(205,127,50,0.14),rgba(205,127,50,0.04))',
    'rgba(0,0,0,0)',
    'rgba(0,0,0,0)',
  ];

  const top1 = vods[0];
  const rest = vods.slice(1);

  return (
    <div style={{ marginBottom: '36px' }}>
      {/* 섹션 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: 'rgba(235,112,26,0.1)', border: '1px solid rgba(235,112,26,0.25)',
          color: '#EB701A', fontSize: '0.7rem', fontWeight: 800,
          padding: '4px 12px', borderRadius: '100px', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          🏆 {label} TOP 5
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          조회수 기준
        </span>
      </div>

      {/* 1위 카드 (크게) */}
      <div
        onClick={() => onPlayVod(top1.id, top1.title)}
        style={{
          display: 'flex', gap: '16px', alignItems: 'stretch',
          padding: '16px', borderRadius: '16px', marginBottom: '10px',
          border: '1.5px solid rgba(235,112,26,0.35)',
          background: 'linear-gradient(135deg,rgba(235,112,26,0.12),rgba(235,112,26,0.04))',
          textDecoration: 'none', color: 'var(--text)', cursor: 'pointer',
          transition: 'transform 0.18s, box-shadow 0.18s',
          transform: hovered === 0 ? 'translateY(-3px)' : 'none',
          boxShadow: hovered === 0 ? '0 12px 32px rgba(235,112,26,0.2)' : '0 4px 16px rgba(235,112,26,0.08)',
        }}
        onMouseEnter={() => setHovered(0)}
        onMouseLeave={() => setHovered(null)}
      >
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '40px' }}>
          <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#EB701A', lineHeight: 1 }}>1</span>
          <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#EB701A', letterSpacing: '0.06em' }}>위</span>
        </div>
        {top1.thumb && (
          <div className="vod-thumb-wrap" style={{ width: '140px', aspectRatio: '16/9', borderRadius: '10px', flexShrink: 0 }}>
            <img src={top1.thumb} alt="" style={{ width: '100%', height: '100%', borderRadius: '10px', objectFit: 'cover' }} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ fontSize: '1rem', fontWeight: 800, lineHeight: 1.4, color: 'var(--text)', marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{top1.title}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <VodStats views={Number(top1.views)} duration={top1.duration} fmtDuration={fmtDuration} size="md" />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{top1.date}</span>
          </div>
        </div>
        <div style={{ fontSize: '1.6rem', alignSelf: 'flex-start', marginTop: '-4px', opacity: 0.9 }}>👑</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {rest.map((vod, idx) => {
          const rank = idx + 2;
          const isHov = hovered === rank;
          return (
            <div key={vod.id} onClick={() => onPlayVod(vod.id, vod.title)}
              style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 14px', borderRadius: '12px', border: `1px solid ${rank <= 3 ? 'rgba(192,192,192,0.25)' : 'var(--card-border)'}`, background: RANK_BG[idx + 1], textDecoration: 'none', color: 'var(--text)', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s', transform: isHov ? 'translateX(4px)' : 'none', boxShadow: isHov ? '0 4px 16px rgba(0,0,0,0.1)' : 'none' }}
              onMouseEnter={() => setHovered(rank)} onMouseLeave={() => setHovered(null)}
            >
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: RANK_COLORS[idx + 1], width: '28px', textAlign: 'center', flexShrink: 0 }}>{rank}</span>
              {vod.thumb && (
                <div className="vod-thumb-wrap" style={{ width: '72px', aspectRatio: '16/9', borderRadius: '7px', flexShrink: 0 }}>
                  <img src={vod.thumb} alt="" style={{ width: '100%', height: '100%', borderRadius: '7px', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.35, color: 'var(--text)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vod.title}</p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <VodStats views={Number(vod.views)} duration={vod.duration} fmtDuration={fmtDuration} size="sm" />
                  <span style={{ fontSize: '0.71rem', color: 'var(--text-muted)' }}>{vod.date}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 메인 캘린더 섹션 ──────────────────────────────────────────────────────────
export default function CalendarSection({ sortedMonths, monthMap, monthTop5, today }: Props) {
  const todayDate = new Date(today);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  const currentYM = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}`;

  const years = useMemo(() => {
    return [...new Set(sortedMonths.map(m => m.substring(0, 4)))].sort();
  }, [sortedMonths]);

  const defaultYear = years.includes(String(todayDate.getFullYear()))
    ? String(todayDate.getFullYear())
    : years[years.length - 1] || '';

  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(currentYM);
  const [search, setSearch] = useState('');
  const [panelDay, setPanelDay] = useState<{ date: string; vods: any[]; origin?: { x: number; y: number } } | null>(null);
  const [playingVod, setPlayingVod] = useState<{ id: string; title: string } | null>(null);
  const openVod = (id: string, title: string) => setPlayingVod({ id, title });

  const monthsInYear = useMemo(() => {
    return sortedMonths.filter(m => m.startsWith(selectedYear));
  }, [sortedMonths, selectedYear]);

  const validSelectedMonth = monthsInYear.includes(selectedMonth)
    ? selectedMonth
    : (monthsInYear[monthsInYear.length - 1] || selectedMonth);

  const calData = monthMap[validSelectedMonth] || {};
  const [year, month] = validSelectedMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCount = Object.values(calData).reduce((a: number, arr: any) => a + arr.length, 0);

  const filteredBySearch = useMemo(() => {
    if (!search) return null;
    const result: { date: string; vod: any }[] = [];
    Object.entries(monthMap).forEach(([ym, days]) => {
      Object.entries(days).forEach(([day, vods]) => {
        (vods as any[]).forEach(v => {
          if (v.title?.toLowerCase().includes(search.toLowerCase())) {
            result.push({ date: `${ym}-${String(day).padStart(2, '0')}`, vod: v });
          }
        });
      });
    });
    return result;
  }, [search, monthMap]);

  const fmtDuration = (ms: number) => {
    if (!ms) return '';
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const monthTotalSec = useMemo(() => {
    return Object.values(calData).flat().reduce((acc: number, v: any) => acc + Math.floor((v.duration || 0) / 1000), 0);
  }, [calData]);

  const fmtMonthTotal = (sec: number) => {
    if (!sec) return null;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
  };

  const openPanel = (day: number, vods: any[], origin?: { x: number; y: number }) => {
    if (vods.length === 0) return;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setPanelDay({ date: dateStr, vods, origin });
  };

  // 특정 월(YYYY-MM)에서 다시보기가 있는 날짜만 오름차순 정렬해서 반환
  const getVodDays = (ym: string) => {
    const data = monthMap[ym] || {};
    return Object.keys(data).map(Number).filter(d => (data[d] || []).length > 0).sort((a, b) => a - b);
  };

  // 현재 팝업이 보여주고 있는 날짜의 월 (달력 탭에서 선택한 월과 다를 수 있음 - 팝업 안에서 다른 달로 넘어갔을 때)
  const panelYm = panelDay ? panelDay.date.slice(0, 7) : validSelectedMonth;
  const panelDayNum = panelDay ? Number(panelDay.date.split('-')[2]) : 0;
  const panelVodDays = useMemo(() => getVodDays(panelYm), [panelYm, monthMap]);
  const panelMonthIdx = sortedMonths.indexOf(panelYm);
  const panelDayIdx = panelVodDays.indexOf(panelDayNum);

  const hasPrevDay = panelDayIdx > 0 || panelMonthIdx > 0;
  const hasNextDay = panelDayIdx < panelVodDays.length - 1 || (panelMonthIdx !== -1 && panelMonthIdx < sortedMonths.length - 1);

  const navigatePanel = (dir: 1 | -1) => {
    if (!panelDay) return;
    const nextIdx = panelDayIdx + dir;

    if (nextIdx >= 0 && nextIdx < panelVodDays.length) {
      // 같은 달 안에서 이동
      const nextDay = panelVodDays[nextIdx];
      const dateStr = `${panelYm}-${String(nextDay).padStart(2, '0')}`;
      setPanelDay({ date: dateStr, vods: (monthMap[panelYm] || {})[nextDay], origin: panelDay.origin });
      return;
    }

    // 달 경계를 넘어 인접 월로 이동 (혹시 빈 월이 끼어 있을 경우를 대비해 최대 24개월까지 탐색)
    let mIdx = panelMonthIdx;
    for (let i = 0; i < 24; i++) {
      mIdx += dir;
      if (mIdx < 0 || mIdx >= sortedMonths.length) return; // 더 이상 이동할 데이터 없음
      const ym = sortedMonths[mIdx];
      const days = getVodDays(ym);
      if (days.length === 0) continue;
      const targetDay = dir === 1 ? days[0] : days[days.length - 1];
      const dateStr = `${ym}-${String(targetDay).padStart(2, '0')}`;
      setPanelDay({ date: dateStr, vods: (monthMap[ym] || {})[targetDay], origin: panelDay.origin });
      // 달력 탭도 같이 이동한 월로 맞춰줌
      setSelectedMonth(ym);
      setSelectedYear(ym.slice(0, 4));
      return;
    }
  };

  const BORDER = '1px solid var(--card-border)';
  const GRID = 'repeat(7, minmax(0, 1fr))';

  const top5 = monthTop5[validSelectedMonth] || [];

  return (
    <div>
      {panelDay && (
        <DayPanel
          date={panelDay.date}
          vods={panelDay.vods}
          onClose={() => setPanelDay(null)}
          fmtDuration={fmtDuration}
          onPrev={() => navigatePanel(-1)}
          onNext={() => navigatePanel(1)}
          hasPrev={hasPrevDay}
          hasNext={hasNextDay}
          isMobile={isMobile}
          origin={panelDay.origin || null}
          onPlayVod={openVod}
        />
      )}

      {playingVod && (
        <VodPlayerModal
          id={playingVod.id}
          title={playingVod.title}
          onClose={() => setPlayingVod(null)}
        />
      )}

      {/* ── 검색창 ── */}
      <div style={{ marginBottom:'20px', position:'relative' }}>
        <span style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', fontSize:'1rem', pointerEvents:'none' }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="다시보기 제목 검색..."
          style={{
            width:'100%', padding:'13px 16px 13px 44px',
            borderRadius:'14px', border:'1px solid var(--card-border)',
            background:'var(--card)', color:'var(--text)', fontSize:'0.9rem',
            outline:'none', boxShadow:'0 1px 6px rgba(0,0,0,0.06)',
            transition:'box-shadow 0.2s',
          }}
          onFocus={e => (e.currentTarget as HTMLElement).style.boxShadow='0 0 0 3px rgba(235,112,26,0.2)'}
          onBlur={e => (e.currentTarget as HTMLElement).style.boxShadow='0 1px 6px rgba(0,0,0,0.06)'}
        />
      </div>

      {search ? (
        /* ── 검색 결과 ── */
        <div>
          <p style={{ marginBottom:'16px', fontSize:'0.85rem', color:'var(--text-muted)' }}>
            &ldquo;{search}&rdquo; 검색 결과: {filteredBySearch?.length || 0}개
          </p>
          <div style={{ background:'var(--bg-deeper)', borderRadius:'18px', padding:'12px', display:'flex', flexDirection:'column', gap:'8px' }}>
            {filteredBySearch?.map(({ date, vod }, i) => (
              <div key={i} onClick={() => openVod(vod.id, vod.title)}
                style={{ display:'flex', gap:'12px', alignItems:'center', padding:'12px 14px', background:'var(--card)', borderRadius:'12px', border:'1px solid var(--card-border)', textDecoration:'none', color:'var(--text)', cursor:'pointer', transition:'transform 0.15s', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform=''}>
                {vod.thumb && (
                  <div className="vod-thumb-wrap" style={{ width:'100px', borderRadius:'8px', flexShrink:0, aspectRatio:'16/9' }}>
                    <img src={vod.thumb} alt="" style={{ width:'100%', height:'100%', borderRadius:'8px', objectFit:'cover' }} />
                  </div>
                )}
                <div>
                  <p style={{ fontSize:'0.72rem', color:'#EB701A', fontWeight:700, marginBottom:'4px' }}>{date}</p>
                  <p style={{ fontSize:'0.9rem', fontWeight:600, marginBottom:'4px', color:'var(--text)' }}>{vod.title}</p>
                  <VodStats views={Number(vod.views)} duration={vod.duration} fmtDuration={fmtDuration} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* ── 연도 + 월 탭 그룹 ── */}
          <div style={{ background:'var(--bg-deeper)', borderRadius:'18px', padding:'16px', marginBottom:'20px' }}>
            {/* 연도 */}
            <div style={{ display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap', alignItems:'center' }}>
              <span style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--text-muted)', marginRight:'4px', letterSpacing:'0.06em', textTransform:'uppercase' }}>연도</span>
              {years.map(y => (
                <button key={y} onClick={() => {
                  setSelectedYear(y);
                  const currentYear = String(todayDate.getFullYear());
                  if (y === currentYear && sortedMonths.includes(currentYM)) {
                    setSelectedMonth(currentYM);
                  } else {
                    const lastInYear = [...sortedMonths].filter(m => m.startsWith(y)).pop();
                    if (lastInYear) setSelectedMonth(lastInYear);
                  }
                }}
                style={{
                  padding:'5px 14px', borderRadius:'100px', cursor:'pointer', fontWeight:700, fontSize:'0.9rem', transition:'all 0.15s',
                  background: selectedYear === y ? '#EB701A' : 'transparent',
                  color: selectedYear === y ? '#fff' : 'var(--text-muted)',
                  boxShadow: 'none',
                  border: selectedYear === y ? '1px solid #EB701A' : '1px solid transparent',
                }}>
                  {y}년
                </button>
              ))}
            </div>
            {/* 구분선 */}
            <div style={{ height:'1px', background:'var(--card-border)', margin:'0 0 12px' }} />
            {/* 월 */}
            <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', alignItems:'center' }}>
              <span style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--text-muted)', marginRight:'4px', letterSpacing:'0.06em', textTransform:'uppercase' }}>월</span>
              {monthsInYear.map(ym => {
                const mo = parseInt(ym.split('-')[1]);
                const cnt = Object.values(monthMap[ym] || {}).reduce((a: number, arr: any) => a + arr.length, 0);
                const isSelected = ym === validSelectedMonth;
                return (
                  <button key={ym} onClick={() => setSelectedMonth(ym)}
                    title={cnt > 0 ? `${mo}월 다시보기 ${cnt}개 있음` : `${mo}월 다시보기 없음`}
                    style={{
                      padding:'5px 13px', borderRadius:'100px', cursor:'pointer',
                      fontWeight: isSelected ? 700 : 500, fontSize:'0.8rem', transition:'all 0.15s', position:'relative',
                      background: isSelected ? '#1A1A1A' : 'var(--card)',
                      color: isSelected ? '#fff' : cnt > 0 ? 'var(--text)' : 'var(--text-muted)',
                      border: isSelected ? '1px solid #1A1A1A' : '1px solid var(--card-border)',
                      opacity: cnt === 0 ? 0.4 : 1,
                    }}>
                    {mo}월
                    {cnt > 0 && (
                      <span style={{ position:'absolute', top:'-3px', right:'-3px', width:'7px', height:'7px', borderRadius:'50%', background: isSelected ? '#EB701A' : '#EB701A' }} />
                    )}
                  </button>
                );
              })}
              {/* 점 표시 범례 */}
              <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', fontSize:'0.68rem', color:'var(--text-muted)', marginLeft:'6px' }}>
                <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#EB701A', display:'inline-block' }} />
                다시보기 있음
              </span>
            </div>
          </div>

          {/* ── 이달의 TOP 5 ── */}
          <MonthTop5 vods={top5} month={validSelectedMonth} fmtDuration={fmtDuration} onPlayVod={openVod} />

          {/* ── 캘린더 헤더 ── */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <h3 style={{ fontSize:'1.1rem', fontWeight:800, color:'var(--text)', margin:0 }}>
              {year}년 <span style={{ color:'#EB701A' }}>{month}월</span>
            </h3>
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              {fmtMonthTotal(monthTotalSec) && (
                <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', fontSize:'0.75rem', fontWeight:700, color:'#EB701A', background:'rgba(235,112,26,0.1)', border:'1px solid rgba(235,112,26,0.2)', padding:'4px 10px', borderRadius:'100px' }}>
                  🕐 {fmtMonthTotal(monthTotalSec)}
                </span>
              )}
              <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', fontSize:'0.75rem', fontWeight:700, color:'var(--text-muted)', background:'var(--bg-deeper)', border:'1px solid var(--card-border)', padding:'4px 10px', borderRadius:'100px' }}>
                📺 {totalCount}개
              </span>
            </div>
          </div>

          {/* ── 캘린더 그리드 ── */}
          <div style={{ background:'var(--bg-deeper)', borderRadius:'20px', padding:'12px', overflow:'hidden' }}>
            <div style={{ background:'var(--card)', borderRadius:'14px', overflow:'hidden', border:'1px solid var(--card-border)', boxShadow:'0 1px 8px rgba(0,0,0,0.06)' }}>
              {/* 요일 헤더 */}
              <div style={{ display:'grid', gridTemplateColumns:GRID, background:'var(--bg-deeper)', borderBottom:'1px solid var(--card-border)' }}>
                {['일','월','화','수','목','금','토'].map((d, i) => (
                  <div key={d} style={{
                    textAlign:'center', padding: isMobile ? '8px 0' : '10px 0',
                    fontSize: isMobile ? '0.65rem' : '0.73rem', fontWeight:700,
                    color: i === 0 ? '#B84444' : i === 6 ? '#6B7A9F' : 'var(--text-muted)',
                    borderRight: i < 6 ? '1px solid var(--card-border)' : 'none',
                  }}>{d}</div>
                ))}
              </div>
              {/* 날짜 셀 */}
              <div style={{ display:'grid', gridTemplateColumns:GRID, background:'var(--card)' }}>
                {Array.from({ length: firstDay }).map((_, i) => {
                  const col = i % 7;
                  return (<div key={`e${i}`} style={{ minHeight: isMobile ? '48px' : '88px', background:'var(--bg-deeper)', borderRight: col < 6 ? '1px solid var(--card-border)' : 'none', borderBottom:'1px solid var(--card-border)' }} />);
                })}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const vods = calData[day] || [];
                  const isToday = todayDate.getFullYear() === year && todayDate.getMonth() + 1 === month && todayDate.getDate() === day;
                  const col = (firstDay + day - 1) % 7;
                  const totalCells = firstDay + daysInMonth;
                  const lastRowStart = Math.floor((totalCells - 1) / 7) * 7;
                  const cellIndex = firstDay + day - 1;
                  const isLastRow = cellIndex >= lastRowStart;
                  const hasVods = vods.length > 0;
                  return (
                    <div key={day} onClick={(e) => openPanel(day, vods, { x: e.clientX, y: e.clientY })}
                      style={{
                        background:'var(--card)', minHeight: isMobile ? '48px' : '88px',
                        padding: isMobile ? '4px' : '8px', overflow:'hidden', minWidth:0,
                        borderRight: col < 6 ? '1px solid var(--card-border)' : 'none',
                        borderBottom: isLastRow ? 'none' : '1px solid var(--card-border)',
                        cursor: hasVods ? 'pointer' : 'default',
                        transition: hasVods ? 'background 0.15s' : undefined,
                      }}
                      onMouseEnter={e => { if (hasVods) (e.currentTarget as HTMLElement).style.background='rgba(235,112,26,0.05)'; }}
                      onMouseLeave={e => { if (hasVods) (e.currentTarget as HTMLElement).style.background='var(--card)'; }}
                    >
                      {/* 날짜 숫자 */}
                      <div style={{ display:'flex', alignItems:'center', gap:'4px', marginBottom:'5px' }}>
                        <span style={{
                          fontSize: isMobile ? '0.75rem' : '0.82rem',
                          fontWeight: isToday ? 900 : 600, lineHeight:1,
                          minWidth:'22px', width:'22px', height:'22px', flexShrink:0,
                          borderRadius:'50%',
                          background: isToday ? '#EB701A' : 'transparent',
                          color: isToday ? '#fff' : col === 0 ? '#B84444' : col === 6 ? '#6B7A9F' : 'var(--text-muted)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          boxShadow: isToday ? '0 2px 8px rgba(235,112,26,0.35)' : 'none',
                        }}>{day}</span>
                        {vods.length > 0 && (
                          <span style={{
                            fontSize:'0.6rem', fontWeight:700,
                            background: hasVods ? '#EB701A' : 'rgba(235,112,26,0.12)',
                            color: hasVods ? '#fff' : '#EB701A',
                            padding:'1px 5px', borderRadius:'100px', flexShrink:0,
                          }}>{vods.length}</span>
                        )}
                      </div>
                      {/* 방송 타이틀 미리보기 */}
                      {!isMobile && (
                        <div style={{ display:'flex', flexDirection:'column', gap:'3px', minWidth:0 }}>
                          {vods.slice(0, 2).map((vod: any, vi: number) => (
                            <span key={vi} title={vod.title} style={{
                              display:'block', fontSize:'0.66rem', color:'var(--text)',
                              background:'rgba(235,112,26,0.07)', borderRadius:'5px',
                              padding:'2px 5px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                            }}>{vod.title}</span>
                          ))}
                          {vods.length > 2 && (
                            <span style={{ fontSize:'0.63rem', color:'#EB701A', fontWeight:700, padding:'1px 5px' }}>+{vods.length - 2}개 더 →</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {(() => {
                  const totalCells = firstDay + daysInMonth;
                  const remainder = totalCells % 7;
                  if (remainder === 0) return null;
                  const trailing = 7 - remainder;
                  return Array.from({ length: trailing }).map((_, i) => (
                    <div key={`t${i}`} style={{ minHeight: isMobile ? '48px' : '88px', background:'var(--bg-deeper)', borderRight:(remainder + i) < 6 ? '1px solid var(--card-border)' : 'none' }} />
                  ));
                })()}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
