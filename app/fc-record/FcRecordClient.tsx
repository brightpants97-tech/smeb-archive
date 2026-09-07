'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const PITCH = '#2FAE6B';
const RED = '#E05252';
const GRAY = '#8A8F98';

// 넥슨 공식 spposition 코드 → 포지션 라벨 + 화면상 좌표(%). 28=SUB(벤치)는 핏치 밖에 별도 표기.
// y: 작을수록 공격진영(위), 클수록 골키퍼 쪽(아래)
const POSITION_MAP: Record<number, { label: string; x: number; y: number }> = {
  0: { label: 'GK', x: 50, y: 95 },
  1: { label: 'SW', x: 50, y: 88 },
  2: { label: 'RWB', x: 88, y: 78 },
  3: { label: 'RB', x: 82, y: 80 },
  4: { label: 'RCB', x: 62, y: 86 },
  5: { label: 'CB', x: 50, y: 88 },
  6: { label: 'LCB', x: 38, y: 86 },
  7: { label: 'LB', x: 18, y: 80 },
  8: { label: 'LWB', x: 12, y: 78 },
  9: { label: 'RDM', x: 66, y: 68 },
  10: { label: 'CDM', x: 50, y: 70 },
  11: { label: 'LDM', x: 34, y: 68 },
  12: { label: 'RM', x: 88, y: 54 },
  13: { label: 'RCM', x: 63, y: 58 },
  14: { label: 'CM', x: 50, y: 60 },
  15: { label: 'LCM', x: 37, y: 58 },
  16: { label: 'LM', x: 12, y: 54 },
  17: { label: 'RAM', x: 66, y: 42 },
  18: { label: 'CAM', x: 50, y: 40 },
  19: { label: 'LAM', x: 34, y: 42 },
  20: { label: 'RF', x: 66, y: 24 },
  21: { label: 'CF', x: 50, y: 20 },
  22: { label: 'LF', x: 34, y: 24 },
  23: { label: 'RW', x: 84, y: 18 },
  24: { label: 'RS', x: 60, y: 10 },
  25: { label: 'ST', x: 50, y: 6 },
  26: { label: 'LS', x: 40, y: 10 },
  27: { label: 'LW', x: 16, y: 18 },
};

const playerImgUrl = (spId: string) => `https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p${spId}.png`;

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

function PlayerImg({ spId, accent }: { spId: string; accent: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div style={{
      width: '34px', height: '34px', borderRadius: '50%', overflow: 'hidden',
      border: `2px solid ${accent}`, background: '#111', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
    }}>
      {!failed ? (
        <img
          src={playerImgUrl(spId)}
          alt=""
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)' }}>?</span>
      )}
    </div>
  );
}

function PitchSquad({ title, squad, accent }: { title: string; squad: SquadPlayer[]; accent: string }) {
  const onPitch = squad.filter(p => typeof p.position === 'number' && POSITION_MAP[p.position as number]);
  const bench = squad.filter(p => !(typeof p.position === 'number' && POSITION_MAP[p.position as number]));

  return (
    <div style={{ flex: '1 1 280px', minWidth: '260px' }}>
      <p style={{ fontSize: '0.7rem', fontWeight: 800, color: accent, letterSpacing: '0.06em', marginBottom: '8px' }}>{title}</p>
      {squad.length === 0 ? (
        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>스쿼드 정보를 불러올 수 없어요.</p>
      ) : (
        <>
          <div style={{
            position: 'relative', width: '100%', aspectRatio: '2/3',
            background: 'linear-gradient(180deg, #1a5c38 0%, #164d2f 100%)',
            borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)',
          }}>
            {/* 핏치 라인 (장식용) */}
            <div style={{ position: 'absolute', inset: '4%', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '4px' }} />
            <div style={{ position: 'absolute', left: '50%', top: '4%', bottom: '4%', width: '1px', background: 'rgba(255,255,255,0.18)' }} />
            <div style={{
              position: 'absolute', left: '50%', top: '50%', width: '26%', aspectRatio: '1/1',
              transform: 'translate(-50%,-50%)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '50%',
            }} />

            {onPitch.map((p, i) => {
              const pos = POSITION_MAP[p.position as number];
              return (
                <div key={p.spId || i} style={{
                  position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`,
                  transform: 'translate(-50%, -50%)', width: '58px', textAlign: 'center' as const,
                  display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '3px',
                }}>
                  <PlayerImg spId={p.spId} accent={accent} />
                  <span style={{
                    fontSize: '0.58rem', fontWeight: 700, color: '#fff',
                    background: 'rgba(0,0,0,0.55)', padding: '1px 4px', borderRadius: '4px',
                    whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                  }}>{p.name}</span>
                </div>
              );
            })}
          </div>

          {bench.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', marginBottom: '5px' }}>벤치</p>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
                {bench.map((p, i) => (
                  <div key={p.spId || i} style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '100px', padding: '3px 8px 3px 3px',
                  }}>
                    <PlayerImg spId={p.spId} accent="rgba(255,255,255,0.25)" />
                    <span style={{ fontSize: '0.68rem', color: '#fff', whiteSpace: 'nowrap' as const }}>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
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
          <PitchSquad title="스맵 스쿼드" squad={match.meSquad} accent={PITCH} />
          <PitchSquad title="상대 스쿼드" squad={match.oppSquad} accent="#E0A62F" />
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
  const [opponents, setOpponents] = useState<{ nickname: string; count: number; lastDate: string }[] | null>(null);
  const [opponentsLoading, setOpponentsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/fconline/head2head?list=1')
      .then(res => res.json())
      .then(data => { if (!data.error) setOpponents(data.opponents); })
      .catch(() => {})
      .finally(() => setOpponentsLoading(false));
  }, []);

  const search = async (nick?: string) => {
    const target = (nick ?? nickname).trim();
    if (!target) return;
    setNickname(target);
    setLoading(true);
    setErrorMsg(null);
    setResult(null);
    try {
      const res = await fetch(`/api/fconline/head2head?opponent=${encodeURIComponent(target)}`);
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
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

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
          <button onClick={() => search()} disabled={loading || !nickname.trim()} style={{
            padding: '14px 24px', borderRadius: '12px', border: 'none',
            background: loading || !nickname.trim() ? 'rgba(255,255,255,0.08)' : PITCH,
            color: loading || !nickname.trim() ? 'rgba(255,255,255,0.4)' : '#04140d',
            fontWeight: 800, fontSize: '0.9rem', cursor: loading || !nickname.trim() ? 'default' : 'pointer',
            fontFamily: 'inherit', whiteSpace: 'nowrap' as const,
          }}>
            {loading ? '조회 중...' : '전적 조회'}
          </button>
        </div>

        {/* 커스텀에서 붙었던 상대 - 클릭하면 바로 검색 */}
        {!opponentsLoading && opponents && opponents.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>
              최근 커스텀에서 붙었던 상대 · 클릭하면 바로 검색해요
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
              {opponents.map(o => (
                <button
                  key={o.nickname}
                  onClick={() => search(o.nickname)}
                  disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', borderRadius: '100px',
                    background: nickname === o.nickname ? PITCH : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${nickname === o.nickname ? PITCH : 'rgba(255,255,255,0.12)'}`,
                    color: nickname === o.nickname ? '#04140d' : '#fff',
                    fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit',
                    cursor: loading ? 'default' : 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {o.nickname}
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 700,
                    color: nickname === o.nickname ? 'rgba(4,20,13,0.6)' : 'rgba(255,255,255,0.4)',
                  }}>{o.count}경기</span>
                </button>
              ))}
            </div>
          </div>
        )}

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
