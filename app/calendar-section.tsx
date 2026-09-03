'use client';
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  sortedMonths: string[];
  monthMap: Record<string, Record<number, any[]>>;
  monthTop5: Record<string, any[]>; // ← 추가
  today: string;
}

// 슬라이드오버 패널
function DayPanel({
  date, vods, onClose, fmtDuration,
}: {
  date: string; vods: any[]; onClose: () => void; fmtDuration: (s: number) => string;
}) {
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
    setTimeout(onClose, 280);
  };

  const label = (() => {
    const d = new Date(date + 'T00:00:00');
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  })();

  return createPortal(
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99998,
        background: visible ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)',
        backdropFilter: visible ? 'blur(4px)' : 'none',
        WebkitBackdropFilter: visible ? 'blur(4px)' : 'none',
        transition: 'background 0.28s, backdrop-filter 0.28s',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: '100%', maxWidth: '420px',
          background: 'var(--card)',
          boxShadow: '-8px 0 48px rgba(0,0,0,0.28)',
          display: 'flex', flexDirection: 'column',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: '20px 20px 16px', borderBottom: '1px solid var(--card-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: '0.72rem', color: '#EB701A', fontWeight: 700, marginBottom: '2px', letterSpacing: '0.04em' }}>다시보기</p>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{label}</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, background: 'rgba(235,112,26,0.12)', color: '#EB701A', padding: '4px 10px', borderRadius: '100px' }}>
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[...vods].sort((a, b) => Number(a.id) - Number(b.id)).map((vod: any, i: number) => (
            <a
              key={i}
              href={`https://vod.sooplive.com/player/${vod.id}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', gap: '12px', alignItems: 'flex-start',
                padding: '12px', borderRadius: '12px',
                border: '1px solid var(--card-border)',
                background: 'var(--bg-deeper)',
                textDecoration: 'none', color: 'var(--text)',
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
              {vod.thumb && (
                <img
                  src={vod.thumb} alt=""
                  style={{ width: '96px', aspectRatio: '16/9', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'inline-block', fontSize: '0.62rem', fontWeight: 700,
                  background: 'rgba(235,112,26,0.12)', color: '#EB701A',
                  padding: '1px 6px', borderRadius: '4px', marginBottom: '4px',
                }}>{i + 1}</span>
                <p style={{ fontSize: '0.88rem', fontWeight: 600, lineHeight: 1.4, color: 'var(--text)', marginBottom: '6px', wordBreak: 'break-all' }}>{vod.title}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {vod.views != null && <span>👁 {Number(vod.views).toLocaleString()}회</span>}
                  {vod.duration ? <span>🕐 {fmtDuration(vod.duration)}</span> : null}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── 이달의 TOP 5 컴포넌트 ─────────────────────────────────────────────────────
function MonthTop5({ vods, month, fmtDuration }: { vods: any[]; month: string; fmtDuration: (s: number) => string }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (!vods || vods.length === 0) return null;

  const [y, m] = month.split('-');
  const label = `${y}년 ${parseInt(m)}월`;

  const RANK_COLORS = ['#EB701A', '#C0C0C0', '#CD7F32', 'var(--text-muted)', 'var(--text-muted)'];
  const RANK_BG = [
    'linear-gradient(135deg,rgba(235,112,26,0.18),rgba(235,112,26,0.06))',
    'linear-gradient(135deg,rgba(192,192,192,0.14),rgba(192,192,192,0.04))',
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
      <a
        href={`https://vod.sooplive.com/player/${top1.id}`}
        target="_blank" rel="noopener noreferrer"
        style={{
          display: 'flex', gap: '16px', alignItems: 'stretch',
          padding: '16px', borderRadius: '16px', marginBottom: '10px',
          border: '1.5px solid rgba(235,112,26,0.35)',
          background: 'linear-gradient(135deg,rgba(235,112,26,0.12),rgba(235,112,26,0.04))',
          textDecoration: 'none', color: 'var(--text)',
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
        {top1.thumb && (<img src={top1.thumb} alt="" style={{ width: '140px', aspectRatio: '16/9', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />)}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ fontSize: '1rem', fontWeight: 800, lineHeight: 1.4, color: 'var(--text)', marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{top1.title}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#EB701A' }}>👁 {Number(top1.views).toLocaleString()}회</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{top1.date}</span>
            {top1.duration ? <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>🕐 {fmtDuration(top1.duration)}</span> : null}
          </div>
        </div>
        <div style={{ fontSize: '1.6rem', alignSelf: 'flex-start', marginTop: '-4px', opacity: 0.9 }}>👑</div>
      </a>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {rest.map((vod, idx) => {
          const rank = idx + 2;
          const isHov = hovered === rank;
          return (
            <a key={vod.id} href={`https://vod.sooplive.com/player/${vod.id}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 14px', borderRadius: '12px', border: `1px solid ${rank <= 3 ? 'rgba(192,192,192,0.25)' : 'var(--card-border)'}`, background: RANK_BG[idx + 1], textDecoration: 'none', color: 'var(--text)', transition: 'transform 0.15s, box-shadow 0.15s', transform: isHov ? 'translateX(4px)' : 'none', boxShadow: isHov ? '0 4px 16px rgba(0,0,0,0.1)' : 'none' }}
              onMouseEnter={() => setHovered(rank)} onMouseLeave={() => setHovered(null)}
            >
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: RANK_COLORS[idx + 1], width: '28px', textAlign: 'center', flexShrink: 0 }}>{rank}</span>
              {vod.thumb && (<img src={vod.thumb} alt="" style={{ width: '72px', aspectRatio: '16/9', borderRadius: '7px', objectFit: 'cover', flexShrink: 0 }} />)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.35, color: 'var(--text)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vod.title}</p>
                <div style={{ display: 'flex', gap: '10px', fontSize: '0.71rem', color: 'var(--text-muted)' }}>
                  <span>👁 {Number(vod.views).toLocaleString()}회</span>
                  <span>{vod.date}</span>
                </div>
              </div>
            </a>
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
  const [panelDay, setPanelDay] = useState<{ date: string; vods: any[] } | null>(null);

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

  const openPanel = (day: number, vods: any[]) => {
    if (vods.length === 0) return;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setPanelDay({ date: dateStr, vods });
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
              <a key={i} href={`https://vod.sooplive.com/player/${vod.id}`} target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', gap:'12px', alignItems:'center', padding:'12px 14px', background:'var(--card)', borderRadius:'12px', border:'1px solid var(--card-border)', textDecoration:'none', color:'var(--text)', transition:'transform 0.15s', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform=''}>
                {vod.thumb && <img src={vod.thumb} alt="" style={{ width:'100px', borderRadius:'8px', flexShrink:0, objectFit:'cover', aspectRatio:'16/9' }} />}
                <div>
                  <p style={{ fontSize:'0.72rem', color:'#EB701A', fontWeight:700, marginBottom:'4px' }}>{date}</p>
                  <p style={{ fontSize:'0.9rem', fontWeight:600, marginBottom:'4px', color:'var(--text)' }}>{vod.title}</p>
                  <p style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>👁 {vod.views?.toLocaleString()}회{vod.duration ? ` · ${fmtDuration(vod.duration)}` : ''}</p>
                </div>
              </a>
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
            </div>
          </div>

          {/* ── 이달의 TOP 5 ── */}
          <MonthTop5 vods={top5} month={validSelectedMonth} fmtDuration={fmtDuration} />

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
                    <div key={day} onClick={() => openPanel(day, vods)}
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
