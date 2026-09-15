'use client';

import { useDashboard } from '@/features/dashboard/DashboardContext';
import IotDevicesPage from '@/features/iot/IotDevicesPage';

export default function DevicesRoute() {
  const { apiFetch, authRole } = useDashboard();

  return <IotDevicesPage apiFetch={apiFetch} authRole={authRole} />;
}
