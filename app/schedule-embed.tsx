'use client';
import { useState, useEffect } from 'react';

const ACCENT = '#EB701A';
const DAY_KO = ['일','월','화','수','목','금','토'];
const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

const CAT = {
  '방송':     { bg:'rgba(235,112,26,0.15)', color:'#EB701A',  icon:'📺' },
  '개인일정': { bg:'rgba(74,127,232,0.15)', color:'#4A7FE8',  icon:'🗓' },
  '휴일':     { bg:'rgba(76,175,80,0.15)',  color:'#4CAF50',  icon:'🏖' },
} as const;

interface Event { date: number; category: string | null; text: string; }

export default function ScheduleEmbed() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/schedule?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => { setEvents(d.events || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [year, month]);

  const prev = () => { if (month===1){setYear(y=>y-1);setMonth(12);}else setMonth(m=>m-1); };
  const next = () => { if (month===12){setYear(y=>y+1);setMonth(1);}else setMonth(m=>m+1); };

  const firstDay = new Date(year, month-1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = now.getFullYear()===year && now.getMonth()+1===month ? now.getDate() : null;

  const eMap: Record<number, Event> = {};
  events.forEach(e => { eMap[e.date] = e; });

  const cells: (number|null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({length: daysInMonth}, (_,i) => i+1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ width:'100%' }}>
      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'10px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <button onClick={prev} style={{ width:'30px', height:'30px', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'#fff', cursor:'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
          <span style={{ fontWeight:900, fontSize:'1.05rem', letterSpacing:'-0.03em' }}>
            {MONTH_KO[month-1]} <em style={{ color:ACCENT, fontStyle:'normal' }}>{year}</em>
            {loading && <span style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.3)', marginLeft:'8px', fontWeight:400 }}>불러오는 중...</span>}
          </span>
          <button onClick={next} style={{ width:'30px', height:'30px', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'#fff', cursor:'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {/* 범례 */}
          {Object.entries(CAT).map(([k, s]) => (
            <span key={k} style={{ fontSize:'0.62rem', fontWeight:700, padding:'2px 7px', borderRadius:'100px', background:s.bg, color:s.color }}>{s.icon} {k}</span>
          ))}
        </div>
      </div>

      {/* 달력 */}
      <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'14px', overflow:'hidden' }}>
        {/* 요일 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          {DAY_KO.map((d, i) => (
            <div key={d} style={{ padding:'8px 0', textAlign:'center', fontSize:'0.65rem', fontWeight:800,
              color: i===0?'#ff6b6b':i===6?'6090ff':'rgba(255,255,255,0.3)' }}>{d}</div>
          ))}
        </div>

        {/* 날짜 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
          {cells.map((day, idx) => {
            const ev = day ? eMap[day] : null;
            const isToday = day===today;
            const isSun = idx%7===0, isSat = idx%7===6;
            const catS = ev?.category ? (CAT as any)[ev.category] : null;

            return (
              <div key={idx} style={{
                minHeight:'80px', padding:'6px 5px',
                borderRight: idx%7===6?'none':'1px solid rgba(255,255,255,0.04)',
                borderBottom: idx<cells.length-7?'1px solid rgba(255,255,255,0.04)':'none',
                display:'flex', flexDirection:'column', gap:'3px',
                background: isToday?'rgba(255,255,255,0.02)':'transparent',
              }}>
                {day && (
                  <>
                    <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
                      width:'22px', height:'22px', borderRadius:'50%', flexShrink:0,
                      background: isToday?ACCENT:'transparent',
                      fontSize:'0.72rem', fontWeight: isToday||!!ev?800:400,
                      color: isToday?'#fff':isSun?'#ff6b6b':isSat?'#6090ff':ev?'#fff':'rgba(255,255,255,0.4)',
                    }}>{day}</div>

                    {ev?.category && catS && (
                      <div style={{ fontSize:'0.58rem', fontWeight:800, padding:'1px 4px', borderRadius:'4px',
                        background:catS.bg, color:catS.color, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {catS.icon} {ev.category}
                      </div>
                    )}

                    {ev?.text && (
                      <div style={{ fontSize:'0.58rem', fontWeight:600, lineHeight:1.3,
                        color:'rgba(255,255,255,0.65)', padding:'1px 4px', borderRadius:'4px',
                        background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)',
                        overflow:'hidden', display:'-webkit-box',
                        WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const, wordBreak:'break-all' }}>
                        {ev.text}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
