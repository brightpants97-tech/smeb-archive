'use client';
import { useState } from 'react';

function VodDrawer({ date, vods, onClose }: { date: string, vods: any[], onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--card)', borderRadius:'24px', width:'90%', maxWidth:'600px', maxHeight:'80vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--card-border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontWeight:800, fontSize:'1rem', color:'var(--text)' }}>{date} · {vods.length}개 다시보기</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.4rem', color:'var(--text-muted)', lineHeight:1 }}>✕</button>
        </div>
        <div style={{ overflowY:'auto', padding:'16px 24px', display:'flex', flexDirection:'column', gap:'12px' }}>
          {vods.map((v: any) => (
            <a key={v.id} href={`https://vod.sooplive.com/player/${v.id}`} target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', gap:'12px', textDecoration:'none', color:'inherit', background:'var(--bg-deeper, #F5F5F5)', borderRadius:'12px', padding:'10px', transition:'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.filter='brightness(0.95)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.filter=''}>
              <img src={v.thumb} alt={v.title} style={{ width:'140px', aspectRatio:'16/9', objectFit:'cover', borderRadius:'8px', flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', justifyContent:'center', gap:'5px' }}>
                <p style={{ fontWeight:700, fontSize:'0.9rem', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', margin:0, color:'var(--text)' }}>{v.title}</p>
                <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                  <span style={{ fontSize:'0.78rem', color:'#EB701A', fontWeight:700 }}>👁 {v.views.toLocaleString()}회</span>
                  <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{v.date}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function pressEffect(e: React.MouseEvent) {
  (e.currentTarget as HTMLElement).style.transform = 'scale(0.94)';
}
function releaseEffect(e: React.MouseEvent) {
  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
}

export default function CalendarSection({ sortedMonths, monthMap, today }: { sortedMonths: string[], monthMap: any, today: string }) {
  const todayDate = new Date(today);
  const todayMk = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}`;

  const years = [...new Set(sortedMonths.map(mk => mk.split('-')[0]))];
  const allMonths: string[] = [];
  years.forEach(y => {
    for (let m = 1; m <= 12; m++) {
      allMonths.push(`${y}-${String(m).padStart(2, '0')}`);
    }
  });

  const allVods: any[] = [];
  Object.values(monthMap).forEach((days: any) => {
    Object.values(days).forEach((vods: any) => {
      vods.forEach((v: any) => allVods.push(v));
    });
  });

  const initialIdx = allMonths.indexOf(todayMk) !== -1 ? allMonths.indexOf(todayMk) : allMonths.length - 1;
  const [idx, setIdx] = useState(initialIdx);
  const [drawer, setDrawer] = useState<{ date: string, vods: any[] } | null>(null);
  const [query, setQuery] = useState('');

  const mk = allMonths[idx];
  const [y, m] = mk.split('-');
  const byDay = monthMap[mk] || {};
  const firstDow = new Date(+y, +m - 1, 1).getDay();
  const daysInMo = new Date(+y, +m, 0).getDate();
  const total = Object.values(byDay).reduce((a: number, arr: any) => a + arr.length, 0);
  const isCurrentMonth = mk === todayMk;
  const todayDay = todayDate.getDate();

  const searchResults = query.trim().length > 0
    ? allVods.filter(v => v.title.toLowerCase().includes(query.trim().toLowerCase()))
    : [];
  const isSearching = query.trim().length > 0;

  const navBtnStyle = (disabled: boolean): React.CSSProperties => ({
    minWidth: '44px', height: '44px',
    padding: '0 18px',
    borderRadius: '12px',
    border: 'none',
    background: disabled ? 'var(--card-border)' : '#EB701A',
    color: disabled ? 'var(--text-muted)' : '#fff',
    fontSize: '1.1rem', fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'transform 0.1s, box-shadow 0.15s',
    flexShrink: 0,
    boxShadow: disabled ? 'none' : '0 4px 12px rgba(235,112,26,0.35)',
  });

  return (
    <>
      {drawer && <VodDrawer date={drawer.date} vods={drawer.vods} onClose={() => setDrawer(null)} />}

      <div style={{ marginBottom:'20px', position:'relative' }}>
        <div style={{ position:'absolute', left:'16px', top:'50%', transform:'translateY(-50%)', fontSize:'1rem', color:'var(--text-muted)', pointerEvents:'none' }}>🔍</div>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="다시보기 제목 검색..."
          style={{
            width:'100%', height:'48px',
            background:'var(--card)',
            border:'1.5px solid var(--card-border)',
            borderRadius:'14px',
            color:'var(--text)',
            fontSize:'0.9rem',
            padding:'0 44px 0 44px',
            outline:'none',
            transition:'border 0.2s, box-shadow 0.2s',
            boxSizing:'border-box',
          }}
          onFocus={e => {
            e.target.style.border = '1.5px solid #EB701A';
            e.target.style.boxShadow = '0 0 0 3px rgba(235,112,26,0.2)';
          }}
          onBlur={e => {
            e.target.style.border = '1.5px solid var(--card-border)';
            e.target.style.boxShadow = 'none';
          }}
        />
        {query && (
          <button onClick={() => setQuery('')}
            style={{ position:'absolute', right:'14px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text-muted)', fontSize:'1.1rem', cursor:'pointer', lineHeight:1, padding:0, transition:'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='var(--text)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='var(--text-muted)'}>
            ✕
          </button>
        )}
      </div>

      {isSearching ? (
        <div style={{ background:'var(--card)', borderRadius:'20px', boxShadow:'0 8px 40px rgba(0,0,0,0.15)', overflow:'hidden', border:'1px solid var(--card-border)' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--card-border)', background:'var(--card)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontWeight:800, fontSize:'0.95rem', color:'var(--text)' }}>"{query}" 검색 결과</span>
            <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', fontWeight:500 }}>{searchResults.length}개</span>
          </div>
          {searchResults.length === 0 ? (
            <div style={{ padding:'60px 20px', textAlign:'center', color:'var(--text-muted)', fontSize:'0.9rem' }}>검색 결과가 없어요</div>
          ) : (
            <div style={{ overflowY:'auto', maxHeight:'520px', padding:'16px', display:'flex', flexDirection:'column', gap:'10px' }}>
              {searchResults.map((v: any) => (
                <a key={v.id} href={`https://vod.sooplive.com/player/${v.id}`} target="_blank" rel="noopener noreferrer"
                  style={{ display:'flex', gap:'12px', textDecoration:'none', color:'inherit', background:'var(--bg-deeper, #F7F7F7)', borderRadius:'12px', padding:'10px', transition:'filter 0.15s, transform 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter='brightness(0.95)'; (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter=''; (e.currentTarget as HTMLElement).style.transform=''; }}>
                  <img src={v.thumb} alt={v.title} style={{ width:'130px', aspectRatio:'16/9', objectFit:'cover', borderRadius:'8px', flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', justifyContent:'center', gap:'5px' }}>
                    <p style={{ fontWeight:700, fontSize:'0.88rem', lineHeight:1.4, color:'var(--text)', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', margin:0 }}>{v.title}</p>
                    <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                      <span style={{ fontSize:'0.75rem', color:'#EB701A', fontWeight:700 }}>👁 {v.views.toLocaleString()}회</span>
                      <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{v.date}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ display:'flex', gap:'6px', justifyContent:'center', marginBottom:'20px', flexWrap:'wrap' }}>
            {allMonths.map((mk2, i) => {
              const [, mm] = mk2.split('-');
              const hasData = !!monthMap[mk2] && Object.keys(monthMap[mk2]).length > 0;
              const isCurrent = mk2 === todayMk;
              const isSelected = i === idx;

              let btnStyle: React.CSSProperties = {};
              if (isSelected) {
                btnStyle = { background:'#EB701A', border:'2px solid #EB701A', color:'#fff', fontWeight:800, boxShadow:'0 4px 12px rgba(235,112,26,0.4)' };
              } else if (hasData) {
                btnStyle = {
                  background:'var(--card)',
                  border: isCurrent ? '2px solid #EB701A' : '2px solid var(--card-border)',
                  color:'var(--text)',
                  fontWeight:600,
                };
              } else {
                btnStyle = {
                  background:'transparent',
                  border:'2px solid var(--card-border)',
                  color:'var(--text-muted)',
                  fontWeight:400,
                };
              }

              return (
                <button key={mk2} onClick={() => setIdx(i)}
                  onMouseDown={pressEffect}
                  onMouseUp={releaseEffect}
                  onMouseLeave={releaseEffect}
                  style={{
                    ...btnStyle,
                    minWidth:'44px', height:'36px', padding:'0 13px',
                    borderRadius:'100px', fontSize:'0.8rem',
                    cursor:'pointer', position:'relative',
                    transition:'all 0.15s',
                  }}>
                  {+mm}월
                  {hasData && !isSelected && (
                    <span style={{ position:'absolute', top:'3px', right:'4px', width:'5px', height:'5px', borderRadius:'50%', background:'#EB701A', display:'block' }} />
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ background:'var(--card)', borderRadius:'24px', boxShadow:'0 8px 40px rgba(0,0,0,0.12)', overflow:'hidden', border:'1px solid var(--card-border)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', borderBottom:'1px solid var(--card-border)', background:'var(--bg-deeper, #f5f5f5)' }}>
              <button onClick={() => setIdx(i => Math.max(0, i-1))} disabled={idx===0}
                onMouseDown={e => { if(idx>0) pressEffect(e); }}
                onMouseUp={releaseEffect} onMouseLeave={releaseEffect}
                style={navBtnStyle(idx===0)}>←</button>

              <div style={{ textAlign:'center' }}>
                <h3 style={{ fontSize:'1.5rem', fontWeight:900, letterSpacing:'-0.03em', color:'var(--text)' }}>
                  {y}년 <span style={{ color:'#EB701A' }}>{+m}월</span>
                </h3>
                <p style={{ fontSize:'0.75rem', marginTop:'3px', color:'var(--text-muted)' }}>
                  {total > 0 ? `${total}개 다시보기` : '다시보기 없음'}
                </p>
              </div>

              <button onClick={() => setIdx(i => Math.min(allMonths.length-1, i+1))} disabled={idx===allMonths.length-1}
                onMouseDown={e => { if(idx<allMonths.length-1) pressEffect(e); }}
                onMouseUp={releaseEffect} onMouseLeave={releaseEffect}
                style={navBtnStyle(idx===allMonths.length-1)}>→</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', textAlign:'center', padding:'10px 20px 6px', background:'var(--bg-deeper, #f5f5f5)', borderBottom:'1px solid var(--card-border)' }}>
              {['일','월','화','수','목','금','토'].map((d, i) => (
                <div key={d} style={{ fontSize:'0.78rem', fontWeight:700, color: i===0 ? '#e53e3e' : i===6 ? '#3b82f6' : 'var(--text-muted)', padding:'4px 0' }}>{d}</div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'12px', padding:'20px' }}>
              {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMo }, (_, i) => {
                const d = i + 1;
                const dayVods = byDay[d];
                const isToday = isCurrentMonth && d === todayDay;
                const first = dayVods?.[0];

                return (
                  <div key={d}
                    onClick={() => dayVods && setDrawer({ date:`${y}년 ${+m}월 ${d}일`, vods:dayVods })}
                    onMouseEnter={e => { if(dayVods) { const el=e.currentTarget as HTMLElement; el.style.transform='translateY(-3px) scale(1.03)'; el.style.boxShadow='0 12px 28px rgba(0,0,0,0.15)'; }}}
                    onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.transform=''; el.style.boxShadow=dayVods?'0 2px 10px rgba(0,0,0,0.08)':'none'; }}
                    onMouseDown={e => { if(dayVods) (e.currentTarget as HTMLElement).style.transform='scale(0.97)'; }}
                    onMouseUp={e => { if(dayVods) (e.currentTarget as HTMLElement).style.transform='translateY(-3px) scale(1.03)'; }}
                    style={{
                      borderRadius:'12px', overflow:'hidden',
                      cursor: dayVods ? 'pointer' : 'default',
                      border: isToday ? '3px solid #EB701A' : dayVods ? '2.5px solid rgba(235,112,26,0.7)' : '2px solid var(--card-border)',
                      background: dayVods ? 'transparent' : 'var(--bg-deeper, #ebebeb)',
                      transition:'transform 0.18s ease, box-shadow 0.18s ease',
                      boxShadow: dayVods ? '0 2px 10px rgba(0,0,0,0.08)' : 'none',
                    }}>
                    {first ? (
                      <div style={{ position:'relative' }}>
                        <div style={{ aspectRatio:'16/9', overflow:'hidden' }}>
                          <img src={first.thumb} alt={first.title} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                        </div>
                        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 45%)', padding:'7px 9px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{ fontSize:'0.8rem', fontWeight:900, color:'#fff', textShadow:'0 1px 4px rgba(0,0,0,0.9)' }}>{d}</span>
                            {dayVods.length > 1 && (
                              <span style={{ fontSize:'0.65rem', fontWeight:800, background:'#EB701A', color:'#fff', padding:'2px 6px', borderRadius:'100px' }}>+{dayVods.length}</span>
                            )}
                          </div>
                        </div>
                        <div style={{ padding:'6px 8px 7px', background:'var(--card)', borderTop:'1px solid var(--card-border)' }}>
                          <p style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text)', lineHeight:1.3, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{first.title}</p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ aspectRatio:'16/9', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ fontSize:'0.88rem', fontWeight: isToday?800:400, color: isToday?'#EB701A':'var(--text-muted)' }}>{d}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
