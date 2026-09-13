'use client';

import { useDashboard } from '@/features/dashboard/DashboardContext';
import BillingCheckoutPage from '@/features/billing/BillingCheckoutPage';

export default function BillingRoute() {
  const { apiFetch, socket, authName } = useDashboard();

  return <BillingCheckoutPage apiFetch={apiFetch} socket={socket} authName={authName} />;
}
