'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import Header from '@/components/Header';
import NavLinks from '@/components/NavLinks';
import NotificationBanner from '@/components/NotificationBanner';
import { DashboardContext } from '@/features/dashboard/DashboardContext';
import { useDashboardState } from '@/features/dashboard/useDashboardState';
import { springs } from '@/lib/motionTokens';
import { applyAppTheme } from '@/lib/themeManager';

// Route-scoped role gates — a customer hitting /staff (or a staff member
// hitting /smart-ai) directly by URL gets bounced to /orders instead of
// silently rendering nothing, which is what the old activeTab-guard version
// of this check did. No entry here means "any authenticated role."
const ROLE_GATES = [
  { prefix: '/sites', roles: ['owner', 'manager'] },
  { prefix: '/layout', roles: ['owner', 'manager'] },
  { prefix: '/staff', roles: ['owner', 'manager'] },
  { prefix: '/cash-bills', roles: ['owner', 'manager'] },
  { prefix: '/devices', roles: ['owner', 'manager'] },
  { prefix: '/delivery', roles: ['owner', 'manager'] },
  { prefix: '/wallet', roles: ['owner', 'manager'] },
  { prefix: '/rooms', roles: ['owner', 'manager'] },
  { prefix: '/bookings', roles: ['owner', 'manager'] },
  { prefix: '/cart', roles: ['customer'] },
  { prefix: '/billing', roles: ['customer'] },
  { prefix: '/smart-ai', roles: ['customer'] },
  { prefix: '/team', roles: ['owner', 'manager', 'cook', 'waiter'] }
];

// The routed replacement for the old src/app/page.js tab-switching shell —
// every route under this group (src/app/(dashboard)/**) shares this one
// layout, which owns auth/socket/cart/orders/menu state (useDashboardState)
// and exposes it via DashboardContext, mirroring src/app/admin/layout.js's
// AdminContext pattern.
export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const state = useDashboardState();
  const { authToken, authRole, authName, connected, apiFetch, socket, clearAuth, handleLoginSuccess } = state;

  useEffect(() => {
    if (authToken === '') {
      router.replace('/login');
      return;
    }
    if (!authRole) return;
    const gate = ROLE_GATES.find((g) => pathname === g.prefix || pathname.startsWith(`${g.prefix}/`));
    if (gate && !gate.roles.includes(authRole)) {
      router.replace('/orders');
    }
  }, [pathname, authToken, authRole, router]);

  // Org premise type — fetched once here (rather than in useDashboardState,
  // which every route already depends on) purely so NavLinks can hide the
  // Rooms nav entry for a non-hotel org. Not the actual gate: Rooms' own
  // page component independently re-checks GET /api/organizations/me before
  // rendering anything, same as every other owner/manager-only surface in
  // this app that also enforces its rule server-side.
  const [premiseType, setPremiseType] = useState(null);
  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    apiFetch('/organizations/me')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data) {
          if (data.premiseType) setPremiseType(data.premiseType);
          if (data.theme) {
            const isDark = localStorage.getItem('app_theme') !== 'light';
            applyAppTheme(data.theme, isDark);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  if (authToken === undefined || !authToken) return null;

  return (
    <DashboardContext.Provider value={state}>
      <div className="app-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header connected={connected} authName={authName} authRole={authRole} onLogout={clearAuth} />

        <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
          {/* Flush Vertical Left Navigation Sidebar attached to top Header */}
          <aside
            className="main-nav-sidebar"
            style={{
              width: 240,
              flexShrink: 0,
              position: 'sticky',
              top: 65,
              height: 'calc(100vh - 65px)',
              background: 'var(--bg-surface)',
              borderRight: '1px solid var(--border)',
              padding: '1.25rem 0.85rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              zIndex: 40
            }}
          >
            <NavLinks authRole={authRole} premiseType={premiseType} />
          </aside>

          {/* Main Dashboard Workspace */}
          <main
            className="dashboard-container"
            style={{
              flex: 1,
              minWidth: 0,
              padding: '1.5rem 2rem',
              maxWidth: 'none',
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}
          >
            <NotificationBanner apiFetch={apiFetch} authRole={authRole} socket={socket} onNavigateToWallet={() => router.push('/wallet')} />

            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }}
                transition={springs.page}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </DashboardContext.Provider>
  );
}

