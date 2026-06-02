'use client';
import { useState, useMemo } from 'react';

interface VideoItem {
  title: string;
  views: number;
}

interface Props {
  monthlyTop10: Record<string, VideoItem[]>;
  monthTop5: Record<string, VideoItem[]>;
  sortedMonths: string[];
  currentMonth: string;
}

export default function PromptCopyCard({ monthlyTop10, monthTop5, sortedMonths, currentMonth }: Props) {
  const availableMonths = useMemo(() => {
    const ytM = Object.keys(monthlyTop10).filter(m => (monthlyTop10[m] || []).length > 0);
    const soopM = sortedMonths.filter(m => (monthTop5[m] || []).length > 0);
    return [...new Set([...ytM, ...soopM])].sort().reverse();
  }, [monthlyTop10, monthTop5, sortedMonths]);

  const defaultMonth = useMemo(() => {
    if (availableMonths.includes(currentMonth)) return currentMonth;
    return availableMonths[0] || currentMonth;
  }, [availableMonths, currentMonth]);

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [copied, setCopied] = useState(false);

  const ytVideos = useMemo(() => (monthlyTop10[selectedMonth] || []).slice(0, 10), [monthlyTop10, selectedMonth]);
  const soopVods = useMemo(() => (monthTop5[selectedMonth] || []).slice(0, 5), [monthTop5, selectedMonth]);

  const [yr, mo] = selectedMonth.split('-');
  const monthLabel = `${yr}년 ${parseInt(mo)}월`;

  const ytList = ytVideos.map((v, i) =>
    `${i + 1}. ${v.title} (조회수: ${Number(v.views).toLocaleString('ko-KR')})`
  ).join('\n');

  const soopList = soopVods.map((v, i) =>
    `${i + 1}. ${v.title} (조회수: ${Number(v.views).toLocaleString('ko-KR')})`
  ).join('\n');

  const prompt = `아래는 스맵(SMEB) 스트리머의 ${monthLabel} 콘텐츠 데이터야.
(사이트: https://www.smebarchive.xyz/)

[유튜브 TOP${ytVideos.length || 10}]
${ytList || '(데이터 없음)'}

[SOOP 다시보기 TOP${soopVods.length || 5}]
${soopList || '(데이터 없음)'}

위 데이터를 기반으로 아래 6가지를 분석해줘:

1. 유튜브 TOP10 키워드 10가지: 영상 주요상황 설명
2. SOOP 다시보기 캘린더 TOP5의 키워드 5가지: 영상 주요상황 설명
3. 유튜브와 SOOP에서 이번달 주된 콘텐츠
4. swot 분석
5. swot을 참고한 콘텐츠 5가지 추천(생방송에서 가능한 현실성 있는 콘텐츠, 구체적으로)
6. 한 문장으로 정리하는 이번 달(명언)`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = prompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const hasData = ytVideos.length > 0 || soopVods.length > 0;

  const fmtMonth = (m: string) => {
    const [y, mo2] = m.split('-');
    const ytC = (monthlyTop10[m] || []).length;
    const soopC = (monthTop5[m] || []).length;
    return `${y}년 ${parseInt(mo2)}월${ytC > 0 ? ` · YT${ytC}` : ''}${soopC > 0 ? ` · SOOP${soopC}` : ''}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
      {/* 월 선택 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>
          분석 월
        </span>
        <div style={{ position: 'relative', flex: 1 }}>
          <select
            value={selectedMonth}
            onChange={e => { setSelectedMonth(e.target.value); setCopied(false); }}
            style={{
              width: '100%', padding: '8px 32px 8px 12px',
              borderRadius: '10px', border: '1px solid var(--card-border)',
              background: 'var(--card)', color: 'var(--text)',
              fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
              outline: 'none', appearance: 'none' as const,
            }}
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{fmtMonth(m)}</option>
            ))}
          </select>
          <span style={{
            position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
            pointerEvents: 'none', color: 'var(--text-muted)', fontSize: '0.75rem',
          }}>▾</span>
        </div>
      </div>

      {/* 복사 카드 */}
      <div
        onClick={handleCopy}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px',
          background: copied
            ? 'linear-gradient(135deg,rgba(34,197,94,0.12) 0%,rgba(34,197,94,0.04) 100%)'
            : 'linear-gradient(135deg,rgba(235,112,26,0.08) 0%,rgba(235,112,26,0.02) 100%)',
          border: `1px solid ${copied ? 'rgba(34,197,94,0.35)' : 'rgba(235,112,26,0.2)'}`,
          borderRadius: '16px', cursor: hasData ? 'pointer' : 'default',
          transition: 'all 0.25s', flexWrap: 'wrap' as const, gap: '12px',
          opacity: hasData ? 1 : 0.5,
        }}
        onMouseEnter={e => { if (hasData && !copied) { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(235,112,26,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(235,112,26,0.12)'; } }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = copied ? 'rgba(34,197,94,0.35)' : 'rgba(235,112,26,0.2)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
            background: copied ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#EB701A,#ff8c3a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.3rem', transition: 'all 0.3s',
          }}>{copied ? '✅' : '📋'}</div>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: copied ? '#22c55e' : '#EB701A', marginBottom: '3px' }}>
              {copied ? '복사 완료!' : 'AI 분석 질문'}
            </div>
            <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {monthLabel} 분석 질문 복사
            </p>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              {copied ? '제미나이에 붙여넣기 하세요!' : `YT ${ytVideos.length}개 · SOOP ${soopVods.length}개`}
            </p>
          </div>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          background: copied ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#EB701A,#ff8c3a)',
          color: '#fff', borderRadius: '100px',
          padding: '9px 18px', fontSize: '0.82rem', fontWeight: 700,
          flexShrink: 0, transition: 'all 0.3s',
        }}>
          {copied ? '✓ 복사됨' : '클릭해서 복사'}
        </div>
      </div>
    </div>
  );
}
