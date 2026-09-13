'use client';

import { useRouter } from 'next/navigation';
import { useDashboard } from '@/features/dashboard/DashboardContext';
import SitesPage from '@/features/sites/SitesPage';

export default function SitesRoute() {
  const router = useRouter();
  const { apiFetch, authRole } = useDashboard();

  return <SitesPage apiFetch={apiFetch} authRole={authRole} onOpenLayout={(site) => router.push(`/layout/${site.id}`)} />;
}
