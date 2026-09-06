'use client';
import { useState } from 'react';
import Link from 'next/link';

const PITCH = '#2FAE6B';
const RED = '#E05252';
const GRAY = '#8A8F98';

interface SquadPlayer {
  spId: string;
  name: string;
  position: number | string | null;
  status: string | number | null;
  grade: number | string | null;
}

interface MatchRow {
  matchId: string | null;
  matchDate: string | null;
  matchType: number;
  outcome: 'win' | 'lose' | 'draw' | 'unknown';
  meGoal: number | null;
  oppGoal: number | null;
  meSquad: SquadPlayer[];
  oppSquad: SquadPlayer[];
}

interface Result {
  meNickname: string;
  opponentNickname: string;
  summary: { win: number; lose: number; draw: number; total: number };
  matches: MatchRow[];
  searchedDepth: number;
  error?: string;
}

const OUTCOME_LABEL: Record<string, string> = { win: '승', lose: '패', draw: '무', unknown: '?' };
const OUTCOME_COLOR: Record<string, string> = { win: PITCH, lose: RED, draw: GRAY, unknown: GRAY };

function SquadGrid({ title, squad, accent }: { title: string; squad: SquadPlayer[]; accent: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: '0.7rem', fontWeight: 800, color: accent, letterSpacing: '0.06em', marginBottom: '8px' }}>{title}</p>
      {squad.length === 0 ? (
        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>스쿼드 정보를 불러올 수 없어요.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '6px' }}>
          {squad.map((p, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px', padding: '6px 8px',
            }}>
              <p style={{ fontSize: '0.76rem', fontWeight: 700, color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
              {p.position != null && (
                <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>POS {p.position}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MatchCard({ match }: { match: MatchRow }) {
  const [open, setOpen] = useState(false);
  const color = OUTCOME_COLOR[match.outcome];
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
        padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      }}>
        <span style={{
          flexShrink: 0, width: '34px', height: '34px', borderRadius: '50%',
          background: color + '22', color, border: `1.5px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.85rem',
        }}>
          {OUTCOME_LABEL[match.outcome]}
        </span>
        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
          {match.meGoal ?? '-'} : {match.oppGoal ?? '-'}
        </span>
        <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', flex: 1 }}>
          {match.matchDate ? new Date(match.matchDate).toLocaleString('ko-KR') : '날짜 정보 없음'}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: '4px 16px 18px', display: 'flex', gap: '20px', flexWrap: 'wrap' as const, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
          <SquadGrid title="스맵 스쿼드" squad={match.meSquad} accent={PITCH} />
          <SquadGrid title="상대 스쿼드" squad={match.oppSquad} accent="#E0A62F" />
        </div>
      )}
    </div>
  );
}

export default function FcRecordClient() {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const search = async () => {
    if (!nickname.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setResult(null);
    try {
      const res = await fetch(`/api/fconline/head2head?opponent=${encodeURIComponent(nickname.trim())}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || '조회에 실패했어요.');
      } else {
        setResult(data);
      }
    } catch {
      setErrorMsg('조회 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: '#0b0b0b', padding: 'clamp(48px,8vw,80px) clamp(1.5rem,6vw,6rem)', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>

        {/* 상단 네비 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          <Link href="/apps" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', textDecoration: 'none',
            padding: '6px 12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '100px',
          }}>← 도구로</Link>
        </div>

        {/* 헤더 */}
        <div style={{ marginBottom: '36px' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', color: PITCH, marginBottom: '8px' }}>FC ONLINE HEAD-TO-HEAD</p>
          <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', margin: 0, lineHeight: 1.15 }}>
            상대 스트리머와의 전적
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.4)', marginTop: '10px', lineHeight: 1.6 }}>
            상대 스트리머의 FC 온라인 닉네임을 입력하면, 스맵과 맞붙었던 경기 전적과 그날 서로 사용한 스쿼드를 보여줘요.
            <br />최근 {result?.searchedDepth ?? 100}경기 내에서 찾아요.
          </p>
        </div>

        {/* 검색창 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
          <input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') search(); }}
            placeholder="상대 닉네임 입력 (예: 호날두팬클럽)"
            style={{
              flex: 1, padding: '14px 18px', borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)',
              color: '#fff', fontSize: '0.95rem', outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button onClick={search} disabled={loading || !nickname.trim()} style={{
            padding: '14px 24px', borderRadius: '12px', border: 'none',
            background: loading || !nickname.trim() ? 'rgba(255,255,255,0.08)' : PITCH,
            color: loading || !nickname.trim() ? 'rgba(255,255,255,0.4)' : '#04140d',
            fontWeight: 800, fontSize: '0.9rem', cursor: loading || !nickname.trim() ? 'default' : 'pointer',
            fontFamily: 'inherit', whiteSpace: 'nowrap' as const,
          }}>
            {loading ? '조회 중...' : '전적 조회'}
          </button>
        </div>

        {/* 에러 */}
        {errorMsg && (
          <div style={{ padding: '16px 18px', borderRadius: '12px', background: 'rgba(224,82,82,0.1)', border: '1px solid rgba(224,82,82,0.3)', color: '#ff9d9d', fontSize: '0.85rem', marginBottom: '24px' }}>
            {errorMsg}
          </div>
        )}

        {/* 결과 */}
        {result && !errorMsg && (
          <>
            {/* 스코어보드 */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(20px,6vw,48px)',
              padding: '28px 20px', borderRadius: '18px', background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)', marginBottom: '28px',
            }}>
              <div style={{ textAlign: 'center' as const }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: PITCH }}>{result.summary.win}</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>승</div>
              </div>
              <div style={{ textAlign: 'center' as const }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: GRAY }}>{result.summary.draw}</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>무</div>
              </div>
              <div style={{ textAlign: 'center' as const }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: RED }}>{result.summary.lose}</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>패</div>
              </div>
            </div>

            {/* 매치 리스트 */}
            {result.matches.length === 0 ? (
              <div style={{ textAlign: 'center' as const, padding: '48px 0', color: 'rgba(255,255,255,0.35)', fontSize: '0.88rem' }}>
                최근 {result.searchedDepth}경기 안에서 <strong style={{ color: '#fff' }}>{result.opponentNickname}</strong>님과 맞붙은 기록을 찾지 못했어요.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
                {result.matches.map((m, i) => <MatchCard key={m.matchId ?? i} match={m} />)}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
