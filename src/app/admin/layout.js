'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Building2, LogOut, ShieldCheck } from 'lucide-react';
import { createAdminApiFetch } from '@/lib/adminApiClient';
import { AdminContext } from '@/features/admin/AdminContext';
import AdminLoginPage from '@/features/admin/AdminLoginPage';

const NAV_ITEMS = [{ href: '/admin/organizations', label: 'Organizations', icon: Building2 }];

// Root of the Master Admin console (plan Phase 1a) — a separate,
// route-based section from the tab-switching customer/staff dashboard
// shell in src/app/page.js. Gated on its own 'admin_token'/'admin_role'
// localStorage pair (see lib/adminApiClient.js) so a Master Admin session
// doesn't collide with a staff/customer one open in another tab.
export default function AdminLayout({ children }) {
  // undefined = "haven't checked localStorage yet" (avoids a login-page
  // flash on refresh while a valid session is still being read).
  const [token, setToken] = useState(undefined);
  const [user, setUser] = useState(null);
  const pathname = usePathname();

  useEffect(() => {
    const storedToken = localStorage.getItem('admin_token') || '';
    const storedRole = localStorage.getItem('admin_role') || '';
    if (storedToken && storedRole === 'master_admin') {
      setToken(storedToken);
      setUser({ name: localStorage.getItem('admin_name') || '', id: localStorage.getItem('admin_user_id') || '' });
    } else {
      setToken('');
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_role');
    localStorage.removeItem('admin_name');
    localStorage.removeItem('admin_user_id');
    setToken('');
    setUser(null);
  };

  const handleLoginSuccess = (newToken, loggedInUser) => {
    localStorage.setItem('admin_token', newToken);
    localStorage.setItem('admin_role', loggedInUser.role);
    localStorage.setItem('admin_name', loggedInUser.name || '');
    localStorage.setItem('admin_user_id', loggedInUser.id || '');
    setToken(newToken);
    setUser({ name: loggedInUser.name, id: loggedInUser.id });
  };

  if (token === undefined) return null;
  if (!token) return <AdminLoginPage onLoginSuccess={handleLoginSuccess} />;

  const apiFetch = createAdminApiFetch(logout);

  return (
    <AdminContext.Provider value={{ apiFetch, user, logout }}>
      <div className="admin-shell">
        <motion.aside className="admin-sidebar" initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem 1.5rem' }}>
            <ShieldCheck size={22} color="var(--accent-primary)" />
            <span className="brand-title" style={{ fontSize: '1.05rem' }}>
              Master Admin
            </span>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link key={href} href={href} className={`admin-sidebar-link ${isActive ? 'active' : ''}`}>
                  <Icon size={17} strokeWidth={2} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {user?.name && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0 0.75rem' }}>Signed in as {user.name}</span>
            )}
            <button className="admin-sidebar-link" style={{ border: 'none', width: '100%', cursor: 'pointer' }} onClick={logout}>
              <LogOut size={17} strokeWidth={2} />
              Log out
            </button>
          </div>
        </motion.aside>

        <div className="admin-content">
          <div className="admin-content-inner">{children}</div>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
