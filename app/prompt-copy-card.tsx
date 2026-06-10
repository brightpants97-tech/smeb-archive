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
  const monthLabel = `${yr}년 ${parseInt(mo)}월`;

  // 최고 조회수 영상
  const topYt   = ytVideos[0];
  const topSoop = soopVods[0];

  const ytList = ytVideos.map((v, i) =>
    `${i + 1}. ${v.title}\n   조회수: ${Number(v.views).toLocaleString('ko-KR')}회${v.id ? `  |  https://www.youtube.com/watch?v=${v.id}` : ''}`
  ).join('\n\n');

  const soopList = soopVods.map((v, i) =>
    `${i + 1}. ${v.title}\n   조회수: ${Number(v.views || 0).toLocaleString('ko-KR')}회${v.id ? `  |  https://vod.sooplive.com/player/${v.id}` : ''}`
  ).join('\n\n');

  const prompt = `아래는 스맵(SMEB) 스트리머의 ${monthLabel} 콘텐츠 데이터야.
(사이트: https://www.smebarchive.xyz/)

[유튜브 ${monthLabel} 전체 영상 (${ytVideos.length}개, 조회수 순)]
🏆 최고 조회수: ${topYt ? `${topYt.title} (${Number(topYt.views).toLocaleString('ko-KR')}회)${topYt.id ? ` → https://www.youtube.com/watch?v=${topYt.id}` : ''}` : '없음'}
${ytList || '(데이터 없음)'}

[SOOP 다시보기 ${monthLabel} 전체 (${soopVods.length}개, 조회수 순)]
🏆 최고 조회수: ${topSoop ? `${topSoop.title} (${Number(topSoop.views || 0).toLocaleString('ko-KR')}회)${topSoop.id ? ` → https://vod.sooplive.com/player/${topSoop.id}` : ''}` : '없음'}
${soopList || '(데이터 없음)'}

위 데이터를 기반으로 아래 10가지를 분석해줘:

1. 유튜브+SOOP 통합 키워드 15가지: 이달 전체 영상 기반 핵심 키워드 15개, 각 키워드마다 관련 영상 주요 상황 설명 (링크 참고)
2. 유튜브와 SOOP에서 이번달 주된 콘텐츠
3. swot 분석
4. swot을 참고한 콘텐츠 5가지 추천(생방송에서 가능한 현실성 있는 콘텐츠, 구체적으로)
5. 이번 달 만났던 모든 스트리머 또는 유튜버 / 베스트 케미 1명
6. 이번 달 최고 조회수 유튜브 영상과 SOOP 영상 각 1개씩 - 왜 이 영상이 가장 인기 있었는지 구체적인 이유 분석
7. 이달 영상 티어표 (S~C): 유튜브+SOOP 전체 영상을 조회수·소재·반응성 기준으로 S/A/B/C 티어로 분류하고 각 이유 한 줄씩
8. 이달 콜라보 케미 랭킹: 함께 등장한 스트리머·유튜버 전원 나열 후 케미·시너지 기준 1위 선정 및 이유
9. 이달 콘텐츠 장르 비율: 게임·일상·합방·여행 등 카테고리별 비율을 퍼센트로 정리 (예: 게임 40% / 합방 30% / 일상 30%)
10. 한 문장으로 정리하는 이번 달(결론)

📌 출력 형식:
- 스맵(SMEB)의 시청자 애칭은 '케케단'이야, 시청자 언급 시 케케단으로 불러줘
- 문체: 실제 신문 기사체 (~했다 / ~으로 분석됐다 / ~인 것으로 나타났다)

[구조]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 SMEB MONTHLY REPORT｜[연월] 호
헤드라인 (한 줄, 이달을 대표하는 임팩트 문장)
부제 (두 줄 이내 요약)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

각 섹션은 아래 형식으로:
▶ [섹션 제목]
리드문 (한 줄, 핵심 결론 먼저)
본문 (항목은 들여쓰기·번호로 명확히 구분)
💬 케케단 논평 한 줄
─────────────────────────

[강조 규칙]
- 핵심 수치·이름: 『 』로 강조 (예: 『103,692회』)
- 1위·최고: 👑 표시
- 티어표·랭킹: 꼴찌(C)→1위(S) 순으로 한 줄씩
- 섹션 간 구분선 필수
- 마지막 명언은 큰따옴표 인용구로 마무리`;

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
