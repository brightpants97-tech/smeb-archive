import type { Metadata } from 'next';
import TeamBuilder from './TeamBuilder';

export const metadata: Metadata = {
  title: '멸망전 팀 빌더 | SMEB Archive',
  description: '숲 멸망전 팀 구성 도우미. 포지션별 선수 배치, 점수 자동 계산, 규칙 커스텀.',
  openGraph: {
    title: '멸망전 팀 빌더 | SMEB Archive',
    description: '숲 멸망전 팀 구성 도우미',
    siteName: '스맵 아카이브',
    locale: 'ko_KR',
    type: 'website',
  },
};

export default function MyeolmangPage() {
  return <TeamBuilder />;
}
