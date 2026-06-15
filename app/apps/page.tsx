import type { Metadata } from 'next';
import AppsClient from './AppsClient';

export const metadata: Metadata = {
  title: '도구 | SMEB Archive',
  description: 'SMEB Archive 도구 모음',
};

export default function AppsPage() {
  return <AppsClient />;
}
