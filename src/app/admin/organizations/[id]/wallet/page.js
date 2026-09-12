'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, RotateCcw } from 'lucide-react';
import { useOrgDetail } from '@/features/admin/OrgDetailContext';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

const TX_LABELS = {
  signup_grant: 'Signup grant',
  order_debit: 'Order debit',
  recharge_credit: 'Recharge credit',
  coupon_bonus: 'Coupon bonus',
  offer_bonus: 'Offer bonus',
  admin_adjustment: 'Admin adjustment'
};

// This org's wallet balance + transaction ledger, read-only (plan Phase
// 1e) — mirrors GET /api/wallet's shape (the tenant-facing Owner/Manager
// dashboard route), scoped by this org's id instead of the caller's own.
export default function OrgWalletPage() {
  const { org, apiFetch } = useOrgDetail();
  const [wallet, setWallet] = useState(undefined); // undefined = loading, null = no wallet yet
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/wallet`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not load this wallet.');
        return;
      }
      setWallet(data);
    } catch (e) {
      console.error('Failed to load organization wallet:', e);
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

  const transactions = wallet?.recentTransactions || [];

  return (
    <div>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '2rem' }}>
            <Skeleton width="30%" height="2rem" />
          </div>
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <Skeleton width="20%" height="1rem" />
                <Skeleton width="20%" height="1rem" />
                <Skeleton width="20%" height="1rem" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--status-cancelled)' }}>{error}</span>
          <Button variant="secondary" onClick={load}>
            <RotateCcw size={15} /> Retry
          </Button>
        </div>
      ) : !wallet ? (
        <div
          className="glass-card"
          style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}
        >
          <Wallet size={32} strokeWidth={1.5} />
          This organization has no wallet yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span className="field-label">Balance</span>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', color: 'var(--text-primary)' }}>{wallet.balanceCoins} coins</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="field-label">Low-balance threshold</span>
              <div style={{ color: 'var(--text-secondary)' }}>{wallet.lowBalanceThreshold} coins</div>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div
              className="glass-card"
              style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}
            >
              <Wallet size={28} strokeWidth={1.5} />
              No wallet transactions yet.
            </div>
          ) : (
            <motion.div className="glass-card" style={{ overflow: 'hidden' }} variants={listVariants} initial="hidden" animate="show">
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Balance after</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <motion.tr key={tx.id} variants={rowVariants}>
                        <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(tx.createdAt).toLocaleString()}</td>
                        <td>
                          <span className="role-badge role-manager">{TX_LABELS[tx.type] || tx.type}</span>
                        </td>
                        <td style={{ color: tx.amount < 0 ? 'var(--status-cancelled)' : '#059669', fontWeight: 600 }}>
                          {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                        </td>
                        <td>{tx.balanceAfter}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {tx.referenceType ? `${tx.referenceType} · ${tx.referenceId}` : '—'}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
