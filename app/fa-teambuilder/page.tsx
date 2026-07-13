import type { Metadata } from 'next';
import FaTeamBuilderClient from './FaTeamBuilderClient';

export const metadata: Metadata = {
  title: 'FA 팀빌더 | SMEB Archive',
  description: 'LoL 멸망전 FA 등급 기반 182점 캡 팀 구성 시뮬레이터',
};

export default function FaTeamBuilderPage() {
  return <FaTeamBuilderClient />;
}
