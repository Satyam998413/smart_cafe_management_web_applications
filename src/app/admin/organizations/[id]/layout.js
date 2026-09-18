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
  Server,
  Palette
} from 'lucide-react';
import { useAdmin } from '@/features/admin/AdminContext';
import { OrgDetailContext } from '@/features/admin/OrgDetailContext';
import { Skeleton } from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';
import ThemeToggle from '@/components/ThemeToggle';
import { Sliders } from 'lucide-react';

const TABS = [
  { path: '', label: 'Overview', desc: 'Org summary & details', icon: Building2, step: '01' },
  { path: '/services', label: 'Services & Flags', desc: 'IoT, locks & POS features', icon: Sliders, step: '02' },
  { path: '/domain', label: 'Custom Domain', desc: 'Domain & SSL routing', icon: Globe, step: '03' },
  { path: '/ai', label: 'AI Credentials', desc: 'LLM & voice provider keys', icon: Sparkles, step: '04' },
  { path: '/theme', label: 'Theme & Fonts', desc: 'Custom fonts, scaling & palette', icon: Palette, step: '05' },
  { path: '/data-plane', label: 'Data Plane', desc: 'Shared DB or BYO Supabase', icon: Database, step: '06' },
  { path: '/layout-devices', label: 'Layout & Devices', desc: 'Spaces & IoT controller', icon: Cpu, step: '07' },
  { path: '/wallet', label: 'Wallet & Coins', desc: 'Credits & coin plan', icon: Wallet, step: '08' },
  { path: '/staff', label: 'Staff Roster', desc: 'User accounts & permissions', icon: Users, step: '09' },
  { path: '/history', label: 'Plan History', desc: 'Subscriptions & audits', icon: History, step: '10' },
  { path: '/security-log', label: 'Security Log', desc: 'Access logs & auth events', icon: ShieldAlert, step: '11' }
];

export default function OrgDetailLayout({ children }) {
  const { apiFetch } = useAdmin();
  const { id } = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent && !org) setLoading(true);
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
  }, [id, apiFetch, org]);

  useEffect(() => {
    if (!org || org.id !== id) {
      load(false);
    }
  }, [id, org, load]);

  const basePath = `/admin/organizations/${id}`;

  if (loading && !org) {
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
        {/* Left Organization Steps Navigation Sidebar (300px) */}
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

        {/* Right Active Sub-Page Workspace (Full Width 100%) */}
        <div style={{ flex: 1, width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Organization Top Banner Card with Org Name & 1st Card Details */}
          <div
            className="glass-card"
            style={{
              padding: '1.5rem 1.75rem',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1.5rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', minWidth: 0 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '1.25rem',
                  overflow: 'hidden',
                  flexShrink: 0,
                  boxShadow: 'var(--shadow-accent)'
                }}
              >
                {org.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.logoUrl} alt={org.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  org.name?.charAt(0) || 'O'
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0 }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {org.name}
                </h1>

                {/* 1st Card Details Badges (Premise, Plan, Data Plane, ID, Email) */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span className="status-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#0284c7', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>
                    {org.premiseType || 'general'}
                  </span>
                  <span className="status-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>
                    {org.planTier || 'standard'}
                  </span>
                  <span className="status-badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#7e22ce', fontSize: '0.72rem', fontWeight: 700 }}>
                    {org.dataPlaneType === 'byo_supabase' ? 'BYO Supabase' : 'Shared DB'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', background: 'var(--bg-surface-elevated)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    ID: {org.id}
                  </span>
                  {org.contactEmail && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      · {org.contactEmail}
                    </span>
                  )}
                  {org.customDomain && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                      · {org.customDomain}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
              <div className="system-status-pill" style={{ padding: '0.4rem 0.85rem' }}>
                <span className="dot" style={{ background: '#10b981' }} />
                ACTIVE TENANT
              </div>
              <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '0.75rem' }}>
                <ThemeToggle />
              </div>
            </div>
          </div>

          {/* Sub-Page Content */}
          <div style={{ width: '100%' }}>{children}</div>
        </div>
      </div>
    </OrgDetailContext.Provider>
  );
}
