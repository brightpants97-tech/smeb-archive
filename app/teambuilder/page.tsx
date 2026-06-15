import type { Metadata } from 'next';
import TeamBuilderClient from './TeamBuilderClient';

export const metadata: Metadata = {
  title: '팀빌더 | SMEB Archive',
  description: '라인별 선수 입력 후 랜덤 팀 배정',
};

export default function TeamBuilderPage() {
  return <TeamBuilderClient />;
}
