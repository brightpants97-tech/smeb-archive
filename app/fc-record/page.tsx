import type { Metadata } from 'next';
import FcRecordClient from './FcRecordClient';

export const metadata: Metadata = {
  title: 'FC 온라인 상대전적 | SMEB Archive',
  description: '스맵과 상대 스트리머의 FC 온라인 전적과 그날의 스쿼드를 확인해보세요.',
};

export default function FcRecordPage() {
  return <FcRecordClient />;
}
