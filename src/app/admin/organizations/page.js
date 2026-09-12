'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Building2, RotateCcw } from 'lucide-react';
import { useAdmin } from '@/features/admin/AdminContext';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

const PREMISE_LABELS = { cafe_restaurant: 'Cafe / Restaurant', company_office: 'Company / Office', hotel: 'Hotel' };

export default function OrganizationsListPage() {
  const { apiFetch } = useAdmin();
  const router = useRouter();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text-primary)' }}>Organizations</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Every tenant on the platform — cafes, restaurants, offices, and hotels.
          </p>
        </div>
        <Button variant="primary" onClick={() => router.push('/admin/organizations/new')}>
          + New organization
        </Button>
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
      ) : orgs.length === 0 ? (
        <div
          className="glass-card"
          style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}
        >
          <Building2 size={32} strokeWidth={1.5} />
          No organizations yet.
          <Button variant="primary" size="sm" onClick={() => router.push('/admin/organizations/new')}>
            Onboard the first one
          </Button>
        </div>
      ) : (
        <motion.div className="glass-card" style={{ overflow: 'hidden' }} variants={listVariants} initial="hidden" animate="show">
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Plan</th>
                  <th>Contact</th>
                  <th>Domain</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <motion.tr key={org.id} className="clickable" variants={rowVariants} onClick={() => router.push(`/admin/organizations/${org.id}`)}>
                    <td>
                      <strong>{org.name}</strong>
                    </td>
                    <td>{PREMISE_LABELS[org.premiseType] || org.premiseType}</td>
                    <td>
                      <span className={`role-badge ${org.planTier === 'enterprise' ? 'role-manager' : 'role-customer'}`}>{org.planTier}</span>
                    </td>
                    <td>{org.contactEmail}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{org.customDomain || '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{new Date(org.createdAt).toLocaleDateString()}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
