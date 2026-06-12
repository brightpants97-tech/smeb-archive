'use client';
import { useState, useEffect } from 'react';

const ACCENT  = '#EB701A';
const DAY_KO  = ['일','월','화','수','목','금','토'];
const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

const CAT: Record<string, { bg:string; border:string; color:string; label:string }> = {
  '방송':     { bg:'rgba(235,112,26,0.18)', border:'rgba(235,112,26,0.4)',  color:'#FF8C3A', label:'📺 방송' },
  '개인일정': { bg:'rgba(74,127,232,0.18)', border:'rgba(74,127,232,0.4)',  color:'#6EA8FF', label:'🗓 개인' },
  '휴일':     { bg:'rgba(76,175,80,0.18)',  border:'rgba(76,175,80,0.4)',   color:'#6DCF72', label:'🏖 휴일' },
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

  const prev = () => { if (month===1){setYear(y=>y-1);setMonth(12);}else setMonth(m=>m-1); };
  const next = () => { if (month===12){setYear(y=>y+1);setMonth(1);}else setMonth(m=>m+1); };

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

  const selEv = selected ? eMap[selected] : null;
  const selCat = selEv?.category ? CAT[selEv.category] : null;

  return (
    <div style={{ width:'100%' }}>

      {/* 컨트롤 바 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'10px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <button onClick={prev} style={{ width:'32px', height:'32px', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
          <span style={{ fontWeight:800, fontSize:'1rem', letterSpacing:'-0.02em', color:'var(--text)' }}>
            {MONTH_KO[month-1]} {year}
            {loading && <span style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.3)', marginLeft:'8px', fontWeight:400 }}>로딩 중</span>}
          </span>
          <button onClick={next} style={{ width:'32px', height:'32px', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          {Object.entries(CAT).map(([k, s]) => (
            <span key={k} style={{ fontSize:'0.68rem', fontWeight:700, padding:'3px 9px', borderRadius:'100px', background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>{s.label}</span>
          ))}
        </div>
      </div>

      {/* 달력 */}
      <div style={{ border:'1px solid rgba(255,255,255,0.09)', borderRadius:'14px', overflow:'hidden', background:'rgba(255,255,255,0.015)' }}>

        {/* 요일 헤더 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)' }}>
          {DAY_KO.map((d, i) => (
            <div key={d} style={{ padding:'11px 0', textAlign:'center', fontSize:'0.75rem', fontWeight:800, letterSpacing:'0.04em',
              color: i===0?'rgba(255,120,120,0.8)':i===6?'rgba(120,160,255,0.8)':'rgba(255,255,255,0.4)' }}>{d}</div>
          ))}
        </div>

        {/* 날짜 셀 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
          {cells.map((day, idx) => {
            const ev     = day ? eMap[day] : null;
            const isToday = day === today;
            const isSel   = day === selected;
            const isSun   = idx % 7 === 0;
            const isSat   = idx % 7 === 6;
            const catS    = ev?.category ? CAT[ev.category] : null;

            return (
              <div key={idx}
                onClick={() => day && setSelected(isSel ? null : day)}
                style={{
                  minHeight:'90px', padding:'8px 7px',
                  borderRight: idx%7===6 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                  borderBottom: idx<cells.length-7 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  display:'flex', flexDirection:'column', gap:'4px',
                  background: isSel ? 'rgba(235,112,26,0.07)' : isToday ? 'rgba(255,255,255,0.03)' : 'transparent',
                  cursor: day ? 'pointer' : 'default',
                  transition:'background 0.12s',
                }}
                onMouseEnter={e => { if (day && !isSel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'; }}
                onMouseLeave={e => { if (day && !isSel) (e.currentTarget as HTMLElement).style.background = isToday ? 'rgba(255,255,255,0.03)' : 'transparent'; }}
              >
                {day && (
                  <>
                    {/* 날짜 숫자 */}
                    <div style={{
                      display:'inline-flex', alignItems:'center', justifyContent:'center',
                      width:'26px', height:'26px', borderRadius:'50%', flexShrink:0,
                      background: isToday ? ACCENT : 'transparent',
                      fontSize:'0.82rem', fontWeight: isToday ? 900 : ev ? 700 : 500,
                      color: isToday ? '#fff' : isSun ? 'rgba(255,110,110,0.9)' : isSat ? 'rgba(110,150,255,0.9)' : ev ? '#fff' : 'rgba(255,255,255,0.55)',
                    }}>{day}</div>

                    {/* 카테고리 배지 */}
                    {ev?.category && catS && (
                      <div style={{
                        fontSize:'0.65rem', fontWeight:800, padding:'2px 6px', borderRadius:'5px',
                        background:catS.bg, color:catS.color, border:`1px solid ${catS.border}`,
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      }}>{catS.label}</div>
                    )}

                    {/* 자유 텍스트 */}
                    {ev?.text && (
                      <div style={{
                        fontSize:'0.65rem', fontWeight:600, lineHeight:1.4,
                        color:'rgba(255,255,255,0.8)',
                        padding:'2px 6px', borderRadius:'5px',
                        background:'rgba(255,255,255,0.07)',
                        border:'1px solid rgba(255,255,255,0.1)',
                        overflow:'hidden', display:'-webkit-box',
                        WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const,
                        wordBreak:'break-all',
                      }}>{ev.text}</div>
                    )}

                    {/* 이벤트 점 표시 */}
                    {ev && !isSel && (
                      <div style={{ position:'absolute' as const, top:'6px', right:'5px', width:'5px', height:'5px', borderRadius:'50%',
                        background: catS ? catS.color : 'rgba(255,255,255,0.5)' }} />
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
        <div style={{ marginTop:'12px', padding:'14px 18px', borderRadius:'12px',
          background: selCat ? selCat.bg : 'rgba(255,255,255,0.05)',
          border: `1px solid ${selCat ? selCat.border : 'rgba(255,255,255,0.1)'}`,
          animation:'fadeIn 0.2s both',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom: selEv.text ? '8px' : '0', flexWrap:'wrap' }}>
            <span style={{ fontWeight:900, fontSize:'0.95rem', color: selCat ? selCat.color : '#fff' }}>
              {month}월 {selected}일 ({DAY_KO[new Date(year,month-1,selected).getDay()]}요일)
            </span>
            {selEv.category && selCat && (
              <span style={{ fontSize:'0.68rem', fontWeight:800, padding:'2px 9px', borderRadius:'100px', background:selCat.bg, color:selCat.color, border:`1px solid ${selCat.border}` }}>
                {selCat.label}
              </span>
            )}
          </div>
          {selEv.text && <p style={{ fontSize:'0.88rem', lineHeight:1.6, color:'rgba(255,255,255,0.85)', margin:0 }}>{selEv.text}</p>}
        </div>
      )}

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
