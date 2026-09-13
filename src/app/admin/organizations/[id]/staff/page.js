'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, RotateCcw, MapPin, ShieldCheck } from 'lucide-react';
import { useOrgDetail } from '@/features/admin/OrgDetailContext';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

// This org's staff roster (owner/manager/cook/waiter), read-only (plan's
// "visibility/support tool, not a duplicate management surface" — Owners
// still manage their own org's staff via the tenant-side Staff page).
// Mirrors the Wallet/Security Log tabs' structure: same OrgDetailContext,
// same Skeleton/empty/error/retry conventions, one GET on mount.
export default function OrgStaffPage() {
  const { org, apiFetch } = useOrgDetail();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/staff`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not load this organization\'s staff.');
        return;
      }
      setStaff(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load organization staff:', e);
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id]);

  return (
    <div>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card staff-row">
              <Skeleton width={40} height={40} radius="50%" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <Skeleton width="30%" height="0.9rem" />
                <Skeleton width="45%" height="0.75rem" />
              </div>
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
      ) : staff.length === 0 ? (
        <div
          className="glass-card"
          style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}
        >
          <Users size={32} strokeWidth={1.5} />
          No staff accounts in this organization yet.
        </div>
      ) : (
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} variants={listVariants} initial="hidden" animate="show">
          {staff.map((person) => (
            <motion.div key={person.id} className="glass-card staff-row" variants={rowVariants}>
              <div className="staff-avatar">{(person.name || '?')[0].toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{person.name}</strong>
                  <span className={`role-badge role-${person.role}`}>{person.role}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{person.email || person.phone || 'No contact on file'}</div>
                {person.spaceId && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                    <MapPin size={11} /> Assigned to a space
                  </div>
                )}
              </div>
              {person.role === 'manager' && (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 220 }}>
                  <PermissionPill label="Password reset" granted={Boolean(person.permissions?.canResetStaffPassword)} />
                  <PermissionPill label="IoT control" granted={Boolean(person.permissions?.canControlIot)} />
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// Read-only summary of a Manager's owner-granted flags — this page never
// writes them (that stays on the tenant-side Staff page's Owner-only
// toggles); Master Admin only needs to see what's already been delegated.
function PermissionPill({ label, granted }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.2rem 0.55rem',
        borderRadius: 'var(--radius-full)',
        fontSize: '0.7rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        background: granted ? 'rgba(5, 150, 105, 0.12)' : 'var(--bg-surface-elevated)',
        color: granted ? '#047857' : 'var(--text-muted)',
        border: `1px solid ${granted ? 'rgba(5, 150, 105, 0.3)' : 'var(--border)'}`
      }}
    >
      {granted && <ShieldCheck size={11} />}
      {label}
    </span>
  );
}
