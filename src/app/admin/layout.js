'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Building2, Coins, LogOut, Megaphone, Menu, ShieldCheck, Sparkles, Ticket, X, User } from 'lucide-react';
import { createAdminApiFetch } from '@/lib/adminApiClient';
import { AdminContext } from '@/features/admin/AdminContext';
import AdminLoginPage from '@/features/admin/AdminLoginPage';

const NAV_ITEMS = [
  { href: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { href: '/admin/coin-plans', label: 'Coin Plans', icon: Coins },
  { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { href: '/admin/offers', label: 'Offers', icon: Megaphone },
  { href: '/admin/ai-configuration', label: 'AI Configuration', icon: Sparkles },
  { href: '/admin/activity', label: 'Activity', icon: Activity }
];

import ThemeToggle from '@/components/ThemeToggle';

export default function AdminLayout({ children }) {
  const [token, setToken] = useState(undefined);
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const storedToken = localStorage.getItem('admin_token') || '';
    const storedRole = localStorage.getItem('admin_role') || '';
    if (storedToken && storedRole === 'master_admin') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(storedToken);
      setUser({ name: localStorage.getItem('admin_name') || 'Alex Mercer', id: localStorage.getItem('admin_user_id') || '' });
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
    localStorage.setItem('admin_name', loggedInUser.name || 'Alex Mercer');
    localStorage.setItem('admin_user_id', loggedInUser.id || '');
    setToken(newToken);
    setUser({ name: loggedInUser.name || 'Alex Mercer', id: loggedInUser.id });
  };

  if (token === undefined) return null;
  if (!token) return <AdminLoginPage onLoginSuccess={handleLoginSuccess} />;

  const apiFetch = createAdminApiFetch(logout);

  return (
    <AdminContext.Provider value={{ apiFetch, user, logout }}>
      <div className="admin-shell">
        <motion.aside
          className={`admin-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.5rem 1.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 0 16px rgba(99, 102, 241, 0.4)' }}>
              <Building2 size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.5px', color: '#fff' }}>PREMISE.IO</div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>MASTER CONSOLE</div>
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`admin-sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon size={18} strokeWidth={2} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #38bdf8, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
                {user?.name ? user.name.charAt(0) : 'A'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{user?.name || 'Alex Mercer'}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Platform Admin</span>
              </div>
            </div>
            <button
              onClick={logout}
              title="Log out"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px', transition: 'color 0.15s ease' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </motion.aside>

        <div className="admin-content">
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div className="system-status-pill">
              <span className="dot" style={{ background: '#10b981' }} />
              ALL SYSTEM RUNNING STABLE
            </div>
            <ThemeToggle />
          </div>
          <div className="admin-content-inner">{children}</div>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
