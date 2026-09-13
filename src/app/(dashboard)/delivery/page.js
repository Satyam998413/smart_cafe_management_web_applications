'use client';

import { useDashboard } from '@/features/dashboard/DashboardContext';
import DeliveryPage from '@/features/delivery/DeliveryPage';

export default function DeliveryRoute() {
  const { apiFetch, orders, handleOrderUpdated } = useDashboard();

  return <DeliveryPage apiFetch={apiFetch} orders={orders} onOrderUpdated={handleOrderUpdated} />;
}
