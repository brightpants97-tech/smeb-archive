import type { Metadata } from 'next';
import ScheduleClient from './ScheduleClient';

export const metadata: Metadata = {
  title: '일정표 | SMEB Archive',
  description: '스맵 일정표',
};

export default function SchedulePage() {
  return <ScheduleClient />;
}
