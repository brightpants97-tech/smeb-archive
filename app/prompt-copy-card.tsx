'use client';
import { useState, useMemo } from 'react';

interface VideoItem {
  id?: string;
  title: string;
  views: number;
}

interface Props {
  monthlyTop10: Record<string, VideoItem[]>;
  monthTop5: Record<string, VideoItem[]>;
  sortedMonths: string[];
  currentMonth: string;
  monthlyAll?: Record<string, VideoItem[]>;
  soopMonthAll?: Record<string, VideoItem[]>;
}

export default function PromptCopyCard({ monthlyTop10, monthTop5, sortedMonths, currentMonth, monthlyAll, soopMonthAll }: Props) {
  const availableMonths = useMemo(() => {
    const ytM = Object.keys(monthlyAll || monthlyTop10).filter(m => ((monthlyAll || monthlyTop10)[m] || []).length > 0);
    const soopM = sortedMonths.filter(m => ((soopMonthAll || monthTop5)[m] || []).length > 0);
    return [...new Set([...ytM, ...soopM])].sort().reverse();
  }, [monthlyAll, monthlyTop10, monthTop5, soopMonthAll, sortedMonths]);

  const defaultMonth = useMemo(() => {
    if (availableMonths.includes(currentMonth)) return currentMonth;
    return availableMonths[0] || currentMonth;
  }, [availableMonths, currentMonth]);

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [copied, setCopied] = useState(false);

  // 전체 데이터 사용 (없으면 기존 top10/top5 fallback)
  const ytVideos = useMemo(() => (monthlyAll || monthlyTop10)[selectedMonth] || [], [monthlyAll, monthlyTop10, selectedMonth]);
  const soopVods  = useMemo(() => (soopMonthAll  || monthTop5)[selectedMonth]  || [], [soopMonthAll,  monthTop5,  selectedMonth]);

  const [yr, mo] = selectedMonth.split('-');
  const monthLabel = `${yr}텄 ${parseInt(mo)}월`;

  const ytList = ytVideos.map((v, i) =>
    `${i + 1}. ${v.title} (\uc870\ud68c\uc218: ${Number(v.views).toLocaleString('ko-KR')})${v.id ? `\n   https://www.youtube.com/watch?v=${v.id}` : ''}`
  ).join('\n');

  const soopList = soopVods.map((v, i) =>
    `${i + 1}. ${v.title} (조회수: ${Number(v.views).toLocaleString('ko-KR')})`
  ).join('\n');

  const prompt = `아래는 스맵(SMEB) 스트리머의 ${monthLabel} 콘텐츠 데이터야.
(사이트: https://www.smebarchive.xyz/)

[유튜브 ${monthLabel} 전체 영상 (${ytVideos.length}개, 조회수 순)]
${ytList || '(데이터 없음)'}

[SOOP 다시보기 ${monthLabel} 전체 (${soopVods.length}개, 조회수 순)]
${soopList || '(데이터 없음)'}

위 데이터를 기반으로 아래 7가지를 분석해줘:

1. 유튜브 TOP10 키워드 10가지: 영상 주요상황 설명
2. SOOP 다시보기 캘린더 TOP5의 키워드 5가지: 영상 주요상황 설명
3. 유튜브와 SOOP에서 이번달 주된 콘텐츠
4. swot 분석
5. swot을 참고한 콘텐츠 5가지 추천(생방송에서 가능한 현실성 있는 콘텐츠, 구체적으로)
6. 이번 달 만났던 모든 스트리머 또는 유튜버 / 베스트 케미 1명
7. 한 문장으로 정리하는 이번 달(명언)`;

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
    const ytC  = ((monthlyAll  || monthlyTop10)[m] || []).length;
    const soopC = ((soopMonthAll || monthTop5)[m]  || []).length;
    return `${y}년 ${parseInt(mo2)}월${ytC > 0 ? ` · YT${ytC}` : ''}${soopC > 0 ? ` · SOOP${soopC}` : ''}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', height: '100%' }}>

      {/* 월 선택 드롭다운 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase' as const, color: 'var(--text-muted)',
          flexShrink: 0,
        }}>
          분석 월
        </span>
        <div style={{ position: 'relative', flex: 1 }}>
          <select
            value={selectedMonth}
            onChange={e => { setSelectedMonth(e.target.value); setCopied(false); }}
            style={{
              width: '100%',
              padding: '8px 30px 8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--card-border)',
              background: 'var(--card)',
              color: 'var(--text)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none' as const,
            }}
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{fmtMonth(m)}</option>
            ))}
          </select>
          <span style={{
            position: 'absolute', right: '10px', top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'var(--text-muted)',
            fontSize: '0.7rem',
          }}>▾</span>
        </div>
      </div>

      {/* 복사 버튼 카드 */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleCopy}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleCopy(); }}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '18px 20px',
          background: copied
            ? 'linear-gradient(135deg,rgba(34,197,94,0.1) 0%,rgba(34,197,94,0.03) 100%)'
            : 'linear-gradient(135deg,rgba(235,112,26,0.08) 0%,rgba(235,112,26,0.02) 100%)',
          border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(235,112,26,0.18)'}`,
          borderRadius: '14px',
          cursor: hasData ? 'pointer' : 'default',
          transition: 'all 0.25s',
          flexWrap: 'wrap' as const,
          opacity: hasData ? 1 : 0.5,
          userSelect: 'none' as const,
        }}
        onMouseEnter={e => {
          if (hasData && !copied) {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = 'rgba(235,112,26,0.45)';
            el.style.boxShadow = '0 6px 24px rgba(235,112,26,0.1)';
          }
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = copied ? 'rgba(34,197,94,0.3)' : 'rgba(235,112,26,0.18)';
          el.style.boxShadow = 'none';
        }}
      >
        {/* 아이콘 + 텍스트 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '11px', flexShrink: 0,
            background: copied
              ? 'linear-gradient(135deg,#22c55e,#16a34a)'
              : 'linear-gradient(135deg,#EB701A,#ff8c3a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem', transition: 'all 0.3s',
          }}>
            {copied ? '✅' : '📋'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              color: copied ? '#22c55e' : '#EB701A',
              marginBottom: '2px',
            }}>
              {copied ? '복사 완료!' : 'AI 분석 질문'}
            </div>
            <p style={{
              fontSize: '0.92rem', fontWeight: 800, color: 'var(--text)',
              letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
            }}>
              {monthLabel} 분석 질문 복사
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              {copied
                ? '제미나이에 붙여넣기 하세요 ✓'
                : `YT 전체 ${ytVideos.length}개 · SOOP 전체 ${soopVods.length}개`}
            </p>
          </div>
        </div>

        {/* 복사 버튼 */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          background: copied
            ? 'linear-gradient(135deg,#22c55e,#16a34a)'
            : 'linear-gradient(135deg,#EB701A,#ff8c3a)',
          color: '#fff', borderRadius: '100px',
          padding: '8px 16px', fontSize: '0.78rem', fontWeight: 700,
          flexShrink: 0, transition: 'all 0.3s',
          whiteSpace: 'nowrap' as const,
        }}>
          {copied ? '✓ 복사됨' : '복사'}
        </div>
      </div>
    </div>
  );
}
