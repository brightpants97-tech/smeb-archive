'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const ORANGE = '#EB701A';
const RED = '#E05252';
const GRAY = '#9AA0A8';
const FONT = "'Paperlogy', -apple-system, sans-serif";

// 넥슨 공식 spposition 코드 → 포지션 라벨 + 화면상 좌표(%)
const POSITION_MAP: Record<number, { label: string; x: number; y: number }> = {
  0: { label: 'GK', x: 50, y: 95 }, 1: { label: 'SW', x: 50, y: 88 },
  2: { label: 'RWB', x: 88, y: 78 }, 3: { label: 'RB', x: 82, y: 80 },
  4: { label: 'RCB', x: 62, y: 86 }, 5: { label: 'CB', x: 50, y: 88 },
  6: { label: 'LCB', x: 38, y: 86 }, 7: { label: 'LB', x: 18, y: 80 },
  8: { label: 'LWB', x: 12, y: 78 }, 9: { label: 'RDM', x: 66, y: 68 },
  10: { label: 'CDM', x: 50, y: 70 }, 11: { label: 'LDM', x: 34, y: 68 },
  12: { label: 'RM', x: 88, y: 54 }, 13: { label: 'RCM', x: 63, y: 58 },
  14: { label: 'CM', x: 50, y: 60 }, 15: { label: 'LCM', x: 37, y: 58 },
  16: { label: 'LM', x: 12, y: 54 }, 17: { label: 'RAM', x: 66, y: 42 },
  18: { label: 'CAM', x: 50, y: 40 }, 19: { label: 'LAM', x: 34, y: 42 },
  20: { label: 'RF', x: 66, y: 24 }, 21: { label: 'CF', x: 50, y: 20 },
  22: { label: 'LF', x: 34, y: 24 }, 23: { label: 'RW', x: 84, y: 18 },
  24: { label: 'RS', x: 60, y: 10 }, 25: { label: 'ST', x: 50, y: 6 },
  26: { label: 'LS', x: 40, y: 10 }, 27: { label: 'LW', x: 16, y: 18 },
};

const playerImgUrl = (spId: string) => `https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p${spId}.png`;

interface SquadPlayer {
  spId: string;
  name: string;
  position: number | string | null;
  grade: number | string | null;
}

interface PlayerStat {
  spId: string; name: string; games: number;
  avgRating: number | null; avgShoot: number; avgEffectiveShoot: number;
  passSuccessRate: number | null; avgTackle: number; avgBlock: number;
  isBest: boolean; isWorst: boolean;
}

interface MatchRow {
  matchId: string | null;
  matchDate: string | null;
  matchType: number;
  outcome: 'win' | 'lose' | 'draw' | 'unknown';
  meGoal: number | null;
  oppGoal: number | null;
  meTeam: { possession: number | null; cornerKick: number | null };
  oppTeam: { possession: number | null; cornerKick: number | null };
  meSquad: SquadPlayer[];
  oppSquad: SquadPlayer[];
}

interface Display { name: string; color: string | null; profileImage?: string | null }

interface Result {
  meNickname: string;
  opponentNickname: string;
  meDisplay: Display;
  oppDisplay: Display;
  summary: { win: number; lose: number; draw: number; total: number };
  teamStats: { me: { possession: number | null; cornerKick: number | null }; opp: { possession: number | null; cornerKick: number | null } };
  playerStats: { me: PlayerStat[]; opp: PlayerStat[] };
  matches: MatchRow[];
  searchedDepth: number;
  error?: string;
}

const OUTCOME_LABEL: Record<string, string> = { win: '승', lose: '패', draw: '무', unknown: '?' };
const OUTCOME_COLOR: Record<string, string> = { win: ORANGE, lose: RED, draw: GRAY, unknown: GRAY };

function PlayerImg({ spId, accent, size = 44 }: { spId: string; accent: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius: '50%', overflow: 'hidden',
      border: `2px solid ${accent}`, background: '#f2f2f2', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    }}>
      {!failed ? (
        <img src={playerImgUrl(spId)} alt="" onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ fontSize: `${size * 0.32}px`, color: '#bbb' }}>?</span>
      )}
    </div>
  );
}

function PitchSquad({ title, squad, accent }: { title: string; squad: SquadPlayer[]; accent: string }) {
  const onPitch = squad.filter(p => typeof p.position === 'number' && POSITION_MAP[p.position as number]);
  const bench = squad.filter(p => !(typeof p.position === 'number' && POSITION_MAP[p.position as number]));

  return (
    <div style={{ flex: '1 1 300px', minWidth: '280px' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 800, color: accent, letterSpacing: '0.06em', marginBottom: '8px' }}>{title}</p>
      {squad.length === 0 ? (
        <p style={{ fontSize: '0.78rem', color: '#aaa' }}>스쿼드 정보를 불러올 수 없어요.</p>
      ) : (
        <>
          <div style={{
            position: 'relative', width: '100%', aspectRatio: '2/3',
            background: 'linear-gradient(180deg, #2FAE6B 0%, #1f8f57 100%)',
            borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)',
          }}>
            <div style={{ position: 'absolute', inset: '4%', border: '1px solid rgba(255,255,255,0.28)', borderRadius: '4px' }} />
            <div style={{ position: 'absolute', left: '50%', top: '4%', bottom: '4%', width: '1px', background: 'rgba(255,255,255,0.28)' }} />
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: '26%', aspectRatio: '1/1', transform: 'translate(-50%,-50%)', border: '1px solid rgba(255,255,255,0.28)', borderRadius: '50%' }} />
            {onPitch.map((p, i) => {
              const pos = POSITION_MAP[p.position as number];
              return (
                <div key={p.spId || i} style={{
                  position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)',
                  width: '76px', textAlign: 'center' as const, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '4px',
                }}>
                  <PlayerImg spId={p.spId} accent={accent} size={56} />
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 700, color: '#fff',
                    background: 'rgba(0,0,0,0.55)', padding: '1px 5px', borderRadius: '4px',
                    whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                  }}>{p.name}</span>
                </div>
              );
            })}
          </div>
          {bench.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <p style={{ fontSize: '0.64rem', color: '#aaa', marginBottom: '6px' }}>벤치</p>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
                {bench.map((p, i) => (
                  <div key={p.spId || i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f7f7f7', border: '1px solid #eee', borderRadius: '100px', padding: '3px 10px 3px 3px' }}>
                    <PlayerImg spId={p.spId} accent="#ddd" size={30} />
                    <span style={{ fontSize: '0.72rem', color: '#333', whiteSpace: 'nowrap' as const }}>{p.name}</span>
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
    <div style={{ border: '1px solid #eee', borderRadius: '16px', overflow: 'hidden', background: '#fff' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
        padding: '16px 18px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
      }}>
        <span style={{
          flexShrink: 0, width: '36px', height: '36px', borderRadius: '50%',
          background: color + '18', color, border: `1.5px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.88rem',
        }}>{OUTCOME_LABEL[match.outcome]}</span>
        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111', flexShrink: 0 }}>{match.meGoal ?? '-'} : {match.oppGoal ?? '-'}</span>
        <span style={{ fontSize: '0.78rem', color: '#999', flex: 1 }}>
          {match.matchDate ? new Date(match.matchDate).toLocaleString('ko-KR') : '날짜 정보 없음'}
        </span>
        <span style={{ color: '#ccc', fontSize: '0.85rem', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: '6px 18px 22px', display: 'flex', gap: '22px', flexWrap: 'wrap' as const, borderTop: '1px solid #f2f2f2', paddingTop: '16px' }}>
          <PitchSquad title="스맵 스쿼드" squad={match.meSquad} accent={ORANGE} />
          <PitchSquad title="상대 스쿼드" squad={match.oppSquad} accent="#3B82C4" />
        </div>
      )}
    </div>
  );
}

function StatRow({ label, meVal, oppVal, suffix = '' }: { label: string; meVal: number | string | null; oppVal: number | string | null; suffix?: string }) {
  const meNum = typeof meVal === 'number' ? meVal : null;
  const oppNum = typeof oppVal === 'number' ? oppVal : null;
  const meBetter = meNum != null && oppNum != null && meNum > oppNum;
  const oppBetter = meNum != null && oppNum != null && oppNum > meNum;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f5f5f5' }}>
      <span style={{ textAlign: 'right' as const, fontWeight: meBetter ? 800 : 500, color: meBetter ? ORANGE : '#333', fontSize: '0.86rem' }}>
        {meVal ?? '-'}{meVal != null ? suffix : ''}
      </span>
      <span style={{ fontSize: '0.68rem', color: '#bbb', padding: '0 14px', whiteSpace: 'nowrap' as const }}>{label}</span>
      <span style={{ textAlign: 'left' as const, fontWeight: oppBetter ? 800 : 500, color: oppBetter ? '#3B82C4' : '#333', fontSize: '0.86rem' }}>
        {oppVal ?? '-'}{oppVal != null ? suffix : ''}
      </span>
    </div>
  );
}

function PlayerStatRowExpandable({ p, accent }: { p: PlayerStat; accent: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      borderRadius: '10px', border: `1px solid ${p.isBest ? ORANGE : p.isWorst ? RED : '#eee'}`,
      background: p.isBest ? `${ORANGE}0d` : p.isWorst ? `${RED}0d` : '#fff', overflow: 'hidden',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
        background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
      }}>
        <PlayerImg spId={p.spId} accent={p.isBest ? ORANGE : p.isWorst ? RED : '#ddd'} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#111', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
            {p.isBest && <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#fff', background: ORANGE, padding: '1px 6px', borderRadius: '100px' }}>BEST</span>}
            {p.isWorst && <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#fff', background: RED, padding: '1px 6px', borderRadius: '100px' }}>WORST</span>}
          </div>
          <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: '#999' }}>{p.games}경기 출전</p>
        </div>
        <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
          <div style={{ fontSize: '1rem', fontWeight: 900, color: p.isBest ? ORANGE : p.isWorst ? RED : '#333' }}>{p.avgRating ?? '-'}</div>
          <div style={{ fontSize: '0.6rem', color: '#bbb' }}>평균 평점</div>
        </div>
        <span style={{ color: '#ccc', fontSize: '0.75rem', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '4px 12px 12px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          {[
            ['슈팅', p.avgShoot], ['유효슈팅', p.avgEffectiveShoot],
            ['패스성공률', p.passSuccessRate != null ? `${p.passSuccessRate}%` : '-'],
            ['태클', p.avgTackle], ['블락', p.avgBlock],
          ].map(([label, val]) => (
            <div key={label as string} style={{ textAlign: 'center' as const, padding: '8px 4px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#333' }}>{val as any}</div>
              <div style={{ fontSize: '0.6rem', color: '#aaa', marginTop: '2px' }}>{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerStatsTable({ title, players, accent }: { title: string; players: PlayerStat[]; accent: string }) {
  if (players.length === 0) return null;
  return (
    <div style={{ flex: '1 1 320px', minWidth: '280px' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 800, color: accent, letterSpacing: '0.06em', marginBottom: '10px' }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
        {players.map(p => <PlayerStatRowExpandable key={p.spId} p={p} accent={accent} />)}
      </div>
    </div>
  );
}

function LoadingState() {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setDots(d => (d % 3) + 1), 450);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '16px' }}>
      <div style={{
        width: '40px', height: '40px', borderRadius: '50%',
        border: '3px solid #f0f0f0', borderTopColor: ORANGE,
        animation: 'fc-spin 0.8s linear infinite',
      }} />
      <p style={{ fontSize: '0.85rem', color: '#999', fontWeight: 600 }}>
        경기 기록을 뒤지는 중{'.'.repeat(dots)}
      </p>
      <style>{`@keyframes fc-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function VsHeader({ me, opp }: { me: Display; opp: Display }) {
  const Avatar = ({ d }: { d: Display }) => d.profileImage ? (
    <img src={d.profileImage} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${d.color || '#ccc'}` }} />
  ) : (
    <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: d.color || ORANGE }} />
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '18px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Avatar d={me} />
        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#111' }}>{me.name}</span>
      </div>
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ccc' }}>VS</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#111' }}>{opp.name}</span>
        <Avatar d={opp} />
      </div>
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
  const [overall, setOverall] = useState<{ win: number; lose: number; draw: number; total: number } | null>(null);

  useEffect(() => {
    fetch('/api/fconline/head2head?list=1')
      .then(res => res.json())
      .then(data => { if (!data.error) setOpponents(data.opponents); })
      .catch(() => {})
      .finally(() => setOpponentsLoading(false));

    fetch('/api/fconline/head2head?overall=1')
      .then(res => res.json())
      .then(data => { if (!data.error) setOverall(data.summary); })
      .catch(() => {});
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
      if (!res.ok || data.error) setErrorMsg(data.error || '조회에 실패했어요.');
      else setResult(data);
    } catch {
      setErrorMsg('조회 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: '#fff', padding: 'clamp(48px,8vw,80px) clamp(1.5rem,6vw,6rem)', fontFamily: FONT }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          <Link href="/apps" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#999',
            textDecoration: 'none', padding: '6px 12px', border: '1px solid #eee', borderRadius: '100px',
          }}>← 도구로</Link>
        </div>

        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', color: ORANGE, marginBottom: '8px' }}>FC ONLINE HEAD-TO-HEAD</p>
          <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)', fontWeight: 900, letterSpacing: '-0.04em', color: '#111', margin: 0, lineHeight: 1.15 }}>
            상대 스트리머와의 전적
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#999', marginTop: '10px', lineHeight: 1.6 }}>
            상대 스트리머의 FC 온라인 닉네임을 입력하면, 스맵과 맞붙었던 경기 전적과 그날 서로 사용한 스쿼드를 보여줘요.
          </p>
        </div>

        {overall && overall.total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', borderRadius: '14px', background: '#fafafa', border: '1px solid #f0f0f0', marginBottom: '24px' }}>
            <span style={{ fontSize: '0.76rem', color: '#999', fontWeight: 700 }}>스맵 통산</span>
            <span style={{ fontWeight: 900, color: ORANGE }}>{overall.win}승</span>
            <span style={{ fontWeight: 900, color: GRAY }}>{overall.draw}무</span>
            <span style={{ fontWeight: 900, color: RED }}>{overall.lose}패</span>
            <span style={{ fontSize: '0.74rem', color: '#bbb' }}>(누적 저장된 {overall.total}경기 기준)</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') search(); }}
            placeholder="상대 닉네임 입력 (예: 호날두팬클럽)"
            style={{ flex: 1, padding: '14px 18px', borderRadius: '12px', border: '1px solid #ddd', background: '#fff', color: '#111', fontSize: '0.95rem', outline: 'none', fontFamily: FONT }}
          />
          <button onClick={() => search()} disabled={loading || !nickname.trim()} style={{
            padding: '14px 24px', borderRadius: '12px', border: 'none',
            background: loading || !nickname.trim() ? '#eee' : ORANGE,
            color: loading || !nickname.trim() ? '#bbb' : '#fff',
            fontWeight: 800, fontSize: '0.9rem', cursor: loading || !nickname.trim() ? 'default' : 'pointer',
            fontFamily: FONT, whiteSpace: 'nowrap' as const,
          }}>{loading ? '조회 중...' : '전적 조회'}</button>
        </div>

        {!opponentsLoading && opponents && opponents.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <p style={{ fontSize: '0.72rem', color: '#aaa', marginBottom: '10px' }}>최근 커스텀에서 붙었던 상대 · 클릭하면 바로 검색해요</p>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
              {opponents.map(o => (
                <button key={o.nickname} onClick={() => search(o.nickname)} disabled={loading} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '100px',
                  background: nickname === o.nickname ? ORANGE : '#fafafa',
                  border: `1px solid ${nickname === o.nickname ? ORANGE : '#eee'}`,
                  color: nickname === o.nickname ? '#fff' : '#333',
                  fontSize: '0.82rem', fontWeight: 700, fontFamily: FONT, cursor: loading ? 'default' : 'pointer',
                }}>
                  {o.nickname}
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: nickname === o.nickname ? 'rgba(255,255,255,0.75)' : '#bbb' }}>{o.count}경기</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {errorMsg && (
          <div style={{ padding: '16px 18px', borderRadius: '12px', background: '#fff5f5', border: '1px solid #f4cccc', color: '#c0392b', fontSize: '0.85rem', marginBottom: '24px' }}>
            {errorMsg}
          </div>
        )}

        {loading && <LoadingState />}

        {result && !errorMsg && !loading && (
          <>
            <VsHeader me={result.meDisplay} opp={result.oppDisplay} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(20px,6vw,48px)', padding: '28px 20px', borderRadius: '18px', background: '#fafafa', border: '1px solid #f0f0f0', marginBottom: '28px' }}>
              <div style={{ textAlign: 'center' as const }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: ORANGE }}>{result.summary.win}</div>
                <div style={{ fontSize: '0.72rem', color: '#999' }}>승</div>
              </div>
              <div style={{ textAlign: 'center' as const }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: GRAY }}>{result.summary.draw}</div>
                <div style={{ fontSize: '0.72rem', color: '#999' }}>무</div>
              </div>
              <div style={{ textAlign: 'center' as const }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: RED }}>{result.summary.lose}</div>
                <div style={{ fontSize: '0.72rem', color: '#999' }}>패</div>
              </div>
            </div>

            {(result.teamStats.me.possession != null || result.playerStats.me.length > 0) && (
              <div style={{ marginBottom: '32px' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#bbb', letterSpacing: '0.06em', marginBottom: '10px' }}>평균 팀 스탯 비교</p>
                {result.teamStats.me.possession != null && (
                  <StatRow label="점유율" meVal={result.teamStats.me.possession} oppVal={result.teamStats.opp.possession} suffix="%" />
                )}
                {result.teamStats.me.cornerKick != null && (
                  <StatRow label="코너킥" meVal={result.teamStats.me.cornerKick} oppVal={result.teamStats.opp.cornerKick} />
                )}
              </div>
            )}

            {(result.playerStats.me.length > 0 || result.playerStats.opp.length > 0) && (
              <div style={{ marginBottom: '32px', display: 'flex', gap: '24px', flexWrap: 'wrap' as const }}>
                <PlayerStatsTable title="스맵 선수 평균 스탯" players={result.playerStats.me} accent={ORANGE} />
                <PlayerStatsTable title="상대 선수 평균 스탯" players={result.playerStats.opp} accent="#3B82C4" />
              </div>
            )}

            {result.matches.length === 0 ? (
              <div style={{ textAlign: 'center' as const, padding: '48px 0', color: '#aaa', fontSize: '0.88rem' }}>
                최근 {result.searchedDepth}경기 안에서 <strong style={{ color: '#333' }}>{result.opponentNickname}</strong>님과 맞붙은 기록을 찾지 못했어요.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
                {result.matches.map((m, i) => <MatchCard key={m.matchId ?? i} match={m} />)}
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: '48px', textAlign: 'center' as const }}>
          <Link href="/fc-record/admin" style={{ fontSize: '0.72rem', color: '#ccc', textDecoration: 'none' }}>관리자</Link>
        </div>
      </div>
    </main>
  );
}
