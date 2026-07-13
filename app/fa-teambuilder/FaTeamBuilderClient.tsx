'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FA_PLAYERS_SNAPSHOT, FaPlayer, Position } from './faPlayers';

const POSITIONS: Position[] = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const TEAM_CAP = 182;

const STORAGE_PLAYERS = 'fa-teambuilder-players';
const STORAGE_TEAMS = 'fa-teambuilder-teams';

interface Team {
  id: string;
  name: string;
  slots: Record<Position, string>;
  sixth: string;
}

function emptySlots(): Record<Position, string> {
  return { TOP: '', JGL: '', MID: '', ADC: '', SUP: '' };
}

function gradeOf(score: number): 'R' | 'S' | 'A' | 'B' | 'C' {
  if (score >= 35) return 'R';
  if (score >= 30) return 'S';
  if (score >= 24) return 'A';
  if (score >= 18) return 'B';
  return 'C';
}

const GRADE_COLOR: Record<string, string> = {
  R: '#E5484D',
  S: '#EB701A',
  A: '#2F6FED',
  B: '#60A5FA',
  C: '#9CA3AF',
};

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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

  const [inName, setInName] = useState('');
  const [inPos, setInPos] = useState<Position>('TOP');
  const [inScore, setInScore] = useState('');
  const [inExPro, setInExPro] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkMsg, setBulkMsg] = useState('');

  // 최초 로드: localStorage에 저장된 값이 있으면 그걸 우선 사용
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

  function upsertPlayer(name: string, position: Position, score: number, exPro: boolean) {
    setPlayers(prev => {
      const idx = prev.findIndex(p => p.name === name && p.position === position);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], score, exPro };
        return next;
      }
      return [...prev, { id: newId('fa'), name, position, score, exPro }];
    });
  }

  function handleAddPlayer() {
    const score = parseFloat(inScore);
    if (!inName.trim() || isNaN(score) || score < 0) {
      alert('닉네임과 점수를 정확히 입력해주세요.');
      return;
    }
    upsertPlayer(inName.trim(), inPos, score, inExPro);
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
      const m = clean.match(/^(.+?)\s+(TOP|JGL|MID|ADC|SUP)\s+([\d.]+)$/i);
      if (m) {
        const existed = players.some(p => p.name === m[1].trim() && p.position === m[2].toUpperCase());
        upsertPlayer(m[1].trim(), m[2].toUpperCase() as Position, parseFloat(m[3]), exPro);
        existed ? updated++ : added++;
      } else {
        failed++;
      }
    });
    const parts = [];
    if (added) parts.push(`${added}명 신규 추가`);
    if (updated) parts.push(`${updated}명 점수 업데이트`);
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

  const filteredPool = useMemo(() => {
    let list = players.slice();
    if (filterPos) list = list.filter(p => p.position === filterPos);
    if (search.trim()) list = list.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()));
    list.sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) || b.score - a.score);
    return list;
  }, [players, filterPos, search]);

  const starters = POSITIONS.map(pos => players.find(p => p.id === currentSlots[pos]));
  const total = starters.reduce((s, p) => s + (p ? p.score : 0), 0);
  const over = total > TEAM_CAP;
  const rCount = starters.filter(p => p && gradeOf(p.score) === 'R').length;
  const exProCount = starters.filter(p => p && p.exPro && p.position !== 'SUP').length;
  const allFilled = starters.every(Boolean);
  const pct = Math.min(100, (total / TEAM_CAP) * 100);

  function pickSlot(pos: Position, playerId: string) {
    setCurrentSlots(prev => ({ ...prev, [pos]: playerId }));
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
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
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
            padding: '6px 14px', fontSize: 12, color: 'var(--text-secondary, #888)',
          }}>
            팀 총점 캡 <b style={{ color: '#EB701A' }}>{TEAM_CAP}점</b> 이하
          </div>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 5, marginBottom: 20 }}>
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

            <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary, #888)' }}>팀 총점 (선발 5인 기준)</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: over ? '#E5484D' : 'var(--text)' }}>{total} / {TEAM_CAP}</span>
              </div>
              <div style={{ height: 14, background: 'var(--card-border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: over ? '#E5484D' : pct > 85 ? '#EB701A' : '#16A34A',
                  transition: 'width .2s, background .2s',
                }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <Chip ok={!over} okText="✓ 총점 182점 이하" badText="✕ 총점 182점 이하" />
                <Chip ok={rCount <= 2} okText={`✓ R등급 ${rCount}/2명`} badText={`✕ R등급 ${rCount}/2명`} />
                <Chip ok={exProCount <= 1} okText={`✓ 전 프로게이머 ${exProCount}/1명 (SUP 제외)`} badText={`✕ 전 프로게이머 ${exProCount}/1명 (SUP 제외)`} />
                <Chip ok={allFilled} okText="✓ 5포지션 완성" badText={`포지션 ${starters.filter(Boolean).length}/5 선택됨`} neutral={!allFilled} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 12 }}>
              {POSITIONS.map(pos => {
                const picked = players.find(p => p.id === currentSlots[pos]);
                const options = players.filter(p => p.position === pos).sort((a, b) => b.score - a.score);
                return (
                  <div key={pos} style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 12, minHeight: 150, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-secondary, #888)', marginBottom: 8 }}>{pos}</div>
                    <select
                      value={currentSlots[pos]}
                      onChange={e => pickSlot(pos, e.target.value)}
                      style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--card-border)', color: 'var(--text)', borderRadius: 7, padding: 8, fontSize: 12, marginBottom: 10 }}
                    >
                      <option value="">선택 안 함</option>
                      {options.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.score})</option>
                      ))}
                    </select>
                    <div style={{ marginTop: 'auto' }}>
                      {picked ? (
                        <>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                            {picked.name}{picked.exPro && <span style={{ fontSize: 10, color: '#EB701A', border: '1px solid #EB701A', borderRadius: 4, padding: '1px 5px', marginLeft: 6 }}>전 프로</span>}
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: GRADE_COLOR[gradeOf(picked.score)] }}>
                            {picked.score}점 · {gradeOf(picked.score)}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary, #888)' }}>선수를 선택하세요</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ background: 'var(--card)', border: '1px dashed var(--card-border)', borderRadius: 12, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-secondary, #888)' }}>6th</span>
              <select
                value={currentSixth}
                onChange={e => setCurrentSixth(e.target.value)}
                style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--card-border)', color: 'var(--text)', borderRadius: 7, padding: 8, fontSize: 12 }}
              >
                <option value="">식스맨 없음</option>
                {sixthOptions.map(p => (
                  <option key={p.id} value={p.id}>[{p.position}] {p.name} ({p.score})</option>
                ))}
              </select>
              <span style={{ fontSize: 10.5, color: 'var(--text-secondary, #888)' }}>총점에 포함되지 않아요</span>
            </div>
          </>
        )}

        {tab === 'pool' && (
          <>
            <Card title="선수 추가">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="닉네임" style={{ flex: 1, minWidth: 110 }}>
                  <input value={inName} onChange={e => setInName(e.target.value)} placeholder="후원자 닉네임" style={inputStyle} />
                </Field>
                <Field label="포지션" style={{ flex: '0 0 100px' }}>
                  <select value={inPos} onChange={e => setInPos(e.target.value as Position)} style={inputStyle}>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
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
                placeholder={'한 줄에 한 명씩. 예:\n페이커 MID 40\n쇼메이커 MID 38 프로'}
                style={{ width: '100%', minHeight: 80, background: 'var(--bg)', border: '1px solid var(--card-border)', color: 'var(--text)', borderRadius: 7, padding: 10, fontSize: 12.5, fontFamily: 'monospace', resize: 'vertical' }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-secondary, #888)', margin: '8px 0' }}>
                형식: &quot;닉네임 포지션 점수&quot; — 맨 뒤에 &quot;프로&quot;라고 적으면 전 프로게이머로 표시돼요. 이미 있는 이름+포지션이면 점수만 갱신돼요.
              </div>
              <button onClick={handleParseBulk} style={{ background: 'var(--bg)', border: '1px solid #EB701A', color: '#EB701A', borderRadius: 7, padding: '8px 16px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
                일괄 추가
              </button>
              {bulkMsg && <div style={{ fontSize: 12, color: '#16A34A', marginTop: 8 }}>{bulkMsg}</div>}
            </Card>

            <Card title={`FA 선수 목록 (${players.length}명)`}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={filterPos} onChange={e => setFilterPos(e.target.value as Position | '')} style={{ ...inputStyle, width: 'auto' }}>
                  <option value="">전체 포지션</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="닉네임 검색..." style={{ ...inputStyle, width: 'auto', flex: 1, minWidth: 140 }} />
                <button onClick={resetToSnapshot} style={{ background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-secondary, #888)', borderRadius: 7, padding: '8px 12px', fontSize: 11.5, cursor: 'pointer' }}>
                  원본 스냅샷으로 초기화
                </button>
              </div>
              <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>포지션</th>
                      <th style={thStyle}>닉네임</th>
                      <th style={thStyle}>등급</th>
                      <th style={thStyle}>점수</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPool.map(p => (
                      <tr key={p.id}>
                        <td style={tdStyle}><PosTag pos={p.position} /></td>
                        <td style={tdStyle}>{p.name}{p.exPro && <span style={{ fontSize: 10, color: '#EB701A', border: '1px solid #EB701A', borderRadius: 4, padding: '1px 5px', marginLeft: 6 }}>전 프로</span>}</td>
                        <td style={tdStyle}><GradeBadge score={p.score} /></td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{p.score}</td>
                        <td style={tdStyle}>
                          <button onClick={() => deletePlayer(p.id)} style={{ background: 'none', border: '1px solid var(--card-border)', color: 'var(--text-secondary, #888)', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: 11 }}>✕</button>
                        </td>
                      </tr>
                    ))}
                    {filteredPool.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary, #888)' }}>선수가 없어요.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
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
              const teamTotal = teamStarters.reduce((s, x) => s + (x.p ? x.p.score : 0), 0);
              const sixthPlayer = players.find(p => p.id === t.sixth);
              const teamOver = teamTotal > TEAM_CAP;
              return (
                <div key={t.id} style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 16, position: 'relative' }}>
                  <button onClick={() => deleteTeam(t.id)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: '1px solid var(--card-border)', color: 'var(--text-secondary, #888)', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: 11 }}>✕</button>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t.name}</h4>
                    <span style={{ fontSize: 18, fontWeight: 800, color: teamOver ? '#E5484D' : '#EB701A' }}>{teamTotal}점</span>
                  </div>
                  {teamStarters.map(x => (
                    <div key={x.pos} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--card-border)', fontSize: 12.5 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><PosTag pos={x.pos} />{x.p ? x.p.name : <span style={{ color: 'var(--text-secondary, #888)' }}>미정</span>}</span>
                      <span>{x.p ? x.p.score : '-'}</span>
                    </div>
                  ))}
                  {sixthPlayer && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5, opacity: 0.7 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={posTagStyle}>6th</span>{sixthPlayer.name}</span>
                      <span>{sixthPlayer.score}</span>
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
  display: 'inline-block', width: 38, textAlign: 'center', fontWeight: 700,
  fontSize: 11, padding: '3px 0', borderRadius: 5, border: '1px solid var(--card-border)', color: 'var(--text-secondary, #888)',
};

function PosTag({ pos }: { pos: Position }) {
  return <span style={posTagStyle}>{pos}</span>;
}

function GradeBadge({ score }: { score: number }) {
  const g = gradeOf(score);
  const color = GRADE_COLOR[g];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22,
      borderRadius: 6, fontWeight: 700, fontSize: 12, background: `${color}22`, color,
    }}>
      {g}
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
    <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--text-secondary, #888)', fontWeight: 700 }}>{title}</h3>
      {children}
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
