import type { Metadata } from 'next';
import TeamBuilderClient from './TeamBuilderClient';

export const metadata: Metadata = {
  title: '팀빌더 | SMEB Archive',
  description: '스맵 멸망전 팀 구성 도우미',
};

export default function TeamBuilderPage() {
  return <TeamBuilderClient />;
}
