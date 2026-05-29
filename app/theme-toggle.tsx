'use client';
import { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme') === 'dark';
    setDark(saved);
    if (saved) document.documentElement.dataset.theme = 'dark';
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

  return (
    <button onClick={toggle} title={dark ? '라이트 모드' : '다크 모드'}
      style={{
        background: 'rgba(235,112,26,0.1)',
        border: '1px solid rgba(235,112,26,0.3)',
        borderRadius: '8px',
        padding: '6px 10px',
        cursor: 'pointer',
        fontSize: '1rem',
        transition: 'background 0.15s',
        lineHeight: 1,
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(235,112,26,0.2)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(235,112,26,0.1)'}>
      {dark ? '☀️' : '🌙'}
    </button>
  );
}