'use client';
import { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme') === 'dark';
    setDark(saved);
    if (saved) document.documentElement.dataset.theme = 'dark';
    // 마운트 직후 한 프레임 뒤에 트랜지션 활성화 (최초 로드 시 회전 방지)
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.dataset.theme = 'dark';
      localStorage.setItem('theme', 'dark');
    } else {
      delete document.documentElement.dataset.theme;
      localStorage.setItem('theme', 'light');
    }
  };

  const iconTransition = mounted ? 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s' : 'none';

  return (
    <button onClick={toggle} title={dark ? '라이트 모드로 전환' : '다크 모드로 전환'} aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      style={{
        position: 'relative',
        width: '30px', height: '30px',
        background: 'rgba(235,112,26,0.1)',
        border: '1px solid rgba(235,112,26,0.3)',
        borderRadius: '8px',
        padding: 0,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.15s',
        lineHeight: 1,
        overflow: 'hidden',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(235,112,26,0.2)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(235,112,26,0.1)'}>
      {/* 해 아이콘 (라이트 모드일 때 보임) */}
      <span style={{
        position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: dark ? 'rotate(90deg) scale(0.4)' : 'rotate(0deg) scale(1)',
        opacity: dark ? 0 : 1,
        transition: iconTransition,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EB701A" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.5" />
          <line x1="12" y1="1.5" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22.5" />
          <line x1="4.2" y1="4.2" x2="5.9" y2="5.9" />
          <line x1="18.1" y1="18.1" x2="19.8" y2="19.8" />
          <line x1="1.5" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22.5" y2="12" />
          <line x1="4.2" y1="19.8" x2="5.9" y2="18.1" />
          <line x1="18.1" y1="5.9" x2="19.8" y2="4.2" />
        </svg>
      </span>
      {/* 달 아이콘 (다크 모드일 때 보임) */}
      <span style={{
        position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: dark ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0.4)',
        opacity: dark ? 1 : 0,
        transition: iconTransition,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#EB701A">
          <path d="M20.5 14.5c-1 .3-2 .5-3 .5-6 0-11-5-11-11 0-1 .1-2 .4-3C3.6 2.4 1 5.9 1 10c0 6.1 4.9 11 11 11 4.1 0 7.6-2.2 9.5-5.5z" />
        </svg>
      </span>
    </button>
  );
}