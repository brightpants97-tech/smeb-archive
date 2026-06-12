'use client';
import { useState, useEffect } from 'react';

const ACCENT  = '#EB701A';
const DAY_KO  = ['일','월','화','수','목','금','토'];
const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

const CAT: Record<string, { bg:string; border:string; color:string; label:string }> = {
  '방송':     { bg:'#FFF0E5', border:'#F4A06A', color:'#C05A10', label:'📺 방송' },
  '개인일정': { bg:'#E8F0FF', border:'#7AAAF5', color:'#2458C8', label:'🗓 개인' },
  '휴일':     { bg:'#E6F7E8', border:'#70C877', color:'#1E7D25', label:'🏖 휴일' },
};

interface Event { date: number; category: string | null; text: string; }

export default function ScheduleEmbed() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true); setSelected(null);
    fetch(`/api/schedule?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => { setEvents(d.events || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [year, month]);

  const prev = () => { if(month===1){setYear(y=>y-1);setMonth(12);}else setMonth(m=>m-1); };
  const next = () => { if(month===12){setYear(y=>y+1);setMonth(1);}else setMonth(m=>m+1); };

  const firstDay    = new Date(year, month-1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today       = now.getFullYear()===year && now.getMonth()+1===month ? now.getDate() : null;

  const eMap: Record<number, Event> = {};
  events.forEach(e => { eMap[e.date] = e; });

  const cells: (number|null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({length: daysInMonth}, (_,i) => i+1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selEv  = selected ? eMap[selected] : null;
  const selCat = selEv?.category ? CAT[selEv.category] : null;

  return (
    <div style={{ width:'100%' }}>

      {/* 컨트롤 바 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <button onClick={prev} style={{ width:'34px', height:'34px', borderRadius:'8px', border:'1.5px solid rgba(0,0,0,0.15)', background:'rgba(0,0,0,0.04)', color:'#333', cursor:'pointer', fontSize:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>‹</button>
          <span style={{ fontWeight:800, fontSize:'1.05rem', letterSpacing:'-0.02em', color:'#1A1A1A' }}>
            {MONTH_KO[month-1]} {year}
          </span>
          <button onClick={next} style={{ width:'34px', height:'34px', borderRadius:'8px', border:'1.5px solid rgba(0,0,0,0.15)', background:'rgba(0,0,0,0.04)', color:'#333', cursor:'pointer', fontSize:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>›</button>
          {loading && <span style={{ fontSize:'0.72rem', color:'#999' }}>불러오는 중...</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          {Object.entries(CAT).map(([k, s]) => (
            <span key={k} style={{ fontSize:'0.72rem', fontWeight:700, padding:'4px 10px', borderRadius:'100px', background:s.bg, color:s.color, border:`1.5px solid ${s.border}` }}>{s.label}</span>
          ))}
        </div>
      </div>

      {/* 달력 */}
      <div style={{ border:'1.5px solid rgba(0,0,0,0.1)', borderRadius:'14px', overflow:'hidden', background:'#fff' }}>

        {/* 요일 헤더 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1.5px solid rgba(0,0,0,0.08)', background:'rgba(0,0,0,0.025)' }}>
          {DAY_KO.map((d, i) => (
            <div key={d} style={{ padding:'12px 0', textAlign:'center', fontSize:'0.8rem', fontWeight:800,
              color: i===0 ? '#D94040' : i===6 ? '#2458C8' : '#666' }}>{d}</div>
          ))}
        </div>

        {/* 날짜 셀 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
          {cells.map((day, idx) => {
            const ev      = day ? eMap[day] : null;
            const isToday = day === today;
            const isSel   = day === selected;
            const isSun   = idx % 7 === 0;
            const isSat   = idx % 7 === 6;
            const catS    = ev?.category ? CAT[ev.category] : null;

            return (
              <div key={idx}
                onClick={() => day && setSelected(isSel ? null : day)}
                style={{
                  minHeight:'96px', padding:'8px 8px 6px',
                  borderRight: idx%7===6 ? 'none' : '1px solid rgba(0,0,0,0.06)',
                  borderBottom: idx<cells.length-7 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                  display:'flex', flexDirection:'column', gap:'4px',
                  background: isSel ? '#FFF5EE' : isToday ? '#FFFAF7' : idx%7===0 ? 'rgba(220,80,80,0.025)' : idx%7===6 ? 'rgba(36,88,200,0.025)' : '#fff',
                  cursor: day ? 'pointer' : 'default',
                  transition:'background 0.12s',
                  position:'relative',
                }}
                onMouseEnter={e => { if(day && !isSel) (e.currentTarget as HTMLElement).style.background = '#F8F8F8'; }}
                onMouseLeave={e => { if(day && !isSel) (e.currentTarget as HTMLElement).style.background = isToday ? '#FFFAF7' : idx%7===0 ? 'rgba(220,80,80,0.025)' : idx%7===6 ? 'rgba(36,88,200,0.025)' : '#fff'; }}
              >
                {day && (
                  <>
                    {/* 날짜 숫자 */}
                    <div style={{
                      display:'inline-flex', alignItems:'center', justifyContent:'center',
                      width:'28px', height:'28px', borderRadius:'50%', flexShrink:0,
                      background: isToday ? ACCENT : 'transparent',
                      fontSize:'0.88rem',
                      fontWeight: isToday ? 900 : ev ? 700 : 500,
                      color: isToday ? '#fff' : isSun ? '#D94040' : isSat ? '#2458C8' : ev ? '#1A1A1A' : '#999',
                    }}>{day}</div>

                    {/* 카테고리 배지 */}
                    {ev?.category && catS && (
                      <div style={{
                        fontSize:'0.7rem', fontWeight:800, padding:'3px 7px', borderRadius:'6px',
                        background:catS.bg, color:catS.color,
                        border:`1.5px solid ${catS.border}`,
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      }}>{catS.label}</div>
                    )}

                    {/* 자유 텍스트 */}
                    {ev?.text && (
                      <div style={{
                        fontSize:'0.7rem', fontWeight:600, lineHeight:1.4,
                        color:'#333',
                        padding:'3px 7px', borderRadius:'6px',
                        background:'rgba(0,0,0,0.05)',
                        border:'1px solid rgba(0,0,0,0.09)',
                        overflow:'hidden', display:'-webkit-box',
                        WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const,
                        wordBreak:'break-all',
                      }}>{ev.text}</div>
                    )}

                    {/* 이벤트 점 */}
                    {ev && !isSel && (
                      <div style={{ position:'absolute', top:'6px', right:'6px', width:'6px', height:'6px', borderRadius:'50%',
                        background: catS ? catS.color : '#666' }} />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 선택한 날 상세 */}
      {selected && selEv && (
        <div style={{ marginTop:'12px', padding:'14px 18px', borderRadius:'12px', animation:'fadeIn 0.2s both',
          background: selCat ? selCat.bg : '#F5F5F5',
          border: `1.5px solid ${selCat ? selCat.border : 'rgba(0,0,0,0.12)'}`,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom: selEv.text ? '8px' : '0', flexWrap:'wrap' }}>
            <span style={{ fontWeight:900, fontSize:'0.95rem', color: selCat ? selCat.color : '#1A1A1A' }}>
              {month}월 {selected}일 ({DAY_KO[new Date(year,month-1,selected).getDay()]}요일)
            </span>
            {selEv.category && selCat && (
              <span style={{ fontSize:'0.72rem', fontWeight:800, padding:'3px 10px', borderRadius:'100px', background:selCat.bg, color:selCat.color, border:`1.5px solid ${selCat.border}` }}>
                {selCat.label}
              </span>
            )}
          </div>
          {selEv.text && <p style={{ fontSize:'0.9rem', lineHeight:1.6, color:'#333', margin:0 }}>{selEv.text}</p>}
        </div>
      )}

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
