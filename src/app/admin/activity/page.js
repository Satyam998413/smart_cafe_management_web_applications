'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, ChevronLeft, ChevronRight, RotateCcw, Filter } from 'lucide-react';
import { useAdmin } from '@/features/admin/AdminContext';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

const PAGE_SIZE = 20;

export default function ActivityPage() {
  const { apiFetch } = useAdmin();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [orgIdFilter, setOrgIdFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const load = async (targetPage = page) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(targetPage), limit: String(PAGE_SIZE) });
      if (orgIdFilter.trim()) params.set('orgId', orgIdFilter.trim());
      if (actionFilter.trim()) params.set('action', actionFilter.trim());
      const res = await apiFetch(`/admin/audit-log?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not load the activity feed.');
        return;
      }
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setTotalPages(data.totalPages || 1);
      setPage(data.currentPage || targetPage);
    } catch (e) {
      console.error('Failed to load activity feed:', e);
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = (e) => {
    e.preventDefault();
    load(1);
  };

  return (
    <div style={{ display: 'flex', gap: '1.5rem', width: '100%', alignItems: 'flex-start' }}>
      {/* 300px Left Filter & Controls Sidebar */}
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
          gap: '1.25rem'
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>System Activity</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
            Audit log of admin actions across all tenants.
          </p>
        </div>

        <form onSubmit={applyFilters} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="field-label" htmlFor="act-org">
              Organization ID
            </label>
            <input
              id="act-org"
              type="text"
              className="field-input"
              placeholder="Filter by org id…"
              value={orgIdFilter}
              onChange={(e) => setOrgIdFilter(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="act-action">
              Action Type
            </label>
            <input
              id="act-action"
              type="text"
              className="field-input"
              placeholder="e.g. plan_tier_changed"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            />
          </div>

          <Button type="submit" variant="primary" fullWidth>
            <Filter size={15} /> Apply filters
          </Button>
        </form>

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
            Pagination Status
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Current Page</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{page} / {totalPages}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <Button variant="ghost" size="sm" fullWidth disabled={page <= 1} onClick={() => load(page - 1)}>
              <ChevronLeft size={14} /> Prev
            </Button>
            <Button variant="ghost" size="sm" fullWidth disabled={page >= totalPages} onClick={() => load(page + 1)}>
              Next <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </div>

      {/* Right Main Content Panel */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {loading ? (
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <Skeleton width="16%" height="1rem" />
                <Skeleton width="20%" height="1rem" />
                <Skeleton width="20%" height="1rem" />
                <Skeleton width="30%" height="1rem" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: 'var(--status-cancelled)' }}>{error}</span>
            <Button variant="secondary" onClick={() => load(page)}>
              <RotateCcw size={15} /> Retry
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div
            className="glass-card"
            style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}
          >
            <Activity size={32} strokeWidth={1.5} />
            No activity recorded {orgIdFilter || actionFilter ? 'for this filter' : 'yet'}.
          </div>
        ) : (
          <motion.div className="glass-card" style={{ overflow: 'hidden' }} variants={listVariants} initial="hidden" animate="show">
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Target</th>
                    <th>Org</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <motion.tr key={entry.id} variants={rowVariants}>
                      <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(entry.createdAt).toLocaleString()}</td>
                      <td>
                        <span className="status-badge available">{entry.action}</span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {entry.actorRole}
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{entry.actorId}</div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {entry.targetType || '—'}
                        {entry.targetId && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{entry.targetId}</div>}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{entry.orgId || '—'}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
