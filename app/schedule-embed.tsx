'use client';
import { useState, useEffect } from 'react';

const ACCENT  = '#EB701A';
const DAY_KO  = ['일','월','화','수','목','금','토'];
const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

const CAT: Record<string, { bg:string; border:string; color:string; label:string }> = {
  '방송':     { bg:'#FFF0E5', border:'#F4A06A', color:'#C05A10', label:'📺 방송' },
  '개인일정': { bg:'#E8F0FF', border:'#7AAAF5', color:'#2458C8', label:'🗓 개인' },
  '개인 일정':{ bg:'#E8F0FF', border:'#7AAAF5', color:'#2458C8', label:'🗓 개인' },
  '휴일':     { bg:'#E6F7E8', border:'#70C877', color:'#1E7D25', label:'🏖 휴일' },
};

interface Event { date: number; category: string | null; texts: string[]; }

export default function ScheduleEmbed() {
  const now = new Date();
  const [year,  setYear]    = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

  const fetchData = () => {
    setLoading(true); setSelected(null);
    fetch(`/api/schedule?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => { setEvents(d.events || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [year, month]);

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
  const getCat = (ev: Event | undefined) => ev?.category ? (CAT[ev.category] ?? CAT[ev.category.replace(/\s/g,'')]) : null;

  return (
    <div style={{ width:'100%' }}>
      {/* 컨트롤 바 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <button onClick={prev} style={{ width:'34px', height:'34px', borderRadius:'8px', border:'1.5px solid var(--card-border)', background:'var(--card)', color:'var(--text)', cursor:'pointer', fontSize:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>‹</button>
          <span style={{ fontWeight:800, fontSize:'1.05rem', letterSpacing:'-0.02em', color:'var(--text)' }}>
            {MONTH_KO[month-1]} {year}
          </span>
          <button onClick={next} style={{ width:'34px', height:'34px', borderRadius:'8px', border:'1.5px solid var(--card-border)', background:'var(--card)', color:'var(--text)', cursor:'pointer', fontSize:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>›</button>
          <button onClick={fetchData} disabled={loading} title="새로고침" style={{ width:'32px', height:'32px', borderRadius:'8px', border:'1.5px solid var(--card-border)', background:'var(--card)', color:'var(--text)', cursor:loading?'wait':'pointer', fontSize:'0.9rem', display:'flex', alignItems:'center', justifyContent:'center', opacity:loading?0.5:1 }}>🔄</button>
          {loading && <span style={{ fontSize:'0.72rem', color:'#999' }}>불러오는 중...</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          {Object.entries(CAT).filter(([,s],i,arr)=>arr.findIndex(([,x])=>x.label===s.label)===i).map(([k,s]) => (
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
              color: i===0?'#D94040':i===6?'#2458C8':'#666' }}>{d}</div>
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
            const catS    = getCat(ev ?? undefined);
            const hasTexts = (ev?.texts?.length ?? 0) > 0;

            return (
              <div key={idx}
                onClick={() => day && setSelected(isSel ? null : day)}
                style={{
                  minHeight:'100px', padding:'7px 7px 6px',
                  borderRight: idx%7===6 ? 'none' : '1px solid rgba(0,0,0,0.06)',
                  borderBottom: idx<cells.length-7 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                  display:'flex', flexDirection:'column', gap:'3px',
                  background: isSel ? '#FFF5EE' : isToday ? '#FFFAF7' : isSun ? 'rgba(220,80,80,0.025)' : isSat ? 'rgba(36,88,200,0.025)' : '#fff',
                  cursor: day ? 'pointer' : 'default',
                  transition:'background 0.12s',
                  position:'relative',
                }}
                onMouseEnter={e => { if(day && !isSel)(e.currentTarget as HTMLElement).style.background='#F8F8F8'; }}
                onMouseLeave={e => { if(day && !isSel)(e.currentTarget as HTMLElement).style.background=isToday?'#FFFAF7':isSun?'rgba(220,80,80,0.025)':isSat?'rgba(36,88,200,0.025)':'#fff'; }}
              >
                {day && (
                  <>
                    {/* 날짜 숫자 */}
                    <div style={{
                      display:'inline-flex', alignItems:'center', justifyContent:'center',
                      width:'26px', height:'26px', borderRadius:'50%', flexShrink:0,
                      background: isToday ? ACCENT : 'transparent',
                      fontSize:'0.85rem', fontWeight: isToday ? 900 : ev ? 700 : 500,
                      color: isToday ? '#fff' : isSun ? '#D94040' : isSat ? '#2458C8' : ev ? '#111' : '#999',
                    }}>{day}</div>

                    {/* 카테고리 배지 */}
                    {ev?.category && catS && (
                      <div style={{
                        fontSize:'0.68rem', fontWeight:800, padding:'2px 6px', borderRadius:'5px',
                        background:catS.bg, color:catS.color, border:`1.5px solid ${catS.border}`,
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      }}>{catS.label}</div>
                    )}

                    {/* 자유 텍스트 줄별 표시 */}
                    {hasTexts && ev!.texts.map((t, ti) => (
                      <div key={ti} style={{
                        fontSize:'0.68rem', fontWeight:600, lineHeight:1.35,
                        color:'#222',
                        padding:'2px 6px', borderRadius:'5px',
                        background:'rgba(0,0,0,0.04)',
                        borderLeft:`2.5px solid ${catS ? catS.border : 'rgba(0,0,0,0.2)'}`,
                        overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
                      }}>{t}</div>
                    ))}

                    {/* 이벤트 점 */}
                    {ev && !isSel && (
                      <div style={{ position:'absolute', top:'5px', right:'5px', width:'5px', height:'5px', borderRadius:'50%',
                        background: catS ? catS.color : '#888' }} />
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
        <div style={{ marginTop:'12px', padding:'16px 18px', borderRadius:'12px', animation:'fadeIn 0.2s both',
          background: getCat(selEv) ? getCat(selEv)!.bg : '#F5F5F5',
          border: `1.5px solid ${getCat(selEv) ? getCat(selEv)!.border : 'rgba(0,0,0,0.12)'}`,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom: selEv.texts.length ? '10px' : '0', flexWrap:'wrap' }}>
            <span style={{ fontWeight:900, fontSize:'0.95rem', color: getCat(selEv) ? getCat(selEv)!.color : '#111' }}>
              {month}월 {selected}일 ({DAY_KO[new Date(year,month-1,selected).getDay()]}요일)
            </span>
            {selEv.category && getCat(selEv) && (
              <span style={{ fontSize:'0.72rem', fontWeight:800, padding:'3px 10px', borderRadius:'100px',
                background:getCat(selEv)!.bg, color:getCat(selEv)!.color, border:`1.5px solid ${getCat(selEv)!.border}` }}>
                {getCat(selEv)!.label}
              </span>
            )}
          </div>
          {selEv.texts.map((t, i) => (
            <div key={i} style={{
              fontSize:'0.9rem', lineHeight:1.6, color:'#222',
              padding:'6px 10px',
              borderLeft:`3px solid ${getCat(selEv) ? getCat(selEv)!.border : 'rgba(0,0,0,0.2)'}`,
              background:'rgba(255,255,255,0.6)',
              borderRadius:'0 6px 6px 0',
              marginBottom: i < selEv.texts.length - 1 ? '6px' : '0',
            }}>{t}</div>
          ))}
        </div>
      )}

      {/* 입력 안내 */}
      <p style={{ marginTop:'10px', fontSize:'0.68rem', color:'rgba(128,128,128,0.6)', textAlign:'center' as const }}>
        💡 날짜 아래 드롭다운으로 카테고리, 그 아래 줄에 텍스트 입력
      </p>

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
