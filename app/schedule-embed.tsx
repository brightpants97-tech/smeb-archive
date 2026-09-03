'use client';
import { useState, useEffect } from 'react';

const ACCENT  = '#EB701A';
const DAY_KO  = ['일','월','화','수','목','금','토'];
const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

const CAT: Record<string, { color:string; light:string; label:string }> = {
  '방송':      { color:'#EB701A', light:'#FFF3E8', label:'📺 방송' },
  '개인일정':  { color:'#6B7A9F', light:'#F0F1F7', label:'🗓 개인일정' },
  '개인 일정': { color:'#6B7A9F', light:'#F0F1F7', label:'🗓 개인일정' },
  '휴일':      { color:'#6B8F71', light:'#EFF5F0', label:'🏖 휴일' },
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
          {loading && <span style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>로딩 중...</span>}
        </div>
      </div>

      {/* 달력 */}
      <div style={{ border:'1.5px solid var(--card-border)', borderRadius:'12px', overflow:'hidden', background:'var(--card)' }}>

        {/* 요일 헤더 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid var(--card-border)', background:'var(--bg-deeper)' }}>
          {DAY_KO.map((d, i) => (
            <div key={d} style={{ padding:'8px 0', textAlign:'center', fontSize:'0.78rem', fontWeight:800,
              color: i===0 ? 'var(--sun)' : i===6 ? 'var(--sat)' : 'var(--text-muted)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 셀 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
          {cells.map((day, idx) => {
            const ev      = day ? eMap[day] : null;
            const catS    = getCat(ev);
            const isToday = day === today;
            const isSel   = day === selected;
            const isSun   = idx % 7 === 0;
            const isSat   = idx % 7 === 6;
            const hasContent = !!(ev?.category || (ev?.texts?.length ?? 0) > 0);
            const previewTexts = ev?.texts?.slice(0, 2) ?? [];
            const extraCount = (ev?.texts?.length ?? 0) - 2;

            return (
              <div key={idx}
                onClick={() => day && setSelected(isSel ? null : day)}
                style={{
                  minHeight:'64px', padding:'0',
                  borderRight: idx%7===6 ? 'none' : '1px solid var(--card-border)',
                  borderBottom: idx<cells.length-7 ? '1px solid var(--card-border)' : 'none',
                  display:'flex', flexDirection:'column',
                  background: isSel
                    ? (catS ? catS.color + '2E' : ACCENT + '2E')  // 선택: 카테고리 색 더 진하게
                    : catS
                      ? catS.color + '17'                        // 카테고리 있는 날: 연한 틴트 (테마 무관 알파블렌딩)
                      : 'transparent',                            // 일반: 컨테이너 배경(var(--card))이 비침
                  cursor: day ? 'pointer' : 'default',
                  transition:'background 0.1s',
                  position:'relative', overflow:'hidden',
                }}
                onMouseEnter={e => { if(day && !isSel)(e.currentTarget as HTMLElement).style.background= catS ? catS.color + '22' : 'var(--bg-deeper)'; }}
                onMouseLeave={e => { if(day && !isSel)(e.currentTarget as HTMLElement).style.background= catS ? catS.color + '17' : 'transparent'; }}
              >
                {day && (
                  <>
                    {/* 상단 컬러 바 */}
                    <div style={{ height:'4px', background: catS ? catS.color : 'transparent', flexShrink:0 }} />

                    <div style={{ padding:'6px 7px 7px', display:'flex', flexDirection:'column', gap:'3px', flex:1 }}>
                      {/* 날짜 숫자 */}
                      <div style={{
                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                        width:'26px', height:'26px', borderRadius:'50%',
                        background: isToday ? ACCENT : 'transparent',
                        fontSize:'0.95rem',
                        fontWeight: isToday ? 800 : 300,
                        color: isToday ? '#fff' : isSun ? 'var(--sun)' : isSat ? 'var(--sat)' : hasContent ? 'var(--text)' : 'var(--text-muted)',
                        flexShrink:0,
                      }}>
                        {day}
                      </div>

                      {/* 카테고리 레이블 (바 아래 텍스트) */}
                      {ev?.category && catS && (
                        <span style={{
                          fontSize:'0.65rem', fontWeight:800, color: catS.color,
                          letterSpacing:'0.01em', lineHeight:1,
                        }}>
                          {catS.label}
                        </span>
                      )}

                      {/* 텍스트 미리보기 (최대 2줄) */}
                      {previewTexts.map((t, ti) => (
                        <div key={ti} style={{
                          fontSize:'0.68rem', fontWeight:700, lineHeight:1.3,
                          color:'var(--text)',
                          overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
                        }}>
                          {t}
                        </div>
                      ))}

                      {/* 더보기 표시 */}
                      {extraCount > 0 && (
                        <span style={{ fontSize:'0.62rem', color: catS ? catS.color : 'var(--text-muted)', fontWeight:700 }}>
                          +{extraCount}개 더보기
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 범례 (달력 아래) */}
      <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', justifyContent:'center', marginTop:'14px' }}>
        {Object.entries(CAT)
          .filter(([,s], i, arr) => arr.findIndex(([,x]) => x.label === s.label) === i)
          .map(([k, s]) => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'0.75rem', fontWeight:700, color:s.color }}>
              <div style={{ width:'10px', height:'3px', borderRadius:'2px', background:s.color }} />
              {s.label}
            </div>
        ))}
      </div>

      {/* 클릭 시 확장 상세 패널 */}
      {selected && selEv && (
        <div style={{
          marginTop:'12px', borderRadius:'12px', overflow:'hidden',
          border:`1.5px solid ${selCat ? selCat.color + '44' : 'var(--card-border)'}`,
          animation:'expandDown 0.18s both',
        }}>
          {/* 헤더 */}
          <div style={{
            padding:'12px 16px',
            background: selCat ? selCat.color : 'var(--text-muted)',
            display:'flex', alignItems:'center', justifyContent:'space-between',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
              <span style={{ fontSize:'1rem', fontWeight:900, color:'#fff' }}>
                {month}월 {selected}일
              </span>
              <span style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.75)', fontWeight:600 }}>
                {DAY_KO[new Date(year,month-1,selected).getDay()]}요일
              </span>
              {selEv.category && selCat && (
                <span style={{ fontSize:'0.72rem', fontWeight:800, padding:'2px 9px', borderRadius:'100px', background:'rgba(255,255,255,0.2)', color:'#fff' }}>
                  {selCat.label}
                </span>
              )}
            </div>
            <button onClick={() => setSelected(null)}
              style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'6px', color:'#fff', cursor:'pointer', padding:'4px 10px', fontSize:'0.75rem', fontWeight:700 }}>
              ✕
            </button>
          </div>

          {/* 텍스트 목록 */}
          <div style={{ background:'var(--card)', padding:'12px 16px', display:'flex', flexDirection:'column', gap:'6px' }}>
            {selEv.texts.length > 0 ? selEv.texts.map((t, i) => (
              <div key={i} style={{
                display:'flex', alignItems:'flex-start', gap:'10px',
                padding:'10px 14px', borderRadius:'9px',
                background: selCat ? selCat.color + '17' : 'var(--bg-deeper)',
                borderLeft:`3px solid ${selCat ? selCat.color : 'var(--card-border)'}`,
              }}>
                <span style={{ fontSize:'0.9rem', lineHeight:1.6, color:'var(--text)', fontWeight:500 }}>{t}</span>
              </div>
            )) : (
              <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', margin:0 }}>내용 없음</p>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes expandDown {
          from { opacity:0; transform:translateY(-6px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
}
