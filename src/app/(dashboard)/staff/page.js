'use client';

import { useDashboard } from '@/features/dashboard/DashboardContext';
import StaffPage from '@/features/staff/StaffPage';

export default function StaffRoute() {
  const { apiFetch, authRole } = useDashboard();

  return <StaffPage apiFetch={apiFetch} authRole={authRole} />;
}
