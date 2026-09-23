'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const ORANGE = '#EB701A';
const RED = '#E05252';
const GRAY = '#9AA0A8';
const WIN_BLUE = '#2F6FED';

// 넥슨 API의 matchDate는 UTC0 기준인데 문자열에 'Z'가 없어서, 그대로 new Date()하면
// 브라우저가 "이미 로컬시간"으로 오인해 9시간 차이가 나던 문제를 수정
function formatMatchDate(dateStr: string | null, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!dateStr) return '날짜 정보 없음';
  const utcDate = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  return utcDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', ...opts });
}
const FONT = "'Paperlogy', -apple-system, sans-serif";

// 넥슨 공식 spposition 코드 → 포지션 라벨 + 세로 기준 좌표(%) (attack↑, y:0=공격 100=골키퍼)
// RDM/LDM(9,11)은 RCB/LCB(4,6)와 대각선으로 너무 가까워 카드가 겹치는 문제가 있어서 레인을 더 넓힘.
// 좌우 폭이 넓은 포지션(RM/LM 등)은 모서리에 카드가 잘리지 않도록 8~92 범위로 여유를 둠.
// 수비-미드필더 간격(22→13)과 미드필더-공격수 간격을 좁혀서 공격진이 너무 떨어져 보이는 것을 개선.
const POSITION_MAP: Record<number, { label: string; x: number; y: number }> = {
  0: { label: 'GK', x: 50, y: 95 }, 1: { label: 'SW', x: 50, y: 88 },
  2: { label: 'RWB', x: 86, y: 76 }, 3: { label: 'RB', x: 80, y: 76 },
  4: { label: 'RCB', x: 59, y: 74 }, 5: { label: 'CB', x: 50, y: 75 },
  6: { label: 'LCB', x: 41, y: 74 }, 7: { label: 'LB', x: 20, y: 76 },
  8: { label: 'LWB', x: 14, y: 76 }, 9: { label: 'RDM', x: 71, y: 62 },
  10: { label: 'CDM', x: 50, y: 63 }, 11: { label: 'LDM', x: 29, y: 62 },
  12: { label: 'RM', x: 88, y: 48 }, 13: { label: 'RCM', x: 62, y: 50 },
  14: { label: 'CM', x: 50, y: 51 }, 15: { label: 'LCM', x: 38, y: 50 },
  16: { label: 'LM', x: 12, y: 48 }, 17: { label: 'RAM', x: 65, y: 34 },
  18: { label: 'CAM', x: 50, y: 32 }, 19: { label: 'LAM', x: 35, y: 34 },
  20: { label: 'RF', x: 65, y: 20 }, 21: { label: 'CF', x: 50, y: 18 },
  22: { label: 'LF', x: 35, y: 20 }, 23: { label: 'RW', x: 84, y: 16 },
  24: { label: 'RS', x: 60, y: 7 }, 25: { label: 'ST', x: 50, y: 5 },
  26: { label: 'LS', x: 40, y: 7 }, 27: { label: 'LW', x: 16, y: 16 },
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
  spId: string; name: string; games: number; position: number | null;
  avgRating: number | null;
  avgShoot: number; avgEffectiveShoot: number; avgMissedShoot: number; shootAccuracy: number | null;
  avgGoal: number; avgAssist: number;
  passSuccessRate: number | null; avgPassTry: number; avgPassSuccess: number;
  avgDribbleTry: number; avgDribbleSuccess: number;
  avgBallTry: number; avgBallSuccess: number;
  avgAerialTry: number; avgAerialSuccess: number;
  avgYellow: number; avgRed: number;
  avgIntercept: number; avgDefending: number;
  avgBlockTry: number; avgBlock: number;
  avgTackleTry: number; avgTackle: number;
  isBest: boolean; isWorst: boolean; isCurrentSquad: boolean;
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
const OUTCOME_COLOR: Record<string, string> = { win: WIN_BLUE, lose: RED, draw: GRAY, unknown: GRAY };

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
  const [showZero, setShowZero] = useState(false);
  const s = p.stats;
  const group = posGroup(p.position);
  const color = group ? GROUP_COLOR[group] : '#999';
  const passRate = s.passTry ? Math.round((s.passSuccess / s.passTry) * 100) : 0;
  const shootAcc = s.shoot ? Math.round((s.effectiveShoot / s.shoot) * 100) : 0;

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
              {p.isMotm && <span title="Man of the Match"><Icon name="starFilled" size={12} color="#F2C94C" /></span>}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
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

        {/* 시도/성공 페어를 한 줄로 합치고 2열 그리드로 배치 + 0값은 기본 숨김 - 세로로 너무 길어지던 문제 해결 */}
        <PStatSection title="공격 지표" showZero={showZero} items={[
          { label: '슈팅 정확도', value: `${shootAcc}%`, raw: s.shoot },
          { label: '슈팅 (유효/전체)', value: `${s.effectiveShoot}/${s.shoot}`, raw: s.shoot },
          { label: '득점', value: s.goal, raw: s.goal },
          { label: '어시스트', value: s.assist, raw: s.assist },
        ]} />
        <PStatSection title="공통 지표" showZero={showZero} items={[
          { label: '패스 (성공/시도)', value: `${s.passSuccess}/${s.passTry}`, raw: s.passTry },
          { label: '드리블 (성공/시도)', value: `${s.dribbleSuccess}/${s.dribbleTry}`, raw: s.dribbleTry },
          { label: '볼 소유 (성공/시도)', value: `${s.ballPossessionSuccess}/${s.ballPossessionTry}`, raw: s.ballPossessionTry },
          { label: '공중볼 경합 (성공/시도)', value: `${s.aerialSuccess}/${s.aerialTry}`, raw: s.aerialTry },
          { label: '옐로 카드', value: s.yellowCards, raw: s.yellowCards },
          { label: '레드 카드', value: s.redCards, raw: s.redCards },
        ]} />
        <PStatSection title="수비 지표" showZero={showZero} items={[
          { label: '인터셉트', value: s.intercept, raw: s.intercept },
          { label: '디펜딩', value: s.defending, raw: s.defending },
          { label: '블락 (성공/시도)', value: `${s.block}/${s.blockTry}`, raw: s.blockTry },
          { label: '태클 (성공/시도)', value: `${s.tackle}/${s.tackleTry}`, raw: s.tackleTry },
        ]} last />

        <button onClick={() => setShowZero(z => !z)} style={{
          width: '100%', marginTop: '8px', padding: '8px', borderRadius: '8px', border: '1px solid #eee',
          background: '#fafafa', color: '#777', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', fontFamily: FONT,
        }}>{showZero ? '기록 없는 항목 숨기기 ▴' : '기록 없는 항목까지 모두 보기 ▾'}</button>
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
// 상대목록 한 행 - 연승/연패 배지, 눌러서 펼치는 '최근 경기 스쿼드 보기'를 포함
function OpponentCard({ o, rank, active, loading, isSearching, onSearch, sortMode }: { o: any; rank: number; active: boolean; loading: boolean; isSearching: boolean; onSearch: () => void; sortMode?: 'games' | 'winrate' | 'recent' }) {
  const [hovered, setHovered] = useState(false);
  const [showSquadModal, setShowSquadModal] = useState(false);
  const total = o.win + o.draw + o.lose;
  const winRate = total > 0 ? (o.win / total) * 100 : 50;
  const hasSquad = o.latestSquad?.meSquad?.length > 0;
  // 색은 테두리로만 표현 - 배경까지 물들이면 승/무/패 원 색상과 겹쳐서 오히려 헷갈림
  const tone = total === 0 ? '#eee' : winRate > 55 ? WIN_BLUE : winRate < 45 ? RED : '#e5d9c8';
  // 표본이 적으면(3경기 미만) 승률이 우연에 가까워서 과신하지 않도록 살짝 톤다운
  const lowSample = total > 0 && total < 3;
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  const initials = (o.displayName || o.nickname || '?').trim().slice(0, 1);
  const lastDateShort = o.lastDate ? formatMatchDate(o.lastDate, { month: 'numeric', day: 'numeric' }) : null;

  return (
    <div style={{
      position: 'relative', height: '104px', borderRadius: '12px', overflow: 'hidden',
      border: `1.5px solid ${active ? ORANGE : tone}`, background: active ? ORANGE : (hovered ? '#fff8f0' : '#fff'),
      opacity: !active && lowSample ? 0.72 : 1,
      // 5) 1위 카드는 옅은 골드 링으로 살짝 더 강조 - 역대 최다 대결 상대라는 의미를 시각적으로도 드러냄
      boxShadow: !active && rank === 1 ? '0 0 0 2px #F2C94C40' : 'none',
      transition: 'background 0.15s, opacity 0.15s',
    }}>
      <button
        onClick={onSearch} disabled={loading}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between',
          padding: '12px', background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer',
          fontFamily: FONT, textAlign: 'left',
        }}
      >
        {/* 상단: 순위 배지 + 프로필 + 이름 - 1~3위만 색이 있는 원형 배지로 강조하고, 나머지는 배경 없이 옅은 숫자로만 표시해 이름에 시선이 먼저 가게 함 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            flexShrink: 0, width: '18px', height: '18px', borderRadius: '50%', fontSize: medal ? '1.05rem' : '0.62rem', fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: active ? 'rgba(255,255,255,0.6)' : '#ccc',
          }}>{medal || rank}</span>
          {o.profileImage ? (
            <img src={o.profileImage} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${active ? '#fff' : o.teamColor}`, flexShrink: 0 }} />
          ) : (
            <span style={{ width: '36px', height: '36px', borderRadius: '50%', background: o.teamColor, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8rem', fontWeight: 900 }}>{initials}</span>
          )}
          <span title={o.displayName} style={{ flex: 1, minWidth: 0, fontSize: '0.84rem', fontWeight: 800, color: active ? '#fff' : '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, paddingRight: hasSquad ? '56px' : 0 }}>{o.displayName}</span>
        </div>

        {/* 중단: 승/무/패 칩 + 연승/연패 배지 (자리는 항상 확보해서 카드 높이가 흔들리지 않게) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ minWidth: '22px', height: '22px', padding: '0 5px', borderRadius: '10px', background: active ? 'rgba(255,255,255,0.28)' : `${WIN_BLUE}14`, color: active ? '#fff' : WIN_BLUE, fontSize: '0.66rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{o.win}승</span>
          {o.draw > 0 && <span style={{ minWidth: '22px', height: '22px', padding: '0 5px', borderRadius: '10px', background: active ? 'rgba(255,255,255,0.28)' : '#f0f0f0', color: active ? '#fff' : GRAY, fontSize: '0.66rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{o.draw}무</span>}
          <span style={{ minWidth: '22px', height: '22px', padding: '0 5px', borderRadius: '10px', background: active ? 'rgba(255,255,255,0.28)' : `${RED}14`, color: active ? '#fff' : RED, fontSize: '0.66rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{o.lose}패</span>
          {o.streakCount >= 2 && (
            <span style={{
              flexShrink: 0, padding: '2px 7px', borderRadius: '100px', fontSize: '0.6rem', fontWeight: 900, whiteSpace: 'nowrap' as const,
              background: active ? 'rgba(255,255,255,0.9)' : (o.streakType === 'win' ? WIN_BLUE : RED),
              color: active ? (o.streakType === 'win' ? WIN_BLUE : RED) : '#fff',
            }}>{o.streakType === 'win' ? '🔥' : '❄️'}{o.streakCount}연{o.streakType === 'win' ? '승' : '패'}</span>
          )}
        </div>

        {/* 하단: 총 경기수·승률 / 조회중 스피너 */}
        {isSearching ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', fontWeight: 800, color: active ? '#fff' : ORANGE }}>
            <span style={{
              width: '10px', height: '10px', borderRadius: '50%', border: `2px solid ${active ? 'rgba(255,255,255,0.4)' : `${ORANGE}40`}`,
              borderTopColor: active ? '#fff' : ORANGE, animation: 'fc-spin 0.7s linear infinite',
            }} />
            조회 중...
          </span>
        ) : (
          <span style={{ fontSize: '0.66rem', fontWeight: 700, color: active ? 'rgba(255,255,255,0.75)' : '#bbb' }}>
            {total}경기{total > 0 ? ` · 승률 ${Math.round(winRate)}%` : ''}{lowSample ? ' · 표본 적음' : ''}{sortMode === 'recent' && lastDateShort ? ` · ${lastDateShort} 대결` : ''}
          </span>
        )}
      </button>

      {/* 최근 경기 스쿼드 보기 - 별도 아이콘으로 분리해서 카드 안에서 클릭 영역이 겹치지 않게 함. 보조 액션이라 톤다운된 아웃라인 스타일로 시선을 승패 정보 뒤로 낮춤 */}
      {hasSquad && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowSquadModal(true); }}
          title="최근 경기 스쿼드 보기"
          style={{
            position: 'absolute', top: '8px', right: '8px', height: '26px', padding: '0 10px', borderRadius: '100px',
            background: active ? 'rgba(255,255,255,0.15)' : '#fff', border: `1.3px solid ${active ? 'rgba(255,255,255,0.6)' : ORANGE}`,
            display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer',
            fontFamily: FONT, fontSize: '0.6rem', fontWeight: 900, color: active ? '#fff' : ORANGE, whiteSpace: 'nowrap' as const,
          }}
        >⚽ 스쿼드</button>
      )}

      {/* 마우스를 올렸을 때만 나타나는 '탭 가능함' 안내 */}
      {!active && hovered && !loading && (
        <span style={{
          position: 'absolute', left: '50%', bottom: '8px', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '100px',
          background: ORANGE, color: '#fff', fontSize: '0.6rem', fontWeight: 900, pointerEvents: 'none',
          boxShadow: `0 2px 6px ${ORANGE}60`, whiteSpace: 'nowrap' as const,
        }}>👆 탭해서 검색</span>
      )}

      {/* 스쿼드 모달 - 원래 매치카드가 그려지던 폭(980px 컨테이너)만큼 넉넉하게 잡아야 핏치 위
          선수 칩들이 겹치지 않음 (예전 640px로는 좁아서 22명이 서로 겹쳐 보였음) */}
      {showSquadModal && (
        <div onClick={() => setShowSquadModal(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 998,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: '920px', maxHeight: '85vh', overflowY: 'auto',
            background: '#fff', borderRadius: '18px', padding: '20px', fontFamily: FONT,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#333' }}>
                {o.displayName}님과의 최근 경기 · {o.latestSquad.meGoal ?? '-'} : {o.latestSquad.oppGoal ?? '-'} · {formatMatchDate(o.latestSquad.date)}
              </p>
              <button onClick={() => setShowSquadModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#ccc', cursor: 'pointer' }}>✕</button>
            </div>
            <MatchPitch meSquad={o.latestSquad.meSquad} oppSquad={o.latestSquad.oppSquad} />
          </div>
        </div>
      )}
    </div>
  );
}

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

// 5) 마우스 위치에 따라 아주 살짝 3D로 기울어지는 호버 효과 (데스크톱 전용, 터치기기는 자연히 무시됨)
function TiltWrapper({ children, maxTilt = 4 }: { children: React.ReactNode; maxTilt?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({ transform: 'perspective(700px) rotateX(0) rotateY(0)' });
  const onMouseMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * maxTilt * 2;
    const rotateX = (0.5 - py) * maxTilt * 2;
    setTiltStyle({ transform: `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`, transition: 'transform 0.06s linear' });
  };
  const onMouseLeave = () => setTiltStyle({ transform: 'perspective(700px) rotateX(0) rotateY(0)', transition: 'transform 0.35s ease' });
  return (
    <div ref={ref} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} style={{ ...tiltStyle, willChange: 'transform' }}>
      {children}
    </div>
  );
}

function MatchCard({ match, index = 0 }: { match: MatchRow; index?: number }) {
  const [open, setOpen] = useState(false);
  const color = OUTCOME_COLOR[match.outcome];
  return (
    <div style={{ animation: 'fc-card-in 0.4s ease both', animationDelay: `${Math.min(index * 0.05, 0.5)}s` }}>
      <div style={{ display: 'flex', border: '1px solid #eee', borderRadius: '16px', overflow: 'hidden', background: '#fff' }}>
        <span style={{ width: '4px', flexShrink: 0, background: color }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <button onClick={() => setOpen(o => !o)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
            padding: '16px 18px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
          }}>
            <span style={{
              flexShrink: 0, width: '36px', height: '36px', borderRadius: '50%',
              background: color + '18', color, border: `1.5px solid ${color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.88rem',
            }}>{OUTCOME_LABEL[match.outcome]}</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0a0a0a', flex: 1 }}>{match.meGoal ?? '-'} : {match.oppGoal ?? '-'}</span>
            <span style={{ fontSize: '0.76rem', color: '#a8a8a8', fontWeight: 600, flexShrink: 0 }}>{formatMatchDate(match.matchDate)}</span>
            <span style={{ color: '#ccc', fontSize: '0.85rem', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>▾</span>
          </button>
          {open && (
            <div style={{ padding: '0 18px 22px' }}>
              <MatchPitch meSquad={match.meSquad} oppSquad={match.oppSquad} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatGroup({ title, icon, children }: { title: string; icon: IconName; children: React.ReactNode }) {
  return (
    <div style={{ flex: '1 1 260px', minWidth: '240px', padding: '16px 18px', borderRadius: '14px', background: '#fafafa', border: '1px solid #f0f0f0' }}>
      <p style={{ fontSize: '0.74rem', fontWeight: 800, color: '#333', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Icon name={icon} size={14} color="#999" />{title}
      </p>
      {children}
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
      <span style={{ textAlign: 'right' as const, fontWeight: meBetter ? 900 : 600, color: meBetter ? ORANGE : '#1a1a1a', fontSize: meBetter ? '0.92rem' : '0.86rem' }}>
        {meVal ?? '-'}{meVal != null ? suffix : ''}
      </span>
      <span style={{ fontSize: '0.66rem', color: '#b0b0b0', fontWeight: 600, padding: '0 14px', whiteSpace: 'nowrap' as const }}>{label}</span>
      <span style={{ textAlign: 'left' as const, fontWeight: oppBetter ? 900 : 600, color: oppBetter ? '#3B82C4' : '#1a1a1a', fontSize: oppBetter ? '0.92rem' : '0.86rem' }}>
        {oppVal ?? '-'}{oppVal != null ? suffix : ''}
      </span>
    </div>
  );
}

function PlayerStatRowExpandable({ p, accent, rank }: { p: PlayerStat; accent: string; rank: number }) {
  const [open, setOpen] = useState(false);
  const [showZero, setShowZero] = useState(false);
  const tone = p.isBest ? ORANGE : p.isWorst ? RED : null;
  const group = posGroup(p.position);
  const posColor = group ? GROUP_COLOR[group] : '#ddd';
  const posLabel = typeof p.position === 'number' ? POSITION_MAP[p.position]?.label : null;
  // 5) BEST/WORST가 아닌 선수도 평점 구간으로 한눈에 잘한 선수를 구분할 수 있게
  const ratingTone = p.avgRating != null ? (p.avgRating >= 7 ? '#2E9E5B' : p.avgRating < 6 ? RED : null) : null;
  return (
    <TiltWrapper maxTilt={1.8}>
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'row' as const, borderRadius: '12px',
      border: `1px solid ${tone ? tone : '#eee'}`,
      background: tone ? `${tone}08` : '#fff', overflow: 'hidden',
      boxShadow: tone ? `0 2px 8px ${tone}1a` : '0 1px 3px rgba(0,0,0,0.03)',
    }}>
      {/* 포지션 컬러 스트립 */}
      <span style={{ width: '4px', flexShrink: 0, background: posColor }} />

      {/* BEST/WORST 코너 배지 */}
      {tone && (
        <span style={{
          position: 'absolute', top: '-1px', right: '10px', background: tone, color: '#fff',
          fontSize: '0.56rem', fontWeight: 900, padding: '2px 8px', borderRadius: '0 0 6px 6px',
          letterSpacing: '0.04em', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: '3px',
        }}>{p.isBest ? <><Icon name="starFilled" size={9} color="#fff" /> BEST</> : <><Icon name="trendDown" size={9} color="#fff" /> WORST</>}</span>
      )}

      {/* 헤더(버튼)와 펼침 내용을 세로로 쌓는 본문 컬럼 - 바깥 wrapper가 row라서 이 래퍼가 꼭 필요함 */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const }}>
        <button onClick={() => setOpen(o => !o)} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 12px',
          background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
        }}>
        <span style={{
          flexShrink: 0, width: '18px', textAlign: 'center' as const, fontSize: '0.72rem', fontWeight: 800,
          color: rank <= 3 ? '#bbb' : '#ddd',
        }}>{rank}</span>
        <div style={{ borderRadius: '50%', border: `2px solid ${tone || posColor}`, flexShrink: 0 }}>
          <PlayerImg spId={p.spId} size={36} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#111', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
            {posLabel && <span style={{ fontSize: '0.58rem', fontWeight: 800, color: '#fff', background: posColor, padding: '1px 5px', borderRadius: '4px', flexShrink: 0 }}>{posLabel}</span>}
          </div>
          <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: '#999', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ background: '#f2f2f2', padding: '0 5px', borderRadius: '100px', fontWeight: 700, color: '#888' }}>{p.games}G</span>
          </p>
        </div>
        <div style={{
          flexShrink: 0, width: '38px', height: '38px', borderRadius: '50%',
          background: tone ? tone : ratingTone ? `${ratingTone}1f` : '#f2f2f2', color: tone ? '#fff' : ratingTone || '#555',
          border: !tone && ratingTone ? `1.5px solid ${ratingTone}` : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.8rem', fontWeight: 900,
        }}>{p.avgRating ?? '-'}</div>
        <span style={{ color: '#ccc', fontSize: '0.75rem', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: '4px 12px 14px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          {/* 주요 지표 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', margin: '8px 0 12px' }}>
            {[
              ['평점', p.avgRating ?? '-'], ['득점', p.avgGoal], ['어시스트', p.avgAssist],
              ['패스성공률', p.passSuccessRate != null ? `${p.passSuccessRate}%` : '-'],
            ].map(([label, val]) => (
              <div key={label as string} style={{ textAlign: 'center' as const, padding: '8px 4px', background: `${tone || '#999'}12`, borderRadius: '8px' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 900, color: tone || '#333' }}>{val as any}</div>
                <div style={{ fontSize: '0.58rem', color: '#999', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>

          <PStatSection title="공격 지표" showZero={showZero} items={[
            { label: '슈팅 정확도', value: p.shootAccuracy != null ? `${p.shootAccuracy}%` : '-', raw: p.avgShoot },
            { label: '슈팅 (유효/전체)', value: `${p.avgEffectiveShoot}/${p.avgShoot}`, raw: p.avgShoot },
            { label: '득점', value: p.avgGoal, raw: p.avgGoal },
            { label: '어시스트', value: p.avgAssist, raw: p.avgAssist },
          ]} />
          <PStatSection title="공통 지표" showZero={showZero} items={[
            { label: '패스 (성공/시도)', value: `${p.avgPassSuccess}/${p.avgPassTry}`, raw: p.avgPassTry },
            { label: '드리블 (성공/시도)', value: `${p.avgDribbleSuccess}/${p.avgDribbleTry}`, raw: p.avgDribbleTry },
            { label: '볼 소유 (성공/시도)', value: `${p.avgBallSuccess}/${p.avgBallTry}`, raw: p.avgBallTry },
            { label: '공중볼 경합 (성공/시도)', value: `${p.avgAerialSuccess}/${p.avgAerialTry}`, raw: p.avgAerialTry },
            { label: '옐로 카드', value: p.avgYellow, raw: p.avgYellow },
            { label: '레드 카드', value: p.avgRed, raw: p.avgRed },
          ]} />
          <PStatSection title="수비 지표" showZero={showZero} items={[
            { label: '인터셉트', value: p.avgIntercept, raw: p.avgIntercept },
            { label: '디펜딩', value: p.avgDefending, raw: p.avgDefending },
            { label: '블락 (성공/시도)', value: `${p.avgBlock}/${p.avgBlockTry}`, raw: p.avgBlockTry },
            { label: '태클 (성공/시도)', value: `${p.avgTackle}/${p.avgTackleTry}`, raw: p.avgTackleTry },
          ]} last />

          <button onClick={() => setShowZero(z => !z)} style={{
            width: '100%', marginTop: '8px', padding: '8px', borderRadius: '8px', border: '1px solid #eee',
            background: '#fafafa', color: '#777', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', fontFamily: FONT,
          }}>{showZero ? '기록 없는 항목 숨기기 ▴' : '기록 없는 항목까지 모두 보기 ▾'}</button>
        </div>
      )}
      </div>
    </div>
    </TiltWrapper>
  );
}

function PStatSection({ title, items, last, showZero }: { title: string; items: { label: string; value: number | string; raw: number }[]; last?: boolean; showZero: boolean }) {
  const visible = showZero ? items : items.filter(it => it.raw > 0);
  if (visible.length === 0) return null;
  return (
    <div style={{ marginBottom: last ? 0 : '10px' }}>
      <p style={{ fontSize: '0.62rem', fontWeight: 800, color: '#bbb', letterSpacing: '0.03em', margin: '0 0 4px' }}>{title}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
        {visible.map(it => (
          <div key={it.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 2px', borderBottom: '1px solid #f5f5f5' }}>
            <span style={{ fontSize: '0.7rem', color: '#999', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#333', flexShrink: 0, marginLeft: '6px' }}>{it.value}</span>
          </div>
        ))}
      </div>
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
function PlayerCompareTable({ meTitle, oppTitle, mePlayers, oppPlayers }: {
  meTitle: string; oppTitle: string; mePlayers: PlayerStat[]; oppPlayers: PlayerStat[];
}) {
  const total = Math.max(mePlayers.length, oppPlayers.length);
  if (total === 0) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px', flexWrap: 'wrap' as const, gap: '6px' }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#333', letterSpacing: '0.06em' }}>선수 평균 스탯</p>
        <p style={{ fontSize: '0.66rem', color: '#bbb', fontWeight: 600 }}>가장 최근 경기 스쿼드(교체 포함) · 포지션 순</p>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' as const }}>
        <p style={{ flex: '1 1 120px', fontSize: '0.68rem', fontWeight: 800, color: ORANGE, whiteSpace: 'nowrap' as const }}>● {meTitle}</p>
        <p style={{ flex: '1 1 120px', fontSize: '0.68rem', fontWeight: 800, color: '#3B82C4', whiteSpace: 'nowrap' as const }}>● {oppTitle}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const }}>
            <div style={{ flex: '1 1 260px', minWidth: '240px' }}>
              {mePlayers[i] ? <PlayerStatRowExpandable p={mePlayers[i]} accent={ORANGE} rank={i + 1} /> : <div />}
            </div>
            <div style={{ flex: '1 1 260px', minWidth: '240px' }}>
              {oppPlayers[i] ? <PlayerStatRowExpandable p={oppPlayers[i]} accent="#3B82C4" rank={i + 1} /> : <div />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Skel({ w, h, r = 8 }: { w: string; h: string; r?: number }) {
  return <div style={{ width: w, height: h, borderRadius: `${r}px`, background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 37%, #f0f0f0 63%)', backgroundSize: '400% 100%', animation: 'fc-shimmer 1.4s ease infinite' }} />;
}

function LoadingState() {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setDots(d => (d % 3) + 1), 450);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      <style>{`@keyframes fc-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`}</style>
      <p style={{ fontSize: '0.8rem', color: '#bbb', fontWeight: 600, marginBottom: '18px', textAlign: 'center' as const }}>
        경기 기록을 뒤지는 중{'.'.repeat(dots)}
      </p>
      {/* VS 헤더 스켈레톤 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '18px', marginBottom: '20px' }}>
        <Skel w="120px" h="24px" r={100} />
        <Skel w="30px" h="24px" r={100} />
        <Skel w="120px" h="24px" r={100} />
      </div>
      {/* 스코어보드 스켈레톤 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', padding: '28px 20px', borderRadius: '18px', background: '#fafafa', border: '1px solid #f0f0f0', marginBottom: '28px' }}>
        <Skel w="48px" h="48px" r={12} /><Skel w="48px" h="48px" r={12} /><Skel w="48px" h="48px" r={12} />
      </div>
      {/* 요약 카드 스켈레톤 */}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '12px', marginBottom: '32px' }}>
        {[1, 2, 3].map(i => <Skel key={i} w="260px" h="120px" r={14} />)}
      </div>
      {/* 매치카드 스켈레톤 */}
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
        {[1, 2, 3].map(i => <Skel key={i} w="100%" h="60px" r={16} />)}
      </div>
    </div>
  );
}

// 2) 스맵이 압도적으로 이기고 있는 상대를 검색했을 때 잠깐 터지는 색종이 효과
function Confetti() {
  const pieces = Array.from({ length: 24 }, (_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.3;
    const duration = 1.1 + Math.random() * 0.6;
    const size = 5 + Math.random() * 5;
    const colors = [ORANGE, WIN_BLUE, '#F2C94C', '#fff'];
    const color = colors[i % colors.length];
    const rotate = Math.random() * 360;
    return { left, delay, duration, size, color, rotate, key: i };
  });
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 2 }}>
      {pieces.map(p => (
        <span key={p.key} style={{
          position: 'absolute', top: '-10px', left: `${p.left}%`, width: `${p.size}px`, height: `${p.size * 0.4}px`,
          background: p.color, borderRadius: '2px',
          animation: `fc-confetti-fall ${p.duration}s ease-in ${p.delay}s both`,
          transform: `rotate(${p.rotate}deg)`,
        }} />
      ))}
      <style>{`
        @keyframes fc-confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(90px) rotate(340deg); opacity: 0; }
        }
      `}</style>
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

// ── 통일된 라인 아이콘 세트 (이모지 대신 사용) ────────────────────────────────
type IconName = 'target' | 'sword' | 'compass' | 'shield' | 'clipboard' | 'star' | 'starFilled' | 'trendDown' | 'calendar';
function Icon({ name, size = 13, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'target':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill={color} /></svg>;
    case 'sword':
      return <svg {...common}><line x1="5" y1="19" x2="16" y2="8" /><path d="M14 6l4-1-1 4-2 2-3-3 2-2z" /><line x1="5" y1="19" x2="8" y2="19" /><line x1="5" y1="19" x2="5" y2="16" /></svg>;
    case 'compass':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M15 9l-2 6-6 2 2-6 6-2z" /></svg>;
    case 'shield':
      return <svg {...common}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /></svg>;
    case 'clipboard':
      return <svg {...common}><rect x="6" y="4" width="12" height="17" rx="2" /><rect x="9" y="2.5" width="6" height="3" rx="1" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="15" y2="15" /></svg>;
    case 'star':
      return <svg {...common}><polygon points="12,3 14.7,9.2 21.5,9.8 16.3,14.2 17.9,21 12,17.3 6.1,21 7.7,14.2 2.5,9.8 9.3,9.2" /></svg>;
    case 'starFilled':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><polygon points="12,3 14.7,9.2 21.5,9.8 16.3,14.2 17.9,21 12,17.3 6.1,21 7.7,14.2 2.5,9.8 9.3,9.2" /></svg>;
    case 'trendDown':
      return <svg {...common}><polyline points="3,7 10,14 14,10 21,17" /><polyline points="15,17 21,17 21,11" /></svg>;
    case 'calendar':
      return <svg {...common}><rect x="3.5" y="5" width="17" height="16" rx="2" /><line x1="3.5" y1="10" x2="20.5" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></svg>;
  }
}

function Divider() {
  return <div style={{ height: '1px', background: '#f0f0f0', margin: '52px 0' }} />;
}

export default function FcRecordClient() {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const resultRef = useRef<Result | null>(null);
  useEffect(() => { resultRef.current = result; }, [result]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showAllStats, setShowAllStats] = useState(false);
  useEffect(() => {
    // 검색 결과가 새로 뜨면 자동으로 그 위치까지 스크롤 - 직접 내려서 찾아야 하는 불편함 해소
    // (조용한 자동갱신 시엔 스크롤 안 튀게, 사용자가 직접 검색했을 때만 동작)
    if (result) {
      const el = document.getElementById('result-top');
      if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [result?.opponentNickname]);
  useEffect(() => { setShowAllStats(false); }, [result?.opponentNickname]); // 상대가 바뀌면 다시 '종합'만 보이는 기본 상태로
  // 3) 우측 고정 요약 카드를 닫을 수 있게 - 상대가 바뀌면 다시 보이도록 초기화
  const [sideSummaryClosed, setSideSummaryClosed] = useState(false);
  useEffect(() => { setSideSummaryClosed(false); }, [result?.opponentNickname]);
  // 7) 매치업 링크 복사 버튼의 "복사됨" 피드백
  const [shareCopied, setShareCopied] = useState(false);
  // 8) 상세 정보까지 보면 페이지가 길어져서, 일정 이상 내려가면 맨 위로 가기 버튼 노출
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 800);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 9) 미니 탭의 활성 상태를 스크롤 위치에 맞춰 추적하고, 밑줄이 부드럽게 이동하도록
  const SECTION_IDS = ['section-summary', 'section-players', 'section-matches'] as const;
  const [activeSection, setActiveSection] = useState<string>('section-summary');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabRowRef = useRef<HTMLDivElement>(null);
  const [underline, setUnderline] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  useEffect(() => {
    if (!result) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible[0]) setActiveSection(visible[0].target.id);
    }, { rootMargin: '-40% 0px -50% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });
    SECTION_IDS.forEach(id => { const el = document.getElementById(id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [result?.opponentNickname]);
  useEffect(() => {
    const btn = tabRefs.current[activeSection];
    const row = tabRowRef.current;
    if (btn && row) {
      const btnRect = btn.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      setUnderline({ left: btnRect.left - rowRect.left, width: btnRect.width });
    }
  }, [activeSection, result?.opponentNickname]);
  useEffect(() => {
    if (!result) return;
    const { win, total } = result.summary;
    // 표본이 너무 적으면(3경기 미만) 우연일 수 있어 제외 - 승률 70% 이상일 때만 축하 연출
    if (total >= 3 && win / total >= 0.7) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 1800);
      return () => clearTimeout(t);
    }
  }, [result]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [opponents, setOpponents] = useState<any[] | null>(null);
  const [opponentsLoading, setOpponentsLoading] = useState(true);
  const [overall, setOverall] = useState<{ win: number; lose: number; draw: number; total: number; thisMonth?: { win: number; lose: number; draw: number; total: number } } | null>(null);
  const [overallLoading, setOverallLoading] = useState(true);
  const [overallProgress, setOverallProgress] = useState(0);
  // 1) 상대 목록 정렬 기준 - 기본은 서버가 내려준 순서(경기 수 많은 순)를 그대로 씀
  const [sortMode, setSortMode] = useState<'games' | 'winrate' | 'recent'>('games');
  // 4) 우세/백중/열세 필터 - 기본은 전체 다 보임, 눌러서 끄고 켤 수 있음
  const [toneFilter, setToneFilter] = useState<Record<'adv' | 'even' | 'dis', boolean>>({ adv: true, even: true, dis: true });

  // 4) 최근 검색 기록 - 브라우저에만 저장, 입력창에 포커스하면 최근 검색한 닉네임을 바로 다시 선택할 수 있게
  const RECENT_SEARCH_KEY = 'fc-record-recent-searches';
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecentDropdown, setShowRecentDropdown] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCH_KEY);
      if (raw) setRecentSearches(JSON.parse(raw));
    } catch {}
  }, []);
  const pushRecentSearch = (nick: string) => {
    try {
      const next = [nick, ...recentSearches.filter(n => n !== nick)].slice(0, 6);
      setRecentSearches(next);
      localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next));
    } catch {}
  };

  // 상대목록+통산전적을 한 번의 요청으로 같이 받아옴 (API 왕복 횟수 절반으로 절감)
  const loadCombined = () => {
    fetch('/api/fconline/head2head?combined=1', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          if (!data.opponentsError) setOpponents(data.opponents);
          setOverall(data.summary);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetch('/api/fconline/head2head?combined=1', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          if (!data.opponentsError) setOpponents(data.opponents);
          setOverall(data.summary);
        }
      })
      .catch(() => {})
      .finally(() => { setOpponentsLoading(false); setOverallLoading(false); stopPolling = true; setOverallProgress(100); });

    // 통산전적 스캔 중엔 진행률(%)을 2.5초마다 폴링해서 표시하되, 스캔이 비정상적으로
    // 오래 걸리는 경우를 대비해 최대 40번(약 100초)까지만 폴링하고 자동으로 멈춤
    let stopPolling = false;
    const pollProgress = async () => {
      let attempts = 0;
      while (!stopPolling && attempts < 40) {
        try {
          const r = await fetch('/api/fconline/head2head?progress=1', { cache: 'no-store' });
          const d = await r.json();
          if (typeof d.percent === 'number') setOverallProgress(d.percent);
        } catch {}
        attempts++;
        await new Promise(res => setTimeout(res, 2500));
      }
    };
    pollProgress();

    // 새로고침 시엔 항상 최신 데이터를 가져오지만, 페이지를 켜놓은 채로 있는 동안 자동으로
    // 다시 조회하진 않음(예전엔 1시간마다 자동갱신했는데, 여러 명이 동시에 페이지를 켜둘 수
    // 있는 만큼 요청량을 최대한 아끼기 위해 완전히 제거함 - 필요하면 새로고침으로 갱신)
    return () => { stopPolling = true; };
  }, []);

  const search = async (nick?: string, silent = false) => {
    const target = (nick ?? nickname).trim();
    if (!target) return;
    if (!silent) {
      setNickname(target);
      setLoading(true);
      setErrorMsg(null);
      setResult(null);
    }
    try {
      const res = await fetch(`/api/fconline/head2head?opponent=${encodeURIComponent(target)}`, silent ? { cache: 'no-store' } : undefined);
      const data = await res.json();
      if (!res.ok || data.error) { if (!silent) setErrorMsg(data.error || '조회에 실패했어요.'); }
      else { setResult(data); if (!silent) pushRecentSearch(target); } // silent여도 최신 데이터로 조용히 교체
    } catch {
      if (!silent) setErrorMsg('조회 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // 7) 링크로 공유된 특정 상대 매치업 - URL에 ?opponent=닉네임이 있으면 페이지 진입 시 바로 그 상대를 조회
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('opponent');
      if (q && q.trim()) { setNickname(q.trim()); search(q.trim()); }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 우세/백중/열세 카테고리 판정 - OpponentCard 안의 tone 계산과 기준을 맞춤
  const oppTone = (o: any): 'adv' | 'even' | 'dis' => {
    const total = o.win + o.draw + o.lose;
    const rate = total > 0 ? (o.win / total) * 100 : 50;
    return total === 0 ? 'even' : rate > 55 ? 'adv' : rate < 45 ? 'dis' : 'even';
  };

  // 1) + 4) 정렬 기준과 우세/백중/열세 필터를 함께 적용한 상대 목록
  const displayedOpponents = (opponents || [])
    .filter(o => toneFilter[oppTone(o)])
    .slice()
    .sort((a, b) => {
      if (sortMode === 'winrate') {
        const aTotal = a.win + a.draw + a.lose, bTotal = b.win + b.draw + b.lose;
        const aRate = aTotal > 0 ? a.win / aTotal : -1, bRate = bTotal > 0 ? b.win / bTotal : -1;
        return bRate - aRate;
      }
      if (sortMode === 'recent') {
        return (a.lastDate < b.lastDate ? 1 : -1);
      }
      return (b.win + b.draw + b.lose) - (a.win + a.draw + a.lose); // games
    });

  // 3) 우세/백중/열세 각각 몇 명인지 - 필터를 누르기 전에 몇 명이 걸러질지 미리 알 수 있게
  const toneCounts = (opponents || []).reduce(
    (acc, o) => { acc[oppTone(o)]++; return acc; },
    { adv: 0, even: 0, dis: 0 } as Record<'adv' | 'even' | 'dis', number>
  );

  // 10) 최근에 맞붙은 상대를 상단에서 바로 찾아갈 수 있는 바로가기 (전체 목록 스크롤 없이 접근)
  // 3) 아래 '경기 수 많은 순' 기본 그리드의 상위 4명과는 겹치지 않게 해서 같은 얼굴이 두 번 보이지 않게 함
  const topByGames = new Set((opponents || []).slice().sort((a, b) => (b.win + b.draw + b.lose) - (a.win + a.draw + a.lose)).slice(0, 4).map(o => o.nickname));
  const recentOpponents = (opponents || [])
    .filter(o => !topByGames.has(o.nickname))
    .slice()
    .sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1))
    .slice(0, 6);

  // 6) 검색 실패 시 등록된 상대 중 가장 비슷한 닉네임을 찾아 "혹시 이 사람?" 제안에 사용
  const levenshtein = (a: string, b: string): number => {
    const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp[a.length][b.length];
  };
  const suggestion = (() => {
    if (!errorMsg || !opponents || !nickname.trim()) return null;
    const target = nickname.trim().toLowerCase();
    let best: any = null, bestDist = Infinity;
    for (const o of opponents) {
      const cand = (o.displayName || o.nickname).toLowerCase();
      const dist = levenshtein(target, cand);
      if (dist < bestDist) { bestDist = dist; best = o; }
    }
    // 닉네임 길이 대비 너무 동떨어진 후보는 오히려 헷갈리니 제외
    if (best && bestDist <= Math.max(2, Math.ceil(target.length * 0.4))) return best;
    return null;
  })();

  return (
    <main style={{ minHeight: '100vh', position: 'relative', background: '#fff', padding: 'clamp(48px,8vw,80px) clamp(1.5rem,6vw,6rem)', fontFamily: FONT }}>
      {/* 은은한 메시 그라데이션 배경 - 아주 느리게 떠다니며 화면에 생동감을 더함. 넓은 화면일수록 양옆이
          비어보이지 않도록, 코너의 둥근 블롭 2개 + 좌우 측면을 세로로 길게 흐르는 블롭 2개를 함께 배치함 */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '-10%', left: '-5%', width: '45vw', height: '45vw', maxWidth: '600px', maxHeight: '600px',
          background: `radial-gradient(circle, ${ORANGE}14 0%, transparent 70%)`, borderRadius: '50%',
          animation: 'fc-blob-a 22s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '-15%', right: '-8%', width: '50vw', height: '50vw', maxWidth: '650px', maxHeight: '650px',
          background: `radial-gradient(circle, ${WIN_BLUE}10 0%, transparent 70%)`, borderRadius: '50%',
          animation: 'fc-blob-b 26s ease-in-out infinite',
        }} />
        {/* 좌측면을 따라 흐르는 세로 블롭 - 넓은 화면에서 좌측 여백을 채움 */}
        <div style={{
          position: 'absolute', top: '20%', left: '-12%', width: '26vw', height: '75vh', maxWidth: '380px',
          background: `radial-gradient(ellipse, ${WIN_BLUE}0d 0%, transparent 65%)`, borderRadius: '50%',
          animation: 'fc-blob-c 30s ease-in-out infinite',
        }} />
        {/* 우측면을 따라 흐르는 세로 블롭 - 넓은 화면에서 우측 여백을 채움 */}
        <div style={{
          position: 'absolute', top: '5%', right: '-12%', width: '26vw', height: '80vh', maxWidth: '380px',
          background: `radial-gradient(ellipse, ${ORANGE}0d 0%, transparent 65%)`, borderRadius: '50%',
          animation: 'fc-blob-d 28s ease-in-out infinite',
        }} />
        <style>{`
          @keyframes fc-blob-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(4%,6%) scale(1.08); } }
          @keyframes fc-blob-b { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-5%,-4%) scale(1.06); } }
          @keyframes fc-blob-c { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(4%) scale(1.05); } }
          @keyframes fc-blob-d { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-4%) scale(1.05); } }
          @keyframes fc-card-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes fc-spin { to { transform: rotate(360deg); } }
          /* 3) 키보드(Tab)로 이동할 때 지금 어디에 포커스가 있는지 명확히 보이게.
             마우스 클릭 시엔 안 보이고, 키보드 탐색일 때만 보이도록 :focus-visible만 사용 */
          main button:focus-visible, main input:focus-visible, main a:focus-visible {
            outline: 2.5px solid ${ORANGE};
            outline-offset: 2px;
          }
          /* 넓은 화면(1680px+)에서만 결과 요약 사이드 패널 노출 - 콘텐츠(980px) 바로 옆에 붙이다보니
             화면이 너무 좁으면 패널이 화면 밖으로 잘려서, 안전하게 보이는 폭부터만 노출함 */
          .fc-side-summary { display: none; }
          @media (min-width: 1680px) {
            .fc-side-summary { display: flex !important; }
          }
          /* 상대목록 카드 그리드 - 좁은 화면은 2열, 640px부터 4열로 고정해서 좌우 빈 공간 없이 꽉 채움
             (auto-fill+고정폭 대신 1fr로 늘어나게 해서 줄 끝에 남는 여백이 생기지 않게 함) */
          .fc-opp-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
          @media (min-width: 640px) {
            .fc-opp-grid { grid-template-columns: repeat(4, 1fr); }
          }
        `}</style>
      </div>

      {/* 넓은 화면 여백 활용: 검색 결과가 있으면 우측에 핵심 요약을 고정 표시해서
          아래로 스크롤하지 않아도 승패/승률을 바로 볼 수 있게 함. 새로운 데이터를 더
          불러오는 게 아니라 이미 받아온 result를 재사용하는 거라 서버 부담은 없음 */}
      {result && !errorMsg && !loading && !sideSummaryClosed && (() => {
        const winRate = result.summary.total > 0 ? (result.summary.win / result.summary.total) * 100 : 50;
        // 4) 우세/열세에 따른 톤 - 숫자를 안 읽어도 색으로 바로 감이 오게
        const tone = result.summary.total === 0 ? '#ddd' : winRate > 55 ? WIN_BLUE : winRate < 45 ? RED : GRAY;
        // 5) 최근 5경기 폼 - 오래된 것부터 최신 순으로 (matches는 이미 최신순 정렬돼있음)
        const last5 = [...result.matches].slice(0, 5).reverse();
        return (
          <div className="fc-side-summary" style={{
            position: 'fixed', top: '130px', left: 'calc(50% + 490px + 24px)', width: '300px', zIndex: 2,
            flexDirection: 'column' as const, gap: '14px', padding: '22px', borderRadius: '20px',
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)', border: `2px solid ${tone}55`,
            boxShadow: `0 10px 30px ${tone}25`,
          }}>
            {/* 3) 계속 떠 있는 게 불편할 때 닫을 수 있게 */}
            <button onClick={() => setSideSummaryClosed(true)} title="닫기" style={{
              position: 'absolute', top: '10px', right: '10px', width: '22px', height: '22px', borderRadius: '50%',
              background: '#f2f2f2', border: 'none', color: '#999', fontSize: '0.7rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT,
            }}>✕</button>
            <button onClick={() => document.getElementById('result-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} style={{
              display: 'flex', flexDirection: 'column' as const, gap: '14px', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: FONT, textAlign: 'left', padding: 0, width: '100%',
            }}>
              {/* 3) 상대 프로필 사진 + 이름 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {result.oppDisplay.profileImage ? (
                  <img src={result.oppDisplay.profileImage} alt="" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: `2.5px solid ${tone}`, flexShrink: 0 }} />
                ) : (
                  <span style={{ width: '44px', height: '44px', borderRadius: '50%', background: tone, flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#bbb', fontWeight: 800, letterSpacing: '0.04em' }}>스맵 VS</p>
                  <p title={result.oppDisplay.name} style={{ margin: '1px 0 0', fontSize: '1.05rem', color: '#222', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{result.oppDisplay.name}</p>
                </div>
              </div>

              {/* 2) 승/무/패 - 대폭 확대된 숫자 */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span style={{ fontSize: '2.3rem', fontWeight: 900, color: WIN_BLUE, lineHeight: 1 }}>{result.summary.win}</span>
                <span style={{ fontSize: '0.8rem', color: '#999', fontWeight: 700 }}>승</span>
                {result.summary.draw > 0 && <><span style={{ fontSize: '2.3rem', fontWeight: 900, color: GRAY, lineHeight: 1 }}>{result.summary.draw}</span><span style={{ fontSize: '0.8rem', color: '#999', fontWeight: 700 }}>무</span></>}
                <span style={{ fontSize: '2.3rem', fontWeight: 900, color: RED, lineHeight: 1 }}>{result.summary.lose}</span>
                <span style={{ fontSize: '0.8rem', color: '#999', fontWeight: 700 }}>패</span>
              </div>

              {result.summary.total > 0 && (
                <>
                  <div style={{ width: '100%', height: '8px', borderRadius: '100px', overflow: 'hidden', display: 'flex', background: '#f0f0f0' }}>
                    <span style={{ width: `${(result.summary.win / result.summary.total) * 100}%`, background: WIN_BLUE }} />
                    <span style={{ width: `${(result.summary.draw / result.summary.total) * 100}%`, background: GRAY }} />
                    <span style={{ width: `${(result.summary.lose / result.summary.total) * 100}%`, background: RED }} />
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#888', fontWeight: 800 }}>
                    승률 <span style={{ color: tone, fontSize: '0.95rem' }}>{Math.round(winRate)}%</span> · 총 {result.summary.total}경기
                  </p>
                </>
              )}

              {/* 5) 최근 5경기 폼 dot */}
              {last5.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: '0.68rem', color: '#bbb', fontWeight: 800 }}>최근 {last5.length}경기</p>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {last5.map((m, i) => {
                      const c = OUTCOME_COLOR[m.outcome];
                      return (
                        <span key={i} style={{
                          width: '22px', height: '22px', borderRadius: '50%', background: `${c}18`, color: c,
                          border: `1.5px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.62rem', fontWeight: 900,
                        }}>{OUTCOME_LABEL[m.outcome]}</span>
                      );
                    })}
                  </div>
                </div>
              )}

              <span style={{ marginTop: '2px', fontSize: '0.76rem', color: ORANGE, fontWeight: 800 }}>자세히 보기 ↓</span>
            </button>
          </div>
        );
      })()}

      <div style={{ maxWidth: '980px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          <Link href="/apps" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#999',
            textDecoration: 'none', padding: '6px 12px', border: '1px solid #eee', borderRadius: '100px',
          }}>← 도구로</Link>
        </div>

        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', color: ORANGE, marginBottom: '8px' }}>FC ONLINE HEAD-TO-HEAD</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' as const }}>
            <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)', fontWeight: 900, letterSpacing: '-0.04em', color: '#111', margin: 0, lineHeight: 1.15 }}>
              상대 스트리머와의 전적
            </h1>
            {/* 10) 전체 규모를 제목 옆에서 바로 보여줌 */}
            {!opponentsLoading && opponents && opponents.length > 0 && (
              <span style={{
                padding: '4px 12px', borderRadius: '100px', background: '#f2f2f2', color: '#888',
                fontSize: '0.74rem', fontWeight: 800, whiteSpace: 'nowrap' as const,
              }}>총 {opponents.length}명과 대결</span>
            )}
          </div>
          <p style={{ fontSize: '0.88rem', color: '#999', marginTop: '10px', lineHeight: 1.6 }}>
            상대 스트리머의 FC 온라인 닉네임을 입력하면, 스맵과 맞붙었던 경기 전적과 그날 서로 사용한 스쿼드를 보여줘요.
          </p>
          {/* 기준일 안내는 페이지에서 여기 한 곳에만 - 통산전적 옆에도 중복으로 있던 걸 통합하고, 시인성 위해 확대 */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px', marginTop: '12px', padding: '8px 16px', borderRadius: '100px',
            background: ORANGE, color: '#fff', fontSize: '0.85rem', fontWeight: 900, boxShadow: `0 2px 8px ${ORANGE}50`,
          }}>
            <Icon name="calendar" size={13} color="#fff" /> 2026년 8월 10일부터의 전적만 집계돼요
          </span>
        </div>

        {(overallLoading || (overall && overall.total > 0)) && (
          <div style={{ padding: '16px 20px', borderRadius: '14px', background: '#fafafa', border: '1px solid #f0f0f0', marginBottom: '32px', minHeight: '20px' }}>
            {overallLoading ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{
                    width: '16px', height: '16px', borderRadius: '50%',
                    border: '2px solid #eee', borderTopColor: ORANGE,
                    animation: 'fc-spin 0.8s linear infinite', flexShrink: 0,
                  }} />
                  <span style={{ fontSize: '0.78rem', color: '#aaa' }}>스맵 통산 전적 최신화 중... {overallProgress}%</span>
                  <style>{`@keyframes fc-spin { to { transform: rotate(360deg); } }`}</style>
                </div>
                <div style={{ width: '100%', height: '4px', borderRadius: '100px', background: '#eee', overflow: 'hidden' }}>
                  <div style={{ width: `${overallProgress}%`, height: '100%', background: ORANGE, borderRadius: '100px', transition: 'width 0.4s ease' }} />
                </div>
              </>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' as const }}>
                  <span style={{ fontSize: '0.76rem', color: '#999', fontWeight: 700 }}>스맵 통산</span>
                  <span style={{ fontWeight: 900, color: WIN_BLUE }}>{overall!.win}승</span>
                  <span style={{ fontWeight: 900, color: GRAY }}>{overall!.draw}무</span>
                  <span style={{ fontWeight: 900, color: RED }}>{overall!.lose}패</span>
                  <span style={{ fontSize: '0.76rem', color: '#999', fontWeight: 600 }}>(총 {overall!.total}경기)</span>
                </div>
                {/* 5) 승/무/패 비율을 숫자만이 아니라 막대로도 한눈에 - 텍스트를 안 읽어도 전체 승률 감이 옴 */}
                {overall!.total > 0 && (
                  <div style={{ width: '100%', height: '7px', borderRadius: '100px', overflow: 'hidden', display: 'flex', background: '#eee', marginTop: '10px' }}>
                    <span style={{ width: `${(overall!.win / overall!.total) * 100}%`, background: WIN_BLUE }} />
                    <span style={{ width: `${(overall!.draw / overall!.total) * 100}%`, background: GRAY }} />
                    <span style={{ width: `${(overall!.lose / overall!.total) * 100}%`, background: RED }} />
                  </div>
                )}
                {overall!.thisMonth && overall!.thisMonth.total > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' as const, marginTop: '10px', padding: '10px 12px', borderRadius: '10px', background: `${ORANGE}0d` }}>
                    <span style={{ fontSize: '0.72rem', color: ORANGE, fontWeight: 800 }}>
                      이번 달{(overall!.thisMonth as any).rangeLabel ? ` (${(overall!.thisMonth as any).rangeLabel})` : ''}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: WIN_BLUE }}>{overall!.thisMonth.win}승</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: GRAY }}>{overall!.thisMonth.draw}무</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: RED }}>{overall!.thisMonth.lose}패</span>
                    <span style={{ fontSize: '0.72rem', color: '#999', fontWeight: 700 }}>
                      · 승률 {Math.round((overall!.thisMonth.win / overall!.thisMonth.total) * 100)}% (총 {overall!.thisMonth.total}경기)
                    </span>
                  </div>
                )}
                {(overall as any).recent15 && (overall as any).recent15.total > 0 && (
                  <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '10px', background: `${WIN_BLUE}0d` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' as const, marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#7a5200', fontWeight: 800 }}>최근 {(overall as any).recent15.total}경기</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: WIN_BLUE }}>{(overall as any).recent15.win}승</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: GRAY }}>{(overall as any).recent15.draw}무</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: RED }}>{(overall as any).recent15.lose}패</span>
                      <span style={{ fontSize: '0.72rem', color: '#999', fontWeight: 700 }}>
                        · 승률 {Math.round(((overall as any).recent15.win / (overall as any).recent15.total) * 100)}%
                      </span>
                    </div>
                    {/* 누구랑 붙었는지 한눈에 - 왼쪽부터 시간순(오래된 것→최신), 클릭하면 바로 그 상대로 검색 */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
                      {(overall as any).recent15.matches?.map((m: any, i: number) => {
                        const c = OUTCOME_COLOR[m.outcome];
                        return (
                          <button key={i} onClick={() => search(m.nickname)} title={`${m.displayName} · ${m.meGoal ?? '-'}:${m.oppGoal ?? '-'} · ${formatMatchDate(m.matchDate)}`} style={{
                            position: 'relative', width: '28px', height: '28px', borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0,
                          }}>
                            {m.profileImage ? (
                              <img src={m.profileImage} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${c}` }} />
                            ) : (
                              <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: '50%', background: m.teamColor, border: `2px solid ${c}` }} />
                            )}
                            {/* 1) 테두리 색만으론 색약 사용자나 빠른 스캔 시 승/패 구분이 어려울 수 있어 텍스트 배지로 보강 */}
                            {m.outcome !== 'unknown' && (
                              <span style={{
                                position: 'absolute', bottom: '-3px', right: '-3px', width: '13px', height: '13px', borderRadius: '50%',
                                background: c, color: '#fff', fontSize: '0.5rem', fontWeight: 900, lineHeight: '13px', textAlign: 'center' as const,
                                border: '1.5px solid #fff',
                              }}>{OUTCOME_LABEL[m.outcome]}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{
          position: 'sticky', top: 0, zIndex: 6, display: 'flex', gap: '8px', marginBottom: '20px',
          padding: '10px 0', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
          boxShadow: '0 6px 14px -8px rgba(0,0,0,0.12)',
        }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { search(); setShowRecentDropdown(false); } if (e.key === 'Escape') setShowRecentDropdown(false); }}
              onFocus={() => setShowRecentDropdown(true)}
              onBlur={() => setTimeout(() => setShowRecentDropdown(false), 120)}
              placeholder="상대 닉네임 입력 (예: 호날두팬클럽)"
              style={{ width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1px solid #ddd', background: '#fff', color: '#111', fontSize: '0.95rem', outline: 'none', fontFamily: FONT }}
            />
            {/* 4) 최근 검색한 닉네임을 드롭다운으로 제안 - 같은 상대를 반복 조회할 때 다시 타이핑하지 않아도 되게 */}
            {showRecentDropdown && recentSearches.length > 0 && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 10,
                background: '#fff', border: '1px solid #eee', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                overflow: 'hidden', padding: '6px',
              }}>
                <p style={{ margin: '4px 8px 6px', fontSize: '0.62rem', fontWeight: 800, color: '#bbb' }}>최근 검색</p>
                {recentSearches.map(n => (
                  <button key={n} onMouseDown={() => { setNickname(n); search(n); setShowRecentDropdown(false); }} style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: '8px',
                    background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: '0.84rem', color: '#333',
                  }}>{n}</button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => search()} disabled={loading || !nickname.trim()} style={{
            padding: '14px 24px', borderRadius: '12px', border: 'none',
            background: loading || !nickname.trim() ? '#eee' : ORANGE,
            color: loading || !nickname.trim() ? '#bbb' : '#fff',
            fontWeight: 800, fontSize: '0.9rem', cursor: loading || !nickname.trim() ? 'default' : 'pointer',
            fontFamily: FONT, whiteSpace: 'nowrap' as const,
          }}>{loading ? '조회 중...' : '전적 조회'}</button>
        </div>

        {/* 로딩 중엔 아무것도 안 보이던 걸, 실제 카드 그리드와 같은 모양의 스켈레톤으로 대체 */}
        {opponentsLoading && (
          <div style={{ marginBottom: '20px', padding: '16px 18px', borderRadius: '14px', background: '#fafafa', border: '1px solid #f0f0f0' }}>
            <Skel w="160px" h="30px" r={100} />
            <div className="fc-opp-grid" style={{ marginTop: '14px' }}>
              {Array.from({ length: 8 }).map((_, i) => <Skel key={i} w="100%" h="92px" r={12} />)}
            </div>
          </div>
        )}

        {/* 10) 최근에 맞붙은 상대 바로가기 - 전체 목록을 스크롤하지 않아도 자주 찾는 최근 상대에 바로 갈 수 있게 */}
        {!opponentsLoading && recentOpponents.length > 0 && (
          <div style={{ marginBottom: '16px', padding: '14px 16px', borderRadius: '14px', background: '#fafafa', border: '1px solid #f0f0f0' }}>
            <p style={{ margin: '0 0 10px', fontSize: '0.72rem', fontWeight: 800, color: '#999' }}>최근에 만난 상대</p>
            <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: '14px', overflowX: 'auto' as const, paddingBottom: '2px' }}>
              {recentOpponents.map(o => (
                <button key={o.nickname} onClick={() => search(o.nickname)} disabled={loading} title={o.displayName} style={{
                  display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '5px', background: 'none', border: 'none',
                  cursor: loading ? 'default' : 'pointer', fontFamily: FONT, flexShrink: 0, width: '54px',
                }}>
                  {o.profileImage ? (
                    <img src={o.profileImage} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${nickname === o.nickname ? ORANGE : o.teamColor}` }} />
                  ) : (
                    <span style={{ width: '40px', height: '40px', borderRadius: '50%', background: o.teamColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9rem', fontWeight: 900, border: `2px solid ${nickname === o.nickname ? ORANGE : 'transparent'}` }}>{(o.displayName || o.nickname).slice(0, 1)}</span>
                  )}
                  <span style={{ fontSize: '0.6rem', color: '#999', fontWeight: 700, maxWidth: '54px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{o.displayName}</span>
                </button>
              ))}
            </div>
            {/* 7) 가로 스크롤 가능함을 암시하는 옅은 페이드 - 오른쪽에 더 있다는 걸 보여줌 */}
            <div aria-hidden style={{ position: 'absolute', top: 0, right: 0, bottom: '2px', width: '28px', pointerEvents: 'none', background: 'linear-gradient(90deg, transparent, #fafafa)' }} />
            </div>
          </div>
        )}

        {/* 액션성 섹션: 클릭하면 바로 검색되는 상대 선택 - 주황 틴트로 "탭 가능함"을 명확히 표시 */}
        {!opponentsLoading && opponents && opponents.length > 0 && (
          <div style={{ marginBottom: '20px', padding: '16px 18px', borderRadius: '14px', background: `${ORANGE}0d`, border: `1.5px solid ${ORANGE}45` }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '6px 14px', borderRadius: '100px', background: ORANGE, boxShadow: `0 2px 8px ${ORANGE}50`, marginBottom: '12px' }}>
              <Icon name="target" size={15} color="#fff" /> <span style={{ fontSize: '0.92rem', color: '#fff', fontWeight: 900 }}>탭하면 바로 검색돼요</span>
            </div>
            {/* 1) 정렬 기준과 4) 우세/백중/열세 필터를 한 줄에 같은 톤(알약 버튼)으로 묶어서 "이 목록을 조작하는 컨트롤"이라는 걸 한눈에 보이게 함 */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '0.68rem', color: '#aaa', fontWeight: 700 }}>정렬</span>
              {([['games', '경기 수'], ['winrate', '승률'], ['recent', '최근 대결']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setSortMode(key)} style={{
                  padding: '4px 10px', borderRadius: '100px', border: `1px solid ${sortMode === key ? ORANGE : '#eee'}`,
                  background: sortMode === key ? ORANGE : '#fff', color: sortMode === key ? '#fff' : '#999',
                  fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer', fontFamily: FONT,
                }}>{label}</button>
              ))}
              <span style={{ width: '1px', height: '14px', background: '#eee', margin: '0 2px' }} />
              <span style={{ fontSize: '0.68rem', color: '#aaa', fontWeight: 700 }}>필터</span>
              {([
                ['adv', WIN_BLUE, '우세(승률 55%↑)'],
                ['even', '#c9b79c', '백중'],
                ['dis', RED, '열세(승률 45%↓)'],
              ] as const).map(([key, color, label]) => {
                const on = toneFilter[key];
                return (
                  <button key={key} onClick={() => setToneFilter(f => ({ ...f, [key]: !f[key] }))} style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '100px',
                    border: `1.5px solid ${color}`, background: on ? `${color}1f` : '#fff', opacity: on ? 1 : 0.5,
                    fontSize: '0.7rem', color: '#666', fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                  }}>
                    {/* 2) 몇 명이 해당하는지 미리 보여줘서, 눌러보기 전에 결과를 가늠할 수 있게 */}
                    <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: color, flexShrink: 0 }} /> {label} ({toneCounts[key]})
                  </button>
                );
              })}
            </div>
            {/* 2) 필터를 걸었을 때 전체 대비 몇 명이 보이는 중인지 한 줄로 요약 - pill 개수 표시와 별개로 전체 맥락을 바로 파악 */}
            {displayedOpponents.length !== (opponents || []).length && (
              <p style={{ margin: '0 0 12px', fontSize: '0.7rem', color: '#aaa', fontWeight: 700 }}>
                전체 {(opponents || []).length}명 중 <span style={{ color: ORANGE, fontWeight: 900 }}>{displayedOpponents.length}명</span> 표시 중
              </p>
            )}
            {displayedOpponents.length === 0 ? (
              <div style={{ textAlign: 'center' as const, padding: '24px 0' }}>
                <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#bbb' }}>선택한 조건에 맞는 상대가 없어요.</p>
                {/* 9) 필터를 걸어놓고 잊었을 때 바로 복구할 수 있게 */}
                <button onClick={() => setToneFilter({ adv: true, even: true, dis: true })} style={{
                  padding: '6px 16px', borderRadius: '100px', border: `1px solid ${ORANGE}`, background: '#fff',
                  color: ORANGE, fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', fontFamily: FONT,
                }}>필터 초기화하고 전체 보기</button>
              </div>
            ) : (
              <div className="fc-opp-grid">
                {displayedOpponents.map((o, i) => (
                  <OpponentCard key={o.nickname} o={o} rank={i + 1} active={nickname === o.nickname} loading={loading} isSearching={loading && nickname === o.nickname} onSearch={() => search(o.nickname)} sortMode={sortMode} />
                ))}
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div style={{ padding: '16px 18px', borderRadius: '12px', background: '#fff5f5', border: '1px solid #f4cccc', color: '#c0392b', fontSize: '0.85rem', marginBottom: '24px' }}>
            <p style={{ margin: 0 }}>{errorMsg}</p>
            {/* 6) 등록된 스트리머 중 가장 비슷한 닉네임을 제안 - 오타 재입력 수고를 줄임 */}
            {suggestion && (
              <button onClick={() => search(suggestion.nickname)} style={{
                marginTop: '10px', padding: '6px 14px', borderRadius: '100px', border: '1px solid #e0a8a8',
                background: '#fff', color: '#c0392b', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', fontFamily: FONT,
              }}>혹시 <b>{suggestion.displayName}</b>님을 찾으셨나요?</button>
            )}
          </div>
        )}

        {loading && <LoadingState />}

        {result && !errorMsg && !loading && (
          <>
            <Divider />
            <div id="result-top" style={{ position: 'relative', scrollMarginTop: '16px' }}>
              {showConfetti && <Confetti />}
              <VsHeader me={result.meDisplay} opp={result.oppDisplay} />
            </div>

            {/* 5) 피라미드 구조의 최상단 - 표/숫자를 보기 전에 결론부터 한 줄 자연어로 전달 */}
            <p style={{ textAlign: 'center' as const, fontSize: '0.95rem', fontWeight: 700, color: '#555', marginBottom: '10px' }}>
              {result.summary.total === 0
                ? `${result.oppDisplay.name}님과 붙은 기록이 아직 없어요`
                : (() => {
                    const rate = Math.round((result.summary.win / result.summary.total) * 100);
                    return <>총 <b style={{ color: '#111' }}>{result.summary.total}경기</b> 중 <b style={{ color: WIN_BLUE }}>{result.summary.win}번 승리</b> (승률 {rate}%){result.summary.total < 3 && <span style={{ fontSize: '0.72rem', color: '#bbb', fontWeight: 600 }}> · 표본이 적어 참고용</span>}</>;
                  })()}
            </p>

            {/* 7) 이 매치업만 담긴 링크를 복사해서 바로 공유할 수 있게 */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <button onClick={async () => {
                const url = `${window.location.origin}${window.location.pathname}?opponent=${encodeURIComponent(result.opponentNickname)}`;
                try {
                  await navigator.clipboard.writeText(url);
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 1800);
                } catch {}
              }} style={{
                display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 14px', borderRadius: '100px',
                border: '1px solid #eee', background: '#fafafa', color: '#999', fontSize: '0.7rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: FONT,
              }}>{shareCopied ? '링크 복사됨 ✓' : `🔗 ${result.oppDisplay.name}님과의 전적 링크 복사`}</button>
            </div>

            {/* sticky 미니 탭 - 섹션이 길어서 스크롤 중에도 바로 이동 가능하게. 9) 지금 보고 있는 섹션에 맞춰
                밑줄이 부드럽게 슬라이드 이동해서 탭과 실제 스크롤 위치가 항상 일치함을 보여줌 */}
            <div ref={tabRowRef} style={{
              position: 'sticky', top: 0, zIndex: 5, display: 'flex', gap: '6px', justifyContent: 'center',
              padding: '8px 0', marginBottom: '24px', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)',
              borderBottom: '1px solid #f0f0f0',
            }}>
              {[['요약', 'section-summary'], ['선수', 'section-players'], ['경기', 'section-matches']].map(([label, id]) => (
                <button
                  key={id}
                  ref={el => { tabRefs.current[id] = el; }}
                  onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  style={{
                    padding: '5px 14px', borderRadius: '100px', border: `1px solid ${activeSection === id ? ORANGE : '#eee'}`,
                    background: activeSection === id ? `${ORANGE}12` : '#fafafa',
                    color: activeSection === id ? ORANGE : '#888', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                    transition: 'background 0.2s, border-color 0.2s, color 0.2s',
                  }}>{label}</button>
              ))}
              <span style={{
                position: 'absolute', bottom: '-1px', left: `${underline.left}px`, width: `${underline.width}px`,
                height: '2px', background: ORANGE, borderRadius: '100px', transition: 'left 0.25s ease, width 0.25s ease',
              }} />
            </div>

            <div id="section-summary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(20px,6vw,48px)', padding: '28px 20px', borderRadius: '18px', background: '#fafafa', border: '1px solid #f0f0f0', marginBottom: '36px' }}>
              {/* 6) 숫자만으론 전체 대비 비중이 바로 안 와닿아서 각 숫자 아래 비율(%)을 함께 표기 */}
              <div style={{ textAlign: 'center' as const }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: WIN_BLUE }}>{result.summary.win}</div>
                <div style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>승{result.summary.total > 0 ? ` · ${Math.round((result.summary.win / result.summary.total) * 100)}%` : ''}</div>
              </div>
              <div style={{ textAlign: 'center' as const }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: GRAY }}>{result.summary.draw}</div>
                <div style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>무{result.summary.total > 0 ? ` · ${Math.round((result.summary.draw / result.summary.total) * 100)}%` : ''}</div>
              </div>
              <div style={{ textAlign: 'center' as const }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: RED }}>{result.summary.lose}</div>
                <div style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>패{result.summary.total > 0 ? ` · ${Math.round((result.summary.lose / result.summary.total) * 100)}%` : ''}</div>
              </div>
            </div>

            <div style={{ marginBottom: '40px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#333', letterSpacing: '0.06em', margin: 0 }}>요약 · 경기당 평균 기록</p>
                {!showAllStats && (
                  <button onClick={() => setShowAllStats(true)} style={{
                    fontSize: '0.72rem', fontWeight: 700, color: ORANGE, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT,
                  }}>공격·빌드업·수비 등 자세히 보기 →</button>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '12px' }}>
                <StatGroup title="종합" icon="target">
                  <StatRow label="승률" meVal={result.summary.total ? +((result.summary.win / result.summary.total) * 100).toFixed(1) : null} oppVal={result.summary.total ? +((result.summary.lose / result.summary.total) * 100).toFixed(1) : null} suffix="%" />
                  <StatRow label="평균 평점" meVal={result.teamStats.me.rating} oppVal={result.teamStats.opp.rating} />
                </StatGroup>
                {showAllStats && (
                  <>
                    <StatGroup title="공격" icon="sword">
                      <StatRow label="유효 슈팅" meVal={result.teamStats.me.effectiveShoot} oppVal={result.teamStats.opp.effectiveShoot} />
                      <StatRow label="일반 슈팅" meVal={result.teamStats.me.shoot != null && result.teamStats.me.effectiveShoot != null ? +(result.teamStats.me.shoot - result.teamStats.me.effectiveShoot).toFixed(1) : null} oppVal={result.teamStats.opp.shoot != null && result.teamStats.opp.effectiveShoot != null ? +(result.teamStats.opp.shoot - result.teamStats.opp.effectiveShoot).toFixed(1) : null} />
                      <StatRow label="박스 안 득점 비율" meVal={result.teamStats.me.inBoxGoalRate} oppVal={result.teamStats.opp.inBoxGoalRate} suffix="%" />
                      <StatRow label="득점 성공 거리" meVal={result.teamStats.me.avgGoalDistance} oppVal={result.teamStats.opp.avgGoalDistance} suffix="m" />
                    </StatGroup>
                    <StatGroup title="빌드업" icon="compass">
                      <StatRow label="점유율(%)" meVal={result.teamStats.me.possession} oppVal={result.teamStats.opp.possession} suffix="%" />
                      <StatRowCount label="패스 성공률" meRate={result.teamStats.me.passSuccessRate} meSuccess={result.teamStats.me.passSuccess} meTry={result.teamStats.me.passTry} oppRate={result.teamStats.opp.passSuccessRate} oppSuccess={result.teamStats.opp.passSuccess} oppTry={result.teamStats.opp.passTry} />
                      <StatRowCount label="드리블 성공률" meRate={result.teamStats.me.dribbleSuccessRate} meSuccess={result.teamStats.me.dribbleSuccess} meTry={result.teamStats.me.dribbleTry} oppRate={result.teamStats.opp.dribbleSuccessRate} oppSuccess={result.teamStats.opp.dribbleSuccess} oppTry={result.teamStats.opp.dribbleTry} />
                    </StatGroup>
                    <StatGroup title="수비" icon="shield">
                      <StatRowCount label="태클 성공률" meRate={result.teamStats.me.tackleSuccessRate} meSuccess={result.teamStats.me.tackleSuccess ?? 0} meTry={result.teamStats.me.tackleTry ?? 0} oppRate={result.teamStats.opp.tackleSuccessRate} oppSuccess={result.teamStats.opp.tackleSuccess ?? 0} oppTry={result.teamStats.opp.tackleTry ?? 0} />
                      <StatRowCount label="차단 성공률" meRate={result.teamStats.me.blockSuccessRate} meSuccess={result.teamStats.me.blockSuccess ?? 0} meTry={result.teamStats.me.blockTry ?? 0} oppRate={result.teamStats.opp.blockSuccessRate} oppSuccess={result.teamStats.opp.blockSuccess ?? 0} oppTry={result.teamStats.opp.blockTry ?? 0} />
                      <StatRowCount label="공중볼 경합 성공률" meRate={result.teamStats.me.aerialSuccessRate} meSuccess={result.teamStats.me.aerialSuccess} meTry={result.teamStats.me.aerialTry} oppRate={result.teamStats.opp.aerialSuccessRate} oppSuccess={result.teamStats.opp.aerialSuccess} oppTry={result.teamStats.opp.aerialTry} />
                      <StatRow label="가로채기" meVal={result.teamStats.me.intercept} oppVal={result.teamStats.opp.intercept} />
                    </StatGroup>
                    <StatGroup title="기타" icon="clipboard">
                      <StatRow label="코너킥" meVal={result.teamStats.me.cornerKick} oppVal={result.teamStats.opp.cornerKick} />
                      <StatRow label="오프사이드" meVal={result.teamStats.me.offside} oppVal={result.teamStats.opp.offside} />
                      <StatRow label="파울(옐로/레드)" meVal={result.teamStats.me.foul != null ? `${result.teamStats.me.foul} (${result.teamStats.me.yellowCards ?? 0}/${result.teamStats.me.redCards ?? 0})` : null} oppVal={result.teamStats.opp.foul != null ? `${result.teamStats.opp.foul} (${result.teamStats.opp.yellowCards ?? 0}/${result.teamStats.opp.redCards ?? 0})` : null} />
                      <StatRow label="경기 중단 횟수" meVal={result.teamStats.me.systemPause} oppVal={result.teamStats.opp.systemPause} />
                    </StatGroup>
                    <button onClick={() => setShowAllStats(false)} style={{
                      width: '100%', padding: '8px', borderRadius: '10px', border: '1px solid #eee', background: '#fafafa',
                      color: '#999', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                    }}>간단히 보기 ▴</button>
                  </>
                )}
              </div>
            </div>

            {(result.playerStats.me.length > 0 || result.playerStats.opp.length > 0) && (
              <>
                <Divider />
                <div id="section-players" style={{ marginBottom: '32px' }}>
                  <PlayerCompareTable meTitle={result.meDisplay.name} oppTitle={result.oppDisplay.name} mePlayers={result.playerStats.me} oppPlayers={result.playerStats.opp} />
                </div>
              </>
            )}

            <Divider />

            <div id="section-matches">
            {result.matches.length === 0 ? (
              <div style={{ textAlign: 'center' as const, padding: '48px 0', color: '#aaa', fontSize: '0.88rem' }}>
                2026년 8월 10일 이후로 <strong style={{ color: '#333' }}>{result.opponentNickname}</strong>님과 맞붙은 기록을 찾지 못했어요.
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#333', letterSpacing: '0.06em', marginBottom: '10px' }}>{result.oppDisplay.name}님과의 최근 {result.matches.length}경기 결과</p>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '14px' }}>
                  {result.matches.map((m, i) => <MatchCard key={m.matchId ?? i} match={m} index={i} />)}
                </div>
              </>
            )}
            </div>
          </>
        )}

        <div style={{ marginTop: '48px', textAlign: 'center' as const }}>
          <Link href="/fc-record/admin" style={{ fontSize: '0.72rem', color: '#ccc', textDecoration: 'none' }}>관리자</Link>
        </div>
      </div>

      {/* 8) 맨 위로 가기 - 상세 정보(선수/경기 탭 등)까지 보면 길어지는 페이지를 빠르게 빠져나올 수 있게 */}
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title="맨 위로" style={{
          position: 'fixed', right: 'clamp(16px,4vw,32px)', bottom: 'clamp(16px,4vw,32px)', zIndex: 7,
          width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: ORANGE, color: '#fff',
          fontSize: '1.1rem', cursor: 'pointer', boxShadow: `0 4px 14px ${ORANGE}55`, display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontFamily: FONT,
        }}>↑</button>
      )}
    </main>
  );
}
