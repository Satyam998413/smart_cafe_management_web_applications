'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { History, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useOrgDetail } from '@/features/admin/OrgDetailContext';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

const PAGE_SIZE = 20;

// This org's plan-tier / subscription history (plan Phase 1e) — audit_log
// filtered to action=plan_tier_changed, the entry PATCH
// /api/admin/organizations/[id] writes whenever planTier changes (see
// src/app/api/admin/organizations/[id]/route.js).
export default function OrgHistoryPage() {
  const { org, apiFetch } = useOrgDetail();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = async (targetPage = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ orgId: org.id, action: 'plan_tier_changed', page: String(targetPage), limit: String(PAGE_SIZE) });
      const res = await apiFetch(`/admin/audit-log?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not load the plan history.');
        return;
      }
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setTotalPages(data.totalPages || 1);
      setPage(data.currentPage || targetPage);
    } catch (e) {
      console.error('Failed to load plan history:', e);
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id]);

  return (
    <div>
      {loading ? (
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Skeleton width="24%" height="1rem" />
              <Skeleton width="30%" height="1rem" />
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
          <History size={32} strokeWidth={1.5} />
          No plan-tier changes recorded for this organization.
        </div>
      ) : (
        <>
          <motion.div className="glass-card" style={{ overflow: 'hidden' }} variants={listVariants} initial="hidden" animate="show">
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Changed by</th>
                    <th>New plan tier</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <motion.tr key={entry.id} variants={rowVariants}>
                      <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(entry.createdAt).toLocaleString()}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {entry.actorRole}
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{entry.actorId}</div>
                      </td>
                      <td>
                        <span className="role-badge role-manager">{entry.metadata?.planTier || '—'}</span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {totalPages > 1 && (
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
          )}
        </>
      )}
    </div>
  );
}
