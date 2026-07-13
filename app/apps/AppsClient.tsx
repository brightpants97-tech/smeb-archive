'use client';
import Link from 'next/link';
import { useState } from 'react';

const APPS = [
  {
    href: '/banpick',
    icon: '⚔️',
    title: '팀 관리',
    desc: '밴픽 조합 분석',
    color: '#A855F7',
  },
  {
    href: '/multiview',
    icon: '📺',
    title: '멀티뷰',
    desc: 'SOOP 동시 시청',
    color: '#EB701A',
  },
  {
    href: '/fa-teambuilder',
    icon: '🎯',
    title: 'FA 팀빌더',
    desc: '멸망전 182점 캡 시뮬레이터',
    color: '#2F6FED',
  },
];

function AppCard({ app }: { app: typeof APPS[0] }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link href={app.href} style={{ textDecoration: 'none' }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: 'var(--card)',
          border: `1.5px solid ${hovered ? app.color + '66' : 'var(--card-border)'}`,
          borderRadius: '20px',
          padding: '28px 20px 22px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          cursor: 'pointer',
          transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
          boxShadow: hovered ? `0 12px 32px ${app.color}22` : 'none',
          transition: 'all 0.18s ease',
        }}
      >
        {/* 도형 아이콘 */}
        <div style={{
          width: '76px',
          height: '76px',
          borderRadius: '20px',
          background: hovered ? `${app.color}28` : `${app.color}14`,
          border: `2px solid ${hovered ? app.color + '77' : app.color + '33'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.2rem',
          transition: 'all 0.18s ease',
          boxShadow: hovered ? `0 0 20px ${app.color}33` : 'none',
        }}>
          {app.icon}
        </div>

        {/* 텍스트 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontWeight: 900,
            fontSize: '0.96rem',
            color: 'var(--text)',
            letterSpacing: '-0.02em',
            marginBottom: '5px',
          }}>
            {app.title}
          </div>
          <div style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            color: app.color,
            opacity: hovered ? 1 : 0.7,
            transition: 'opacity 0.18s',
          }}>
            {app.desc}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function AppsClient() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      padding: 'clamp(2rem,6vw,4rem) clamp(1.5rem,5vw,3rem)',
    }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* 홈 링크 */}
        <div style={{ marginBottom: '32px' }}>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '0.82rem', fontWeight: 700,
            color: 'var(--text-secondary, #888)',
            textDecoration: 'none', opacity: 0.7,
            transition: 'opacity 0.15s',
          }}>
            ← 홈으로
          </Link>
        </div>

        {/* 헤더 */}
        <div style={{ marginBottom: '48px' }}>
          <p style={{
            fontSize: '0.76rem',
            fontWeight: 800,
            letterSpacing: '0.16em',
            color: '#EB701A',
            textTransform: 'uppercase' as const,
            marginBottom: '10px',
            margin: '0 0 10px',
          }}>SMEB Archive</p>
          <h1 style={{
            fontSize: 'clamp(2rem,5vw,3rem)',
            fontWeight: 900,
            letterSpacing: '-0.05em',
            lineHeight: 1,
            margin: '0 0 12px',
            color: 'var(--text)',
          }}>도구</h1>
          <p style={{
            fontSize: '0.9rem',
            color: 'var(--text-secondary, #888)',
            margin: 0,
          }}>스맵 팀 운영을 위한 도구 모음</p>
        </div>

        {/* 앱 그리드 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 180px))',
          gap: '16px',
        }}>
          {APPS.map(app => <AppCard key={app.href} app={app} />)}

          {/* 준비 중 */}
          {[0].map(i => (
            <div key={i} style={{
              background: 'var(--card)',
              border: '1.5px dashed var(--card-border)',
              borderRadius: '20px',
              padding: '28px 20px 22px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              opacity: 0.3,
            }}>
              <div style={{
                width: '76px',
                height: '76px',
                borderRadius: '20px',
                background: 'rgba(128,128,128,0.08)',
                border: '2px dashed rgba(128,128,128,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.6rem',
                color: '#888',
              }}>+</div>
              <div style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--text)',
              }}>준비 중</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
