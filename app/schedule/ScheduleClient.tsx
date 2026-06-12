'use client';
import { useState, useEffect } from 'react';

const ACCENT  = '#EB701A';
const DAY_KO  = ['일','월','화','수','목','금','토'];
const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

const CAT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  '방송':     { bg: 'rgba(235,112,26,0.15)', color: '#EB701A',  label: '📺 방송' },
  '개인일정': { bg: 'rgba(74,127,232,0.15)', color: '#4A7FE8',  label: '🗓 개인' },
  '휴일':     { bg: 'rgba(100,180,100,0.15)',color: '#4CAF50',  label: '🏖 휴일' },
};

interface Event { date: number; category: string | null; text: string; }

export default function ScheduleClient() {
  const now  = new Date();
  const [year,  setYear]    = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
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

  const firstDay = new Date(year, month-1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = now.getFullYear()===year && now.getMonth()+1===month ? now.getDate() : null;

  const eventMap: Record<number, Event> = {};
  events.forEach(e => { eventMap[e.date] = e; });

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({length: daysInMonth}, (_,i) => i+1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selEvent = selected ? eventMap[selected] : null;

  return (
    <div style={{ background:'#0b0b0b', minHeight:'100vh', color:'#fff', fontFamily:'system-ui,sans-serif' }}>

      {/* 헤더 */}
      <div style={{ borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'14px clamp(1rem,4vw,2.5rem)', display:'flex', alignItems:'center', gap:'12px' }}>
        <a href="/" style={{ color:'rgba(255,255,255,0.35)', fontSize:'0.78rem', textDecoration:'none', fontWeight:600 }}>← 홈</a>
        <span style={{ color:'rgba(255,255,255,0.12)' }}>|</span>
        <span style={{ fontWeight:900, fontSize:'1rem' }}>📅 일정표</span>
        {/* 범례 */}
        <div style={{ display:'flex', gap:'8px', marginLeft:'auto' }}>
          {Object.entries(CAT_STYLE).map(([k, s]) => (
            <span key={k} style={{ fontSize:'0.65rem', fontWeight:700, padding:'2px 8px', borderRadius:'100px', background:s.bg, color:s.color }}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'24px clamp(1rem,4vw,2rem)' }}>

        {/* 월 네비 */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
          <button onClick={prevMonth} style={{ width:'36px', height:'36px', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'#fff', cursor:'pointer', fontSize:'1.1rem' }}>‹</button>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'1.5rem', fontWeight:900, letterSpacing:'-0.04em' }}>
              {MONTH_KO[month-1]} <em style={{ color:ACCENT, fontStyle:'normal', fontSize:'1.1rem' }}>{year}</em>
            </div>
            <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.3)', marginTop:'3px' }}>
              {loading ? '불러오는 중...' : error ? <span style={{color:'#ff6b6b'}}>⚠️ {error}</span> : `일정 ${events.filter(e=>e.category&&e.category!=='선택취소').length + events.filter(e=>e.text).length}건`}
            </div>
          </div>
          <button onClick={nextMonth} style={{ width:'36px', height:'36px', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'#fff', cursor:'pointer', fontSize:'1.1rem' }}>›</button>
        </div>

        {/* 달력 */}
        <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px', overflow:'hidden' }}>
          {/* 요일 헤더 */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
            {DAY_KO.map((d, i) => (
              <div key={d} style={{ padding:'10px 0', textAlign:'center', fontSize:'0.72rem', fontWeight:800,
                color: i===0 ? '#ff6b6b' : i===6 ? '#6090ff' : 'rgba(255,255,255,0.35)' }}>{d}</div>
            ))}
          </div>

          {/* 날짜 셀 */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
            {cells.map((day, idx) => {
              const ev      = day ? eventMap[day] : null;
              const isToday = day === today;
              const isSel   = day === selected;
              const isSun   = idx % 7 === 0;
              const isSat   = idx % 7 === 6;
              const catStyle = ev?.category ? CAT_STYLE[ev.category] : null;

              return (
                <div key={idx}
                  onClick={() => day && setSelected(isSel ? null : day)}
                  style={{
                    minHeight:'100px', padding:'8px 6px', position:'relative',
                    borderRight: idx%7===6 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                    borderBottom: idx < cells.length-7 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: isSel ? 'rgba(235,112,26,0.07)' : isToday ? 'rgba(255,255,255,0.025)' : 'transparent',
                    cursor: day ? 'pointer' : 'default',
                    transition:'background 0.15s',
                    display:'flex', flexDirection:'column', gap:'4px',
                  }}>
                  {day && (
                    <>
                      {/* 날짜 숫자 */}
                      <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
                        width:'24px', height:'24px', borderRadius:'50%', flexShrink:0,
                        background: isToday ? ACCENT : 'transparent',
                        fontSize:'0.78rem', fontWeight: isToday||!!ev ? 800 : 400,
                        color: isToday ? '#fff' : isSun ? '#ff6b6b' : isSat ? '#6090ff' : ev ? '#fff' : 'rgba(255,255,255,0.45)',
                      }}>
                        {day}
                      </div>

                      {/* 카테고리 배지 */}
                      {ev?.category && catStyle && (
                        <div style={{
                          fontSize:'0.62rem', fontWeight:800, padding:'2px 5px', borderRadius:'5px',
                          background: catStyle.bg, color: catStyle.color,
                          border: `1px solid ${catStyle.color}33`,
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                        }}>
                          {catStyle.label}
                        </div>
                      )}

                      {/* 자유 텍스트 */}
                      {ev?.text && (
                        <div style={{
                          fontSize:'0.62rem', fontWeight:600, lineHeight:1.35,
                          color:'rgba(255,255,255,0.75)',
                          padding:'2px 5px', borderRadius:'5px',
                          background:'rgba(255,255,255,0.05)',
                          border:'1px solid rgba(255,255,255,0.08)',
                          overflow:'hidden', display:'-webkit-box',
                          WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const,
                          wordBreak:'break-all',
                        }}>
                          {ev.text}
                        </div>
                      )}

                      {/* 이벤트 표시 점 */}
                      {ev && !isSel && (
                        <div style={{ position:'absolute', top:'6px', right:'5px', width:'5px', height:'5px', borderRadius:'50%',
                          background: catStyle?.color || 'rgba(255,255,255,0.4)' }} />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 선택한 날 상세 */}
        {selected && selEvent && (
          <div style={{ marginTop:'14px', padding:'16px 20px', borderRadius:'14px', animation:'fadeIn 0.2s both',
            background: selEvent.category && CAT_STYLE[selEvent.category]
              ? CAT_STYLE[selEvent.category].bg.replace('0.15', '0.1')
              : 'rgba(255,255,255,0.04)',
            border: `1px solid ${selEvent.category && CAT_STYLE[selEvent.category] ? CAT_STYLE[selEvent.category].color + '44' : 'rgba(255,255,255,0.1)'}`,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px', flexWrap:'wrap' }}>
              <span style={{ fontSize:'1.05rem', fontWeight:900, color: selEvent.category && CAT_STYLE[selEvent.category] ? CAT_STYLE[selEvent.category].color : '#fff' }}>
                {month}월 {selected}일 ({DAY_KO[new Date(year,month-1,selected).getDay()]}요일)
              </span>
              {selEvent.category && CAT_STYLE[selEvent.category] && (
                <span style={{ fontSize:'0.7rem', fontWeight:800, padding:'3px 10px', borderRadius:'100px',
                  background: CAT_STYLE[selEvent.category].bg, color: CAT_STYLE[selEvent.category].color }}>
                  {CAT_STYLE[selEvent.category].label}
                </span>
              )}
            </div>
            {selEvent.text && <p style={{ fontSize:'0.9rem', lineHeight:1.6, color:'rgba(255,255,255,0.8)', margin:0 }}>{selEvent.text}</p>}
          </div>
        )}

        {/* 하단 링크 */}
        <div style={{ marginTop:'18px', display:'flex', alignItems:'center', justifyContent:'center', gap:'14px' }}>
          <button onClick={() => { setYear(y=>y); setMonth(m=>m); }} style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.35)', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'5px 12px', cursor:'pointer' }}>
            🔄 새로고침
          </button>
          <a href="https://docs.google.com/spreadsheets/d/1Zm1VOH4rASeczj1mtxXE1pnafBPQb5x9Tak0cwdq8w4/edit"
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.25)', textDecoration:'none' }}>
            📝 시트에서 수정
          </a>
        </div>
      </div>

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
