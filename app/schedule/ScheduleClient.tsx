'use client';
import { useState, useEffect } from 'react';

const ACCENT = '#EB701A';
const DAY_KO = ['일','월','화','수','목','금','토'];
const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

interface Event { date: number; text: string; }

export default function ScheduleClient() {
  const now   = new Date();
  const [year,  setYear]   = useState(now.getFullYear());
  const [month, setMonth]  = useState(now.getMonth() + 1);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]       = useState('');
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true); setSelected(null); setError('');
    fetch(`/api/schedule?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => { setEvents(d.events || []); if (d.error) setError(d.error); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [year, month]);

  const prevMonth = () => { if (month === 1) { setYear(y => y-1); setMonth(12); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y+1); setMonth(1); } else setMonth(m => m+1); };

  // 달력 계산
  const firstDay = new Date(year, month-1, 1).getDay(); // 0=일
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = now.getFullYear()===year && now.getMonth()+1===month ? now.getDate() : null;

  const eventMap: Record<number, string> = {};
  events.forEach(e => { eventMap[e.date] = e.text; });

  const selectedEvent = selected ? eventMap[selected] : null;

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({length: daysInMonth}, (_,i) => i+1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ background:'#0b0b0b', minHeight:'100vh', color:'#fff', fontFamily:'system-ui,sans-serif' }}>

      {/* 헤더 */}
      <div style={{ borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'14px clamp(1rem,4vw,2.5rem)', display:'flex', alignItems:'center', gap:'12px' }}>
        <a href="/" style={{ color:'rgba(255,255,255,0.35)', fontSize:'0.78rem', textDecoration:'none', fontWeight:600 }}>← 홈</a>
        <span style={{ color:'rgba(255,255,255,0.12)' }}>|</span>
        <span style={{ fontWeight:900, fontSize:'1rem' }}>📅 일정표</span>
      </div>

      <div style={{ maxWidth:'900px', margin:'0 auto', padding:'28px clamp(1rem,4vw,2rem)' }}>

        {/* 월 네비게이션 */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
          <button onClick={prevMonth} style={{ width:'36px', height:'36px', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'#fff', cursor:'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'1.6rem', fontWeight:900, letterSpacing:'-0.04em', lineHeight:1 }}>
              {MONTH_KO[month-1]}
              <em style={{ color:ACCENT, fontStyle:'normal', marginLeft:'6px', fontSize:'1.2rem' }}>{year}</em>
            </div>
            {loading && <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.3)', marginTop:'4px' }}>불러오는 중...</div>}
            {!loading && !error && <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.3)', marginTop:'4px' }}>일정 {events.length}개</div>}
            {error && <div style={{ fontSize:'0.7rem', color:'#ff6b6b', marginTop:'4px', maxWidth:'280px' }}>⚠️ {error}</div>}
          </div>
          <button onClick={nextMonth} style={{ width:'36px', height:'36px', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'#fff', cursor:'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
        </div>

        {/* 달력 그리드 */}
        <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px', overflow:'hidden' }}>

          {/* 요일 헤더 */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
            {DAY_KO.map((d, i) => (
              <div key={d} style={{ padding:'10px 0', textAlign:'center', fontSize:'0.72rem', fontWeight:800, letterSpacing:'0.05em',
                color: i===0 ? '#ff6b6b' : i===6 ? '#6090ff' : 'rgba(255,255,255,0.35)' }}>
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 셀 */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
            {cells.map((day, idx) => {
              const isToday   = day === today;
              const hasEvent  = day !== null && !!eventMap[day];
              const isSel     = day === selected;
              const isSun     = idx % 7 === 0;
              const isSat     = idx % 7 === 6;
              return (
                <div key={idx}
                  onClick={() => day && setSelected(isSel ? null : day)}
                  style={{
                    minHeight:'72px', padding:'8px', position:'relative',
                    borderRight: idx%7===6 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                    borderBottom: idx < cells.length-7 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: isSel ? 'rgba(235,112,26,0.08)' : isToday ? 'rgba(255,255,255,0.03)' : 'transparent',
                    cursor: day ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (day) (e.currentTarget as HTMLElement).style.background = isSel ? 'rgba(235,112,26,0.1)' : 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={e => { if (day) (e.currentTarget as HTMLElement).style.background = isSel ? 'rgba(235,112,26,0.08)' : isToday ? 'rgba(255,255,255,0.03)' : 'transparent'; }}
                >
                  {day && (
                    <>
                      {/* 날짜 숫자 */}
                      <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
                        width:'26px', height:'26px', borderRadius:'50%',
                        background: isToday ? ACCENT : 'transparent',
                        fontSize:'0.82rem', fontWeight: isToday||hasEvent ? 900 : 500,
                        color: isToday ? '#fff' : isSun ? '#ff6b6b' : isSat ? '#6090ff' : hasEvent ? '#fff' : 'rgba(255,255,255,0.5)',
                        marginBottom:'4px',
                      }}>
                        {day}
                      </div>

                      {/* 이벤트 텍스트 */}
                      {hasEvent && (
                        <div style={{
                          fontSize:'0.65rem', fontWeight:700, lineHeight:1.35,
                          color: isSel ? ACCENT : 'rgba(255,255,255,0.8)',
                          padding:'3px 5px', borderRadius:'5px',
                          background: isSel ? 'rgba(235,112,26,0.15)' : 'rgba(255,255,255,0.05)',
                          border: isSel ? '1px solid rgba(235,112,26,0.3)' : '1px solid rgba(255,255,255,0.07)',
                          overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const,
                          wordBreak:'break-all',
                        }}>
                          {eventMap[day]}
                        </div>
                      )}

                      {/* 이벤트 있음 점 표시 */}
                      {hasEvent && !isSel && (
                        <div style={{ position:'absolute', top:'6px', right:'6px', width:'5px', height:'5px', borderRadius:'50%', background:ACCENT }} />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 선택한 날 이벤트 상세 */}
        {selected && selectedEvent && (
          <div style={{ marginTop:'16px', padding:'16px 20px', background:'rgba(235,112,26,0.07)', border:'1px solid rgba(235,112,26,0.25)', borderRadius:'14px', animation:'fadeIn 0.2s both' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
              <span style={{ fontSize:'1.1rem', fontWeight:900, color:ACCENT }}>{month}월 {selected}일</span>
              <span style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.3)', background:'rgba(255,255,255,0.06)', padding:'2px 8px', borderRadius:'100px' }}>
                {DAY_KO[new Date(year, month-1, selected).getDay()]}요일
              </span>
            </div>
            <p style={{ fontSize:'0.92rem', lineHeight:1.6, color:'rgba(255,255,255,0.85)', margin:0 }}>{selectedEvent}</p>
          </div>
        )}

        {/* 시트 링크 */}
        <div style={{ marginTop:'20px', textAlign:'center' }}>
          <a href={`https://docs.google.com/spreadsheets/d/1Zm1VOH4rASeczj1mtxXE1pnafBPQb5x9Tak0cwdq8w4/edit`}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.25)', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:'4px' }}>
📝 Google Sheets에서 수정
          </a>
        </div>
      </div>

      <style>{`@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  );
}
