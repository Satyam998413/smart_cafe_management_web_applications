'use client';

import { useDashboard } from '@/features/dashboard/DashboardContext';
import BookingsPage from '@/features/bookings/BookingsPage';

export default function BookingsRoute() {
  const { apiFetch } = useDashboard();

  return <BookingsPage apiFetch={apiFetch} />;
}
