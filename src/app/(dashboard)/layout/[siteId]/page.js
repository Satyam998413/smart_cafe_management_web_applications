'use client';

import { useParams } from 'next/navigation';
import { useDashboard } from '@/features/dashboard/DashboardContext';
import LayoutBuilderPage from '@/features/layout-builder/LayoutBuilderPage';

// Reached from SitesPage's "Layout" button (src/app/(dashboard)/sites/page.js
// pushes here with the chosen site's id) — the siteId route param replaces
// the old layoutSiteId hand-off state that used to live on Home.
export default function LayoutBuilderForSiteRoute() {
  const { siteId } = useParams();
  const { apiFetch, authRole } = useDashboard();

  return <LayoutBuilderPage apiFetch={apiFetch} authRole={authRole} initialSiteId={siteId} />;
}
