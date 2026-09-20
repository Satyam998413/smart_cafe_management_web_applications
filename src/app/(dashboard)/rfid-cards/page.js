'use client';

import { useDashboard } from '@/features/dashboard/DashboardContext';
import RfidCardsPage from '@/features/rfid/RfidCardsPage';

export default function RfidCardsRoute() {
  const { apiFetch } = useDashboard();

  return <RfidCardsPage apiFetch={apiFetch} />;
}
