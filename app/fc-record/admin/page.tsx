import type { Metadata } from 'next';
import AdminClient from './AdminClient';

export const metadata: Metadata = {
  title: '스트리머 관리 | SMEB Archive',
  robots: { index: false, follow: false },
};

export default function FcAdminPage() {
  return <AdminClient />;
}
