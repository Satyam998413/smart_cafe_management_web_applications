'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useAdmin } from '@/features/admin/AdminContext';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

const PAGE_SIZE = 20;

// Global, unfiltered (unless the admin narrows it) audit_log feed (plan
// Phase 1e) — the read side of src/lib/auditLog.js's write-only
// logAudit(). Every mutating admin route in this app writes here; before
// this page existed none of it was ever visible again. Filter inputs are
// free-text (org id, action) rather than a fixed dropdown since action
// values are an open-ended, code-defined set (see auditLog.js call sites),
// not a DB-enumerated list this page could fetch options for.
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = (e) => {
    e.preventDefault();
    load(1);
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text-primary)' }}>Activity</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Every logged admin action across the platform.
          </p>
        </div>
      </div>

      <form onSubmit={applyFilters} className="glass-card" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div style={{ flex: '1 1 200px' }}>
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
        <div style={{ flex: '1 1 200px' }}>
          <label className="field-label" htmlFor="act-action">
            Action
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
        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
      </form>

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
        <>
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
                        <span className="role-badge role-manager">{entry.action}</span>
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

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.25rem' }}>
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>
              <ChevronLeft size={15} /> Prev
            </Button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Page {page} of {totalPages}
            </span>
            <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>
              Next <ChevronRight size={15} />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
