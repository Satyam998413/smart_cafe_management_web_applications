'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Building2, RotateCcw, Search, Plus, Filter, Layers } from 'lucide-react';
import { useAdmin } from '@/features/admin/AdminContext';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { rowVariants } from '@/components/ui/motionVariants';

const PREMISE_LABELS = { cafe_restaurant: 'Cafe / Restaurant', company_office: 'Company / Office', hotel: 'Hotel' };

export default function OrganizationsListPage() {
  const { apiFetch } = useAdmin();
  const router = useRouter();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/admin/organizations');
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not load organizations.');
        return;
      }
      setOrgs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load organizations:', e);
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredOrgs = useMemo(() => {
    return orgs.filter((org) => {
      const matchesSearch =
        !search ||
        org.name?.toLowerCase().includes(search.toLowerCase()) ||
        org.contactEmail?.toLowerCase().includes(search.toLowerCase()) ||
        org.customDomain?.toLowerCase().includes(search.toLowerCase());
      const matchesPlan = planFilter === 'all' || (org.planTier || 'standard').toLowerCase() === planFilter.toLowerCase();
      const matchesStatus = statusFilter === 'all' || (org.status || 'active').toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesPlan && matchesStatus;
    });
  }, [orgs, search, planFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = orgs.length;
    const active = orgs.filter((o) => (o.status || 'active') === 'active').length;
    const enterprise = orgs.filter((o) => o.planTier === 'enterprise').length;
    const byo = orgs.filter((o) => o.dataPlane === 'byo_supabase' || o.dataPlaneType === 'byo_supabase').length;
    return { total, active, enterprise, byo };
  }, [orgs]);

  return (
    <div style={{ display: 'flex', gap: '1.5rem', width: '100%', alignItems: 'flex-start' }}>
      {/* 300px Sticky Left Filter & Controls Sidebar */}
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
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Organizations
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
            Manage tenants, branding & data plane.
          </p>
        </div>

        {/* Action Button */}
        <button className="btn-orange" onClick={() => router.push('/admin/organizations/new')} style={{ justifyContent: 'center' }}>
          <Plus size={16} /> Create organization
        </button>

        {/* Stats Metrics Panel */}
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
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Tenant Metrics
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Tenants</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{stats.total}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Active</span>
            <span style={{ fontWeight: 700, color: '#10b981' }}>{stats.active}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Enterprise</span>
            <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{stats.enterprise}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>BYO Supabase</span>
            <span style={{ fontWeight: 700, color: '#a855f7' }}>{stats.byo}</span>
          </div>
        </div>

        {/* Search & Filters Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Search & Filter
          </div>

          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="field-input"
              style={{ paddingLeft: '2.2rem', height: 38, fontSize: '0.85rem' }}
              placeholder="Search tenant or domain…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>
              Plan Tier
            </label>
            <select className="field-input" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} style={{ padding: '0.45rem 0.65rem' }}>
              <option value="all">All Plans</option>
              <option value="standard">Standard</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>
              Account Status
            </label>
            <select className="field-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '0.45rem 0.65rem' }}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="setup">Setup</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Right Main Content (Table) */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Showing {filteredOrgs.length} of {orgs.length} organizations
          </span>
        </div>

        {loading ? (
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <Skeleton width="22%" height="1rem" />
                <Skeleton width="18%" height="1rem" />
                <Skeleton width="14%" height="1rem" />
                <Skeleton width="26%" height="1rem" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: 'var(--status-cancelled)' }}>{error}</span>
            <Button variant="secondary" onClick={load}>
              <RotateCcw size={15} /> Retry
            </Button>
          </div>
        ) : filteredOrgs.length === 0 ? (
          <div
            className="glass-card"
            style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}
          >
            <Building2 size={32} strokeWidth={1.5} />
            No organizations found matching criteria.
          </div>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Premise</th>
                  <th>Plan</th>
                  <th>Data Plane</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.map((org) => {
                  const isEnt = org.planTier === 'enterprise';
                  const dataPlane = org.dataPlane === 'byo_supabase' || org.dataPlaneType === 'byo_supabase' ? 'BYO Supabase' : 'Shared';
                  return (
                    <motion.tr key={org.id} variants={rowVariants} initial="hidden" animate="show">
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--bg-surface-elevated)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              overflow: 'hidden'
                            }}
                          >
                            {org.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={org.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              org.name?.charAt(0) || 'O'
                            )}
                          </div>
                          <div>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem', display: 'block' }}>{org.name}</strong>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{org.contactEmail}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {PREMISE_LABELS[org.premiseType] || org.premiseType}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${isEnt ? 'enterprise' : 'standard'}`}>
                          {isEnt ? 'Enterprise' : 'Standard'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {dataPlane}
                        </span>
                      </td>
                      <td>
                        <span className="status-badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                          {org.status || 'Active'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/organizations/${org.id}`)}>
                          Manage →
                        </Button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
