'use client';
import { useState } from 'react';

interface VideoItem {
  title: string;
  views: number;
}

interface Props {
  ytVideos: VideoItem[];
  soopVods: VideoItem[];
  currentMonth: string;
}

export default function PromptCopyCard({ ytVideos, soopVods, currentMonth }: Props) {
  const [copied, setCopied] = useState(false);

  const [yr, mo] = currentMonth.split('-');
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

  return (
    <div
      onClick={handleCopy}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 28px',
        background: copied
          ? 'linear-gradient(135deg,rgba(34,197,94,0.12) 0%,rgba(34,197,94,0.04) 100%)'
          : 'linear-gradient(135deg,rgba(235,112,26,0.08) 0%,rgba(235,112,26,0.02) 100%)',
        border: `1px solid ${copied ? 'rgba(34,197,94,0.35)' : 'rgba(235,112,26,0.2)'}`,
        borderRadius: '16px', cursor: hasData ? 'pointer' : 'default',
        transition: 'all 0.25s',
        flexWrap: 'wrap' as const, gap: '16px',
        opacity: hasData ? 1 : 0.5,
      }}
      onMouseEnter={e => { if (hasData && !copied) { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(235,112,26,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(235,112,26,0.12)'; } }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = copied ? 'rgba(34,197,94,0.35)' : 'rgba(235,112,26,0.2)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
          background: copied
            ? 'linear-gradient(135deg,#22c55e,#16a34a)'
            : 'linear-gradient(135deg,#EB701A,#ff8c3a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.4rem', transition: 'all 0.3s',
        }}>{copied ? '✅' : '📋'}</div>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: copied ? '#22c55e' : '#EB701A', marginBottom: '4px', transition: 'color 0.3s' }}>
            {copied ? '복사 완료!' : 'AI 분석 질문'}
          </div>
          <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {monthLabel} 분석 질문 복사
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {copied ? '제미나이에 붙여넣기 하세요!' : `유튜브 ${ytVideos.length}개 · SOOP ${soopVods.length}개 데이터 포함`}
          </p>
        </div>
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        background: copied
          ? 'linear-gradient(135deg,#22c55e,#16a34a)'
          : 'linear-gradient(135deg,#EB701A,#ff8c3a)',
        color: '#fff', borderRadius: '100px',
        padding: '10px 20px', fontSize: '0.85rem', fontWeight: 700,
        flexShrink: 0, transition: 'all 0.3s',
      }}>
        {copied ? '✓ 복사됨' : '클릭해서 복사'}
      </div>
    </div>
  );
}
