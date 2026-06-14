import type { Metadata } from 'next';
import BanPickClient from './BanPickClient';

export const metadata: Metadata = {
  title: '밴픽 도구 | SMEB Archive',
  description: '맞춤형 밴픽 시뮬레이터 & 선수 전력 분석',
};

export default function BanPickPage() {
  return <BanPickClient />;
}
