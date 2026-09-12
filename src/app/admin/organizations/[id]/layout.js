'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useAdmin } from '@/features/admin/AdminContext';
import { OrgDetailContext } from '@/features/admin/OrgDetailContext';
import { Skeleton } from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';

const TABS = [
  { path: '', label: 'Overview' },
  { path: '/domain', label: 'Domain' },
  { path: '/ai', label: 'AI Credentials' },
  { path: '/data-plane', label: 'Data Plane' },
  { path: '/wallet', label: 'Wallet' },
  { path: '/history', label: 'Plan History' },
  { path: '/security-log', label: 'Security Log' }
];

// Fetches the org once (plan Phase 1a's tenant detail routes) and shares it
// with whichever sub-tab is active via OrgDetailContext, rather than each
// of Overview/Domain/AI/Data-plane independently re-fetching the same row.
export default function OrgDetailLayout({ children }) {
  const { apiFetch } = useAdmin();
  const { id } = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/admin/organizations/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not load this organization.');
        return;
      }
      setOrg(data);
    } catch (e) {
      console.error('Failed to load organization:', e);
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const basePath = `/admin/organizations/${id}`;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Skeleton width="30%" height="1.6rem" />
        <Skeleton width="100%" height="10rem" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
        <span style={{ color: 'var(--status-cancelled)' }}>{error || 'Organization not found.'}</span>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="secondary" onClick={load}>
            Retry
          </Button>
          <Button variant="ghost" onClick={() => router.push('/admin/organizations')}>
            Back to list
          </Button>
        </div>
      </div>
    );
  }

  return (
    <OrgDetailContext.Provider value={{ org, apiFetch, reload: load }}>
      <div>
        <div className="admin-page-header">
          <div>
            <button type="button" className="text-link" style={{ marginBottom: '0.5rem' }} onClick={() => router.push('/admin/organizations')}>
              ← All organizations
            </button>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text-primary)' }}>{org.name}</h1>
          </div>
        </div>

        <nav className="admin-subtabs">
          {TABS.map((tab) => {
            const href = `${basePath}${tab.path}`;
            const isActive = pathname === href;
            return (
              <Link key={tab.path} href={href} className={`admin-subtab ${isActive ? 'active' : ''}`}>
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </OrgDetailContext.Provider>
  );
}
