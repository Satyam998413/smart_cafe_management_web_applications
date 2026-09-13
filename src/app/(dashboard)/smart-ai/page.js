'use client';

import { useDashboard } from '@/features/dashboard/DashboardContext';
import SmartAiPage from '@/features/ai/SmartAiPage';

export default function SmartAiRoute() {
  const { apiFetch, authName, menu, cartApi } = useDashboard();

  return <SmartAiPage apiFetch={apiFetch} authName={authName} menu={menu} cartApi={cartApi} />;
}
