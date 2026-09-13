'use client';

import { useDashboard } from '@/features/dashboard/DashboardContext';
import WalletPage from '@/features/wallet/WalletPage';

export default function WalletRoute() {
  const { apiFetch, authRole, authName } = useDashboard();

  return <WalletPage apiFetch={apiFetch} authRole={authRole} authName={authName} />;
}
