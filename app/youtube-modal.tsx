'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  views: number;
}

interface Notice {
  id: number;
  title: string;
  summary: string;
  date: string;
  likes: number;
  comments: number;
  url: string;
}

interface Props {
  videos: Video[];
  top10: Video[];
  notices: Notice[];
}

function VideoModal({ activeId, onClose }: { activeId: string; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh', zIndex:99999, background:'rgba(0,0,0,0.9)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:'960px', position:'relative' }}>
        <button onClick={onClose}
          style={{ position:'absolute', top:'-48px', right:0, background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff', borderRadius:'10px', padding:'8px 18px', cursor:'pointer', fontSize:'0.85rem', fontWeight:700 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.22)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.12)'}>
          ✕ 닫기
        </button>
        <div style={{ aspectRatio:'16/9', borderRadius:'18px', overflow:'hidden', boxShadow:'0 32px 100px rgba(0,0,0,0.8)' }}>
          <iframe src={`https://www.youtube.com/embed/${activeId}?autoplay=1&rel=0`}
            width="100%" height="100%"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen style={{ border:'none', display:'block', width:'100%', height:'100%' }} />
        </div>
      </div>
    </div>,
    document.body
  );
}

function LiveSection() {
  const BJID = 'townboy';
  const PLAY_URL = `https://play.sooplive.com/${BJID}`;
  const PROFILE = `https://profile.img.sooplive.com/LOGO/to/${BJID}/${BJID}.jpg`;
  const [broadStart, setBroadStart] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/live').then(r => r.json()).then(d => {
      if (d.broadStart) setBroadStart(d.broadStart);
    }).catch(() => {});
  }, []);

  return (
    <div style={{ borderRadius:'16px', overflow:'hidden', border:'1px solid var(--card-border)', background:'var(--card)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--card-border)', display:'flex', alignItems:'center', gap:'8px' }}>
        <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#EB701A' }} />
        <span style={{ fontSize:'0.75rem', fontWeight:800, color:'var(--text)', letterSpacing:'0.08em' }}>LIVE NOW</span>
      </div>
      <a href={PLAY_URL} target="_blank" rel="noopener noreferrer" style={{ display:'block', textDecoration:'none' }}>
        <div style={{ width:'100%', aspectRatio:'16/9', background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
          <img src={PROFILE} alt="스맵" style={{ width:'72px', height:'72px', borderRadius:'50%', border:'3px solid rgba(235,112,26,0.7)', objectFit:'cover' }} />
        </div>
      </a>
      <div style={{ padding:'12px 14px', flex:1, display:'flex', flexDirection:'column', gap:'8px' }}>
        {broadStart && (
          <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', margin:0 }}>
            마지막 방송: {new Date(broadStart).toLocaleDateString('ko-KR', { month:'long', day:'numeric' })}
          </p>
        )}
        <a href={PLAY_URL} target="_blank" rel="noopener noreferrer"
          style={{ display:'block', textAlign:'center', background:'#EB701A', color:'#fff', fontSize:'0.8rem', fontWeight:700, padding:'8px', borderRadius:'10px', textDecoration:'none' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity='0.85'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity='1'}>
          방송국 바로가기 →
        </a>
      </div>
    </div>
  );
}

const RANK_BADGE: Record<number, string> = { 1:'#EB701A', 2:'#C0C0C0', 3:'#CD7F32' };

export default function YoutubeSection({ videos, top10, notices }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const top1 = top10[0];
  const top2to4 = top10.slice(1, 4);
  const top5to10 = top10.slice(4, 10);

  return (
    <>
      {activeId && <VideoModal activeId={activeId} onClose={() => setActiveId(null)} />}

      {/* ── TOP 10 메인 그리드 ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr 0.75fr', gap:'20px', alignItems:'start', marginBottom:'0' }}>

        {/* 1위 */}
        {top1 && (
          <div onClick={() => setActiveId(top1.id)}
            style={{ cursor:'pointer', borderRadius:'16px', overflow:'hidden', border:'1px solid var(--card-border)', transition:'transform 0.2s, box-shadow 0.2s', background:'var(--card)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 16px 40px rgba(0,0,0,0.2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow=''; }}>
            <div style={{ position:'relative' }}>
              <img src={top1.thumbnail} alt={top1.title} style={{ width:'100%', aspectRatio:'16/9', objectFit:'cover', display:'block' }} />
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)' }} />
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ width:'60px', height:'60px', borderRadius:'50%', background:'rgba(235,112,26,0.92)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 0 10px rgba(235,112,26,0.18)' }}>
                  <span style={{ fontSize:'1.4rem', marginLeft:'5px', color:'#fff' }}>▶</span>
                </div>
              </div>
              <div style={{ position:'absolute', top:'14px', left:'14px', background:'#EB701A', color:'#fff', fontWeight:900, fontSize:'0.85rem', width:'38px', height:'38px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 0 3px rgba(235,112,26,0.35)' }}>1</div>
              <div style={{ position:'absolute', top:'14px', right:'14px', background:'rgba(235,112,26,0.85)', backdropFilter:'blur(8px)', color:'#fff', fontSize:'0.62rem', fontWeight:800, padding:'3px 8px', borderRadius:'4px', letterSpacing:'0.08em' }}>BEST</div>
              <div style={{ position:'absolute', bottom:'16px', left:'16px', right:'16px' }}>
                <p style={{ fontWeight:800, fontSize:'1.05rem', lineHeight:1.35, color:'#fff', marginBottom:'10px' }}>{top1.title}</p>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <span style={{ fontSize:'0.8rem', fontWeight:700, color:'#fff', background:'rgba(235,112,26,0.85)', backdropFilter:'blur(8px)', padding:'3px 10px', borderRadius:'100px' }}>👁 {top1.views.toLocaleString()}회</span>
                  <span style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.55)' }}>{new Date(top1.publishedAt).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2~4위 */}
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {top2to4.map((video, i) => {
            const rank = i + 2;
            return (
              <div key={video.id} onClick={() => setActiveId(video.id)}
                style={{ display:'flex', overflow:'hidden', borderRadius:'14px', border:'1px solid var(--card-border)', background:'var(--card)', cursor:'pointer', transition:'transform 0.18s, box-shadow 0.18s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 10px 28px rgba(0,0,0,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow=''; }}>
                <div style={{ position:'relative', flexShrink:0, width:'140px' }}>
                  <img src={video.thumbnail} alt={video.title} style={{ width:'140px', height:'100%', objectFit:'cover', display:'block' }} />
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.15)' }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'rgba(235,112,26,0.9)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <span style={{ fontSize:'0.8rem', marginLeft:'3px', color:'#fff' }}>▶</span>
                    </div>
                  </div>
                  <div style={{ position:'absolute', top:'8px', left:'8px', background: RANK_BADGE[rank] || '#3C3C3C', color:'#fff', fontWeight:900, fontSize:'0.75rem', width:'26px', height:'26px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>{rank}</div>
                </div>
                <div style={{ flex:1, minWidth:0, padding:'12px 14px', display:'flex', flexDirection:'column', justifyContent:'center', gap:'5px' }}>
                  <p style={{ fontWeight:700, fontSize:'0.85rem', lineHeight:1.4, color:'var(--text)', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' } as React.CSSProperties}>{video.title}</p>
                  <p style={{ fontSize:'0.78rem', fontWeight:700, color:'#EB701A', margin:0 }}>👁 {video.views.toLocaleString()}회</p>
                  <p style={{ fontSize:'0.7rem', color:'var(--text-muted)', margin:0 }}>{new Date(video.publishedAt).toLocaleDateString('ko-KR')}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* LIVE NOW */}
        <LiveSection />
      </div>

      {/* ── 5~10위 리스트 ── */}
      {top5to10.length > 0 && (
        <div style={{ marginTop:'16px', borderRadius:'16px', border:'1px solid var(--card-border)', background:'var(--card)', overflow:'hidden' }}>
          <div style={{ padding:'10px 18px', borderBottom:'1px solid var(--card-border)', display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ fontSize:'0.72rem', fontWeight:800, color:'#EB701A', letterSpacing:'0.08em', textTransform:'uppercase' }}>🏅 5위 ~ 10위</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)' }}>
            {top5to10.map((video, i) => {
              const rank = i + 5;
              const isHov = hovered === rank;
              const isLast = i >= 3;
              const borderRight = (i % 3) < 2;
              return (
                <div key={video.id} onClick={() => setActiveId(video.id)}
                  onMouseEnter={() => setHovered(rank)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    display:'flex', gap:'12px', alignItems:'center',
                    padding:'12px 16px', cursor:'pointer',
                    background: isHov ? 'rgba(235,112,26,0.04)' : 'transparent',
                    borderRight: borderRight ? '1px solid var(--card-border)' : 'none',
                    borderBottom: !isLast ? '1px solid var(--card-border)' : 'none',
                    transition:'background 0.15s',
                  }}>
                  <span style={{ fontSize:'1.1rem', fontWeight:900, color: rank <= 3 ? RANK_BADGE[rank] : 'var(--text-muted)', width:'24px', flexShrink:0, textAlign:'center' }}>{rank}</span>
                  <img src={video.thumbnail} alt="" style={{ width:'80px', aspectRatio:'16/9', objectFit:'cover', borderRadius:'8px', flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:'0.8rem', fontWeight:700, color:'var(--text)', lineHeight:1.35, marginBottom:'4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{video.title}</p>
                    <p style={{ fontSize:'0.72rem', fontWeight:700, color:'#EB701A', margin:0 }}>👁 {video.views.toLocaleString()}회</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 최신 영상 + 공지 ── */}
      <div id="videos" className="sec-light" style={{ margin:'40px calc(-1 * clamp(1.5rem, 5vw, 3rem)) 0', padding:'40px clamp(1.5rem, 5vw, 3rem)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'40px', alignItems:'start' }}>
          <div>
            <p style={{ fontSize:'0.72rem', fontWeight:700, color:'#EB701A', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'8px', display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ display:'block', width:'24px', height:'2px', background:'#EB701A', borderRadius:'2px' }} />최신 업로드
            </p>
            <h2 style={{ fontSize:'clamp(1.4rem, 2.5vw, 2rem)', fontWeight:900, letterSpacing:'-0.04em', color:'var(--text)', marginBottom:'16px' }}>최신 영상</h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'14px' }}>
              {videos.slice(0, 6).map((video, i) => (
                <div key={video.id} onClick={() => setActiveId(video.id)}
                  className="card fade-in-up"
                  style={{ cursor:'pointer', transitionDelay:`${(i % 3) * 0.08}s` } as React.CSSProperties}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 16px 40px rgba(0,0,0,0.15)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow=''; }}>
                  <div style={{ position:'relative' }}>
                    <img src={video.thumbnail} alt={video.title} style={{ width:'100%', aspectRatio:'16/9', objectFit:'cover', display:'block' }} />
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0)', transition:'background 0.2s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(0,0,0,0.25)'; const btn=(e.currentTarget as HTMLElement).querySelector('.play-btn') as HTMLElement; if(btn) btn.style.opacity='1'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='rgba(0,0,0,0)'; const btn=(e.currentTarget as HTMLElement).querySelector('.play-btn') as HTMLElement; if(btn) btn.style.opacity='0'; }}>
                      <div className="play-btn" style={{ width:'44px', height:'44px', borderRadius:'50%', background:'rgba(235,112,26,0.9)', display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'opacity 0.2s' }}>
                        <span style={{ fontSize:'1rem', marginLeft:'3px', color:'#fff' }}>▶</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding:'10px 12px 12px' }}>
                    <p style={{ fontWeight:700, fontSize:'0.88rem', lineHeight:1.4, marginBottom:'6px', color:'var(--text)', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' } as React.CSSProperties}>{video.title}</p>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:'0.78rem', fontWeight:700, color:'#EB701A' }}>👁 {video.views.toLocaleString()}회</span>
                      <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{new Date(video.publishedAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize:'0.72rem', fontWeight:700, color:'#EB701A', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'8px', display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ display:'block', width:'24px', height:'2px', background:'#EB701A', borderRadius:'2px' }} />SOOP 공지
            </p>
            <h2 style={{ fontSize:'clamp(1.4rem, 2.5vw, 2rem)', fontWeight:900, letterSpacing:'-0.04em', color:'var(--text)', marginBottom:'16px' }}>최신 공지</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {notices.map((n) => (
                <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="notice-card"
                  style={{ display:'flex', flexDirection:'column', gap:'8px', padding:'16px', background:'var(--card)', borderRadius:'14px', border:'1px solid var(--card-border)', textDecoration:'none', transition:'transform 0.15s, box-shadow 0.15s' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:'0.72rem', fontWeight:700, color:'#EB701A' }}>
                      {n.date.split('-')[1]}월 {n.date.split('-')[2]}일
                    </span>
                    <div style={{ display:'flex', gap:'8px', fontSize:'0.72rem', color:'var(--text-muted)' }}>
                      <span>❤️ {n.likes}</span>
                      <span>💬 {n.comments}</span>
                    </div>
                  </div>
                  <p style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', margin:0 }}>{n.title}</p>
                  <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', margin:0, lineHeight:1.5 } as React.CSSProperties}>{n.summary}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
