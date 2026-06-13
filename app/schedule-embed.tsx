'use client';
import { useState, useEffect } from 'react';

const ACCENT  = '#EB701A';
const DAY_KO  = ['일','월','화','수','목','금','토'];
const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

const CAT: Record<string, { bg:string; border:string; color:string; label:string }> = {
  '방송':      { bg:'#FFEEDE', border:'#E8863A', color:'#B34D00', label:'📺 방송' },
  '개인일정':  { bg:'#DDE9FF', border:'#5B8EE8', color:'#1A44B0', label:'🗓 개인' },
  '개인 일정': { bg:'#DDE9FF', border:'#5B8EE8', color:'#1A44B0', label:'🗓 개인' },
  '휴일':      { bg:'#DFF2E1', border:'#4DB85A', color:'#186624', label:'🏖 휴일' },
};

const DEFAULT_BORDER = '#BBBBBB';
const DEFAULT_BG     = 'rgba(0,0,0,0.05)';

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

  const getCat = (ev?: Event) => {
    if (!ev?.category) return null;
    return CAT[ev.category] ?? CAT[ev.category.replace(/\s/g,'')] ?? null;
  };
  const selEv = selected ? eMap[selected] : null;

  return (
    <div style={{ width:'100%' }}>

      {/* 컨트롤 바 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <button onClick={prev} style={{ width:'36px', height:'36px', borderRadius:'9px', border:'1.5px solid var(--card-border)', background:'var(--card)', color:'var(--text)', cursor:'pointer', fontSize:'1.15rem', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>‹</button>
          <span style={{ fontWeight:900, fontSize:'1.1rem', letterSpacing:'-0.02em', color:'var(--text)' }}>
            {MONTH_KO[month-1]} {year}
          </span>
          <button onClick={next} style={{ width:'36px', height:'36px', borderRadius:'9px', border:'1.5px solid var(--card-border)', background:'var(--card)', color:'var(--text)', cursor:'pointer', fontSize:'1.15rem', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>›</button>
          <button onClick={fetchData} disabled={loading} title="새로고침"
            style={{ width:'34px', height:'34px', borderRadius:'9px', border:'1.5px solid var(--card-border)', background:'var(--card)', color:'var(--text)', cursor:loading?'wait':'pointer', fontSize:'0.9rem', display:'flex', alignItems:'center', justifyContent:'center', opacity:loading?0.4:1, transition:'opacity 0.15s' }}>
            🔄
          </button>
          {loading && <span style={{ fontSize:'0.72rem', color:'#999' }}>불러오는 중...</span>}
        </div>

        {/* 범례 */}
        <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
          {Object.entries(CAT)
            .filter(([,s], i, arr) => arr.findIndex(([,x]) => x.label === s.label) === i)
            .map(([k, s]) => (
              <span key={k} style={{ fontSize:'0.73rem', fontWeight:800, padding:'4px 11px', borderRadius:'100px', background:s.bg, color:s.color, border:`1.5px solid ${s.border}` }}>
                {s.label}
              </span>
          ))}
        </div>
      </div>

      {/* 달력 그리드 */}
      <div style={{ border:'1.5px solid rgba(0,0,0,0.12)', borderRadius:'14px', overflow:'hidden', background:'#fff' }}>

        {/* 요일 헤더 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1.5px solid rgba(0,0,0,0.1)', background:'rgba(0,0,0,0.03)' }}>
          {DAY_KO.map((d, i) => (
            <div key={d} style={{ padding:'12px 0', textAlign:'center', fontSize:'0.82rem', fontWeight:800, letterSpacing:'0.03em',
              color: i===0 ? '#C83232' : i===6 ? '#2052C8' : '#555' }}>
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 셀 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
          {cells.map((day, idx) => {
            const ev      = day ? eMap[day] : null;
            const catS    = getCat(ev ?? undefined);
            const isToday = day === today;
            const isSel   = day === selected;
            const isSun   = idx % 7 === 0;
            const isSat   = idx % 7 === 6;

            let bgColor = '#fff';
            if (isSel)   bgColor = '#FFF3E8';
            else if (isToday) bgColor = '#FFFAF5';
            else if (isSun)   bgColor = 'rgba(200,50,50,0.04)';
            else if (isSat)   bgColor = 'rgba(32,82,200,0.04)';

            return (
              <div key={idx}
                onClick={() => day && setSelected(isSel ? null : day)}
                style={{
                  minHeight:'120px', padding:'8px 7px 7px',
                  borderRight: idx%7===6 ? 'none' : '1px solid rgba(0,0,0,0.07)',
                  borderBottom: idx<cells.length-7 ? '1px solid rgba(0,0,0,0.07)' : 'none',
                  display:'flex', flexDirection:'column', gap:'4px',
                  background: bgColor,
                  cursor: day ? 'pointer' : 'default',
                  transition:'background 0.1s',
                  position:'relative',
                }}
                onMouseEnter={e => { if(day && !isSel) (e.currentTarget as HTMLElement).style.background = '#F5F5F5'; }}
                onMouseLeave={e => { if(day && !isSel) (e.currentTarget as HTMLElement).style.background = bgColor; }}
              >
                {day && (
                  <>
                    {/* 날짜 숫자 */}
                    <div style={{
                      display:'inline-flex', alignItems:'center', justifyContent:'center',
                      width:'30px', height:'30px', borderRadius:'50%', flexShrink:0,
                      background: isToday ? ACCENT : 'transparent',
                      fontSize:'0.9rem',
                      fontWeight: isToday ? 900 : ev ? 800 : 500,
                      color: isToday ? '#fff' : isSun ? '#C83232' : isSat ? '#2052C8' : ev ? '#111' : '#AAA',
                    }}>
                      {day}
                    </div>

                    {/* 카테고리 배지 */}
                    {ev?.category && catS && (
                      <div style={{
                        fontSize:'0.73rem', fontWeight:800,
                        padding:'3px 7px', borderRadius:'6px',
                        background: catS.bg, color: catS.color,
                        border:`1.5px solid ${catS.border}`,
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      }}>
                        {catS.label}
                      </div>
                    )}

                    {/* 자유 텍스트 */}
                    {ev?.texts.map((t, ti) => (
                      <div key={ti} style={{
                        fontSize:'0.73rem', fontWeight:600, lineHeight:1.4,
                        color:'#1A1A1A',
                        padding:'3px 7px 3px 8px',
                        borderRadius:'0 6px 6px 0',
                        borderLeft:`3px solid ${catS ? catS.border : DEFAULT_BORDER}`,
                        background: catS ? catS.bg.replace(')', ', 0.6)').replace('rgb', 'rgba') : DEFAULT_BG,
                        overflow:'hidden',
                        display:'-webkit-box',
                        WebkitLineClamp:2,
                        WebkitBoxOrient:'vertical' as const,
                        wordBreak:'break-all',
                      }}>
                        {t}
                      </div>
                    ))}

                    {/* 이벤트 표시 점 */}
                    {ev && !isSel && (
                      <div style={{
                        position:'absolute', top:'6px', right:'6px',
                        width:'6px', height:'6px', borderRadius:'50%',
                        background: catS ? catS.color : '#999',
                      }} />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 선택한 날 상세 */}
      {selected && selEv && (() => {
        const cs = getCat(selEv);
        return (
          <div style={{
            marginTop:'12px', padding:'16px 18px', borderRadius:'12px',
            animation:'fadeIn 0.2s both',
            background: cs ? cs.bg : '#F0F0F0',
            border:`1.5px solid ${cs ? cs.border : 'rgba(0,0,0,0.15)'}`,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom: selEv.texts.length ? '10px' : '0', flexWrap:'wrap' }}>
              <span style={{ fontWeight:900, fontSize:'1rem', color: cs ? cs.color : '#111' }}>
                {month}월 {selected}일 ({DAY_KO[new Date(year,month-1,selected).getDay()]}요일)
              </span>
              {selEv.category && cs && (
                <span style={{ fontSize:'0.75rem', fontWeight:800, padding:'3px 11px', borderRadius:'100px', background:cs.bg, color:cs.color, border:`1.5px solid ${cs.border}` }}>
                  {cs.label}
                </span>
              )}
            </div>
            {selEv.texts.map((t, i) => (
              <div key={i} style={{
                fontSize:'0.9rem', lineHeight:1.65, color:'#111',
                padding:'7px 12px',
                borderLeft:`3px solid ${cs ? cs.border : DEFAULT_BORDER}`,
                background:'rgba(255,255,255,0.65)',
                borderRadius:'0 7px 7px 0',
                marginBottom: i < selEv.texts.length-1 ? '6px' : '0',
                fontWeight:500,
              }}>
                {t}
              </div>
            ))}
          </div>
        );
      })()}

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
