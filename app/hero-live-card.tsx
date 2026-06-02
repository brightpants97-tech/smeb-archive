'use client';
import { useState, useEffect } from 'react';

export default function HeroLiveCard() {
  const BJID     = 'townboy';
  const PLAY_URL = `https://play.sooplive.com/${BJID}`;
  const PROFILE  = `https://profile.img.sooplive.com/LOGO/to/${BJID}/${BJID}.jpg`;
  const [broadStart, setBroadStart] = useState<string | null>(null);
  const [isLive, setIsLive]         = useState(false);

  useEffect(() => {
    fetch('/api/live').then(r => r.json()).then(d => {
      if (d.broadStart) setBroadStart(d.broadStart);
      if (d.isLive)     setIsLive(true);
    }).catch(() => {});
  }, []);

  return (
    <div style={{
      borderRadius:'20px', overflow:'hidden',
      border: isLive ? '2px solid #EB701A' : '1px solid rgba(255,255,255,0.1)',
      background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 55%,#0f3460 100%)',
      display:'flex', flexDirection:'column' as const,
      boxShadow: isLive ? '0 0 0 4px rgba(235,112,26,0.25)' : 'none',
    }}>
      <a href={PLAY_URL} target="_blank" rel="noopener noreferrer"
        style={{display:'flex',alignItems:'center',justifyContent:'center',
          padding:'28px 24px 20px',textDecoration:'none',position:'relative'}}>
        {isLive && (
          <div style={{position:'absolute',top:'14px',right:'14px',
            display:'flex',alignItems:'center',gap:'5px',
            background:'rgba(232,0,10,0.9)',borderRadius:'100px',
            padding:'3px 10px',fontSize:'0.65rem',fontWeight:800,
            color:'#fff',letterSpacing:'0.06em'}}>
            <span style={{width:'6px',height:'6px',borderRadius:'50%',
              background:'#fff',display:'inline-block',animation:'pulse 1.2s infinite'}} />
            LIVE
          </div>
        )}
        <img src={PROFILE} alt="스맵"
          style={{width:'80px',height:'80px',borderRadius:'50%',
            border:`3px solid ${isLive ? '#EB701A' : 'rgba(235,112,26,0.6)'}`,
            objectFit:'cover',
            boxShadow: isLive ? '0 0 0 5px rgba(235,112,26,0.25)' : 'none'}} />
      </a>
      <div style={{padding:'0 16px 16px',display:'flex',flexDirection:'column' as const,gap:'10px'}}>
        {broadStart && (
          <p style={{fontSize:'0.7rem',color:'rgba(255,255,255,0.4)',
            textAlign:'center' as const,margin:0,letterSpacing:'0.04em'}}>
            마지막 방송: {new Date(broadStart).toLocaleDateString('ko-KR', {month:'long',day:'numeric'})}
          </p>
        )}
        <a href={PLAY_URL} target="_blank" rel="noopener noreferrer"
          style={{display:'block',textAlign:'center' as const,
            background:'#EB701A',color:'#fff',
            fontSize:'0.82rem',fontWeight:700,
            padding:'10px',borderRadius:'12px',textDecoration:'none',
            boxShadow:'0 4px 16px rgba(235,112,26,0.4)',transition:'opacity 0.15s'}}
          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.opacity='0.85'}
          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.opacity='1'}>
          생방송 바로가기 →
        </a>
      </div>
    </div>
  );
}
