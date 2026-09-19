import type { Metadata } from 'next';
import IssuesAdminClient from './IssuesAdminClient';

export const metadata: Metadata = {
  title: '최근 이슈 관리 | SMEB Archive',
  robots: { index: false, follow: false },
};

export default function IssuesAdminPage() {
  return <IssuesAdminClient />;
}
