'use client';
import { useState, useEffect, useRef } from 'react';
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
  top3: Video[];
  notices: Notice[];
}

function VideoModal({ activeId, onClose }: { activeId: string, onClose: () => void }) {
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

// LIVE NOW 섹션
// 전략: 클라이언트에서 방송국 페이지를 직접 fetch → liveimg URL 파싱 → 이미지 로드 검증
function LiveSection() {
  const BJID = 'townboy';
  const PROFILE = `https://profile.img.sooplive.com/LOGO/to/${BJID}/${BJID}.jpg`;

  const [broadcastNo, setBroadcastNo] = useState<string | null>(null);
  const [isLive, setIsLive] = useState<boolean | null>(null);
  const [broadStart, setBroadStart] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = async () => {
    try {
      // broadStart는 route.ts에서 가져옴 (station API는 여전히 접근 가능)
      const apiRes = await fetch('/api/live').then(r => r.json()).catch(() => ({}));
      if (apiRes.broadStart) setBroadStart(apiRes.broadStart);

      // 방송국 페이지 HTML에서 liveimg URL 파싱 (클라이언트 → CORS 없음)
      const html = await fetch(`https://www.sooplive.com/station/${BJID}`, { cache: 'no-store' }).then(r => r.text());
      const m = html.match(/liveimg\.sooplive\.com\/[a-z]+\/(\d{8,})/) ||
                html.match(/play\.sooplive\.com\/${BJID}\/(\d{8,})/);
      const no = m?.[1] ?? null;

      if (!no) {
        setBroadcastNo(null);
        setIsLive(false);
        return;
      }

      // liveimg 실제 로드 시도 → 성공이면 방송 중 확정
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => { setBroadcastNo(no); setIsLive(true); resolve(); };
        img.onerror = () => { setBroadcastNo(null); setIsLive(false); resolve(); };
        img.src = `https://liveimg.sooplive.co.kr/m/${no}?t=${Date.now()}`;
      });
    } catch {
      setIsLive(false);
    }
  };

  useEffect(() => {
    check();
    timerRef.current = setInterval(check, 60000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const thumbnailUrl = broadcastNo ? `https://liveimg.sooplive.co.kr/m/${broadcastNo}` : null;
  const liveUrl = broadcastNo
    ? `https://play.sooplive.com/${BJID}/${broadcastNo}`
    : `https://www.sooplive.com/station/${BJID}`;

  return (
    <div style={{ borderRadius:'16px', overflow:'hidden', border:'1px solid var(--card-border)', background:'var(--card)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--card-border)', display:'flex', alignItems:'center', gap:'8px' }}>
        <div style={{
          width:'8px', height:'8px', borderRadius:'50%',
          background: isLive ? '#ff4040' : 'var(--text-muted)',
          boxShadow: isLive ? '0 0 0 3px rgba(255,64,64,0.25)' : 'none',
          animation: isLive === null ? 'pulse 1.2s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontSize:'0.75rem', fontWeight:800, color:'var(--text)', letterSpacing:'0.08em' }}>LIVE NOW</span>
        {isLive && (
          <span style={{ marginLeft:'auto', fontSize:'0.68rem', fontWeight:700, background:'rgba(255,64,64,0.12)', color:'#ff4040', padding:'2px 8px', borderRadius:'100px' }}>
            방송 중
          </span>
        )}
      </div>

      <a href={liveUrl} target="_blank" rel="noopener noreferrer"
        style={{ display:'block', position:'relative', textDecoration:'none' }}>
        {isLive && thumbnailUrl ? (
          <img src={thumbnailUrl + '?t=' + Date.now()} alt="라이브 방송"
            style={{ width:'100%', aspectRatio:'16/9', objectFit:'cover', display:'block' }} />
        ) : isLive === false ? (
          <div style={{ width:'100%', aspectRatio:'16/9', background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <img src={PROFILE} alt="스맵"
              style={{ width:'68px', height:'68px', borderRadius:'50%', border:'3px solid rgba(235,112,26,0.6)', objectFit:'cover' }} />
          </div>
        ) : (
          <div style={{ width:'100%', aspectRatio:'16/9', background:'var(--bg-deeper)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:'32px', height:'32px', borderRadius:'50%', border:'3px solid var(--card-border)', borderTopColor:'#EB701A', animation:'spin 0.8s linear infinite' }} />
          </div>
        )}
        {isLive && (
          <div style={{ position:'absolute', top:'10px', left:'10px', display:'flex', alignItems:'center', gap:'4px', background:'rgba(255,40,40,0.92)', color:'#fff', fontSize:'0.68rem', fontWeight:800, padding:'3px 8px', borderRadius:'4px' }}>
            <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#fff' }} />
            LIVE
          </div>
        )}
      </a>

      <div style={{ padding:'12px 14px', flex:1 }}>
        {isLive ? (
          <a href={liveUrl} target="_blank" rel="noopener noreferrer"
            style={{ display:'block', textAlign:'center', background:'#ff4040', color:'#fff', fontSize:'0.8rem', fontWeight:700, padding:'8px', borderRadius:'10px', textDecoration:'none' }}>
            지금 시청하기 →
          </a>
        ) : (
          <>
            <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'6px' }}>
              {isLive === null ? '방송 상태 확인 중...' : '현재 방송 중이 아니에요'}
            </p>
            {broadStart && isLive === false && (
              <p style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginBottom:'8px' }}>
                마지막 방송: {new Date(broadStart).toLocaleDateString('ko-KR', { month:'long', day:'numeric' })}
              </p>
            )}
            <a href={`https://www.sooplive.com/station/${BJID}`} target="_blank" rel="noopener noreferrer"
              style={{ display:'block', textAlign:'center', background:'var(--bg-deeper)', color:'var(--text)', fontSize:'0.75rem', fontWeight:700, padding:'7px', borderRadius:'10px', textDecoration:'none', border:'1px solid var(--card-border)' }}>
              채널 방문하기 →
            </a>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
      `}</style>
    </div>
  );
}

export default function YoutubeSection({ videos, top3, notices }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <>
      {activeId && <VideoModal activeId={activeId} onClose={() => setActiveId(null)} />}

      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 0.9fr 0.9fr', gap:'20px', alignItems:'start' }}>

        {top3[0] && (
          <div onClick={() => setActiveId(top3[0].id)}
            style={{ cursor:'pointer', borderRadius:'16px', overflow:'hidden', border:'1px solid var(--card-border)', transition:'transform 0.2s, box-shadow 0.2s', background:'var(--card)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 16px 40px rgba(0,0,0,0.2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow=''; }}>
            <div style={{ position:'relative' }}>
              <img src={top3[0].thumbnail} alt={top3[0].title} style={{ width:'100%', aspectRatio:'16/9', objectFit:'cover', display:'block' }} />
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)' }} />
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ width:'60px', height:'60px', borderRadius:'50%', background:'rgba(235,112,26,0.92)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 0 10px rgba(235,112,26,0.18)' }}>
                  <span style={{ fontSize:'1.4rem', marginLeft:'5px', color:'#fff' }}>▶</span>
                </div>
              </div>
              <div style={{ position:'absolute', top:'14px', left:'14px', background:'#EB701A', color:'#fff', fontWeight:900, fontSize:'0.85rem', width:'38px', height:'38px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 0 3px rgba(235,112,26,0.35)' }}>1</div>
              <div style={{ position:'absolute', top:'14px', right:'14px', background:'rgba(235,112,26,0.85)', backdropFilter:'blur(8px)', color:'#fff', fontSize:'0.62rem', fontWeight:800, padding:'3px 8px', borderRadius:'4px', letterSpacing:'0.08em' }}>BEST</div>
              <div style={{ position:'absolute', bottom:'16px', left:'16px', right:'16px' }}>
                <p style={{ fontWeight:800, fontSize:'1.05rem', lineHeight:1.35, color:'#fff', marginBottom:'10px' }}>{top3[0].title}</p>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <span style={{ fontSize:'0.8rem', fontWeight:700, color:'#fff', background:'rgba(235,112,26,0.85)', backdropFilter:'blur(8px)', padding:'3px 10px', borderRadius:'100px' }}>👁 {top3[0].views.toLocaleString()}회</span>
                  <span style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.55)' }}>{new Date(top3[0].publishedAt).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          {top3.slice(1).map((video, i) => (
            <div key={video.id} onClick={() => setActiveId(video.id)}
              style={{ display:'flex', overflow:'hidden', borderRadius:'16px', border:'1px solid var(--card-border)', background:'var(--card)', cursor:'pointer', transition:'transform 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 16px 40px rgba(0,0,0,0.2)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow=''; }}>
              <div style={{ position:'relative', flexShrink:0, width:'160px' }}>
                <img src={video.thumbnail} alt={video.title} style={{ width:'160px', height:'100%', objectFit:'cover', display:'block' }} />
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.2)' }}>
                  <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'rgba(235,112,26,0.9)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontSize:'0.9rem', marginLeft:'3px', color:'#fff' }}>▶</span>
                  </div>
                </div>
                <div style={{ position:'absolute', top:'8px', left:'8px', background:'#3C3C3C', color:'#fff', fontWeight:900, fontSize:'0.78rem', width:'28px', height:'28px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>{i + 2}</div>
              </div>
              <div style={{ flex:1, minWidth:0, padding:'14px 16px', display:'flex', flexDirection:'column', justifyContent:'center', gap:'6px' }}>
                <p style={{ fontWeight:700, fontSize:'0.88rem', lineHeight:1.4, color:'var(--text)' }}>{video.title}</p>
                <p style={{ fontSize:'0.78rem', fontWeight:700, color:'#EB701A' }}>👁 {video.views.toLocaleString()}회</p>
                <p style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{new Date(video.publishedAt).toLocaleDateString('ko-KR')}</p>
              </div>
            </div>
          ))}
        </div>

        <LiveSection />

      </div>

      <div id="videos" className="sec-light" style={{ margin:'40px calc(-1 * clamp(1.5rem, 5vw, 3rem)) 0', padding:'40px clamp(1.5rem, 5vw, 3rem)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'40px', alignItems:'start' }}>

          <div>
            <p style={{ fontSize:'0.72rem', fontWeight:700, color:'#EB701A', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'8px', display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ display:'block', width:'24px', height:'2px', background:'#EB701A', borderRadius:'2px' }} />최신 업로드
            </p>
            <h2 style={{ fontSize:'clamp(1.4rem, 2.5vw, 2rem)', fontWeight:900, letterSpacing:'-0.04em', color:'var(--text)', marginBottom:'16px' }}>최신 영상</h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'14px' }}>
              {videos.slice(0, 6).map((video, i) => (
                <div key={video.id}
                  onClick={() => setActiveId(video.id)}
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
                    <p style={{ fontWeight:700, fontSize:'0.88rem', lineHeight:1.4, marginBottom:'6px', color:'var(--text)', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{video.title}</p>
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
                  <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', margin:0, lineHeight:1.5 }}>{n.summary}</p>
                </a>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
                  }
