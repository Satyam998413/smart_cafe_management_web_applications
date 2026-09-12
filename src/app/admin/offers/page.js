'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Pencil, RotateCcw } from 'lucide-react';
import { useAdmin } from '@/features/admin/AdminContext';
import { jsonBody } from '@/lib/apiClient';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

const BONUS_TYPES = [
  { value: 'percent_extra_coins', label: 'Percent extra coins' },
  { value: 'flat_extra_coins', label: 'Flat extra coins' }
];
const APPLIES_TO = [
  { value: 'all_orgs', label: 'All organizations' },
  { value: 'new_orgs_only', label: 'New organizations only' }
];

const toLocalInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

const EMPTY_FORM = {
  name: '',
  description: '',
  bonusType: 'percent_extra_coins',
  bonusValue: '',
  appliesTo: 'all_orgs',
  startsAt: '',
  endsAt: '',
  isActive: true
};

// Master Admin's write surface for platform-wide promotional offers (plan
// Phase 1B.c) — same list+create-modal structure as /admin/coin-plans and
// /admin/coupons. platform_offers has no existing read path anywhere in
// this codebase yet, so this page (and its GET/POST/PATCH routes) is the
// first place the table is ever touched.
export default function OffersPage() {
  const { apiFetch } = useAdmin();
  const [offers, setOffers] = useState([]);
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
      const res = await apiFetch('/admin/offers');
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not load offers.');
        return;
      }
      setOffers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load offers:', e);
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

  const openEdit = (offer) => {
    setFormMode('edit');
    setEditingId(offer.id);
    setForm({
      name: offer.name,
      description: offer.description || '',
      bonusType: offer.bonusType,
      bonusValue: String(offer.bonusValue),
      appliesTo: offer.appliesTo,
      startsAt: toLocalInput(offer.startsAt),
      endsAt: toLocalInput(offer.endsAt),
      isActive: offer.isActive
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.startsAt || !form.endsAt) {
      setFormError('Start and end dates are both required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        bonusType: form.bonusType,
        bonusValue: Number(form.bonusValue),
        appliesTo: form.appliesTo,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        isActive: form.isActive
      };
      const res =
        formMode === 'add'
          ? await apiFetch('/admin/offers', { method: 'POST', ...jsonBody(payload) })
          : await apiFetch(`/admin/offers/${editingId}`, { method: 'PATCH', ...jsonBody(payload) });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message || 'Failed to save.');
        return;
      }
      await load();
      setShowForm(false);
    } catch (e) {
      console.error('Failed to save offer:', e);
      setFormError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (offer) => {
    try {
      const res = await apiFetch(`/admin/offers/${offer.id}`, { method: 'PATCH', ...jsonBody({ isActive: !offer.isActive }) });
      if (res.ok) await load();
    } catch (e) {
      console.error('Failed to toggle offer:', e);
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text-primary)' }}>Platform offers</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Time-bounded bonus coins layered on top of a recharge, platform-wide or new-orgs-only.
          </p>
        </div>
        <Button variant="primary" onClick={openAdd}>
          + New offer
        </Button>
      </div>

      {loading ? (
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Skeleton width="22%" height="1rem" />
              <Skeleton width="18%" height="1rem" />
              <Skeleton width="18%" height="1rem" />
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
      ) : offers.length === 0 ? (
        <div
          className="glass-card"
          style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}
        >
          <Megaphone size={32} strokeWidth={1.5} />
          No offers yet.
          <Button variant="primary" size="sm" onClick={openAdd}>
            Launch the first one
          </Button>
        </div>
      ) : (
        <motion.div className="glass-card" style={{ overflow: 'hidden' }} variants={listVariants} initial="hidden" animate="show">
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Bonus</th>
                  <th>Applies to</th>
                  <th>Window</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => (
                  <motion.tr key={offer.id} variants={rowVariants}>
                    <td>
                      <strong>{offer.name}</strong>
                      {offer.description && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{offer.description}</div>
                      )}
                    </td>
                    <td>{offer.bonusType === 'percent_extra_coins' ? `+${offer.bonusValue}%` : `+${offer.bonusValue} coins`}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{APPLIES_TO.find((a) => a.value === offer.appliesTo)?.label || offer.appliesTo}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {new Date(offer.startsAt).toLocaleDateString()} – {new Date(offer.endsAt).toLocaleDateString()}
                    </td>
                    <td>
                      <span className={`role-badge ${offer.isActive ? 'role-manager' : 'role-customer'}`}>
                        {offer.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button className="icon-btn" onClick={() => openEdit(offer)} title="Edit">
                          <Pencil size={15} />
                        </button>
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(offer)}>
                          {offer.isActive ? 'Deactivate' : 'Activate'}
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
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>{formMode === 'add' ? 'New offer' : 'Edit offer'}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="field-label" htmlFor="of-name">
                  Offer name
                </label>
                <input
                  id="of-name"
                  type="text"
                  className="field-input"
                  placeholder="Diwali Bonus"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="of-description">
                  Description <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <input
                  id="of-description"
                  type="text"
                  className="field-input"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="field-label" htmlFor="of-bonus-type">
                    Bonus type
                  </label>
                  <select id="of-bonus-type" className="field-input" value={form.bonusType} onChange={(e) => setForm({ ...form, bonusType: e.target.value })}>
                    {BONUS_TYPES.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="of-bonus-value">
                    Bonus value
                  </label>
                  <input
                    id="of-bonus-value"
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="field-input"
                    value={form.bonusValue}
                    onChange={(e) => setForm({ ...form, bonusValue: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="of-applies-to">
                  Applies to
                </label>
                <select id="of-applies-to" className="field-input" value={form.appliesTo} onChange={(e) => setForm({ ...form, appliesTo: e.target.value })}>
                  {APPLIES_TO.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="field-label" htmlFor="of-starts">
                    Starts at
                  </label>
                  <input
                    id="of-starts"
                    type="datetime-local"
                    className="field-input"
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="of-ends">
                    Ends at
                  </label>
                  <input
                    id="of-ends"
                    type="datetime-local"
                    className="field-input"
                    value={form.endsAt}
                    onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
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
