import type { Metadata } from 'next';
import MultiviewClient from './MultiviewClient';

export const metadata: Metadata = {
  title: '멀티뷰 | SMEB Archive',
  description: 'SOOP 라이브 방송을 최대 4개까지 동시에 시청하세요',
};

export default function MultiviewPage() {
  return <MultiviewClient />;
}
