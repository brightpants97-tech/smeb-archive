'use client';
import { useState, useEffect } from 'react';

const ACCENT  = '#EB701A';
const DAY_KO  = ['일','월','화','수','목','금','토'];
const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

const CAT: Record<string, { color:string; light:string; label:string }> = {
  '방송':      { color:'#D4620A', light:'#FFF3E8', label:'📺 방송' },
  '개인일정':  { color:'#2252CC', light:'#EAF0FF', label:'🗓 개인일정' },
  '개인 일정': { color:'#2252CC', light:'#EAF0FF', label:'🗓 개인일정' },
  '휴일':      { color:'#1A7A28', light:'#E4F5E7', label:'🏖 휴일' },
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

  const getCat = (ev?: Event | null) => {
    if (!ev?.category) return null;
    return CAT[ev.category] ?? CAT[ev.category.replace(/\s/g,'')] ?? null;
  };

  const selEv  = selected ? eMap[selected] : null;
  const selCat = getCat(selEv);

  return (
    <div style={{ width:'100%' }}>

      {/* 컨트롤 바 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'10px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <button onClick={prev} style={{ width:'34px', height:'34px', borderRadius:'8px', border:'1.5px solid var(--card-border)', background:'var(--card)', color:'var(--text)', cursor:'pointer', fontSize:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>‹</button>
          <span style={{ fontWeight:900, fontSize:'1.05rem', color:'var(--text)', minWidth:'90px', textAlign:'center' as const }}>
            {MONTH_KO[month-1]} {year}
          </span>
          <button onClick={next} style={{ width:'34px', height:'34px', borderRadius:'8px', border:'1.5px solid var(--card-border)', background:'var(--card)', color:'var(--text)', cursor:'pointer', fontSize:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>›</button>
          <button onClick={fetchData} disabled={loading} title="새로고침"
            style={{ width:'32px', height:'32px', borderRadius:'8px', border:'1.5px solid var(--card-border)', background:'var(--card)', color:'var(--text)', cursor:loading?'wait':'pointer', fontSize:'0.85rem', display:'flex', alignItems:'center', justifyContent:'center', opacity:loading?0.4:1 }}>
            🔄
          </button>
        </div>

        {/* 범례 */}
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {Object.entries(CAT)
            .filter(([,s], i, arr) => arr.findIndex(([,x]) => x.label === s.label) === i)
            .map(([k, s]) => (
              <div key={k} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'0.72rem', fontWeight:700, color:s.color }}>
                <div style={{ width:'10px', height:'10px', borderRadius:'2px', background:s.color }} />
                {s.label}
              </div>
          ))}
        </div>
      </div>

      {/* 달력 */}
      <div style={{ border:'1.5px solid rgba(0,0,0,0.1)', borderRadius:'12px', overflow:'hidden', background:'#fff' }}>

        {/* 요일 헤더 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid rgba(0,0,0,0.08)', background:'rgba(0,0,0,0.025)' }}>
          {DAY_KO.map((d, i) => (
            <div key={d} style={{ padding:'11px 0', textAlign:'center', fontSize:'0.78rem', fontWeight:800, letterSpacing:'0.04em',
              color: i===0 ? '#C83232' : i===6 ? '#2052C8' : '#666' }}>
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 셀 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
          {cells.map((day, idx) => {
            const ev    = day ? eMap[day] : null;
            const catS  = getCat(ev);
            const isToday = day === today;
            const isSel   = day === selected;
            const isSun   = idx % 7 === 0;
            const isSat   = idx % 7 === 6;
            const hasContent = !!(ev?.category || (ev?.texts?.length ?? 0) > 0);

            return (
              <div key={idx}
                onClick={() => day && setSelected(isSel ? null : day)}
                style={{
                  minHeight:'72px',
                  padding:'0',
                  borderRight: idx%7===6 ? 'none' : '1px solid rgba(0,0,0,0.06)',
                  borderBottom: idx<cells.length-7 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                  display:'flex', flexDirection:'column',
                  background: isSel ? (catS ? catS.light : '#FFF5EE') : '#fff',
                  cursor: day ? 'pointer' : 'default',
                  transition:'background 0.12s',
                  position:'relative', overflow:'hidden',
                }}
                onMouseEnter={e => { if(day && !isSel)(e.currentTarget as HTMLElement).style.background='#F6F6F6'; }}
                onMouseLeave={e => { if(day && !isSel)(e.currentTarget as HTMLElement).style.background= isSel?(catS?catS.light:'#FFF5EE'):'#fff'; }}
              >
                {day && (
                  <>
                    {/* A: 상단 컬러 바 */}
                    <div style={{
                      height: hasContent ? '4px' : '4px',
                      background: catS ? catS.color : 'transparent',
                      flexShrink:0,
                    }} />

                    <div style={{ padding:'7px 8px 8px', flex:1, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                      {/* 날짜 숫자 */}
                      <div style={{
                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                        width:'28px', height:'28px', borderRadius:'50%', flexShrink:0,
                        background: isToday ? ACCENT : 'transparent',
                        fontSize:'0.92rem',
                        fontWeight: isToday ? 900 : hasContent ? 800 : 500,
                        color: isToday ? '#fff' : isSun ? '#C83232' : isSat ? '#2052C8' : hasContent ? '#111' : '#BBB',
                      }}>
                        {day}
                      </div>

                      {/* C: 이벤트 점 인디케이터 */}
                      {hasContent && (
                        <div style={{ display:'flex', gap:'3px', alignItems:'center', marginTop:'4px' }}>
                          {/* 카테고리 점 */}
                          {ev?.category && catS && (
                            <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:catS.color, flexShrink:0 }} />
                          )}
                          {/* 텍스트 줄 수 점들 */}
                          {(ev?.texts ?? []).slice(0, 3).map((_, ti) => (
                            <div key={ti} style={{
                              width:'5px', height:'5px', borderRadius:'2px',
                              background: catS ? catS.color + '99' : '#AAA',
                              flexShrink:0,
                            }} />
                          ))}
                          {(ev?.texts?.length ?? 0) > 3 && (
                            <span style={{ fontSize:'0.55rem', color:'#999', lineHeight:1 }}>+{(ev?.texts?.length ?? 0)-3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* C: 클릭 시 확장 상세 패널 */}
      {selected && selEv && (
        <div style={{
          marginTop:'12px', borderRadius:'12px', overflow:'hidden',
          border:`1.5px solid ${selCat ? selCat.color + '55' : 'rgba(0,0,0,0.12)'}`,
          animation:'expandDown 0.2s both',
        }}>
          {/* 패널 헤더 */}
          <div style={{
            padding:'12px 16px',
            background: selCat ? selCat.color : '#555',
            display:'flex', alignItems:'center', justifyContent:'space-between',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ fontSize:'1rem', fontWeight:900, color:'#fff' }}>
                {month}월 {selected}일
              </span>
              <span style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.8)', fontWeight:600 }}>
                {DAY_KO[new Date(year,month-1,selected).getDay()]}요일
              </span>
              {selEv.category && selCat && (
                <span style={{ fontSize:'0.72rem', fontWeight:800, padding:'2px 9px', borderRadius:'100px', background:'rgba(255,255,255,0.22)', color:'#fff' }}>
                  {selCat.label}
                </span>
              )}
            </div>
            <button onClick={() => setSelected(null)}
              style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'6px', color:'#fff', cursor:'pointer', padding:'3px 8px', fontSize:'0.75rem', fontWeight:700 }}>
              닫기
            </button>
          </div>

          {/* 텍스트 목록 */}
          {selEv.texts.length > 0 ? (
            <div style={{ background:'#fff', padding:'12px 16px', display:'flex', flexDirection:'column', gap:'6px' }}>
              {selEv.texts.map((t, i) => (
                <div key={i} style={{
                  display:'flex', alignItems:'flex-start', gap:'10px',
                  padding:'10px 12px', borderRadius:'8px',
                  background: selCat ? selCat.light : '#F5F5F5',
                }}>
                  <div style={{ width:'6px', height:'6px', borderRadius:'50%', background: selCat ? selCat.color : '#888', marginTop:'6px', flexShrink:0 }} />
                  <span style={{ fontSize:'0.92rem', lineHeight:1.6, color:'#111', fontWeight:500 }}>{t}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background:'#fff', padding:'14px 16px', color:'#999', fontSize:'0.85rem' }}>
              텍스트 없음
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes expandDown {
          from { opacity:0; transform:translateY(-8px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
}
