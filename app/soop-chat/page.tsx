import type { Metadata } from 'next';
import ChatInspector from './ChatInspector';
export const metadata: Metadata = {
  title: 'SOOP 채팅 부검 | SMEB Archive',
  description: 'SOOP 다시보기 채팅을 검색하고 Gemini·ChatGPT로 검수합니다. 아이디별 발언과 앞뒤 대화를 확인하세요.',
  alternates: { canonical: 'https://www.smebarchive.xyz/soop-chat' },
};
export default function Page() { return <ChatInspector />; }
