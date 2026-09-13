'use client';

import { useDashboard } from '@/features/dashboard/DashboardContext';
import PendingCashBillsPage from '@/features/billing/PendingCashBillsPage';

export default function CashBillsRoute() {
  const { apiFetch, socket } = useDashboard();

  return <PendingCashBillsPage apiFetch={apiFetch} socket={socket} />;
}
