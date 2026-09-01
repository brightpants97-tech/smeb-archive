'use client';
import Link from 'next/link';

const APPS = [
  {
    href: '/fa-teambuilder',
    title: 'FA 팀빌더',
    tag: '시뮬레이터',
    desc: '멸망전 182점 캡 기준 최적 팀 조합을 시뮬레이션',
    color: '#2F6FED',
  },
];

export default function AppsClient() {
  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--bg, #0b0b0b)',
      padding: 'clamp(48px,8vw,80px) clamp(1.5rem,6vw,6rem)',
      fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>

        {/* 홈 버튼 */}
        <div style={{ marginBottom: '32px' }}>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)',
            textDecoration: 'none', padding: '6px 12px',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '100px',
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#fff'; el.style.borderColor = 'rgba(255,255,255,0.25)'; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(255,255,255,0.45)'; el.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          >
            ← 홈으로
          </Link>
        </div>

        {/* 헤더 */}
        <div style={{ marginBottom: '40px' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', color: '#EB701A', marginBottom: '8px' }}>
            TOOLS
          </p>
          <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', margin: 0, lineHeight: 1.1 }}>
            도구
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.4)', marginTop: '10px' }}>
            스맵 아카이브 전용 유틸리티
          </p>
        </div>

        {/* 앱 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {APPS.map(app => (
            <Link key={app.href} href={app.href} style={{ textDecoration: 'none' }}>
              <div style={{
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.03)',
                display: 'flex',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = app.color + '55';
                el.style.background = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = 'rgba(255,255,255,0.08)';
                el.style.background = 'rgba(255,255,255,0.03)';
              }}>
                {/* 왼쪽 컬러 액센트 */}
                <div style={{ width: '4px', background: app.color, flexShrink: 0 }} />

                {/* 본문 */}
                <div style={{ flex: 1, padding: '22px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                        {app.title}
                      </span>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700,
                        background: app.color + '22',
                        color: app.color,
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}>
                        {app.tag}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.5 }}>
                      {app.desc}
                    </p>
                  </div>

                  <div style={{
                    flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    color: 'rgba(255,255,255,0.7)',
                    whiteSpace: 'nowrap' as const,
                  }}>
                    열기 →
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
