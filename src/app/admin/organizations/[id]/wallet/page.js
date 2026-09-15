'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, RotateCcw, PlusCircle, Check, Coins } from 'lucide-react';
import { useOrgDetail } from '@/features/admin/OrgDetailContext';
import { jsonBody } from '@/lib/apiClient';
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

const COIN_PRESETS = [100, 500, 1000, 5000];

export default function OrgWalletPage() {
  const { org, apiFetch } = useOrgDetail();
  const [wallet, setWallet] = useState(undefined); // undefined = loading, null = no wallet yet
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add Coins state
  const [showAddCoins, setShowAddCoins] = useState(false);
  const [amount, setAmount] = useState(500);
  const [note, setNote] = useState('Master Admin Direct Credit');
  const [crediting, setCrediting] = useState(false);
  const [creditError, setCreditError] = useState('');
  const [creditSuccess, setCreditSuccess] = useState('');

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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id]);

  const handleAddCoins = async (e) => {
    e.preventDefault();
    setCreditError('');
    setCreditSuccess('');
    setCrediting(true);

    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/wallet`, {
        method: 'POST',
        ...jsonBody({
          amount: Number(amount),
          note
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setCreditError(data.message || 'Failed to credit coins.');
        return;
      }

      setWallet(data);
      setCreditSuccess(`Successfully credited +${amount} coins! (No Payment Required)`);
      setShowAddCoins(false);
      setTimeout(() => setCreditSuccess(''), 4000);
    } catch (e) {
      console.error('Failed to add coins:', e);
      setCreditError('Network error — please try again.');
    } finally {
      setCrediting(false);
    }
  };

  const transactions = wallet?.recentTransactions || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
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
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Balance & Manual Add Coins Header Card */}
          <div className="glass-card" style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <span className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Coins size={16} style={{ color: 'var(--accent-primary)' }} /> Total Wallet Balance
              </span>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {wallet?.balanceCoins ?? 0} <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>coins</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ textAlign: 'right' }}>
                <span className="field-label">Low-balance threshold</span>
                <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{wallet?.lowBalanceThreshold ?? 50} coins</div>
              </div>

              <Button variant="primary" onClick={() => setShowAddCoins(!showAddCoins)}>
                <PlusCircle size={16} style={{ marginRight: '0.4rem' }} />
                {showAddCoins ? 'Cancel' : 'Add Coins (Master Admin)'}
              </Button>
            </div>
          </div>

          {creditSuccess && (
            <div style={{ padding: '0.9rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.14)', color: '#047857', fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Check size={18} /> {creditSuccess}
            </div>
          )}

          {/* Master Admin Direct Manual Coin Allocation Form */}
          {showAddCoins && (
            <form onSubmit={handleAddCoins} className="glass-card" style={{ padding: '1.75rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--accent-primary)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Master Admin Direct Coin Allocation</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Credit tokens/coins to this organization&apos;s wallet balance instantly (No payment processing required).
                </p>
              </div>

              <div>
                <label className="field-label">Quick Preset Amount</label>
                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                  {COIN_PRESETS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmount(val)}
                      style={{
                        padding: '0.45rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: Number(amount) === val ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)',
                        color: Number(amount) === val ? '#ffffff' : 'var(--text-primary)',
                        border: `1px solid ${Number(amount) === val ? 'var(--accent-primary)' : 'var(--border)'}`,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      +{val} coins
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                <div>
                  <label className="field-label">Custom Coin Amount *</label>
                  <input
                    type="number"
                    min="1"
                    className="field-input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="field-label">Audit Note / Reason</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="e.g. Master Admin Bonus / Trial Grant"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>

              {creditError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{creditError}</div>}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                <Button type="button" variant="ghost" onClick={() => setShowAddCoins(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={crediting} disabled={crediting}>
                  Credit Coins Now (No Payment)
                </Button>
              </div>
            </form>
          )}

          {/* Ledger Table */}
          {transactions.length === 0 ? (
            <div
              className="glass-card"
              style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}
            >
              <Wallet size={32} strokeWidth={1.5} />
              No wallet transactions recorded yet.
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
                      <th>Reference / Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <motion.tr key={tx.id} variants={rowVariants}>
                        <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(tx.createdAt).toLocaleString()}</td>
                        <td>
                          <span className={`role-badge ${tx.type === 'admin_adjustment' ? 'role-owner' : 'role-manager'}`}>
                            {TX_LABELS[tx.type] || tx.type}
                          </span>
                        </td>
                        <td style={{ color: tx.amount < 0 ? 'var(--status-cancelled)' : '#059669', fontWeight: 700 }}>
                          {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                        </td>
                        <td style={{ fontWeight: 600 }}>{tx.balanceAfter}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
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
