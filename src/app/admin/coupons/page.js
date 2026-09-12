'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Ticket, Pencil, RotateCcw } from 'lucide-react';
import { useAdmin } from '@/features/admin/AdminContext';
import { jsonBody } from '@/lib/apiClient';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

const SCOPES = [
  { value: 'bill_discount', label: 'Bill discount' },
  { value: 'coin_purchase', label: 'Coin purchase' }
];
const DISCOUNT_TYPES = [
  { value: 'flat', label: 'Flat (₹)' },
  { value: 'percent', label: 'Percent (%)' }
];

// yyyy-MM-ddTHH:mm for a datetime-local input, from an ISO string.
const toLocalInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

const EMPTY_FORM = {
  code: '',
  scope: 'coin_purchase',
  discountType: 'percent',
  discountValue: '',
  maxUsesTotal: '',
  maxUsesPerOrg: '1',
  validFrom: '',
  validUntil: '',
  isActive: true
};

// Master Admin's write surface for coupon codes (plan Phase 1B.c) — same
// list+create-modal structure as /admin/coin-plans and
// src/app/admin/organizations/page.js. Before this page existed the only
// coupon code paths were consumption (apply-coupon on a bill, coin
// purchase) — nothing could ever create one.
export default function CouponsPage() {
  const { apiFetch } = useAdmin();
  const [coupons, setCoupons] = useState([]);
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
      const res = await apiFetch('/admin/coupons');
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not load coupons.');
        return;
      }
      setCoupons(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load coupons:', e);
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

  const openEdit = (coupon) => {
    setFormMode('edit');
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      scope: coupon.scope,
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      maxUsesTotal: coupon.maxUsesTotal === null || coupon.maxUsesTotal === undefined ? '' : String(coupon.maxUsesTotal),
      maxUsesPerOrg: String(coupon.maxUsesPerOrg),
      validFrom: toLocalInput(coupon.validFrom),
      validUntil: toLocalInput(coupon.validUntil),
      isActive: coupon.isActive
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.validUntil) {
      setFormError('A valid-until date is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        scope: form.scope,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxUsesTotal: form.maxUsesTotal === '' ? null : Number(form.maxUsesTotal),
        maxUsesPerOrg: Number(form.maxUsesPerOrg) || 1,
        validUntil: new Date(form.validUntil).toISOString(),
        isActive: form.isActive,
        ...(form.validFrom ? { validFrom: new Date(form.validFrom).toISOString() } : {})
      };
      const res =
        formMode === 'add'
          ? await apiFetch('/admin/coupons', { method: 'POST', ...jsonBody(payload) })
          : await apiFetch(`/admin/coupons/${editingId}`, { method: 'PATCH', ...jsonBody(payload) });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message || 'Failed to save.');
        return;
      }
      await load();
      setShowForm(false);
    } catch (e) {
      console.error('Failed to save coupon:', e);
      setFormError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (coupon) => {
    try {
      const res = await apiFetch(`/admin/coupons/${coupon.id}`, { method: 'PATCH', ...jsonBody({ isActive: !coupon.isActive }) });
      if (res.ok) await load();
    } catch (e) {
      console.error('Failed to toggle coupon:', e);
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text-primary)' }}>Coupons</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            One-time-use discount codes for bill checkout or coin recharges.
          </p>
        </div>
        <Button variant="primary" onClick={openAdd}>
          + New coupon
        </Button>
      </div>

      {loading ? (
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Skeleton width="18%" height="1rem" />
              <Skeleton width="18%" height="1rem" />
              <Skeleton width="14%" height="1rem" />
              <Skeleton width="20%" height="1rem" />
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
      ) : coupons.length === 0 ? (
        <div
          className="glass-card"
          style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}
        >
          <Ticket size={32} strokeWidth={1.5} />
          No coupons yet.
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
                  <th>Code</th>
                  <th>Scope</th>
                  <th>Discount</th>
                  <th>Uses (total / per org)</th>
                  <th>Valid until</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <motion.tr key={coupon.id} variants={rowVariants}>
                    <td>
                      <strong>{coupon.code}</strong>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{SCOPES.find((s) => s.value === coupon.scope)?.label || coupon.scope}</td>
                    <td>{coupon.discountType === 'percent' ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}</td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {coupon.maxUsesTotal ?? '∞'} / {coupon.maxUsesPerOrg}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{new Date(coupon.validUntil).toLocaleDateString()}</td>
                    <td>
                      <span className={`role-badge ${coupon.isActive ? 'role-manager' : 'role-customer'}`}>
                        {coupon.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button className="icon-btn" onClick={() => openEdit(coupon)} title="Edit">
                          <Pencil size={15} />
                        </button>
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(coupon)}>
                          {coupon.isActive ? 'Deactivate' : 'Activate'}
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
        <Modal onClose={() => setShowForm(false)} maxWidth={480}>
          <div style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>{formMode === 'add' ? 'New coupon' : 'Edit coupon'}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="field-label" htmlFor="cpn-code">
                  Code
                </label>
                <input
                  id="cpn-code"
                  type="text"
                  className="field-input"
                  placeholder="WELCOME10"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="field-label" htmlFor="cpn-scope">
                    Scope
                  </label>
                  <select id="cpn-scope" className="field-input" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                    {SCOPES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="cpn-discount-type">
                    Discount type
                  </label>
                  <select
                    id="cpn-discount-type"
                    className="field-input"
                    value={form.discountType}
                    onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                  >
                    {DISCOUNT_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="cpn-discount-value">
                  Discount value
                </label>
                <input
                  id="cpn-discount-value"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="field-input"
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="field-label" htmlFor="cpn-max-total">
                    Max total uses <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(blank = unlimited)</span>
                  </label>
                  <input
                    id="cpn-max-total"
                    type="number"
                    min="1"
                    step="1"
                    className="field-input"
                    value={form.maxUsesTotal}
                    onChange={(e) => setForm({ ...form, maxUsesTotal: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="cpn-max-per-org">
                    Max uses per org
                  </label>
                  <input
                    id="cpn-max-per-org"
                    type="number"
                    min="1"
                    step="1"
                    className="field-input"
                    value={form.maxUsesPerOrg}
                    onChange={(e) => setForm({ ...form, maxUsesPerOrg: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="field-label" htmlFor="cpn-valid-from">
                    Valid from <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                  </label>
                  <input
                    id="cpn-valid-from"
                    type="datetime-local"
                    className="field-input"
                    value={form.validFrom}
                    onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="cpn-valid-until">
                    Valid until
                  </label>
                  <input
                    id="cpn-valid-until"
                    type="datetime-local"
                    className="field-input"
                    value={form.validUntil}
                    onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                    required
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
