'use client';
import { useState, useEffect } from 'react';

const TIER_COLOR: Record<string, string> = {
  IRON: '#8D8D8D', BRONZE: '#C8883A', SILVER: '#A8B4C0',
  GOLD: '#E8C44A', PLATINUM: '#38C4A4', EMERALD: '#2ECC71',
  DIAMOND: '#6A8FE8', MASTER: '#9B59B6',
  GRANDMASTER: '#E74C3C', CHALLENGER: '#F1C40F',
};
const TIER_ICON: Record<string, string> = {
  IRON: '🩶', BRONZE: '🟤', SILVER: '⚪',
  GOLD: '🟡', PLATINUM: '🩵', EMERALD: '🟢',
  DIAMOND: '🔷', MASTER: '🟣',
  GRANDMASTER: '🔴', CHALLENGER: '👑',
};

interface RankData {
  tier: string; tierKo: string; rank: string;
  lp: number; wins: number; losses: number;
  wr: number; display: string;
}
interface Result {
  name: string; tag: string; level: number;
  solo: RankData | null; flex: RankData | null;
}

function RankCard({ data, label }: { data: RankData; label: string }) {
  const color = TIER_COLOR[data.tier] ?? '#fff';
  const icon  = TIER_ICON[data.tier]  ?? '🎮';
  return (
    <div style={{
      padding: '24px 28px',
      background: `linear-gradient(135deg, ${color}18 0%, transparent 100%)`,
      border: `1px solid ${color}40`,
      borderRadius: '20px', flex: 1, minWidth: '200px',
    }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
        <span style={{ fontSize: '3rem', lineHeight: 1 }}>{icon}</span>
        <div style={{ fontSize: '1.6rem', fontWeight: 900, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{data.display}</div>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4CAF50', background: 'rgba(76,175,80,0.12)', borderRadius: '100px', padding: '4px 12px' }}>{data.wins}승</span>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#F44336', background: 'rgba(244,67,54,0.12)', borderRadius: '100px', padding: '4px 12px' }}>{data.losses}패</span>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-deeper,rgba(0,0,0,0.05))', borderRadius: '100px', padding: '4px 12px' }}>승률 {data.wr}%</span>
      </div>
    </div>
  );
}

export default function TierPage() {
  const [loading, setLoading] = useState(true);
  const [result,  setResult]  = useState<Result | null>(null);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch('/api/tier?name=춘봉박&tag=kr1')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setResult(data);
      })
      .catch(() => setError('네트워크 오류가 발생했어요.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', paddingTop: '80px' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '40px clamp(1.2rem, 4vw, 2rem)' }}>

        {/* 헤더 */}
        <div style={{ marginBottom: '36px' }}>
          <a href="/" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '20px' }}>← 스맵 아카이브</a>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '6px' }}>
            스맵 롤 <em style={{ color: '#EB701A', fontStyle: 'italic' }}>티어</em>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>춘봉박#kr1 · 실시간 솔로/자유 랭크</p>
        </div>

        {/* 로딩 */}
        {loading && (
          <div style={{ padding: '48px', textAlign: 'center' as const, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</div>
            <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
            <div>티어 조회 중...</div>
          </div>
        )}

        {/* 에러 */}
        {error && !loading && (
          <div style={{ padding: '20px 24px', background: 'rgba(244,67,54,0.08)', border: '1px solid rgba(244,67,54,0.2)', borderRadius: '16px', color: '#F44336', fontSize: '0.88rem' }}>
            ⚠️ {error}
          </div>
        )}

        {/* 결과 */}
        {result && !loading && (
          <div style={{ animation: 'fadeInUp 0.35s both' }}>
            <style>{'@keyframes fadeInUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}'}</style>

            {/* 소환사 카드 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', padding: '18px 22px', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '18px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg,#EB701A,#ff8c3a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>🎮</div>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                  {result.name}<span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>#{result.tag}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>소환사 레벨 {result.level}</div>
              </div>
            </div>

            {/* 랭크 카드 */}
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' as const }}>
              {result.solo
                ? <RankCard data={result.solo} label="솔로 랭크" />
                : <div style={{ flex: 1, minWidth: '200px', padding: '24px 28px', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '20px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>솔로 랭크 배치 없음</div>
              }
              {result.flex
                ? <RankCard data={result.flex} label="자유 랭크" />
                : <div style={{ flex: 1, minWidth: '200px', padding: '24px 28px', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '20px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>자유 랭크 배치 없음</div>
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
