'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Building2,
  Coins,
  LogOut,
  Megaphone,
  Menu,
  ShieldCheck,
  Sparkles,
  Ticket,
  X,
  User,
  ArrowLeft,
  Palette
} from 'lucide-react';
import { createAdminApiFetch } from '@/lib/adminApiClient';
import { AdminContext } from '@/features/admin/AdminContext';
import ThemeToggle from '@/components/ThemeToggle';
import AdminThemeSettings from '@/features/admin/AdminThemeSettings';

const NAV_ITEMS = [
  { href: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { href: '/admin/coin-plans', label: 'Coin Plans', icon: Coins },
  { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { href: '/admin/offers', label: 'Offers', icon: Megaphone },
  { href: '/admin/ai-configuration', label: 'AI Configuration', icon: Sparkles },
  { href: '/admin/activity', label: 'Activity', icon: Activity },
  { href: '/admin/theme', label: 'Theme Settings', icon: Palette }
];

const getPageHeaderInfo = (pathname) => {
  if (pathname === '/admin/theme') {
    return { title: 'Theme & Fonts Settings', subtitle: 'Platform Google fonts, typography scaling & color palette presets', backHref: null };
  }
  if (pathname === '/admin/organizations/new') {
    return { title: 'Onboard Organization', subtitle: 'Provision a new tenant and grant starter wallet', backHref: '/admin/organizations' };
  }
  if (pathname.startsWith('/admin/organizations/')) {
    return null;
  }
  if (pathname.startsWith('/admin/organizations')) {
    return { title: 'Organizations', subtitle: 'Manage tenants, branding, data plane and access', backHref: null };
  }
  if (pathname.startsWith('/admin/coin-plans')) {
    return { title: 'Coin Plans', subtitle: 'Recharge catalog for coin purchases', backHref: null };
  }
  if (pathname.startsWith('/admin/coupons')) {
    return { title: 'Coupons', subtitle: 'Discount codes for bill checkout or coin recharges', backHref: null };
  }
  if (pathname.startsWith('/admin/offers')) {
    return { title: 'Offers', subtitle: 'Platform-wide promotional campaigns & coin bonuses', backHref: null };
  }
  if (pathname.startsWith('/admin/ai-configuration')) {
    return { title: 'Master AI Configuration', subtitle: 'Platform fallback LLM & voice provider credentials', backHref: null };
  }
  if (pathname.startsWith('/admin/activity')) {
    return { title: 'System Activity', subtitle: 'Audit log of admin actions across all tenants', backHref: null };
  }
  return { title: 'Admin Console', subtitle: 'Master Management Console', backHref: null };
};

export default function AdminLayout({ children }) {
  const [token, setToken] = useState(undefined);
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === '/admin/login') return;
    const storedToken = localStorage.getItem('admin_token') || '';
    const storedRole = localStorage.getItem('admin_role') || '';

    if (storedToken && storedRole === 'master_admin') {
      setToken(storedToken);
      setUser({ name: localStorage.getItem('admin_name') || 'Alex Mercer', id: localStorage.getItem('admin_user_id') || '' });
    } else {
      setToken('');
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_role');
      localStorage.removeItem('admin_name');
      localStorage.removeItem('admin_user_id');
      router.replace('/admin/login');
    }
  }, [pathname, router]);

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_role');
    localStorage.removeItem('admin_name');
    localStorage.removeItem('admin_user_id');
    setToken('');
    setUser(null);
    router.replace('/admin/login');
  };

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (token === undefined || !token) return null;

  const apiFetch = createAdminApiFetch(logout);
  const pageInfo = getPageHeaderInfo(pathname);

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
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-on-accent)', boxShadow: 'var(--shadow-accent)' }}>
              <Building2 size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.5px', color: 'var(--text-primary)' }}>PREMISE.IO</div>
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
          {/* Top Header Bar with Title, Subtitle, optional Back Button on Left */}
          {pageInfo && (
            <div
              className="glass-card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1.5rem',
                padding: '1.25rem 1.75rem',
                marginBottom: '2rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {pageInfo.backHref && (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => router.push(pageInfo.backHref)}
                    title="Go back"
                    style={{ width: 38, height: 38, background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}
                  >
                    <ArrowLeft size={18} />
                  </button>
                )}
                <div>
                  <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                    {pageInfo.title}
                  </h1>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    {pageInfo.subtitle}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="system-status-pill" style={{ padding: '0.4rem 0.85rem' }}>
                  <span className="dot" style={{ background: '#10b981' }} />
                  ALL SYSTEM RUNNING STABLE
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', borderLeft: '1px solid var(--border)', paddingLeft: '1rem' }}>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          )}

          <div className="admin-content-inner">{children}</div>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
