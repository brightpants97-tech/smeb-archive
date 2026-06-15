import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '도구 | SMEB Archive',
  description: 'SMEB Archive 도구 모음',
};

const APPS = [
  {
    href: '/banpick',
    icon: '⚔️',
    title: '팀 관리',
    desc: '밴픽 조합 분석',
    color: '#A855F7',
  },
];

export default function AppsPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      padding: 'clamp(2rem,6vw,4rem) clamp(1.5rem,5vw,3rem)',
    }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ marginBottom: '48px' }}>
          <p style={{
            fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.14em',
            color: '#EB701A', textTransform: 'uppercase', marginBottom: '10px',
          }}>SMEB Archive</p>
          <h1 style={{
            fontSize: 'clamp(2rem,5vw,3.2rem)', fontWeight: 900,
            letterSpacing: '-0.05em', lineHeight: 1, margin: 0,
            color: 'var(--text)',
          }}>도구</h1>
          <p style={{
            marginTop: '12px', fontSize: '0.9rem',
            color: 'var(--text-secondary, rgba(128,128,128,0.8))',
          }}>스맵 팀 운영을 위한 도구 모음</p>
        </div>

        {/* 앱 그리드 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 180px))',
          gap: '16px',
        }}>
          {APPS.map(app => (
            <Link key={app.href} href={app.href} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'var(--card)',
                border: '1.5px solid var(--card-border)',
                borderRadius: '20px',
                padding: '24px 20px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '14px',
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 32px ${app.color}22`;
                  (e.currentTarget as HTMLElement).style.borderColor = `${app.color}66`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)';
                }}
              >
                {/* 도형 아이콘 */}
                <div style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '18px',
                  background: `${app.color}18`,
                  border: `2px solid ${app.color}44`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                }}>
                  {app.icon}
                </div>

                {/* 텍스트 */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontWeight: 900, fontSize: '0.95rem',
                    color: 'var(--text)', letterSpacing: '-0.02em',
                    marginBottom: '4px',
                  }}>
                    {app.title}
                  </div>
                  <div style={{
                    fontSize: '0.72rem', fontWeight: 600,
                    color: app.color, opacity: 0.8,
                  }}>
                    {app.desc}
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {/* 준비 중 플레이스홀더 */}
          {[...Array(2)].map((_, i) => (
            <div key={i} style={{
              background: 'var(--card)',
              border: '1.5px dashed var(--card-border)',
              borderRadius: '20px',
              padding: '24px 20px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
              opacity: 0.35,
            }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '18px',
                background: 'rgba(128,128,128,0.1)',
                border: '2px dashed rgba(128,128,128,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem',
              }}>+</div>
              <div style={{
                fontSize: '0.78rem', fontWeight: 700,
                color: 'var(--text)',
                opacity: 0.5,
              }}>준비 중</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
