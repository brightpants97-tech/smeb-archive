'use client';
import { useState, useEffect } from 'react';

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);

  // 열리면 스크롤 방지
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      {/* 햄버거 버튼 */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="메뉴"
        style={{
          display: 'none',
          background: 'none', border: 'none',
          cursor: 'pointer', padding: '6px',
          flexDirection: 'column', gap: '5px',
          alignItems: 'center', justifyContent: 'center',
        }}
        className="hamburger-btn">
        <span className={`bar ${open ? 'bar-top' : ''}`} />
        <span className={`bar ${open ? 'bar-mid' : ''}`} />
        <span className={`bar ${open ? 'bar-bot' : ''}`} />
      </button>

      {/* 오버레이 */}
      {open && (
        <div onClick={close}
          style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)' }} />
      )}

      {/* 슬라이드 메뉴 */}
      <nav
        style={{
          position: 'fixed', top: 0, right: 0,
          width: '280px', height: '100vh',
          zIndex: 400,
          background: 'var(--card)',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.2)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.22,1,0.36,1)',
          display: 'flex', flexDirection: 'column',
          padding: '0',
        }}
        className="slide-menu">
        {/* 메뉴 헤더 */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', borderBottom:'1px solid var(--card-border)' }}>
          <span style={{ fontWeight:900, fontSize:'1.1rem', color:'var(--text)' }}>
            SMEB<span style={{ color:'#EB701A' }}>.</span>
          </span>
          <button onClick={close} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.4rem', color:'var(--text-muted)', lineHeight:1 }}>✕</button>
        </div>

        {/* 메뉴 링크 */}
        <div style={{ display:'flex', flexDirection:'column', padding:'16px 0' }}>
          {[
            { href:'#top3',    label:'BEST 3',    desc:'이달의 유튜브 TOP 3' },
            { href:'#videos',  label:'유튜브',    desc:'이번 달 전체 영상' },
            { href:'#soopcal', label:'다시보기',  desc:'SOOP 다시보기 캘린더' },
            { href:'/apps', label:'도구', desc:'스맵 팀 운영 도구 모음' },
            { href:'/banpick', label:'팀 관리', desc:'밴픽 조합 분석' },
            { href:'/teambuilder', label:'팀빌더', desc:'멸망전 팀 구성 도우미' },
          ].map(item => (
            <a key={item.href} href={item.href} onClick={close}
              style={{ display:'flex', flexDirection:'column', gap:'2px', padding:'16px 24px', textDecoration:'none', borderBottom:'1px solid var(--card-border)', transition:'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(235,112,26,0.06)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background=''}>
              <span style={{ fontWeight:800, fontSize:'1rem', color:'var(--text)' }}>{item.label}</span>
              <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{item.desc}</span>
            </a>
          ))}
        </div>

        {/* 외부 링크 */}
        <div style={{ marginTop:'auto', padding:'24px', display:'flex', flexDirection:'column', gap:'12px' }}>
          <a href="https://www.youtube.com/@smeb2774/videos" target="_blank"
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', padding:'12px', borderRadius:'12px', background:'linear-gradient(135deg,#EB701A,#ff8c3a)', color:'#fff', fontWeight:700, fontSize:'0.9rem', textDecoration:'none', boxShadow:'0 4px 14px rgba(235,112,26,0.35)' }}>
            ▶ YouTube 채널
          </a>
          <a href="https://www.sooplive.com/station/townboy" target="_blank"
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', padding:'12px', borderRadius:'12px', border:'1px solid var(--card-border)', color:'var(--text)', fontWeight:600, fontSize:'0.9rem', textDecoration:'none', transition:'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(235,112,26,0.06)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background=''}>
            SOOP 방송국 ↗
          </a>
        </div>
      </nav>

      <style>{`
        .hamburger-btn { display: none; }
        @media (max-width: 768px) {
          .hamburger-btn { display: flex !important; }
          .desktop-nav { display: none !important; }
        }
        .bar {
          display: block;
          width: 22px; height: 2px;
          background: var(--text);
          border-radius: 2px;
          transition: transform 0.3s, opacity 0.3s;
        }
        .bar-top { transform: translateY(7px) rotate(45deg); }
        .bar-mid { opacity: 0; }
        .bar-bot { transform: translateY(-7px) rotate(-45deg); }
      `}</style>
    </>
  );
}
