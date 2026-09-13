'use client';

import { useDashboard } from '@/features/dashboard/DashboardContext';
import RoomsPage from '@/features/rooms/RoomsPage';

export default function RoomsRoute() {
  const { apiFetch, authRole } = useDashboard();

  return <RoomsPage apiFetch={apiFetch} authRole={authRole} />;
}
