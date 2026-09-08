'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const ORANGE = '#EB701A';
const RED = '#E05252';
const GRAY = '#9AA0A8';
const FONT = "'Paperlogy', -apple-system, sans-serif";

// 넥슨 공식 spposition 코드 → 포지션 라벨 + 세로 기준 좌표(%) (attack↑, y:0=공격 100=골키퍼)
// RDM/LDM(9,11)은 RCB/LCB(4,6)와 대각선으로 너무 가까워 카드가 겹치는 문제가 있어서 레인을 더 넓힘.
// 좌우 폭이 넓은 포지션(RM/LM 등)은 모서리에 카드가 잘리지 않도록 8~92 범위로 여유를 둠.
const POSITION_MAP: Record<number, { label: string; x: number; y: number }> = {
  0: { label: 'GK', x: 50, y: 95 }, 1: { label: 'SW', x: 50, y: 88 },
  2: { label: 'RWB', x: 86, y: 78 }, 3: { label: 'RB', x: 80, y: 80 },
  4: { label: 'RCB', x: 59, y: 87 }, 5: { label: 'CB', x: 50, y: 88 },
  6: { label: 'LCB', x: 41, y: 87 }, 7: { label: 'LB', x: 20, y: 80 },
  8: { label: 'LWB', x: 14, y: 78 }, 9: { label: 'RDM', x: 71, y: 65 },
  10: { label: 'CDM', x: 50, y: 68 }, 11: { label: 'LDM', x: 29, y: 65 },
  12: { label: 'RM', x: 88, y: 50 }, 13: { label: 'RCM', x: 62, y: 55 },
  14: { label: 'CM', x: 50, y: 58 }, 15: { label: 'LCM', x: 38, y: 55 },
  16: { label: 'LM', x: 12, y: 50 }, 17: { label: 'RAM', x: 65, y: 39 },
  18: { label: 'CAM', x: 50, y: 36 }, 19: { label: 'LAM', x: 35, y: 39 },
  20: { label: 'RF', x: 65, y: 23 }, 21: { label: 'CF', x: 50, y: 19 },
  22: { label: 'LF', x: 35, y: 23 }, 23: { label: 'RW', x: 84, y: 16 },
  24: { label: 'RS', x: 60, y: 9 }, 25: { label: 'ST', x: 50, y: 6 },
  26: { label: 'LS', x: 40, y: 9 }, 27: { label: 'LW', x: 16, y: 16 },
};

// 세로 포메이션 좌표를 좌/우로 마주보는 가로 배치 좌표로 변환
function toHorizontal(pos: number, side: 'left' | 'right') {
  const base = POSITION_MAP[pos];
  if (!base) return null;
  const xLeft = ((100 - base.y) / 100) * 43; // 배율을 살짝 줄여 중앙선/모서리에 카드가 안 붙게 여유를 둠
  if (side === 'left') return { x: xLeft, y: base.x };
  return { x: 100 - xLeft, y: 100 - base.x };
}

type PosGroup = 'GK' | 'DF' | 'MF' | 'FW';
function posGroup(pos: number | null): PosGroup | null {
  if (pos == null) return null;
  if (pos === 0) return 'GK';
  if (pos <= 8) return 'DF';
  if (pos <= 19) return 'MF';
  if (pos <= 27) return 'FW';
  return null;
}
const GROUP_COLOR: Record<PosGroup, string> = { GK: '#F2C94C', DF: '#4A90D9', MF: '#27AE60', FW: '#EB5757' };

const playerImgUrl = (spId: string) => `https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p${spId}.png`;

interface PlayerStatsRaw {
  rating: number | null; goal: number; assist: number; shoot: number; effectiveShoot: number;
  passTry: number; passSuccess: number; dribbleTry: number; dribbleSuccess: number;
  ballPossessionTry: number; ballPossessionSuccess: number; aerialTry: number; aerialSuccess: number;
  blockTry: number; block: number; tackleTry: number; tackle: number; intercept: number; defending: number;
  yellowCards: number; redCards: number;
}

interface SquadPlayer {
  spId: string;
  name: string;
  position: number | null;
  grade: number | null;
  isMotm?: boolean;
  stats: PlayerStatsRaw;
}

interface TeamStat {
  rating: number | null; shoot: number | null; effectiveShoot: number | null;
  possession: number | null; cornerKick: number | null;
  foul: number | null; offside: number | null; systemPause: number | null;
  yellowCards: number | null; redCards: number | null; intercept: number | null;
  avgGoalDistance: number | null; inBoxGoalRate: number | null;
  passTry: number; passSuccess: number; passSuccessRate: number | null;
  dribbleTry: number; dribbleSuccess: number; dribbleSuccessRate: number | null;
  aerialTry: number; aerialSuccess: number; aerialSuccessRate: number | null;
  tackleTry: number | null; tackleSuccess: number | null; tackleSuccessRate: number | null;
  blockTry: number | null; blockSuccess: number | null; blockSuccessRate: number | null;
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
  meTeam: TeamStat;
  oppTeam: TeamStat;
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
  teamStats: { me: TeamStat; opp: TeamStat };
  playerStats: { me: PlayerStat[]; opp: PlayerStat[] };
  matches: MatchRow[];
  searchedDepth: number;
  error?: string;
}

const OUTCOME_LABEL: Record<string, string> = { win: '승', lose: '패', draw: '무', unknown: '?' };
const OUTCOME_COLOR: Record<string, string> = { win: ORANGE, lose: RED, draw: GRAY, unknown: GRAY };

function PlayerImg({ spId, size = 44 }: { spId: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius: '50%', overflow: 'hidden',
      background: '#f2f2f2', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {!failed ? (
        <img src={playerImgUrl(spId)} alt="" onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ fontSize: `${size * 0.32}px`, color: '#bbb' }}>?</span>
      )}
    </div>
  );
}

// ── 선수 개인 상세 스탯 모달 ──────────────────────────────────────────────
function PlayerDetailModal({ p, onClose }: { p: SquadPlayer; onClose: () => void }) {
  const s = p.stats;
  const group = posGroup(p.position);
  const color = group ? GROUP_COLOR[group] : '#999';
  const passRate = s.passTry ? Math.round((s.passSuccess / s.passTry) * 100) : 0;
  const shootAcc = s.shoot ? Math.round((s.effectiveShoot / s.shoot) * 100) : 0;

  const Row = ({ label, value }: { label: string; value: number | string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f2f2f2' }}>
      <span style={{ fontSize: '0.8rem', color: '#888' }}>{label}</span>
      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#222' }}>{value}</span>
    </div>
  );

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: '380px', maxHeight: '85vh', overflowY: 'auto',
        background: '#fff', borderRadius: '18px', padding: '24px', fontFamily: FONT,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <div style={{ position: 'relative' }}>
            <PlayerImg spId={p.spId} size={56} />
            {p.grade != null && (
              <span style={{
                position: 'absolute', bottom: '-4px', right: '-6px', background: 'linear-gradient(135deg, #F2C94C, #E0A62F)',
                color: '#5a3d00', fontSize: '0.68rem', fontWeight: 900, padding: '2px 6px', borderRadius: '8px',
                border: '1.5px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
              }}>+{p.grade}</span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 900, fontSize: '1.05rem', color: '#111' }}>{p.name}</span>
              {p.isMotm && <span title="Man of the Match">⭐</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              {group && <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#fff', background: color, padding: '2px 8px', borderRadius: '6px' }}>{POSITION_MAP[p.position as number]?.label}</span>}
              {p.grade != null && (
                <span style={{
                  fontSize: '0.7rem', fontWeight: 900, color: '#7a5200', background: 'linear-gradient(135deg, #FFE9A8, #F2C94C)',
                  padding: '2px 9px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '3px',
                }}>⚡ 강화 +{p.grade}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#ccc', cursor: 'pointer' }}>✕</button>
        </div>

        {/* 헤드라인 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' }}>
          {[
            ['평점', s.rating != null ? s.rating.toFixed(1) : '-'],
            ['득점', s.goal], ['어시스트', s.assist], ['패스성공률', `${passRate}%`],
          ].map(([label, val]) => (
            <div key={label as string} style={{ textAlign: 'center' as const, padding: '10px 4px', background: `${color}12`, borderRadius: '10px' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color }}>{val as any}</div>
              <div style={{ fontSize: '0.62rem', color: '#999', marginTop: '2px' }}>{label}</div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#bbb', letterSpacing: '0.04em', marginBottom: '4px' }}>공격 지표</p>
        <Row label="슈팅 정확도" value={`${shootAcc}%`} />
        <Row label="빗나간 슈팅" value={s.shoot - s.effectiveShoot} />
        <Row label="유효 슈팅" value={s.effectiveShoot} />
        <Row label="전체 슛" value={s.shoot} />
        <Row label="득점" value={s.goal} />
        <Row label="어시스트" value={s.assist} />

        <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#bbb', letterSpacing: '0.04em', margin: '16px 0 4px' }}>공통 지표</p>
        <Row label="패스 성공률" value={`${passRate}%`} />
        <Row label="패스 시도" value={s.passTry} />
        <Row label="패스 성공" value={s.passSuccess} />
        <Row label="드리블 시도" value={s.dribbleTry} />
        <Row label="드리블 성공" value={s.dribbleSuccess} />
        <Row label="볼 소유 시도" value={s.ballPossessionTry} />
        <Row label="볼 소유 성공" value={s.ballPossessionSuccess} />
        <Row label="공중볼 경합 시도" value={s.aerialTry} />
        <Row label="공중볼 경합 성공" value={s.aerialSuccess} />
        <Row label="옐로 카드" value={s.yellowCards} />
        <Row label="레드 카드" value={s.redCards} />

        <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#bbb', letterSpacing: '0.04em', margin: '16px 0 4px' }}>수비 지표</p>
        <Row label="인터셉트" value={s.intercept} />
        <Row label="디펜딩" value={s.defending} />
        <Row label="블락 시도" value={s.blockTry} />
        <Row label="블락 성공" value={s.block} />
        <Row label="태클 시도" value={s.tackleTry} />
        <Row label="태클 성공" value={s.tackle} />
      </div>
    </div>
  );
}

// ── 선수 카드 (핏치 위에 배치되는 조각) ──────────────────────────────────────
function PitchPlayerChip({ p, coord, onClick }: { p: SquadPlayer; coord: { x: number; y: number }; onClick: () => void }) {
  const group = posGroup(p.position) || 'MF';
  const color = GROUP_COLOR[group];
  const rating = p.stats.rating;
  return (
    <button onClick={onClick} title={p.name} style={{
      position: 'absolute', left: `${coord.x}%`, top: `${coord.y}%`, transform: 'translate(-50%, -50%)',
      width: '54px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT,
      display: 'flex', flexDirection: 'column' as const, alignItems: 'center', padding: 0, zIndex: 1,
    }}>
      <div style={{ position: 'relative' }}>
        <div style={{ borderRadius: '50%', border: `2px solid ${color}`, boxShadow: '0 2px 6px rgba(0,0,0,0.35)' }}>
          <PlayerImg spId={p.spId} size={38} />
        </div>
        {rating != null && rating > 0 && (
          <span style={{
            position: 'absolute', top: '-6px', right: '-8px', background: color, color: '#fff',
            fontSize: '0.6rem', fontWeight: 900, padding: '1px 4px', borderRadius: '6px',
            display: 'flex', alignItems: 'center', gap: '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}>{rating.toFixed(1)}{p.isMotm && '★'}</span>
        )}
        {p.grade != null && (
          <span style={{
            position: 'absolute', bottom: '-4px', left: '-6px', background: 'linear-gradient(135deg, #FFE9A8, #F2C94C)',
            color: '#5a3d00', fontSize: '0.56rem', fontWeight: 900, padding: '0 4px', borderRadius: '5px',
            border: '1px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}>+{p.grade}</span>
        )}
      </div>
      <span style={{
        marginTop: '3px', fontSize: '0.56rem', fontWeight: 800, color: '#fff',
        background: color, padding: '1px 6px', borderRadius: '4px',
      }}>{POSITION_MAP[p.position as number]?.label || '-'}</span>
      <span style={{
        marginTop: '2px', fontSize: '0.58rem', fontWeight: 700, color: '#fff', lineHeight: 1.15,
        background: 'rgba(0,0,0,0.62)', padding: '1px 4px', borderRadius: '4px', textAlign: 'center' as const,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
        overflow: 'hidden', maxWidth: '68px', wordBreak: 'keep-all' as const,
      }}>{p.name}</span>
    </button>
  );
}

function BenchChip({ p, onClick }: { p: SquadPlayer; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '5px', background: '#f7f7f7', border: '1px solid #eee',
      borderRadius: '100px', padding: '3px 10px 3px 3px', cursor: 'pointer', fontFamily: FONT,
    }}>
      <div style={{ position: 'relative' }}>
        <PlayerImg spId={p.spId} size={26} />
        {p.grade != null && (
          <span style={{
            position: 'absolute', bottom: '-3px', right: '-4px', background: 'linear-gradient(135deg, #FFE9A8, #F2C94C)',
            color: '#5a3d00', fontSize: '0.5rem', fontWeight: 900, padding: '0 3px', borderRadius: '4px',
            border: '1px solid #fff',
          }}>+{p.grade}</span>
        )}
      </div>
      <span style={{ fontSize: '0.68rem', color: '#333' }}>{p.name}</span>
    </button>
  );
}

// ── 하나의 가로 핏치에 양팀을 마주보게 배치 ──────────────────────────────────
function MatchPitch({ meSquad, oppSquad }: { meSquad: SquadPlayer[]; oppSquad: SquadPlayer[] }) {
  const [selected, setSelected] = useState<SquadPlayer | null>(null);
  const meOnPitch = meSquad.filter(p => typeof p.position === 'number' && POSITION_MAP[p.position]);
  const oppOnPitch = oppSquad.filter(p => typeof p.position === 'number' && POSITION_MAP[p.position]);
  const meBench = meSquad
    .filter(p => !(typeof p.position === 'number' && POSITION_MAP[p.position]))
    .sort((a, b) => (b.grade ?? -1) - (a.grade ?? -1));
  const oppBench = oppSquad
    .filter(p => !(typeof p.position === 'number' && POSITION_MAP[p.position]))
    .sort((a, b) => (b.grade ?? -1) - (a.grade ?? -1));

  return (
    <div>
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '2.15/1',
        background: 'linear-gradient(90deg, #1f8f57 0%, #2FAE6B 50%, #1f8f57 100%)',
        borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{ position: 'absolute', inset: '3%', border: '1px solid rgba(255,255,255,0.28)', borderRadius: '4px' }} />
        <div style={{ position: 'absolute', top: '3%', bottom: '3%', left: '50%', width: '1px', background: 'rgba(255,255,255,0.28)' }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', height: '30%', aspectRatio: '1/1', transform: 'translate(-50%,-50%)', border: '1px solid rgba(255,255,255,0.28)', borderRadius: '50%' }} />
        {/* 좌/우 페널티 박스 느낌 */}
        <div style={{ position: 'absolute', left: '3%', top: '25%', bottom: '25%', width: '10%', border: '1px solid rgba(255,255,255,0.2)', borderLeft: 'none' }} />
        <div style={{ position: 'absolute', right: '3%', top: '25%', bottom: '25%', width: '10%', border: '1px solid rgba(255,255,255,0.2)', borderRight: 'none' }} />

        {meOnPitch.map((p, i) => {
          const c = toHorizontal(p.position as number, 'left');
          if (!c) return null;
          return <PitchPlayerChip key={p.spId || i} p={p} coord={c} onClick={() => setSelected(p)} />;
        })}
        {oppOnPitch.map((p, i) => {
          const c = toHorizontal(p.position as number, 'right');
          if (!c) return null;
          return <PitchPlayerChip key={p.spId || i} p={p} coord={c} onClick={() => setSelected(p)} />;
        })}
      </div>

      {(meBench.length > 0 || oppBench.length > 0) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginTop: '10px', flexWrap: 'wrap' as const }}>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
            {meBench.map((p, i) => <BenchChip key={p.spId || i} p={p} onClick={() => setSelected(p)} />)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
            {oppBench.map((p, i) => <BenchChip key={p.spId || i} p={p} onClick={() => setSelected(p)} />)}
          </div>
        </div>
      )}

      {selected && <PlayerDetailModal p={selected} onClose={() => setSelected(null)} />}
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
        <div style={{ padding: '6px 18px 22px', borderTop: '1px solid #f2f2f2', paddingTop: '16px' }}>
          <MatchPitch meSquad={match.meSquad} oppSquad={match.oppSquad} />
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
        <PlayerImg spId={p.spId} size={36} />
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

function StatRowCount({ label, meRate, meSuccess, meTry, oppRate, oppSuccess, oppTry }: {
  label: string; meRate: number | null; meSuccess: number; meTry: number;
  oppRate: number | null; oppSuccess: number; oppTry: number;
}) {
  return (
    <StatRow
      label={label}
      meVal={meRate != null ? `${meRate}% (${meSuccess}/${meTry})` : '-'}
      oppVal={oppRate != null ? `${oppRate}% (${oppSuccess}/${oppTry})` : '-'}
    />
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
  const [opponents, setOpponents] = useState<{ nickname: string; count: number; displayName: string; profileImage: string | null; teamColor: string }[] | null>(null);
  const [opponentsLoading, setOpponentsLoading] = useState(true);
  const [overall, setOverall] = useState<{ win: number; lose: number; draw: number; total: number } | null>(null);
  const [overallLoading, setOverallLoading] = useState(true);
  const [recent30, setRecent30] = useState<any[] | null>(null);

  useEffect(() => {
    fetch('/api/fconline/head2head?list=1')
      .then(res => res.json())
      .then(data => { if (!data.error) setOpponents(data.opponents); })
      .catch(() => {})
      .finally(() => setOpponentsLoading(false));

    fetch('/api/fconline/head2head?overall=1', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => { if (!data.error) setOverall(data.summary); })
      .catch(() => {})
      .finally(() => setOverallLoading(false));

    fetch('/api/fconline/head2head?recent30=1')
      .then(res => res.json())
      .then(data => { if (!data.error) setRecent30(data.matches); })
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
      <div style={{ maxWidth: '980px', margin: '0 auto' }}>

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

        {(overallLoading || (overall && overall.total > 0)) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', borderRadius: '14px', background: '#fafafa', border: '1px solid #f0f0f0', marginBottom: '24px', minHeight: '20px' }}>
            {overallLoading ? (
              <>
                <div style={{
                  width: '16px', height: '16px', borderRadius: '50%',
                  border: '2px solid #eee', borderTopColor: ORANGE,
                  animation: 'fc-spin 0.8s linear infinite', flexShrink: 0,
                }} />
                <span style={{ fontSize: '0.78rem', color: '#aaa' }}>스맵 통산 전적 최신화 중...</span>
                <style>{`@keyframes fc-spin { to { transform: rotate(360deg); } }`}</style>
              </>
            ) : (
              <>
                <span style={{ fontSize: '0.76rem', color: '#999', fontWeight: 700 }}>스맵 통산</span>
                <span style={{ fontWeight: 900, color: ORANGE }}>{overall!.win}승</span>
                <span style={{ fontWeight: 900, color: GRAY }}>{overall!.draw}무</span>
                <span style={{ fontWeight: 900, color: RED }}>{overall!.lose}패</span>
                <span style={{ fontSize: '0.74rem', color: '#bbb' }}>(총 {overall!.total}경기)</span>
              </>
            )}
          </div>
        )}

        {recent30 && recent30.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <p style={{ fontSize: '0.72rem', color: '#aaa', marginBottom: '10px' }}>등록된 스트리머와의 최근 {recent30.length}경기 결과</p>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
              {recent30.map((m, i) => {
                const color = OUTCOME_COLOR[m.outcome];
                const label = m.oppDisplayName || m.oppNickname;
                return (
                  <div key={m.matchId ?? i} title={`${label} · ${m.meGoal ?? '-'}:${m.oppGoal ?? '-'} · ${m.matchDate ? new Date(m.matchDate).toLocaleDateString('ko-KR') : ''}`} style={{
                    display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 9px 4px 4px', borderRadius: '100px',
                    background: '#fafafa', border: `1px solid ${color}33`,
                  }}>
                    <span style={{
                      width: '20px', height: '20px', borderRadius: '50%', background: color + '20', color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 900,
                    }}>{OUTCOME_LABEL[m.outcome]}</span>
                    {m.oppProfileImage && <img src={m.oppProfileImage} alt="" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} />}
                    <span style={{ fontSize: '0.68rem', color: '#888', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{label}</span>
                  </div>
                );
              })}
            </div>
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
              {opponents.map(o => {
                const active = nickname === o.nickname;
                return (
                  <button key={o.nickname} onClick={() => search(o.nickname)} disabled={loading} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px 6px 6px', borderRadius: '100px',
                    background: active ? ORANGE : '#fafafa',
                    border: `1px solid ${active ? ORANGE : '#eee'}`,
                    color: active ? '#fff' : '#333',
                    fontSize: '0.82rem', fontWeight: 700, fontFamily: FONT, cursor: loading ? 'default' : 'pointer',
                  }}>
                    {o.profileImage ? (
                      <img src={o.profileImage} alt="" style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${active ? '#fff' : o.teamColor}` }} />
                    ) : (
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: o.teamColor, marginLeft: '4px' }} />
                    )}
                    {o.displayName}
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: active ? 'rgba(255,255,255,0.75)' : '#bbb' }}>{o.count}경기</span>
                  </button>
                );
              })}
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

            <div style={{ marginBottom: '32px' }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#bbb', letterSpacing: '0.06em', marginBottom: '10px' }}>요약 · 경기당 평균 기록</p>
              <StatRow label="승률" meVal={result.summary.total ? +((result.summary.win / result.summary.total) * 100).toFixed(1) : null} oppVal={result.summary.total ? +((result.summary.lose / result.summary.total) * 100).toFixed(1) : null} suffix="%" />
              <StatRow label="평균 평점" meVal={result.teamStats.me.rating} oppVal={result.teamStats.opp.rating} />
              <StatRow label="유효 슈팅" meVal={result.teamStats.me.effectiveShoot} oppVal={result.teamStats.opp.effectiveShoot} />
              <StatRow label="일반 슈팅" meVal={result.teamStats.me.shoot != null && result.teamStats.me.effectiveShoot != null ? +(result.teamStats.me.shoot - result.teamStats.me.effectiveShoot).toFixed(1) : null} oppVal={result.teamStats.opp.shoot != null && result.teamStats.opp.effectiveShoot != null ? +(result.teamStats.opp.shoot - result.teamStats.opp.effectiveShoot).toFixed(1) : null} />
              <StatRow label="점유율(%)" meVal={result.teamStats.me.possession} oppVal={result.teamStats.opp.possession} suffix="%" />
              <StatRow label="박스 안 득점 비율" meVal={result.teamStats.me.inBoxGoalRate} oppVal={result.teamStats.opp.inBoxGoalRate} suffix="%" />
              <StatRow label="득점 성공 거리" meVal={result.teamStats.me.avgGoalDistance} oppVal={result.teamStats.opp.avgGoalDistance} suffix="m" />
              <StatRowCount label="패스 성공률" meRate={result.teamStats.me.passSuccessRate} meSuccess={result.teamStats.me.passSuccess} meTry={result.teamStats.me.passTry} oppRate={result.teamStats.opp.passSuccessRate} oppSuccess={result.teamStats.opp.passSuccess} oppTry={result.teamStats.opp.passTry} />
              <StatRowCount label="드리블 성공률" meRate={result.teamStats.me.dribbleSuccessRate} meSuccess={result.teamStats.me.dribbleSuccess} meTry={result.teamStats.me.dribbleTry} oppRate={result.teamStats.opp.dribbleSuccessRate} oppSuccess={result.teamStats.opp.dribbleSuccess} oppTry={result.teamStats.opp.dribbleTry} />
              <StatRowCount label="공중볼 경합 성공률" meRate={result.teamStats.me.aerialSuccessRate} meSuccess={result.teamStats.me.aerialSuccess} meTry={result.teamStats.me.aerialTry} oppRate={result.teamStats.opp.aerialSuccessRate} oppSuccess={result.teamStats.opp.aerialSuccess} oppTry={result.teamStats.opp.aerialTry} />
              <StatRowCount label="태클 성공률" meRate={result.teamStats.me.tackleSuccessRate} meSuccess={result.teamStats.me.tackleSuccess ?? 0} meTry={result.teamStats.me.tackleTry ?? 0} oppRate={result.teamStats.opp.tackleSuccessRate} oppSuccess={result.teamStats.opp.tackleSuccess ?? 0} oppTry={result.teamStats.opp.tackleTry ?? 0} />
              <StatRowCount label="차단 성공률" meRate={result.teamStats.me.blockSuccessRate} meSuccess={result.teamStats.me.blockSuccess ?? 0} meTry={result.teamStats.me.blockTry ?? 0} oppRate={result.teamStats.opp.blockSuccessRate} oppSuccess={result.teamStats.opp.blockSuccess ?? 0} oppTry={result.teamStats.opp.blockTry ?? 0} />
              <StatRow label="가로채기" meVal={result.teamStats.me.intercept} oppVal={result.teamStats.opp.intercept} />
              <StatRow label="코너킥" meVal={result.teamStats.me.cornerKick} oppVal={result.teamStats.opp.cornerKick} />
              <StatRow label="오프사이드" meVal={result.teamStats.me.offside} oppVal={result.teamStats.opp.offside} />
              <StatRow label="파울(옐로/레드)" meVal={result.teamStats.me.foul != null ? `${result.teamStats.me.foul} (${result.teamStats.me.yellowCards ?? 0}/${result.teamStats.me.redCards ?? 0})` : null} oppVal={result.teamStats.opp.foul != null ? `${result.teamStats.opp.foul} (${result.teamStats.opp.yellowCards ?? 0}/${result.teamStats.opp.redCards ?? 0})` : null} />
              <StatRow label="경기 중단 횟수" meVal={result.teamStats.me.systemPause} oppVal={result.teamStats.opp.systemPause} />
            </div>

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
              <>
                <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#bbb', letterSpacing: '0.06em', marginBottom: '10px' }}>{result.oppDisplay.name}님과의 최근 {result.matches.length}경기 결과</p>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
                  {result.matches.map((m, i) => <MatchCard key={m.matchId ?? i} match={m} />)}
                </div>
              </>
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
