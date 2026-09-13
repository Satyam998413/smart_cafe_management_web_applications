'use client';

import { useDashboard } from '@/features/dashboard/DashboardContext';
import LayoutBuilderPage from '@/features/layout-builder/LayoutBuilderPage';

// Route folder named "layout" (a URL segment) — unrelated to the special
// layout.js FILE that lives one level up (src/app/(dashboard)/layout.js).
// No siteId param here; LayoutBuilderPage's own loadSites() already falls
// back to the org's first site when initialSiteId is undefined.
export default function LayoutBuilderRoute() {
  const { apiFetch, authRole } = useDashboard();

  return <LayoutBuilderPage apiFetch={apiFetch} authRole={authRole} initialSiteId={undefined} />;
}
