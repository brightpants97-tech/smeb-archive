'use client';
import { useState, useMemo } from 'react';

interface Props {
  sortedMonths: string[];
  monthMap: Record<string, Record<number, any[]>>;
  today: string;
}

export default function CalendarSection({ sortedMonths, monthMap, today }: Props) {
  const todayDate = new Date(today);
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

  const monthsInYear = useMemo(() => {
    return sortedMonths.filter(m => m.startsWith(selectedYear));
  }, [sortedMonths, selectedYear]);

  const validSelectedMonth = monthsInYear.includes(selectedMonth)
    ? selectedMonth
    : (monthsInYear[0] || selectedMonth);

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

  const fmtDuration = (sec: number) => {
    if (!sec) return '';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
  };

  const BORDER = '1px solid var(--card-border)';
  const GRID = 'repeat(7, minmax(0, 1fr))';

  return (
    <div>
      <div style={{ marginBottom: '24px', position: 'relative' }}>
        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '1rem' }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="다시보기 제목 검색..."
          style={{ width: '100%', padding: '12px 16px 12px 42px', borderRadius: '12px', border: BORDER, background: 'var(--card)', color: 'var(--text)', fontSize: '0.9rem', outline: 'none' }} />
      </div>

      {search ? (
        <div>
          <p style={{ marginBottom: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            "{search}" 검색 결과: {filteredBySearch?.length || 0}개
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredBySearch?.map(({ date, vod }, i) => (
              <a key={i} href={`https://vod.sooplive.com/player/${vod.id}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 16px', background: 'var(--card)', borderRadius: '12px', border: BORDER, textDecoration: 'none', color: 'var(--text)', transition: 'transform 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = ''}>
                {vod.thumb && <img src={vod.thumb} alt="" style={{ width: '100px', borderRadius: '8px', flexShrink: 0, objectFit: 'cover' }} />}
                <div>
                  <p style={{ fontSize: '0.72rem', color: '#EB701A', fontWeight: 700, marginBottom: '4px' }}>{date}</p>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text)' }}>{vod.title}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    👁 {vod.views?.toLocaleString()}회{vod.duration ? ` · ${fmtDuration(vod.duration)}` : ''}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '4px' }}>연도</span>
            {years.map(y => (
              <button key={y} onClick={() => {
                setSelectedYear(y);
                const firstInYear = sortedMonths.find(m => m.startsWith(y));
                if (firstInYear) setSelectedMonth(firstInYear);
              }}
                style={{
                  padding: '7px 20px', borderRadius: '100px', cursor: 'pointer', fontWeight: 700, fontSize: '0.92rem', transition: 'all 0.15s',
                  background: selectedYear === y ? '#EB701A' : 'var(--card)',
                  color: selectedYear === y ? '#fff' : 'var(--text-muted)',
                  boxShadow: selectedYear === y ? '0 4px 14px rgba(235,112,26,0.35)' : 'none',
                  border: selectedYear === y ? '1px solid #EB701A' : BORDER,
                }}>
                {y}년
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '28px', flexWrap: 'wrap', alignItems: 'center', padding: '14px 16px', background: 'var(--bg-deeper)', borderRadius: '14px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '4px' }}>월</span>
            {monthsInYear.map(ym => {
              const mo = parseInt(ym.split('-')[1]);
              const cnt = Object.values(monthMap[ym] || {}).reduce((a: number, arr: any) => a + arr.length, 0);
              const isSelected = ym === validSelectedMonth;
              return (
                <button key={ym} onClick={() => setSelectedMonth(ym)}
                  style={{
                    padding: '5px 14px', borderRadius: '100px', cursor: 'pointer', fontWeight: isSelected ? 700 : 500, fontSize: '0.82rem', transition: 'all 0.15s', position: 'relative',
                    background: isSelected ? '#1A1A1A' : 'var(--card)',
                    color: isSelected ? '#fff' : cnt > 0 ? 'var(--text)' : 'var(--text-muted)',
                    border: isSelected ? '1px solid #1A1A1A' : BORDER,
                    opacity: cnt === 0 ? 0.45 : 1,
                  }}>
                  {mo}월
                  {cnt > 0 && (
                    <span style={{ position: 'absolute', top: '-3px', right: '-3px', width: '7px', height: '7px', borderRadius: '50%', background: isSelected ? '#fff' : '#EB701A' }} />
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>
              {year}년 <span style={{ color: '#EB701A' }}>{month}월</span>
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              짱 {totalCount}개 다시보기
            </span>
          </div>

          <div style={{ borderRadius: '16px', overflow: 'hidden', border: BORDER, width: '100%' }}>
            {/* 요일 헤더 */}
            <div style={{ display: 'grid', gridTemplateColumns: GRID, background: 'var(--bg-deeper)' }}>
              {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                <div key={d} style={{
                  textAlign: 'center', padding: '10px 0', fontSize: '0.75rem', fontWeight: 700,
                  color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : 'var(--text-muted)',
                  borderRight: i < 6 ? BORDER : 'none',
                  borderBottom: BORDER,
                  overflow: 'hidden',
                }}>{d}</div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div style={{ display: 'grid', gridTemplateColumns: GRID, background: 'var(--card)' }}>
              {Array.from({ length: firstDay }).map((_, i) => {
                const col = i % 7;
                return (
                  <div key={`e${i}`} style={{
                    minHeight: '90px', background: 'var(--bg-deeper)', overflow: 'hidden',
                    borderRight: col < 6 ? BORDER : 'none',
                    borderBottom: BORDER,
                  }} />
                );
              })}

              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const vods = calData[day] || [];
                const isToday = todayDate.getFullYear() === year && todayDate.getMonth() + 1 === month && todayDate.getDate() === day;
                const col = (firstDay + day - 1) % 7;
                const totalCells = firstDay + daysInMonth;
                const lastRowStart = Math.floor((totalCells - 1) / 7) * 7;
                const cellIndex = firstDay + day - 1;
                const isLastRow = cellIndex >= lastRowStart;
                return (
                  <div key={day} style={{
                    background: 'var(--card)', minHeight: '90px', padding: '8px',
                    overflow: 'hidden', minWidth: 0,
                    borderRight: col < 6 ? BORDER : 'none',
                    borderBottom: isLastRow ? 'none' : BORDER,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                      <span style={{
                        fontSize: '0.8rem', fontWeight: isToday ? 800 : 600, lineHeight: 1,
                        minWidth: '22px', width: '22px', height: '22px', flexShrink: 0,
                        borderRadius: '50%',
                        background: isToday ? '#EB701A' : 'transparent',
                        color: isToday ? '#fff' : col === 0 ? '#ef4444' : col === 6 ? '#3b82f6' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{day}</span>
                      {vods.length > 0 && (
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, background: 'rgba(235,112,26,0.15)', color: '#EB701A', padding: '1px 5px', borderRadius: '100px', flexShrink: 0 }}>
                          {vods.length}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                      {vods.slice(0, 2).map((vod: any, vi: number) => (
                        <a key={vi} href={`https://vod.sooplive.com/player/${vod.id}`} target="_blank" rel="noopener noreferrer"
                          title={vod.title}
                          style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text)', background: 'rgba(235,112,26,0.08)', borderRadius: '4px', padding: '2px 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none', minWidth: 0 }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(235,112,26,0.2)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(235,112,26,0.08)'}>
                          {vod.title}
                        </a>
                      ))}
                      {vods.length > 2 && (
                        <span style={{ fontSize: '0.65rem', color: '#EB701A', fontWeight: 700, padding: '1px 5px' }}>+{vods.length - 2}개 더</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {(() => {
                const totalCells = firstDay + daysInMonth;
                const remainder = totalCells % 7;
                if (remainder === 0) return null;
                const trailing = 7 - remainder;
                return Array.from({ length: trailing }).map((_, i) => (
                  <div key={`t${i}`} style={{
                    minHeight: '90px', background: 'var(--bg-deeper)', overflow: 'hidden',
                    borderRight: (remainder + i) < 6 ? BORDER : 'none',
                    borderBottom: 'none',
                  }} />
                ));
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
