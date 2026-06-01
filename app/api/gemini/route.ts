import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

const GEMINI_MODEL = 'gemini-1.5-flash';

interface VideoItem {
  title: string;
  views: number;
  date?: string;
  publishedAt?: string;
}

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1200,
          responseMimeType: 'application/json',
        },
      }),
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
}

const getAnalysis = unstable_cache(
  async (month: string, ytVideos: VideoItem[], soopVods: VideoItem[]) => {
    const [y, m] = month.split('-');
    const monthLabel = `${y}년 ${parseInt(m)}월`;

    const ytList = ytVideos
      .slice(0, 10)
      .map((v, i) => `${i + 1}위. "${v.title}" — ${v.views.toLocaleString()}회`)
      .join('\n');

    const soopList = soopVods
      .slice(0, 5)
      .map((v, i) => `${i + 1}위. "${v.title}" — ${v.views.toLocaleString()}회`)
      .join('\n');

    const prompt = `
당신은 스트리머 콘텐츠 분석 전문가입니다.
아래는 전 프로게이머 출신 스트리머 "스맵(SMEB)"의 ${monthLabel} 콘텐츠 성과 데이터입니다.

[유튜브 TOP 10 (조회수 기준)]
${ytList}

[SOOP 다시보기 TOP 5 (조회수 기준)]
${soopList}

위 데이터를 분석하여 아래 JSON 형식으로만 응답하세요. 마크다운 없이 JSON만 출력:

{
  "month": "${monthLabel}",
  "trendKeywords": ["키워드1", "키워드2", "키워드3"],
  "topPerformer": {
    "title": "가장 성과 좋은 콘텐츠 제목",
    "reason": "왜 잘 됐는지 2~3문장으로 분석"
  },
  "lowPerformer": {
    "title": "상대적으로 반응이 낙은 콘텐츠 유형",
    "reason": "왜 반응이 낙은지 2~3문장으로 분석"
  },
  "insights": [
    "핵심 인사이트 1 (1~2문장)",
    "핵심 인사이트 2 (1~2문장)",
    "핵심 인사이트 3 (1~2문장)"
  ],
  "suggestions": [
    "구체적 개선 제안 1",
    "구체적 개선 제안 2",
    "구체적 개선 제안 3"
  ],
  "overallScore": 75,
  "overallComment": "이달 전체 콘텐츠에 대한 총평 2~3문장"
}

분석 시 주의사항:
- 스맵은 LOL 프로게이머 출신으로 게임, 일상, 스포츠 콘텐츠를 주로 다룸
- 조회수 차이가 클수록 팬 선호도 차이가 나타나는 것
- 제목에서 콘텐츠 유형(예: LCK 시청, GTA, 일상, 콜라보 등)을 파악할 것
- overallScore는 0~100 숫자
`;

    const raw = await callGemini(prompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  },
  ['gemini-analysis-v2'],
  { revalidate: 60 * 60 * 24 * 7 }
);

export async function POST(req: NextRequest) {
  try {
    const { month, ytVideos, soopVods } = await req.json();
    if (!month || !ytVideos || !soopVods) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const result = await getAnalysis(month, ytVideos, soopVods);
    return NextResponse.json(result);
  } catch (e) {
    console.error('Gemini analysis error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
