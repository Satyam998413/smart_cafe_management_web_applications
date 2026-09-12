'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, Pencil, RotateCcw } from 'lucide-react';
import { useAdmin } from '@/features/admin/AdminContext';
import { jsonBody } from '@/lib/apiClient';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

const EMPTY_FORM = { name: '', priceInr: '', coinsGranted: '', bonusCoins: '0', sortOrder: '0', isActive: true };

// Master Admin's write surface for the coin recharge catalog (plan Phase
// 1B.c) — mirrors src/app/admin/organizations/page.js's list+create
// structure exactly (skeleton/empty/error states, framer-motion stagger,
// design tokens). Before this page existed there was no way to create a
// coin_plans row through the app at all — only the tenant-facing read
// route (/api/wallet/coin-plans) existed.
export default function CoinPlansPage() {
  const { apiFetch } = useAdmin();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' | 'edit'
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/admin/coin-plans');
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not load coin plans.');
        return;
      }
      setPlans(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load coin plans:', e);
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setFormMode('add');
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (plan) => {
    setFormMode('edit');
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      priceInr: String(plan.priceInr),
      coinsGranted: String(plan.coinsGranted),
      bonusCoins: String(plan.bonusCoins),
      sortOrder: String(plan.sortOrder),
      isActive: plan.isActive
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        priceInr: Number(form.priceInr),
        coinsGranted: Number(form.coinsGranted),
        bonusCoins: Number(form.bonusCoins) || 0,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive
      };
      const res =
        formMode === 'add'
          ? await apiFetch('/admin/coin-plans', { method: 'POST', ...jsonBody(payload) })
          : await apiFetch(`/admin/coin-plans/${editingId}`, { method: 'PATCH', ...jsonBody(payload) });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message || 'Failed to save.');
        return;
      }
      await load();
      setShowForm(false);
    } catch (e) {
      console.error('Failed to save coin plan:', e);
      setFormError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (plan) => {
    try {
      const res = await apiFetch(`/admin/coin-plans/${plan.id}`, { method: 'PATCH', ...jsonBody({ isActive: !plan.isActive }) });
      if (res.ok) await load();
    } catch (e) {
      console.error('Failed to toggle coin plan:', e);
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text-primary)' }}>Coin plans</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            The recharge catalog every tenant’s Owner buys coins from.
          </p>
        </div>
        <Button variant="primary" onClick={openAdd}>
          + New plan
        </Button>
      </div>

      {loading ? (
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Skeleton width="22%" height="1rem" />
              <Skeleton width="14%" height="1rem" />
              <Skeleton width="14%" height="1rem" />
              <Skeleton width="14%" height="1rem" />
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
      ) : plans.length === 0 ? (
        <div
          className="glass-card"
          style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}
        >
          <Coins size={32} strokeWidth={1.5} />
          No coin plans yet.
          <Button variant="primary" size="sm" onClick={openAdd}>
            Create the first one
          </Button>
        </div>
      ) : (
        <motion.div className="glass-card" style={{ overflow: 'hidden' }} variants={listVariants} initial="hidden" animate="show">
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Coins</th>
                  <th>Bonus</th>
                  <th>Status</th>
                  <th>Sort</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <motion.tr key={plan.id} variants={rowVariants}>
                    <td>
                      <strong>{plan.name}</strong>
                    </td>
                    <td>₹{plan.priceInr}</td>
                    <td>{plan.coinsGranted}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{plan.bonusCoins > 0 ? `+${plan.bonusCoins}` : '—'}</td>
                    <td>
                      <span className={`role-badge ${plan.isActive ? 'role-manager' : 'role-customer'}`}>
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{plan.sortOrder}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button className="icon-btn" onClick={() => openEdit(plan)} title="Edit">
                          <Pencil size={15} />
                        </button>
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(plan)}>
                          {plan.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} maxWidth={440}>
          <div style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>{formMode === 'add' ? 'New coin plan' : 'Edit coin plan'}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="field-label" htmlFor="cp-name">
                  Plan name
                </label>
                <input
                  id="cp-name"
                  type="text"
                  className="field-input"
                  placeholder="Starter"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="field-label" htmlFor="cp-price">
                    Price (₹)
                  </label>
                  <input
                    id="cp-price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="field-input"
                    value={form.priceInr}
                    onChange={(e) => setForm({ ...form, priceInr: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="cp-coins">
                    Coins granted
                  </label>
                  <input
                    id="cp-coins"
                    type="number"
                    min="0"
                    step="1"
                    className="field-input"
                    value={form.coinsGranted}
                    onChange={(e) => setForm({ ...form, coinsGranted: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="field-label" htmlFor="cp-bonus">
                    Bonus coins
                  </label>
                  <input
                    id="cp-bonus"
                    type="number"
                    min="0"
                    step="1"
                    className="field-input"
                    value={form.bonusCoins}
                    onChange={(e) => setForm({ ...form, bonusCoins: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="cp-sort">
                    Sort order
                  </label>
                  <input
                    id="cp-sort"
                    type="number"
                    step="1"
                    className="field-input"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Active
              </label>
              {formError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{formError}</div>}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <Button type="button" variant="ghost" fullWidth onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" fullWidth disabled={saving} loading={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
