'use client';
import { useState, useMemo } from 'react';

interface AnalysisResult {
  month: string;
  trendKeywords: string[];
  topPerformer: { title: string; reason: string };
  lowPerformer: { title: string; reason: string };
  insights: string[];
  suggestions: string[];
  overallScore: number;
  overallComment: string;
}

interface Props {
  monthlyTop10: Record<string, { title: string; views: number; publishedAt?: string }[]>;
  monthTop5:    Record<string, { title: string; views: number }[]>;
  sortedMonths: string[];
  currentMonth: string;
}

export default function AnalysisSection({ monthlyTop10, monthTop5, sortedMonths, currentMonth }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analyzedMonth, setAnalyzedMonth] = useState('');

  const availableMonths = useMemo(() => {
    const ytMonths = new Set(Object.keys(monthlyTop10));
    const soopMonths = new Set(sortedMonths);
    const all = new Set([...ytMonths, ...soopMonths]);
    return [...all].sort().reverse();
  }, [monthlyTop10, sortedMonths]);

  const ytVideos = useMemo(() =>
    (monthlyTop10[selectedMonth] || []).sort((a, b) => b.views - a.views).slice(0, 10).map(v => ({ title: v.title, views: v.views })),
    [monthlyTop10, selectedMonth]
  );
  const soopVods = useMemo(() =>
    (monthTop5[selectedMonth] || []).slice(0, 5).map(v => ({ title: v.title, views: v.views })),
    [monthTop5, selectedMonth]
  );

  const [y, m] = selectedMonth.split('-');
  const monthLabel = `${y}년 ${parseInt(m)}월`;
  const scoreColor = (s: number) => s >= 80 ? '#22c55e' : s >= 60 ? '#EB701A' : '#ef4444';
  const scoreLabel = (s: number) => s >= 80 ? '우수' : s >= 60 ? '양호' : '개선 필요';
  const hasData = ytVideos.length > 0 || soopVods.length > 0;

  const run = async () => {
    if (loading || !hasData) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth, ytVideos, soopVods }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data); setAnalyzedMonth(selectedMonth);
    } catch { setError('분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'); }
    finally { setLoading(false); }
  };

  const handleMonthChange = (mo: string) => {
    setSelectedMonth(mo);
    if (mo !== analyzedMonth) { setResult(null); setError(''); }
  };

  return (
    <div style={{ marginTop: '48px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap' as const, gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#EB701A', marginBottom: '8px' }}>
            <span style={{ display: 'block', width: '24px', height: '2px', background: '#EB701A', borderRadius: '2px' }} />
            AI 콘텐츠 분석
          </div>
          <h2 style={{ fontSize: 'clamp(1.4rem,2.5vw,2rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.1, color: 'var(--text)' }}>
            {monthLabel} <span style={{ color: '#EB701A' }}>리포트</span>
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '6px' }}>Gemini AI가 유튜브 TOP10 + SOOP TOP5를 분석합니다</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' as const }}>
          <select value={selectedMonth} onChange={e => handleMonthChange(e.target.value)}
            style={{ padding: '10px 32px 10px 14px', borderRadius: '10px', border: '1px solid var(--card-border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', outline: 'none', appearance: 'none' as const, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
            {availableMonths.map(mo => {
              const [my, mm] = mo.split('-');
              const ytCount = (monthlyTop10[mo] || []).length;
              const soopCount = (monthTop5[mo] || []).length;
              return <option key={mo} value={mo}>{my}년 {parseInt(mm)}월{ytCount > 0 ? ` (YT ${ytCount})` : ''}{soopCount > 0 ? ` (SOOP ${soopCount})` : ''}</option>;
            })}
          </select>

          <button onClick={run} disabled={loading || !hasData}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: (!hasData || loading) ? 'var(--bg-deeper)' : 'linear-gradient(135deg,#4285f4,#34a853)', color: (!hasData || loading) ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '0.88rem', fontWeight: 700, cursor: (!hasData || loading) ? 'not-allowed' : 'pointer', boxShadow: (!hasData || loading) ? 'none' : '0 4px 16px rgba(66,133,244,0.35)', transition: 'all 0.2s' }}>
            {loading ? <><span style={{ width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />분석 중...</> : <><span>✨</span>{result && analyzedMonth === selectedMonth ? '다시 분석' : 'AI 분석 시작'}</>}
          </button>
        </div>
      </div>

      {!hasData && <div style={{ border: '1px solid var(--card-border)', borderRadius: '12px', padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{monthLabel}에는 분석할 데이터가 없습니다.</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '14px 18px', color: '#ef4444', fontSize: '0.85rem', marginBottom: '20px' }}>⚠️ {error}</div>}

      {hasData && !result && !loading && (
        <div onClick={run} style={{ border: '2px dashed var(--card-border)', borderRadius: '16px', padding: '48px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#4285f4'; (e.currentTarget as HTMLElement).style.background = 'rgba(66,133,244,0.04)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🤖</div>
          <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>클릭해서 {monthLabel} 콘텐츠 분석 시작</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>유튜브 {ytVideos.length}개 · SOOP {soopVods.length}개 데이터 기준</p>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[120, 160, 140].map((h, i) => <div key={i} style={{ height: h, borderRadius: '14px', background: 'var(--bg-deeper)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '8px' }}>✨ Gemini가 {monthLabel} 데이터를 분석하고 있습니다...</p>
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>종합 점수</p>
              <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                <svg viewBox="0 0 90 90" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <circle cx="45" cy="45" r="38" fill="none" stroke="var(--bg-deeper)" strokeWidth="8" />
                  <circle cx="45" cy="45" r="38" fill="none" stroke={scoreColor(result.overallScore)} strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 38 * result.overallScore / 100} ${2 * Math.PI * 38}`} strokeLinecap="round" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 900, color: scoreColor(result.overallScore) }}>{result.overallScore}</span>
                </div>
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: scoreColor(result.overallScore), background: scoreColor(result.overallScore) + '20', borderRadius: '100px', padding: '2px 10px' }}>{scoreLabel(result.overallScore)}</span>
            </div>
            <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px' }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' as const, marginBottom: '12px' }}>이달의 트렌드 키워드</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                {result.trendKeywords.map((kw, i) => <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: i === 0 ? 'rgba(235,112,26,0.12)' : 'var(--bg-deeper)', color: i === 0 ? '#EB701A' : 'var(--text)', border: i === 0 ? '1px solid rgba(235,112,26,0.3)' : '1px solid var(--card-border)', borderRadius: '100px', padding: '4px 12px', fontSize: '0.82rem', fontWeight: 600 }}>{i === 0 && '🔥 '}{kw}</span>)}
              </div>
              <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>{result.overallComment}</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ background: 'linear-gradient(135deg,rgba(34,197,94,0.08),rgba(34,197,94,0.02))', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><span>🚀</span><span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase' as const }}>이달의 MVP 콘텐츠</span></div>
              <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', marginBottom: '8px', lineHeight: 1.4 }}>"{result.topPerformer.title}"</p>
              <p style={{ fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>{result.topPerformer.reason}</p>
            </div>
            <div style={{ background: 'linear-gradient(135deg,rgba(239,68,68,0.06),rgba(239,68,68,0.01))', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><span>💡</span><span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' as const }}>개선 여지 있는 유형</span></div>
              <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', marginBottom: '8px', lineHeight: 1.4 }}>{result.lowPerformer.title}</p>
              <p style={{ fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>{result.lowPerformer.reason}</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}><span>📊</span><span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>핵심 인사이트</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {result.insights.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(235,112,26,0.12)', color: '#EB701A', fontSize: '0.68rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <p style={{ fontSize: '0.83rem', lineHeight: 1.55, color: 'var(--text)' }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: 'linear-gradient(135deg,rgba(66,133,244,0.07),rgba(66,133,244,0.02))', border: '1px solid rgba(66,133,244,0.18)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}><span>🎯</span><span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4285f4', textTransform: 'uppercase' as const }}>개선 제안</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {result.suggestions.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ flexShrink: 0, color: '#4285f4', fontWeight: 700 }}>→</span>
                    <p style={{ fontSize: '0.83rem', lineHeight: 1.55, color: 'var(--text)' }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>✨ Gemini 1.5 Flash 분석 · 기준: {analyzedMonth} · 유튜브 {ytVideos.length}개 + SOOP {soopVods.length}개</p>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
