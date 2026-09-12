'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, MapPin, Pencil, RotateCcw, ArrowRight } from 'lucide-react';
import { jsonBody } from '@/lib/apiClient.js';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

const EMPTY_FORM = { name: '', address: '', googleBusinessProfileUrl: '' };

/**
 * Sites — an org's branches/properties (plan Phase 2a). List is
 * owner/manager visible (mirrors GET /api/sites' gating); create and edit
 * are owner-only, hidden rather than disabled for a manager, same as every
 * other owner-only action in this app.
 *
 * onOpenLayout(site) hands a site off to the Layout Builder tab — page.js
 * owns which site is "selected" there, this page just requests the handoff.
 */
export default function SitesPage({ apiFetch, authRole, onOpenLayout }) {
  const isOwner = authRole === 'owner';

  const [sites, setSites] = useState([]);
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
      const res = await apiFetch('/sites');
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not load sites.');
        return;
      }
      setSites(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load sites:', e);
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

  const openEdit = (site) => {
    setFormMode('edit');
    setEditingId(site.id);
    setForm({ name: site.name || '', address: site.address || '', googleBusinessProfileUrl: site.googleBusinessProfileUrl || '' });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) {
      setFormError('Name is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name, address: form.address || undefined, googleBusinessProfileUrl: form.googleBusinessProfileUrl || undefined };
      const res =
        formMode === 'add'
          ? await apiFetch('/sites', { method: 'POST', ...jsonBody(payload) })
          : await apiFetch(`/sites/${editingId}`, { method: 'PATCH', ...jsonBody(payload) });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message || 'Failed to save.');
        return;
      }
      setSites((prev) => (formMode === 'add' ? [data, ...prev] : prev.map((s) => (s.id === data.id ? data : s))));
      setShowForm(false);
    } catch (e) {
      console.error('Failed to save site:', e);
      setFormError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>Sites</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>Your organization&apos;s branches and properties.</p>
        </div>
        {isOwner && (
          <Button variant="primary" onClick={openAdd}>
            + Add Site
          </Button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {Array.from({ length: 3 }).map((_, i) => (
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
      ) : sites.length === 0 ? (
        <div
          className="glass-card"
          style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}
        >
          <Building2 size={28} strokeWidth={1.5} />
          No sites yet.
          {isOwner && (
            <Button variant="primary" size="sm" onClick={openAdd}>
              Add your first site
            </Button>
          )}
        </div>
      ) : (
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} variants={listVariants} initial="hidden" animate="show">
          {sites.map((site) => (
            <motion.div key={site.id} className="glass-card staff-row" variants={rowVariants}>
              <div className="staff-avatar" style={{ borderRadius: 'var(--radius-md)' }}>
                <Building2 size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ color: 'var(--text-primary)' }}>{site.name}</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {site.address ? (
                    <>
                      <MapPin size={12} /> {site.address}
                    </>
                  ) : (
                    'No address on file'
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {onOpenLayout && (
                  <Button variant="ghost" size="sm" onClick={() => onOpenLayout(site)}>
                    Layout <ArrowRight size={14} />
                  </Button>
                )}
                {isOwner && (
                  <button className="icon-btn" onClick={() => openEdit(site)} title="Edit site">
                    <Pencil size={15} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} maxWidth={440}>
          <div style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>{formMode === 'add' ? 'Add Site' : 'Edit Site'}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="field-label" htmlFor="site-name">
                  Name
                </label>
                <input
                  id="site-name"
                  type="text"
                  className="field-input"
                  placeholder="e.g. Downtown Branch"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="site-address">
                  Address
                </label>
                <input
                  id="site-address"
                  type="text"
                  className="field-input"
                  placeholder="Street, city"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="site-gbp">
                  Google Business Profile URL <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <input
                  id="site-gbp"
                  type="url"
                  className="field-input"
                  placeholder="https://…"
                  value={form.googleBusinessProfileUrl}
                  onChange={(e) => setForm({ ...form, googleBusinessProfileUrl: e.target.value })}
                />
              </div>
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
