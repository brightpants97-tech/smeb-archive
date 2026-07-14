'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FA_PLAYERS_SNAPSHOT, FaPlayer, Position } from './faPlayers';
import { TIER_ORDER, tierAtLeast, tierColor } from './tiers';

const POSITIONS: Position[] = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const TEAM_CAP = 182;
const PAGE_SIZE = 30;

const POS_ICON: Record<Position, string> = {
  TOP: '🛡️',
  JGL: '🌿',
  MID: '⚡',
  ADC: '🏹',
  SUP: '💊',
};

const STORAGE_PLAYERS = 'fa-teambuilder-players-v2';
const STORAGE_TEAMS = 'fa-teambuilder-teams-v2';

// 카드가 배경 위에 "떠 있는" 느낌을 주기 위한 테두리 링 + 그림자 (라이트/다크 어디서든 자연스럽게 동작)
const ELEVATE = '0 0 0 1px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03), 0 8px 20px rgba(0,0,0,0.06)';
const ELEVATE_SM = '0 0 0 1px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.05)';

interface Team {
  id: string;
  name: string;
  slots: Record<Position, string>;
  sixth: string;
}

function emptySlots(): Record<Position, string> {
  return { TOP: '', JGL: '', MID: '', ADC: '', SUP: '' };
}

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// 팀 시너지 보너스: 정글+서폿 또는 원딜+서폿이 둘 다 S+ 이상이면 -5, 둘 다 A- 이상(S+ 미만)이면 -3
function pairBonus(a?: FaPlayer, b?: FaPlayer): number {
  if (!a || !b) return 0;
  if (tierAtLeast(a.tier, 'S+') && tierAtLeast(b.tier, 'S+')) return -5;
  if (tierAtLeast(a.tier, 'A-') && tierAtLeast(b.tier, 'A-')) return -3;
  return 0;
}

export default function FaTeamBuilderClient() {
  const [tab, setTab] = useState<'builder' | 'pool' | 'saved'>('builder');
  const [players, setPlayers] = useState<FaPlayer[]>(FA_PLAYERS_SNAPSHOT);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [currentSlots, setCurrentSlots] = useState<Record<Position, string>>(emptySlots());
  const [currentSixth, setCurrentSixth] = useState('');
  const [teamName, setTeamName] = useState('');

  const [filterPos, setFilterPos] = useState<Position | ''>('');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState('');
  const [editTier, setEditTier] = useState('');
  const [editExPro, setEditExPro] = useState(false);

  const [lockedPos, setLockedPos] = useState<Record<Position, boolean>>({ TOP: false, JGL: false, MID: false, ADC: false, SUP: false });
  const [comboResults, setComboResults] = useState<{ slots: Record<Position, string>; total: number }[]>([]);
  const [comboPage, setComboPage] = useState(0);
  const [comboTotal, setComboTotal] = useState(0);
  const COMBO_PAGE = 50;

  const [inName, setInName] = useState('');
  const [inPos, setInPos] = useState<Position>('TOP');
  const [inTier, setInTier] = useState<string>('B');
  const [inScore, setInScore] = useState('');
  const [inExPro, setInExPro] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkMsg, setBulkMsg] = useState('');

  useEffect(() => {
    try {
      const p = localStorage.getItem(STORAGE_PLAYERS);
      if (p) setPlayers(JSON.parse(p));
      const t = localStorage.getItem(STORAGE_TEAMS);
      if (t) setTeams(JSON.parse(t));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_PLAYERS, JSON.stringify(players));
  }, [players, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_TEAMS, JSON.stringify(teams));
  }, [teams, loaded]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filterPos, search]);

  function upsertPlayer(name: string, position: Position, tier: string, score: number, exPro: boolean) {
    setPlayers(prev => {
      const idx = prev.findIndex(p => p.name === name && p.position === position);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], tier, score, exPro };
        return next;
      }
      return [...prev, { id: newId('fa'), name, position, tier, score, exPro }];
    });
  }

  function handleAddPlayer() {
    const score = parseFloat(inScore);
    if (!inName.trim() || isNaN(score) || score < 0) {
      alert('닉네임과 점수를 정확히 입력해주세요.');
      return;
    }
    upsertPlayer(inName.trim(), inPos, inTier, score, inExPro);
    setInName('');
    setInScore('');
    setInExPro(false);
  }

  function handleParseBulk() {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    let added = 0, updated = 0, failed = 0;
    lines.forEach(line => {
      const exPro = /프로\s*$/.test(line);
      const clean = line.replace(/프로\s*$/, '').trim();
      const m = clean.match(/^(.+?)\s+(TOP|JGL|MID|ADC|SUP)\s+([A-Za-z+-]+|Transcended|God|Legendary|Unique|SSR|SR)\s+([\d.]+)$/i);
      if (m) {
        const tierRaw = TIER_ORDER.find(t => t.toLowerCase() === m[3].toLowerCase()) || m[3];
        const existed = players.some(p => p.name === m[1].trim() && p.position === m[2].toUpperCase());
        upsertPlayer(m[1].trim(), m[2].toUpperCase() as Position, tierRaw, parseFloat(m[4]), exPro);
        existed ? updated++ : added++;
      } else {
        failed++;
      }
    });
    const parts = [];
    if (added) parts.push(`${added}명 신규 추가`);
    if (updated) parts.push(`${updated}명 갱신`);
    if (failed) parts.push(`${failed}줄 인식 실패`);
    setBulkMsg(parts.join(' · ') || '인식된 줄이 없어요.');
    if (added || updated) setBulkText('');
  }

  function deletePlayer(id: string) {
    if (!confirm('이 선수를 목록에서 삭제할까요?')) return;
    setPlayers(prev => prev.filter(p => p.id !== id));
  }

  function resetToSnapshot() {
    if (!confirm('현재 목록을 지우고 원본 FA 스냅샷으로 되돌릴까요?')) return;
    setPlayers(FA_PLAYERS_SNAPSHOT);
  }

  function startEdit(p: FaPlayer) {
    setEditingId(p.id);
    setEditScore(String(p.score));
    setEditTier(p.tier);
    setEditExPro(p.exPro);
  }

  function saveEdit(id: string) {
    const score = parseFloat(editScore);
    if (isNaN(score) || score < 0) {
      alert('점수를 정확히 입력해주세요.');
      return;
    }
    setPlayers(prev => prev.map(p => (p.id === id ? { ...p, score, tier: editTier, exPro: editExPro } : p)));
    setEditingId(null);
  }

  const playersById = useMemo(() => {
    const map = new Map<string, FaPlayer>();
    players.forEach(p => map.set(p.id, p));
    return map;
  }, [players]);

  const positionCounts = useMemo(() => {
    const counts: Record<Position, number> = { TOP: 0, JGL: 0, MID: 0, ADC: 0, SUP: 0 };
    players.forEach(p => { counts[p.position]++; });
    return counts;
  }, [players]);

  const filteredPool = useMemo(() => {
    let list = players.slice();
    if (filterPos) list = list.filter(p => p.position === filterPos);
    if (search.trim()) list = list.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()));
    list.sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) || b.score - a.score);
    return list;
  }, [players, filterPos, search]);

  const visiblePool = filteredPool.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPool.length;

  const starters = POSITIONS.map(pos => players.find(p => p.id === currentSlots[pos]));
  const [, sJgl, , sAdc, sSup] = starters;
  const rawTotal = starters.reduce((s, p) => s + (p ? p.score : 0), 0);

  const jglSupBonus = pairBonus(sJgl, sSup);
  const adcSupBonus = pairBonus(sAdc, sSup);
  const synergyBonus = jglSupBonus + adcSupBonus;
  const effectiveTotal = rawTotal + synergyBonus;

  const over = effectiveTotal > TEAM_CAP;
  const rTierCount = starters.filter(p => p && tierAtLeast(p.tier, 'R')).length;
  const exProCount = starters.filter(p => p && p.exPro && p.position !== 'SUP').length;
  const allFilled = starters.every(Boolean);
  const pct = Math.min(100, (effectiveTotal / TEAM_CAP) * 100);

  function toggleLock(pos: Position) {
    if (!currentSlots[pos]) return;
    setLockedPos(prev => ({ ...prev, [pos]: !prev[pos] }));
    setComboResults([]);
    setComboPage(0);
  }

  function generateCombos() {
    const lockedList = POSITIONS.filter(p => lockedPos[p] && currentSlots[p]);
    if (lockedList.length < 2) { alert('포지션을 2개 이상 고정해주세요.'); return; }
    const openList = POSITIONS.filter(p => !lockedPos[p]);
    const lockedScore = lockedList.reduce((s, p) => {
      const pl = players.find(x => x.id === currentSlots[p]);
      return s + (pl?.score ?? 0);
    }, 0);
    // 오픈 포지션별 선수 배열
    const openPlayers = openList.map(p => players.filter(x => x.position === p));
    // 브루트포스 탐색: 총점 180~182 범위만 수집
    const all: { slots: Record<Position, string>; total: number }[] = [];
    function recurse(idx: number, partialScore: number, partialSlots: Record<Position, string>) {
      if (idx === openList.length) {
        // 메인 팀빌더와 동일하게 JGL+SUP, ADC+SUP 페어 보너스 반영
        const jglPl = players.find(x => x.id === partialSlots['JGL']);
        const adcPl = players.find(x => x.id === partialSlots['ADC']);
        const supPl = players.find(x => x.id === partialSlots['SUP']);
        const bonus = pairBonus(jglPl, supPl) + pairBonus(adcPl, supPl);
        const actualTotal = partialScore + bonus;
        if (actualTotal >= 180 && actualTotal <= TEAM_CAP) {
          all.push({ slots: { ...partialSlots }, total: actualTotal });
        }
        return;
      }
      const pos = openList[idx];
      for (const pl of openPlayers[idx]) {
        const next = partialScore + pl.score;
        if (next > TEAM_CAP) continue;
        partialSlots[pos] = pl.id;
        recurse(idx + 1, next, partialSlots);
      }
      partialSlots[pos] = '';
    }
    const init: Record<Position, string> = { ...currentSlots };
    openList.forEach(p => { init[p] = ''; });
    recurse(0, lockedScore, init);
    all.sort((a, b) => b.total - a.total);
    setComboResults(all);
    setComboTotal(all.length);
    setComboPage(1);
  }

  function saveComboAsTeam(slots: Record<Position, string>) {
    const name = `조합 ${teams.length + 1}`;
    setTeams(prev => [...prev, { id: newId('team'), name, slots, sixth: '' }]);
  }

  function pickSlot(pos: Position, playerId: string) {
    setCurrentSlots(prev => ({ ...prev, [pos]: playerId }));
    // 선택 안 함으로 바꾸면 잠금도 자동 해제
    if (!playerId) {
      setLockedPos(prev => ({ ...prev, [pos]: false }));
    }
    setComboResults([]);
    setComboPage(0);
  }




  function saveTeam() {
    if (starters.some(p => !p)) {
      alert('5포지션을 모두 선택해주세요.');
      return;
    }
    const name = teamName.trim() || `팀 ${teams.length + 1}`;
    setTeams(prev => [...prev, { id: newId('team'), name, slots: { ...currentSlots }, sixth: currentSixth }]);
    setTeamName('');
    setCurrentSlots(emptySlots());
    setCurrentSixth('');
    setTab('saved');
  }

  function deleteTeam(id: string) {
    if (!confirm('이 팀을 삭제할까요?')) return;
    setTeams(prev => prev.filter(t => t.id !== id));
  }

  const pickedIds = Object.values(currentSlots).filter(Boolean);
  const sixthOptions = players
    .filter(p => !pickedIds.includes(p.id))
    .sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) || b.score - a.score);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 'clamp(1.25rem,5vw,3rem)' }}>
      <style>{`
        @keyframes synergyPulse {
          0%   { text-shadow: 0 0 0 rgba(22,163,74,0); }
          50%  { text-shadow: 0 0 14px rgba(22,163,74,0.55); }
          100% { text-shadow: 0 0 0 rgba(22,163,74,0); }
        }
        .fatb-synergy { animation: synergyPulse 1.8s ease-in-out infinite; }
        .fatb-row:hover { filter: brightness(0.97); }
      `}</style>
      <div style={{ maxWidth: '980px', margin: '0 auto' }}>
        <div style={{ marginBottom: '20px' }}>
          <Link
            href="/apps"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary, #888)',
              textDecoration: 'none', opacity: 0.7,
            }}
          >
            ← 도구로
          </Link>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10, marginBottom: 20, paddingBottom: 18, borderBottom: '1px solid var(--card-border)' }}>
          <div>
            <p style={{ fontSize: '0.76rem', fontWeight: 800, letterSpacing: '0.16em', color: '#EB701A', textTransform: 'uppercase', margin: '0 0 8px' }}>
              SMEB ARCHIVE
            </p>
            <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.2rem)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0, color: 'var(--text)' }}>
              FA 팀빌더
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #888)', margin: '6px 0 0' }}>
              LoL 멸망전 FA 등급 기반 팀 구성 시뮬레이터
            </p>
          </div>
          <div style={{
            background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 20,
            boxShadow: ELEVATE_SM,
            padding: '6px 14px', fontSize: 12, color: 'var(--text-secondary, #888)',
          }}>
            팀 총점 캡 <b style={{ color: '#EB701A' }}>{TEAM_CAP}점</b> 이하
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 5, marginBottom: 20, boxShadow: ELEVATE_SM }}>
          {(['builder', 'pool', 'saved'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, background: tab === t ? 'rgba(235,112,26,0.1)' : 'transparent',
                border: 'none', color: tab === t ? '#EB701A' : 'var(--text-secondary, #888)',
                padding: '11px 10px', borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {t === 'builder' ? '팀 빌더' : t === 'pool' ? 'FA 선수 풀' : `저장된 팀 (${teams.length})`}
            </button>
          ))}
        </div>

        {tab === 'builder' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <PositionCountStrip counts={positionCounts} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="팀 이름 (선택 입력, 비워두면 자동 지정)"
                style={{
                  flex: 1, minWidth: 180, background: 'var(--card)', border: '1px solid var(--card-border)',
                  color: 'var(--text)', borderRadius: 8, padding: '10px 14px', fontSize: 14,
                }}
              />
              <button
                onClick={saveTeam}
                style={{ background: '#EB701A', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
              >
                이 팀 저장
              </button>
            </div>

            <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '16px 18px', marginBottom: 16, boxShadow: ELEVATE }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary, #888)' }}>
                  팀 총점 (선발 5인{synergyBonus !== 0 && <span style={{ color: '#16A34A' }}> · 시너지 보너스 {synergyBonus}점 적용됨</span>})
                </span>
                <span
                  className={synergyBonus !== 0 ? 'fatb-synergy' : ''}
                  style={{ fontSize: 22, fontWeight: 800, color: over ? '#E5484D' : synergyBonus !== 0 ? '#16A34A' : 'var(--text)' }}
                >
                  {effectiveTotal} / {TEAM_CAP}
                  {synergyBonus !== 0 && <span style={{ fontSize: 12, color: 'var(--text-secondary, #888)', fontWeight: 500, marginLeft: 6 }}>(원점수 {rawTotal})</span>}
                </span>
              </div>
              <div style={{ height: 14, background: 'var(--card-border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: over ? '#E5484D' : pct > 85 ? '#EB701A' : '#16A34A',
                  transition: 'width .2s, background .2s',
                }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <Chip ok={!over} okText={`✓ 총점 182점 이하 (${effectiveTotal})`} badText={`✕ 총점 182점 초과 (${effectiveTotal})`} />
                <Chip ok={exProCount <= 1} okText={`✓ 전 프로게이머 ${exProCount}/1명 (SUP 제외)`} badText={`✕ 전 프로게이머 ${exProCount}/1명 (SUP 제외)`} />
                <Chip ok={allFilled} okText="✓ 5포지션 완성" badText={`포지션 ${starters.filter(Boolean).length}/5 선택됨`} neutral={!allFilled} />
                {jglSupBonus !== 0 && <SynergyChip label={`정글+서폿 시너지 ${jglSupBonus}점`} />}
                {adcSupBonus !== 0 && <SynergyChip label={`원딜+서폿 시너지 ${adcSupBonus}점`} />}
                {rTierCount > 0 && <span style={{ fontSize: 11, color: 'var(--text-secondary, #888)' }}>참고: R등급 이상 {rTierCount}명 포함</span>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 12 }}>
              {POSITIONS.map(pos => {
                const picked = players.find(p => p.id === currentSlots[pos]);
                const options = players.filter(p => p.position === pos).sort((a, b) => b.score - a.score);
                const color = picked ? tierColor(picked.tier) : undefined;
                return (
                  <div
                    key={pos}
                    style={{
                      background: picked ? `${color}0F` : 'var(--card)',
                      border: `1.5px solid ${picked ? color + '66' : 'var(--card-border)'}`,
                      borderRadius: 12, padding: 12, minHeight: 156, display: 'flex', flexDirection: 'column',
                      boxShadow: picked ? `0 0 0 3px ${color}1A, 0 6px 16px ${color}22, ${ELEVATE_SM}` : ELEVATE_SM,
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-secondary, #888)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span>{POS_ICON[pos]}</span>{pos}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-secondary, #888)', opacity: 0.7 }}>{positionCounts[pos]}명</span>
                    </div>
                    <select
                      value={currentSlots[pos]}
                      onChange={e => pickSlot(pos, e.target.value)}
                      style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--card-border)', color: 'var(--text)', borderRadius: 7, padding: 8, fontSize: 12, marginBottom: 10 }}
                    >
                      <option value="">선택 안 함</option>
                      {options.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.tier}, {p.score})</option>
                      ))}
                    </select>
                    <div style={{ marginTop: 'auto' }}>
                      {picked ? (
                        <>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <span>{picked.name}{picked.exPro && <span style={{ fontSize: 10, color: '#EB701A', border: '1px solid #EB701A', borderRadius: 4, padding: '1px 5px', marginLeft: 6 }}>전 프로</span>}</span>
                            <button
                              onClick={() => toggleLock(pos)}
                              title={lockedPos[pos] ? '고정 해제' : '이 선수로 고정'}
                              style={{
                                background: lockedPos[pos] ? '#EB701A' : 'var(--bg)',
                                border: `1px solid ${lockedPos[pos] ? '#EB701A' : 'var(--card-border)'}`,
                                color: lockedPos[pos] ? '#fff' : 'var(--text-secondary, #888)',
                                borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: 11, flexShrink: 0,
                              }}
                            >
                              {lockedPos[pos] ? '🔒' : '🔓'}
                            </button>
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 800, color }}>
                            {picked.score}점
                          </div>
                          <TierBadge tier={picked.tier} />
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary, #888)' }}>선수를 선택하세요</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ background: 'var(--card)', border: '1px dashed var(--card-border)', borderRadius: 12, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, boxShadow: ELEVATE_SM }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-secondary, #888)' }}>6th</span>
              <select
                value={currentSixth}
                onChange={e => setCurrentSixth(e.target.value)}
                style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--card-border)', color: 'var(--text)', borderRadius: 7, padding: 8, fontSize: 12 }}
              >
                <option value="">식스맨 없음</option>
                {sixthOptions.map(p => (
                  <option key={p.id} value={p.id}>[{p.position}] {p.name} ({p.tier}, {p.score})</option>
                ))}
              </select>
              <span style={{ fontSize: 10.5, color: 'var(--text-secondary, #888)' }}>총점에 포함되지 않아요</span>
            </div>

          </>
        )}

        {/* 조합 탐색 — builder 탭 하단 */}
        {tab === 'builder' && (() => {
          const lockedCount = POSITIONS.filter(p => lockedPos[p] && currentSlots[p]).length;
          const visible = comboResults.slice(0, comboPage * COMBO_PAGE);
          return (
            <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 16, marginTop: 8, boxShadow: ELEVATE }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>🔍 조합 탐색</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary, #888)' }}>슬롯의 🔓 버튼으로 2명 이상 고정 후 탐색 — 180~182점 조합</div>
                </div>
                <button
                  onClick={generateCombos}
                  disabled={lockedCount < 2}
                  style={{
                    background: lockedCount >= 2 ? '#EB701A' : 'var(--bg)',
                    color: lockedCount >= 2 ? '#fff' : 'var(--text-secondary, #888)',
                    border: lockedCount >= 2 ? 'none' : '1px solid var(--card-border)',
                    borderRadius: 8, padding: '10px 18px', fontWeight: 800, fontSize: 13,
                    cursor: lockedCount >= 2 ? 'pointer' : 'not-allowed',
                    opacity: lockedCount >= 2 ? 1 : 0.6, whiteSpace: 'nowrap',
                  }}
                >
                  {lockedCount >= 2 ? '조합 찾기' : `${2 - lockedCount}명 더 고정 필요`}
                </button>
              </div>

              {comboTotal > 0 && (
                <>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary, #888)', marginBottom: 10 }}>
                    180~182점 조합 <b style={{ color: 'var(--text)' }}>{comboTotal.toLocaleString()}개</b> 발견 · 총점 높은 순
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {visible.map((r, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                        background: 'var(--bg)', border: '1px solid var(--card-border)',
                        borderRadius: 10, padding: '8px 12px',
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #888)', minWidth: 28 }}>#{idx + 1}</span>
                        {POSITIONS.map(pos => {
                          const pl = players.find(x => x.id === r.slots[pos]);
                          return (
                            <span key={pos} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12 }}>
                              <span style={{ opacity: 0.55 }}>{POS_ICON[pos]}</span>
                              <span style={{ fontWeight: lockedPos[pos] ? 800 : 500, color: lockedPos[pos] ? '#EB701A' : 'var(--text)' }}>{pl?.name ?? '—'}</span>
                              {pl && <TierBadge tier={pl.tier} small />}
                            </span>
                          );
                        })}
                        <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 14, color: '#EB701A' }}>{r.total}점</span>
                        <button
                          onClick={() => saveComboAsTeam(r.slots)}
                          style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-secondary, #888)', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          저장
                        </button>
                      </div>
                    ))}
                  </div>
                  {visible.length < comboTotal && (
                    <button
                      onClick={() => setComboPage(p => p + 1)}
                      style={{
                        marginTop: 12, width: '100%', padding: '10px 0',
                        background: 'var(--bg)', border: '1px solid var(--card-border)',
                        borderRadius: 8, fontWeight: 700, fontSize: 13,
                        color: 'var(--text)', cursor: 'pointer',
                      }}
                    >
                      50개 더 보기 ({visible.length} / {comboTotal.toLocaleString()})
                    </button>
                  )}
                  {visible.length >= comboTotal && (
                    <div style={{ marginTop: 10, textAlign: 'center', fontSize: 12, color: 'var(--text-secondary, #888)' }}>
                      전체 {comboTotal.toLocaleString()}개 표시 완료
                    </div>
                  )}
                </>
              )}

              {comboTotal === 0 && comboPage > 0 && (
                <div style={{ fontSize: 13, color: 'var(--text-secondary, #888)', paddingTop: 8 }}>180~182점 범위의 유효 조합이 없어요.</div>
              )}
            </div>
          );
        })()}

        {tab === 'pool' && (
          <>
            <Card title="선수 추가">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="닉네임" style={{ flex: 1, minWidth: 110 }}>
                  <input value={inName} onChange={e => setInName(e.target.value)} placeholder="닉네임" style={inputStyle} />
                </Field>
                <Field label="포지션" style={{ flex: '0 0 90px' }}>
                  <select value={inPos} onChange={e => setInPos(e.target.value as Position)} style={inputStyle}>
                    {POSITIONS.map(p => <option key={p} value={p}>{POS_ICON[p]} {p}</option>)}
                  </select>
                </Field>
                <Field label="등급" style={{ flex: '0 0 100px' }}>
                  <select value={inTier} onChange={e => setInTier(e.target.value)} style={inputStyle}>
                    {TIER_ORDER.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="점수" style={{ flex: '0 0 80px' }}>
                  <input value={inScore} onChange={e => setInScore(e.target.value)} placeholder="0" type="number" style={inputStyle} />
                </Field>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary, #888)', paddingBottom: 10 }}>
                  <input type="checkbox" checked={inExPro} onChange={e => setInExPro(e.target.checked)} /> 전 프로게이머
                </label>
                <button onClick={handleAddPlayer} style={{ background: '#EB701A', color: '#fff', border: 'none', borderRadius: 7, padding: '10px 18px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                  추가
                </button>
              </div>
            </Card>

            <Card title="붙여넣기 일괄추가">
              <textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={'한 줄에 한 명씩. 예:\n페이커 MID S+ 40\n쇼메이커 MID S 38 프로'}
                style={{ width: '100%', minHeight: 80, background: 'var(--bg)', border: '1px solid var(--card-border)', color: 'var(--text)', borderRadius: 7, padding: 10, fontSize: 12.5, fontFamily: 'monospace', resize: 'vertical' }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-secondary, #888)', margin: '8px 0' }}>
                형식: &quot;닉네임 포지션 등급 점수&quot; — 맨 뒤에 &quot;프로&quot;를 붙이면 전 프로게이머로 표시돼요. 이미 있는 이름+포지션이면 갱신돼요.
              </div>
              <button onClick={handleParseBulk} style={{ background: 'var(--bg)', border: '1px solid #EB701A', color: '#EB701A', borderRadius: 7, padding: '8px 16px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
                일괄 추가
              </button>
              {bulkMsg && <div style={{ fontSize: 12, color: '#16A34A', marginTop: 8 }}>{bulkMsg}</div>}
            </Card>

            <Card title={`FA 선수 목록 (${players.length}명 · ${visiblePool.length}명 표시 중)`}>
              <div style={{ marginBottom: 10 }}>
                <PositionCountStrip counts={positionCounts} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={filterPos} onChange={e => setFilterPos(e.target.value as Position | '')} style={{ ...inputStyle, width: 'auto' }}>
                  <option value="">전체 포지션 ({players.length})</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{POS_ICON[p]} {p} ({positionCounts[p]})</option>)}
                </select>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="닉네임 검색..." style={{ ...inputStyle, width: 'auto', flex: 1, minWidth: 140 }} />
                <button onClick={resetToSnapshot} style={{ background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-secondary, #888)', borderRadius: 7, padding: '8px 12px', fontSize: 11.5, cursor: 'pointer' }}>
                  원본 스냅샷으로 초기화
                </button>
              </div>
              <div style={{ maxHeight: 560, overflowY: 'auto', border: '1px solid var(--card-border)', borderRadius: 10, boxShadow: ELEVATE_SM }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 }}>포지션</th>
                      <th style={{ ...thStyle, position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 }}>닉네임</th>
                      <th style={{ ...thStyle, position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 }}>등급</th>
                      <th style={{ ...thStyle, position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 }}>점수</th>
                      <th style={{ ...thStyle, position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePool.map((p, idx) => (
                      editingId === p.id ? (
                        <tr key={p.id} style={{ background: idx % 2 === 1 ? 'var(--bg)' : 'transparent' }}>
                          <td style={tdStyle}><PosTag pos={p.position} /></td>
                          <td style={tdStyle}>{p.name}</td>
                          <td style={tdStyle}>
                            <select value={editTier} onChange={e => setEditTier(e.target.value)} style={{ ...inputStyle, width: 90, padding: '4px 6px' }}>
                              {TIER_ORDER.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </td>
                          <td style={tdStyle}>
                            <input value={editScore} onChange={e => setEditScore(e.target.value)} type="number" style={{ ...inputStyle, width: 64, padding: '4px 6px' }} />
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <label style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <input type="checkbox" checked={editExPro} onChange={e => setEditExPro(e.target.checked)} />프로
                              </label>
                              <button onClick={() => saveEdit(p.id)} style={{ background: '#16A34A', border: 'none', color: '#fff', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: 11 }}>✓</button>
                              <button onClick={() => setEditingId(null)} style={{ background: 'none', border: '1px solid var(--card-border)', color: 'var(--text-secondary, #888)', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: 11 }}>✕</button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={p.id} className="fatb-row" style={{ background: idx % 2 === 1 ? 'var(--bg)' : 'transparent' }}>
                          <td style={tdStyle}><PosTag pos={p.position} /></td>
                          <td style={tdStyle}>{p.name}{p.exPro && <span style={{ fontSize: 10, color: '#EB701A', border: '1px solid #EB701A', borderRadius: 4, padding: '1px 5px', marginLeft: 6 }}>전 프로</span>}</td>
                          <td style={tdStyle}><TierBadge tier={p.tier} /></td>
                          <td style={{ ...tdStyle, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{p.score}</td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => startEdit(p)} style={{ background: 'none', border: '1px solid var(--card-border)', color: 'var(--text-secondary, #888)', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: 11 }}>✎</button>
                              <button onClick={() => deletePlayer(p.id)} style={{ background: 'none', border: '1px solid var(--card-border)', color: 'var(--text-secondary, #888)', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: 11 }}>✕</button>
                            </div>
                          </td>
                        </tr>
                      )
                    ))}
                    {visiblePool.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary, #888)' }}>선수가 없어요.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <button
                    onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                    style={{ background: 'var(--bg)', border: '1px solid var(--card-border)', color: 'var(--text-secondary, #888)', borderRadius: 8, padding: '9px 20px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                  >
                    더보기 ({filteredPool.length - visibleCount}명 더 있음)
                  </button>
                </div>
              )}
            </Card>
          </>
        )}

        {tab === 'saved' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 14 }}>
            {teams.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-secondary, #888)', padding: 40, fontSize: 13 }}>
                저장된 팀이 없어요. &quot;팀 빌더&quot; 탭에서 팀을 구성하고 저장해보세요.
              </div>
            )}
            {teams.map(t => {
              const teamStarters = POSITIONS.map(pos => ({ pos, p: players.find(pl => pl.id === t.slots[pos]) }));
              const rawT = teamStarters.reduce((s, x) => s + (x.p ? x.p.score : 0), 0);
              const jP = teamStarters.find(x => x.pos === 'JGL')?.p;
              const aP = teamStarters.find(x => x.pos === 'ADC')?.p;
              const sP = teamStarters.find(x => x.pos === 'SUP')?.p;
              const bonus = pairBonus(jP, sP) + pairBonus(aP, sP);
              const effT = rawT + bonus;
              const sixthPlayer = players.find(p => p.id === t.sixth);
              const teamOver = effT > TEAM_CAP;
              return (
                <div key={t.id} style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 16, position: 'relative', boxShadow: ELEVATE }}>
                  <button onClick={() => deleteTeam(t.id)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: '1px solid var(--card-border)', color: 'var(--text-secondary, #888)', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: 11 }}>✕</button>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t.name}</h4>
                    <span style={{ fontSize: 18, fontWeight: 800, color: teamOver ? '#E5484D' : '#EB701A' }}>
                      {effT}점{bonus !== 0 && <span style={{ fontSize: 10, color: '#16A34A', marginLeft: 4 }}>({bonus})</span>}
                    </span>
                  </div>
                  {teamStarters.map(x => (
                    <div key={x.pos} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--card-border)', fontSize: 12.5 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <PosTag pos={x.pos} />
                        {x.p ? x.p.name : <span style={{ color: 'var(--text-secondary, #888)' }}>미정</span>}
                        {x.p && <TierBadge tier={x.p.tier} small />}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{x.p ? x.p.score : '-'}</span>
                    </div>
                  ))}
                  {sixthPlayer && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5, opacity: 0.7 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={posTagStyle}>6th</span>{sixthPlayer.name}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{sixthPlayer.score}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--card-border)',
  color: 'var(--text)', borderRadius: 7, padding: '9px 10px', fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left', fontSize: 10.5, color: 'var(--text-secondary, #888)', padding: '8px 10px',
  borderBottom: '1px solid var(--card-border)', textTransform: 'uppercase',
};

const tdStyle: React.CSSProperties = {
  padding: '9px 10px', fontSize: 13, borderBottom: '1px solid var(--card-border)', color: 'var(--text)',
};

const posTagStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, width: 'auto', padding: '3px 7px',
  fontWeight: 700, fontSize: 11, borderRadius: 5, border: '1px solid var(--card-border)', color: 'var(--text-secondary, #888)',
};

function PosTag({ pos }: { pos: Position }) {
  return <span style={posTagStyle}>{POS_ICON[pos]} {pos}</span>;
}

// 등급 배지: 배경을 채운 필(pill) 형태 + 흰 글씨로 어떤 등급이든 대비 확보
function TierBadge({ tier, small }: { tier: string; small?: boolean }) {
  const color = tierColor(tier);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: small ? 34 : 44, height: small ? 18 : 22, padding: '0 7px',
      borderRadius: 6, fontWeight: 800, fontSize: small ? 9.5 : 11,
      background: color, color: '#fff', letterSpacing: '-0.01em',
    }}>
      {tier}
    </span>
  );
}

function SynergyChip({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20, border: '1px solid #16A34A', color: '#16A34A', background: 'rgba(22,163,74,0.08)' }}>
      ⚡ {label}
    </span>
  );
}

function Chip({ ok, okText, badText, neutral }: { ok: boolean; okText: string; badText: string; neutral?: boolean }) {
  const color = neutral ? 'var(--text-secondary, #888)' : ok ? '#16A34A' : '#E5484D';
  return (
    <span style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20, border: `1px solid ${color}`, color }}>
      {ok ? okText : badText}
    </span>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: ELEVATE }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--text-secondary, #888)', fontWeight: 700 }}>{title}</h3>
      {children}
    </div>
  );
}

function PositionCountStrip({ counts }: { counts: Record<Position, number> }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {POSITIONS.map(pos => (
        <span
          key={pos}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #888)',
            background: 'var(--bg)', border: '1px solid var(--card-border)',
            borderRadius: 20, padding: '4px 9px',
          }}
        >
          <span>{POS_ICON[pos]}</span>{pos}
          <b style={{ color: 'var(--text)', fontWeight: 800 }}>{counts[pos]}</b>
        </span>
      ))}
    </div>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label style={{ fontSize: 10.5, color: 'var(--text-secondary, #888)', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}
