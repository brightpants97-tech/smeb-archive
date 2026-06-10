'use client';
import { useState, useEffect } from 'react';

/* ── 상수 ── */
const ACCENT = '#EB701A';
const DARK   = '#0b0b0b';
const CARD   = 'rgba(255,255,255,0.04)';

const TIER_ORDER = ['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER'];
const TIER_COLOR: Record<string, string> = {
  IRON:'#8B8B8B', BRONZE:'#CD7F32', SILVER:'#A8B8C8', GOLD:'#FFD700',
  PLATINUM:'#00C9A7', EMERALD:'#00E676', DIAMOND:'#80DEEA',
  MASTER:'#AA00FF', GRANDMASTER:'#FF6D00', CHALLENGER:'#F8C600',
};
const TIER_KO: Record<string, string> = {
  IRON:'아이언', BRONZE:'브론즈', SILVER:'실버', GOLD:'골드',
  PLATINUM:'플래티넘', EMERALD:'에메랄드', DIAMOND:'다이아', MASTER:'마스터',
  GRANDMASTER:'그랜드마스터', CHALLENGER:'챌린저',
};
const RANK_NUM: Record<string, number> = { I:4, II:3, III:2, IV:1 };
const POSITIONS  = ['탑','정글','미드','원딜','서포터'];
const STYLE_TAGS = ['오더형','캐리형','서포터형','한타형','라인전형','유연형'];

/* ── 타입 ── */
interface Champion { id:number; name:string; image:string; level:number; points:number; }
interface RankInfo  { tier:string; rank:string; lp:number; wins:number; losses:number; }
interface Player {
  id: string;
  gameName: string; tagLine: string;
  profileIconId: number; summonerLevel: number;
  rank: RankInfo | null;
  topChampions: Champion[];
  version: string;
  positions: string[];
  styleTags: string[];
  team: 'A' | 'B' | null;
}

/* ── 유틸 ── */
function tierScore(p: Player) {
  if (!p.rank) return 0;
  const t = TIER_ORDER.indexOf(p.rank.tier);
  const r = RANK_NUM[p.rank.rank] ?? 0;
  return t * 4 + r;
}
function avgTier(players: Player[]) {
  const ranked = players.filter(p => p.rank);
  if (!ranked.length) return null;
  const avg = ranked.reduce((s, p) => s + tierScore(p), 0) / ranked.length;
  const tIdx = Math.floor(avg / 4);
  const rIdx = Math.round(avg % 4);
  const tier = TIER_ORDER[Math.min(tIdx, TIER_ORDER.length - 1)];
  const rank = ['IV','III','II','I'][Math.min(rIdx, 3)];
  return { tier, rank };
}

/* ── 컴포넌트 ── */
export default function TeamBuilderClient() {
  const [players, setPlayers]   = useState<Player[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [editId, setEditId]     = useState<string | null>(null);

  /* 저장 로드 */
  useEffect(() => {
    (async () => {
      try {
        const r = await (window as any).storage?.get('tb-players');
        if (r?.value) setPlayers(JSON.parse(r.value));
      } catch {}
    })();
  }, []);

  const save = (data: Player[]) => {
    try { (window as any).storage?.set('tb-players', JSON.stringify(data)); } catch {}
  };

  /* 참가자 추가 */
  const addPlayer = async () => {
    const trimmed = input.trim();
    if (!trimmed.includes('#')) { setError('닉네임#태그 형식으로 입력해주세요 (예: 스맵#KR1)'); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch(`/api/riot?name=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      const p: Player = { ...data, id: `${data.gameName}#${data.tagLine}`, positions: [], styleTags: [], team: null };
      const updated = [...players.filter(x => x.id !== p.id), p];
      setPlayers(updated); save(updated); setInput('');
    } catch { setError('데이터 불러오기 실패'); }
    finally { setLoading(false); }
  };

  const removePlayer = (id: string) => {
    const updated = players.filter(p => p.id !== id);
    setPlayers(updated); save(updated);
  };

  const assignTeam = (id: string, team: 'A' | 'B' | null) => {
    const updated = players.map(p => p.id === id ? { ...p, team } : p);
    setPlayers(updated); save(updated);
  };

  const toggleTag = (id: string, tag: string, type: 'positions' | 'styleTags') => {
    const updated = players.map(p => {
      if (p.id !== id) return p;
      const arr = p[type];
      return { ...p, [type]: arr.includes(tag) ? arr.filter((t: string) => t !== tag) : [...arr, tag] };
    });
    setPlayers(updated); save(updated);
  };

  const clearAll = () => { if (confirm('참가자 전체 초기화할까요?')) { setPlayers([]); save([]); } };

  const teamA = players.filter(p => p.team === 'A');
  const teamB = players.filter(p => p.team === 'B');
  const unassigned = players.filter(p => !p.team);

  return (
    <div style={{ background: DARK, minHeight: '100vh', color: '#fff', fontFamily: 'system-ui,sans-serif', paddingBottom: '80px' }}>

      {/* 헤더 */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '18px clamp(1rem,4vw,3rem)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textDecoration: 'none' }}>← 홈</a>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <span style={{ fontWeight: 900, fontSize: '1.1rem' }}>⚔️ 팀빌더</span>
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '100px' }}>
            {players.length}명 등록
          </span>
        </div>
        {players.length > 0 && (
          <button onClick={clearAll} style={{ fontSize: '0.75rem', color: 'rgba(255,100,100,0.7)', background: 'none', border: '1px solid rgba(255,100,100,0.2)', borderRadius: '8px', padding: '4px 12px', cursor: 'pointer' }}>
            전체 초기화
          </button>
        )}
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px clamp(1rem,4vw,3rem)' }}>

        {/* 참가자 등록 */}
        <div style={{ background: CARD, border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px 24px', marginBottom: '28px' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, color: ACCENT, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>참가자 등록</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPlayer()}
              placeholder="닉네임#태그  (예: 스맵#KR1)"
              style={{ flex: 1, minWidth: '220px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
            />
            <button
              onClick={addPlayer} disabled={loading}
              style={{ padding: '10px 24px', borderRadius: '10px', background: loading ? 'rgba(235,112,26,0.4)' : ACCENT, color: '#fff', border: 'none', fontWeight: 800, fontSize: '0.9rem', cursor: loading ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
              {loading ? '불러오는 중...' : '+ 추가'}
            </button>
          </div>
          {error && <p style={{ color: '#ff6b6b', fontSize: '0.8rem', marginTop: '8px' }}>{error}</p>}
        </div>

        {/* 팀 구성 패널 */}
        {players.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
            {(['A', 'B'] as const).map(team => {
              const members = team === 'A' ? teamA : teamB;
              const avg = avgTier(members);
              return (
                <div key={team} style={{ background: CARD, border: `1px solid ${team === 'A' ? 'rgba(235,112,26,0.2)' : 'rgba(80,120,255,0.2)'}`, borderRadius: '16px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 900, fontSize: '1rem', color: team === 'A' ? ACCENT : '#6090ff' }}>팀 {team}</span>
                      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>{members.length}/5</span>
                    </div>
                    {avg && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: TIER_COLOR[avg.tier] || '#fff', background: 'rgba(255,255,255,0.06)', padding: '2px 10px', borderRadius: '100px' }}>
                        평균 {TIER_KO[avg.tier]} {avg.rank}
                      </span>
                    )}
                  </div>
                  {/* 포지션 커버 */}
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                    {POSITIONS.map(pos => {
                      const covered = members.some(p => p.positions.includes(pos));
                      return (
                        <span key={pos} style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', background: covered ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.04)', color: covered ? '#00e676' : 'rgba(255,255,255,0.2)', border: `1px solid ${covered ? 'rgba(0,230,118,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
                          {pos} {covered ? '✓' : ''}
                        </span>
                      );
                    })}
                  </div>
                  {/* 멤버 목록 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {members.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '6px 10px' }}>
                        <img src={`https://ddragon.leagueoflegends.com/cdn/${p.version}/img/profileicon/${p.profileIconId}.png`} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.gameName}</span>
                          {p.rank && <span style={{ fontSize: '0.65rem', color: TIER_COLOR[p.rank.tier] }}>{TIER_KO[p.rank.tier]} {p.rank.rank}</span>}
                        </div>
                        <button onClick={() => assignTeam(p.id, null)} style={{ fontSize: '0.7rem', color: 'rgba(255,100,100,0.7)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>✕</button>
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, 5 - members.length) }).map((_, i) => (
                      <div key={i} style={{ height: '42px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.15)' }}>빈 슬롯</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 참가자 카드 목록 */}
        {unassigned.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>미배치 참가자 ({unassigned.length}명)</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
              {unassigned.map(p => <PlayerCard key={p.id} p={p} onAssign={assignTeam} onRemove={removePlayer} onToggle={toggleTag} editing={editId === p.id} onEdit={() => setEditId(editId === p.id ? null : p.id)} />)}
            </div>
          </div>
        )}

        {players.filter(p => p.team).length > 0 && (
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>배치 완료 ({players.filter(p=>p.team).length}명)</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
              {players.filter(p => p.team).map(p => <PlayerCard key={p.id} p={p} onAssign={assignTeam} onRemove={removePlayer} onToggle={toggleTag} editing={editId === p.id} onEdit={() => setEditId(editId === p.id ? null : p.id)} />)}
            </div>
          </div>
        )}

        {players.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'rgba(255,255,255,0.2)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚔️</div>
            <p style={{ fontSize: '1rem', fontWeight: 700 }}>참가자를 추가해주세요</p>
            <p style={{ fontSize: '0.82rem', marginTop: '8px' }}>닉네임#태그 형식으로 입력하면 자동으로 티어·챔프 정보를 불러와요</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 참가자 카드 ── */
function PlayerCard({ p, onAssign, onRemove, onToggle, editing, onEdit }: {
  p: Player;
  onAssign: (id: string, team: 'A' | 'B' | null) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string, tag: string, type: 'positions' | 'styleTags') => void;
  editing: boolean;
  onEdit: () => void;
}) {
  const winRate = p.rank ? Math.round(p.rank.wins / (p.rank.wins + p.rank.losses) * 100) : null;
  const tierColor = p.rank ? (TIER_COLOR[p.rank.tier] || '#fff') : 'rgba(255,255,255,0.3)';

  return (
    <div style={{ background: CARD, border: `1px solid ${p.team === 'A' ? 'rgba(235,112,26,0.25)' : p.team === 'B' ? 'rgba(80,120,255,0.25)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '14px', padding: '14px 16px', transition: 'border-color 0.2s' }}>
      {/* 상단: 프사 + 기본정보 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img src={`https://ddragon.leagueoflegends.com/cdn/${p.version}/img/profileicon/${p.profileIconId}.png`} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', border: `2px solid ${tierColor}` }} />
          <span style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.55rem', fontWeight: 900, background: tierColor, color: '#000', padding: '1px 5px', borderRadius: '100px', whiteSpace: 'nowrap' }}>
            {p.summonerLevel}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.gameName}</div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>#{p.tagLine}</div>
          {p.rank ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: tierColor }}>{TIER_KO[p.rank.tier]} {p.rank.rank}</span>
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>{p.rank.lp} LP</span>
              {winRate !== null && <span style={{ fontSize: '0.65rem', color: winRate >= 55 ? '#00e676' : winRate >= 50 ? '#fff' : '#ff6b6b' }}>{winRate}%</span>}
            </div>
          ) : (
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)', marginTop: '4px', display: 'block' }}>언랭크</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button onClick={onEdit} style={{ fontSize: '0.7rem', background: editing ? ACCENT : 'rgba(255,255,255,0.06)', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}>태그</button>
          <button onClick={() => onRemove(p.id)} style={{ fontSize: '0.7rem', background: 'none', color: 'rgba(255,100,100,0.6)', border: '1px solid rgba(255,100,100,0.15)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}>삭제</button>
        </div>
      </div>

      {/* 챔피언 아이콘 */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
        {p.topChampions.slice(0, 7).map(c => (
          <div key={c.id} title={`${c.name} (레벨 ${c.level})`} style={{ position: 'relative' }}>
            <img src={`https://ddragon.leagueoflegends.com/cdn/${p.version}/img/champion/${c.image}`} alt={c.name} style={{ width: '32px', height: '32px', borderRadius: '6px', border: `1.5px solid ${c.level >= 7 ? '#FFD700' : c.level >= 5 ? '#CD7F32' : 'rgba(255,255,255,0.12)'}` }} />
          </div>
        ))}
      </div>

      {/* 태그 편집 */}
      {editing && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', marginBottom: '10px' }}>
          <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginBottom: '6px' }}>포지션</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
            {POSITIONS.map(pos => (
              <button key={pos} onClick={() => onToggle(p.id, pos, 'positions')} style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', border: 'none', cursor: 'pointer', background: p.positions.includes(pos) ? ACCENT : 'rgba(255,255,255,0.07)', color: p.positions.includes(pos) ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                {pos}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginBottom: '6px' }}>성향</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {STYLE_TAGS.map(tag => (
              <button key={tag} onClick={() => onToggle(p.id, tag, 'styleTags')} style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', border: 'none', cursor: 'pointer', background: p.styleTags.includes(tag) ? '#6090ff' : 'rgba(255,255,255,0.07)', color: p.styleTags.includes(tag) ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 포지션·성향 뱃지 */}
      {!editing && (p.positions.length > 0 || p.styleTags.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
          {p.positions.map(pos => <span key={pos} style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', background: 'rgba(235,112,26,0.12)', color: ACCENT, border: '1px solid rgba(235,112,26,0.25)' }}>{pos}</span>)}
          {p.styleTags.map(tag => <span key={tag} style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', background: 'rgba(96,144,255,0.1)', color: '#6090ff', border: '1px solid rgba(96,144,255,0.2)' }}>{tag}</span>)}
        </div>
      )}

      {/* 팀 배정 버튼 */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={() => onAssign(p.id, p.team === 'A' ? null : 'A')} style={{ flex: 1, padding: '7px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem', background: p.team === 'A' ? ACCENT : 'rgba(235,112,26,0.1)', color: p.team === 'A' ? '#fff' : ACCENT, transition: 'all 0.15s' }}>
          {p.team === 'A' ? '✓ 팀 A' : '팀 A'}
        </button>
        <button onClick={() => onAssign(p.id, p.team === 'B' ? null : 'B')} style={{ flex: 1, padding: '7px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem', background: p.team === 'B' ? '#6090ff' : 'rgba(96,144,255,0.1)', color: p.team === 'B' ? '#fff' : '#6090ff', transition: 'all 0.15s' }}>
          {p.team === 'B' ? '✓ 팀 B' : '팀 B'}
        </button>
      </div>
    </div>
  );
}
