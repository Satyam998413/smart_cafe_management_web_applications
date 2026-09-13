'use client';

import { useDashboard } from '@/features/dashboard/DashboardContext';
import OrdersPage from '@/features/orders/OrdersPage';

export default function OrdersRoute() {
  const { orders, ordersLoading, authRole, handleClaimOrder, handleStatusChange, fetchOrders } = useDashboard();

  return (
    <OrdersPage
      orders={orders}
      loading={ordersLoading}
      authRole={authRole}
      onClaim={handleClaimOrder}
      onStatusChange={handleStatusChange}
      onRefetch={(showAllHistory) => fetchOrders(authRole, showAllHistory)}
    />
  );
}
