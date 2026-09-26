import type { Metadata } from 'next';
import TimelineAdminClient from './TimelineAdminClient';

export const metadata: Metadata = {
  title: '타임라인 관리 | SMEB Archive',
  robots: { index: false, follow: false },
};

export default function TimelineAdminPage() {
  return <TimelineAdminClient />;
}
