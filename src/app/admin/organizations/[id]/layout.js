'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import {
  Building2,
  Globe,
  Sparkles,
  Database,
  Cpu,
  Wallet,
  Users,
  History,
  ShieldAlert,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  Server
} from 'lucide-react';
import { useAdmin } from '@/features/admin/AdminContext';
import { OrgDetailContext } from '@/features/admin/OrgDetailContext';
import { Skeleton } from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';

const TABS = [
  { path: '', label: 'Overview', desc: 'Org summary & details', icon: Building2, step: '01' },
  { path: '/domain', label: 'Custom Domain', desc: 'Domain & SSL routing', icon: Globe, step: '02' },
  { path: '/ai', label: 'AI Credentials', desc: 'LLM & voice provider keys', icon: Sparkles, step: '03' },
  { path: '/data-plane', label: 'Data Plane', desc: 'Shared DB or BYO Supabase', icon: Database, step: '04' },
  { path: '/layout-devices', label: 'Layout & Devices', desc: 'Spaces & IoT controller', icon: Cpu, step: '05' },
  { path: '/wallet', label: 'Wallet & Coins', desc: 'Credits & coin plan', icon: Wallet, step: '06' },
  { path: '/staff', label: 'Staff Roster', desc: 'User accounts & permissions', icon: Users, step: '07' },
  { path: '/history', label: 'Plan History', desc: 'Subscriptions & audits', icon: History, step: '08' },
  { path: '/security-log', label: 'Security Log', desc: 'Access logs & auth events', icon: ShieldAlert, step: '09' }
];

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
  }, [id, apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const basePath = `/admin/organizations/${id}`;

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: '1.5rem', width: '100%' }}>
        <div className="glass-card" style={{ width: 290, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Skeleton height="2rem" width="60%" />
          <Skeleton height="5rem" />
          <Skeleton height="12rem" />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Skeleton width="30%" height="2rem" />
          <Skeleton width="100%" height="16rem" />
        </div>
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

  const isTabActive = (tabPath) => {
    const targetHref = `${basePath}${tabPath}`;
    if (tabPath === '') return pathname === basePath || pathname === `${basePath}/`;
    return pathname === targetHref || pathname.startsWith(`${targetHref}/`);
  };

  return (
    <OrgDetailContext.Provider value={{ org, apiFetch, reload: load }}>
      <div style={{ display: 'flex', gap: '1.5rem', width: '100%', alignItems: 'flex-start' }}>
        {/* Left Organization Steps & Detail Sidebar (300px) */}
        <div
          className="glass-card"
          style={{
            width: 300,
            flexShrink: 0,
            position: 'sticky',
            top: '1.5rem',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            maxHeight: 'calc(100vh - 3rem)',
            overflowY: 'auto'
          }}
        >
          {/* Top Back Navigation */}
          <button
            type="button"
            className="text-link"
            onClick={() => router.push('/admin/organizations')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}
          >
            <ArrowLeft size={14} /> Back to Organizations
          </button>

          {/* Organization Summary Badge Card */}
          <div
            style={{
              padding: '1rem',
              background: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '1rem',
                  overflow: 'hidden'
                }}
              >
                {org.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.logoUrl} alt={org.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  org.name?.charAt(0) || 'O'
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {org.name}
                </h3>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID: {org.id?.slice(0, 12)}…</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.2rem' }}>
              <span className="status-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#0284c7', fontSize: '0.68rem', textTransform: 'uppercase' }}>
                {org.premiseType || 'general'}
              </span>
              <span className="status-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669', fontSize: '0.68rem', textTransform: 'uppercase' }}>
                {org.planTier || 'standard'}
              </span>
              <span className="status-badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#7e22ce', fontSize: '0.68rem' }}>
                {org.dataPlaneType === 'byo_supabase' ? 'BYO Supabase' : 'Shared DB'}
              </span>
            </div>
          </div>

          {/* Step-by-Step Navigation Menu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '0.25rem', paddingLeft: '0.35rem' }}>
              Organization Steps
            </div>

            {TABS.map((tab) => {
              const href = `${basePath}${tab.path}`;
              const active = isTabActive(tab.path);
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.path}
                  href={href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    textDecoration: 'none',
                    fontSize: '0.85rem',
                    fontWeight: active ? 700 : 500,
                    color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    background: active ? 'var(--bg-surface-elevated)' : 'transparent',
                    border: active ? '1px solid var(--accent-primary)' : '1px solid transparent',
                    boxShadow: active ? 'var(--shadow-accent)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 'var(--radius-sm)',
                      background: active ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)',
                      color: active ? '#fff' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Icon size={15} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.85rem', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tab.label}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '1px' }}>
                      {tab.desc}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '2px 5px',
                      borderRadius: '4px',
                      background: active ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)',
                      color: active ? '#fff' : 'var(--text-muted)'
                    }}
                  >
                    {tab.step}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right Active Sub-Page Content */}
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
    </OrgDetailContext.Provider>
  );
}
