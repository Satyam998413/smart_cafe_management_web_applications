'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import Header from '@/components/Header';
import NavLinks from '@/components/NavLinks';
import NotificationBanner from '@/components/NotificationBanner';
import LoginPage from '@/features/auth/LoginPage';
import { DashboardContext } from '@/features/dashboard/DashboardContext';
import { useDashboardState } from '@/features/dashboard/useDashboardState';
import { springs } from '@/lib/motionTokens';

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
    if (!authRole) return;
    const gate = ROLE_GATES.find((g) => pathname === g.prefix || pathname.startsWith(`${g.prefix}/`));
    if (gate && !gate.roles.includes(authRole)) {
      router.replace('/orders');
    }
  }, [pathname, authRole, router]);

  if (authToken === undefined) return null;
  if (!authToken) return <LoginPage onLoginSuccess={handleLoginSuccess} />;

  return (
    <DashboardContext.Provider value={state}>
      <div className="app-root">
        <Header connected={connected} authName={authName} authRole={authRole} onLogout={clearAuth} />

        <main className="dashboard-container">
          <NotificationBanner apiFetch={apiFetch} authRole={authRole} socket={socket} onNavigateToWallet={() => router.push('/wallet')} />
          <NavLinks authRole={authRole} />

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
    </DashboardContext.Provider>
  );
}
