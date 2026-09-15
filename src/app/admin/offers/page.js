'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Pencil, RotateCcw, Plus } from 'lucide-react';
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

export default function OffersPage() {
  const { apiFetch } = useAdmin();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('add');
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

  const stats = useMemo(() => {
    const total = offers.length;
    const active = offers.filter((o) => o.isActive).length;
    return { total, active };
  }, [offers]);

  return (
    <div style={{ display: 'flex', gap: '1.5rem', width: '100%', alignItems: 'flex-start' }}>
      {/* 300px Left Control Sidebar */}
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
        <button className="btn-orange" onClick={openAdd} style={{ justifyContent: 'center' }}>
          <Plus size={16} /> New offer
        </button>

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
            Campaign Metrics
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Offers</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{stats.total}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Active Offers</span>
            <span style={{ fontWeight: 700, color: '#10b981' }}>{stats.active}</span>
          </div>
        </div>
      </div>

      {/* Right Content Table */}
      <div style={{ flex: 1, minWidth: 0 }}>
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
            No promotional offers yet.
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
                    <th>Bonus</th>
                    <th>Applies to</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer) => (
                    <motion.tr key={offer.id} variants={rowVariants}>
                      <td>
                        <strong>{offer.name}</strong>
                        {offer.description && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{offer.description}</div>
                        )}
                      </td>
                      <td>
                        {offer.bonusType === 'percent_extra_coins' ? `+${offer.bonusValue}% coins` : `+${offer.bonusValue} coins`}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {APPLIES_TO.find((a) => a.value === offer.appliesTo)?.label || offer.appliesTo}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {new Date(offer.startsAt).toLocaleDateString()} – {new Date(offer.endsAt).toLocaleDateString()}
                      </td>
                      <td>
                        <span className={`status-badge ${offer.isActive ? 'available' : 'unavailable'}`}>
                          {offer.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
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
      </div>

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
                  placeholder="Diwali Bonus 20%"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="field-label" htmlFor="of-desc">
                  Description <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <textarea
                  id="of-desc"
                  className="field-input"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="field-label" htmlFor="of-btype">
                    Bonus type
                  </label>
                  <select id="of-btype" className="field-input" value={form.bonusType} onChange={(e) => setForm({ ...form, bonusType: e.target.value })}>
                    {BONUS_TYPES.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="of-bval">
                    Bonus value
                  </label>
                  <input
                    id="of-bval"
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
                <label className="field-label" htmlFor="of-applies">
                  Applies to
                </label>
                <select id="of-applies" className="field-input" value={form.appliesTo} onChange={(e) => setForm({ ...form, appliesTo: e.target.value })}>
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
                    Starts at *
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
                    Ends at *
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
