'use client';
import { useState } from 'react';

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
      padding: '20px 24px',
      background: `linear-gradient(135deg, ${color}18 0%, transparent 100%)`,
      border: `1px solid ${color}40`,
      borderRadius: '16px', flex: 1, minWidth: '200px',
    }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <span style={{ fontSize: '2.5rem' }}>{icon}</span>
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{data.display}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4CAF50', background: 'rgba(76,175,80,0.12)', borderRadius: '100px', padding: '3px 10px' }}>{data.wins}승</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#F44336', background: 'rgba(244,67,54,0.12)', borderRadius: '100px', padding: '3px 10px' }}>{data.losses}패</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-deeper)', borderRadius: '100px', padding: '3px 10px' }}>승률 {data.wr}%</span>
      </div>
    </div>
  );
}

export default function TierPage() {
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<Result | null>(null);
  const [error,   setError]   = useState('');

  const search = async () => {
    const raw = input.trim();
    if (!raw) return;

    // 이름#태그 또는 이름 단독 처리
    const [name, tag = 'KR1'] = raw.includes('#') ? raw.split('#') : [raw, 'KR1'];

    setLoading(true);
    setResult(null);
    setError('');

    try {
      const res  = await fetch(`/api/tier?name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data);
    } catch {
      setError('네트워크 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', paddingTop: '80px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px clamp(1.2rem, 4vw, 2rem)' }}>

        {/* 헤더 */}
        <div style={{ marginBottom: '40px' }}>
          <a href="/" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '20px' }}>← 스맵 아카이브</a>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '8px' }}>
            롤 티어 <em style={{ color: '#EB701A', fontStyle: 'italic' }}>조회</em>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>라이엇 ID를 입력하면 솔로/자유 랭크 티어를 확인할 수 있어요</p>
        </div>

        {/* 입력창 */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Hide on bush#KR1"
            style={{
              flex: 1, minWidth: '200px',
              padding: '14px 18px', borderRadius: '14px',
              border: '1.5px solid var(--card-border)',
              background: 'var(--card)', color: 'var(--text)',
              fontSize: '1rem', fontWeight: 600, outline: 'none',
            }}
          />
          <button
            onClick={search}
            disabled={loading}
            style={{
              padding: '14px 28px', borderRadius: '14px', border: 'none',
              background: loading ? 'rgba(235,112,26,0.5)' : 'linear-gradient(135deg,#EB701A,#ff8c3a)',
              color: '#fff', fontSize: '0.92rem', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', flexShrink: 0,
            }}
          >
            {loading ? '조회 중...' : '조회'}
          </button>
        </div>

        {/* 에러 */}
        {error && (
          <div style={{ padding: '16px 20px', background: 'rgba(244,67,54,0.08)', border: '1px solid rgba(244,67,54,0.2)', borderRadius: '14px', color: '#F44336', fontSize: '0.88rem', marginBottom: '24px' }}>
            ⚠️ {error}
          </div>
        )}

        {/* 결과 */}
        {result && (
          <div style={{ animation: 'fadeInUp 0.35s both' }}>
            <style>{'@keyframes fadeInUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }'}</style>

            {/* 소환사 정보 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', padding: '16px 20px', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '16px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg,#EB701A,#ff8c3a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>🎮</div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{result.name}<span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>#{result.tag}</span></div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>소환사 레벨 {result.level}</div>
              </div>
            </div>

            {/* 랭크 카드 */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {result.solo
                ? <RankCard data={result.solo} label="솔로 랭크" />
                : <div style={{ flex: 1, minWidth: '200px', padding: '20px 24px', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '16px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>솔로 랭크 배치 없음</div>
              }
              {result.flex
                ? <RankCard data={result.flex} label="자유 랭크" />
                : <div style={{ flex: 1, minWidth: '200px', padding: '20px 24px', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '16px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>자유 랭크 배치 없음</div>
              }
            </div>
          </div>
        )}

        {/* 사용법 안내 */}
        {!result && !error && !loading && (
          <div style={{ padding: '24px', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '16px', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.7 }}>
            <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>💡 사용법</div>
            <div>• <code style={{ background: 'var(--bg-deeper)', padding: '1px 6px', borderRadius: '4px' }}>Hide on bush#KR1</code> 형식으로 입력</div>
            <div>• 태그 없이 이름만 입력하면 <code style={{ background: 'var(--bg-deeper)', padding: '1px 6px', borderRadius: '4px' }}>#KR1</code> 자동 적용</div>
            <div>• 솔로 랭크와 자유 랭크를 함께 보여드려요</div>
          </div>
        )}
      </div>
    </div>
  );
}
