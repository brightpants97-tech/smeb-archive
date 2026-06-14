import type { Metadata } from 'next';
import BanPickClient from './BanPickClient';

export const metadata: Metadata = {
  title: '팀 관리 | SMEB Archive',
  description: '팀별 선수 챔피언 풀 & 전력 분석',
};

export default function BanPickPage() {
  return <BanPickClient />;
}
