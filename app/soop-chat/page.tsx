import type { Metadata } from 'next';
import ChatInspector from './ChatInspector';
export const metadata: Metadata = {
  title: 'SOOP 채팅 부검 | SMEB Archive',
  description: 'SOOP 생방송과 다시보기 채팅을 아이디, 닉네임, 내용, 시간별로 검색합니다.',
  alternates: { canonical: 'https://www.smebarchive.xyz/soop-chat' },
};
export default function Page() { return <ChatInspector />; }
