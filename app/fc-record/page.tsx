import type { Metadata } from 'next';
import Script from 'next/script';
import FcRecordClient from './FcRecordClient';

export const metadata: Metadata = {
  title: 'FC 온라인 상대전적 | SMEB Archive',
  description: '스맵과 상대 스트리머의 FC 온라인 전적과 그날의 스쿼드를 확인해보세요.',
};

export default function FcRecordPage() {
  return (
    <>
      {/* 넥슨 Open API 애플리케이션(339932) 연동 확인용 Analytics 스크립트 */}
      <Script src="https://openapi.nexon.com/js/analytics.js?app_id=339932" strategy="afterInteractive" async />
      <FcRecordClient />
    </>
  );
}
