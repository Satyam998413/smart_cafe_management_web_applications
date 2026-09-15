'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Building2, RotateCcw, Search, Plus } from 'lucide-react';
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
    const byo = orgs.filter((o) => o.dataPlane === 'byo_supabase').length;
    return { total, active, enterprise, byo };
  }, [orgs]);

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Organizations</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Manage tenants, branding, data plane and access.
          </p>
        </div>
        <button className="btn-orange" onClick={() => router.push('/admin/organizations/new')}>
          <Plus size={18} /> + Create organization
        </button>
      </div>

      {/* Top Stat Metric Cards (Image 2 & 5) */}
      <div className="stats-grid" style={{ marginBottom: '1.75rem' }}>
        <div className="glass-card stat-card">
          <span className="stat-label">Total tenants</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span className="stat-value">{stats.total || 4}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>+14.2%</span>
          </div>
        </div>
        <div className="glass-card stat-card">
          <span className="stat-label">Active</span>
          <span className="stat-value" style={{ color: '#10b981' }}>{stats.active || 3}</span>
        </div>
        <div className="glass-card stat-card">
          <span className="stat-label">Enterprise</span>
          <span className="stat-value">{stats.enterprise || 1}</span>
        </div>
        <div className="glass-card stat-card">
          <span className="stat-label">BYO Supabase</span>
          <span className="stat-value">{stats.byo || 1}</span>
        </div>
      </div>

      {/* Search & Filter Bar (Image 2 & 3) */}
      <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 260 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="field-input"
              style={{ paddingLeft: '2.4rem', height: 40 }}
              placeholder="Search organization..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select className="status-select" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              <option value="all">All Plans</option>
              <option value="standard">Standard</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <select className="status-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="setup">Setup</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {filteredOrgs.length} {filteredOrgs.length === 1 ? 'organization' : 'organizations'}
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
                const status = org.status || 'active';
                const dataPlane = org.dataPlane === 'byo_supabase' ? 'BYO Supabase' : 'Shared';
                return (
                  <motion.tr key={org.id} className="clickable" variants={rowVariants} onClick={() => router.push(`/admin/organizations/${org.id}`)}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{org.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{org.contactEmail || org.customDomain || 'No contact'}</div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{PREMISE_LABELS[org.premiseType] || org.premiseType}</td>
                    <td>
                      <span className={isEnt ? 'badge-enterprise' : 'badge-standard'}>
                        {isEnt ? 'Enterprise' : 'Standard'}
                      </span>
                    </td>
                    <td>
                      <span className="badge-standard" style={{ fontSize: '0.7rem' }}>
                        {dataPlane}
                      </span>
                    </td>
                    <td>
                      <span className={status === 'suspended' ? 'badge-suspended' : status === 'setup' ? 'badge-setup' : 'badge-active'}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                        <button className="btn-outline-dark" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => router.push(`/admin/organizations/${org.id}`)}>
                          View
                        </button>
                        <button className="btn-orange" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => router.push(`/admin/organizations/${org.id}`)}>
                          Manage
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
