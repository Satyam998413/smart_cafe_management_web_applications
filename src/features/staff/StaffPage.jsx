'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, KeyRound, Users } from 'lucide-react';
import { jsonBody } from '@/lib/apiClient.js';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

// Ported unchanged from react_app/src/pages/StaffPage.jsx.
const EMPTY_FORM = { name: '', email: '', phone: '', password: '', role: 'cook' };

/** Manager-only staff (cook/manager account) management. */
export default function StaffPage({ apiFetch }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' | 'edit'
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [resetTargetId, setResetTargetId] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/staff');
      const data = await res.json();
      if (Array.isArray(data)) setStaff(data);
    } catch (e) {
      console.error('Failed to load staff:', e);
      setError('Could not load staff accounts.');
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

  const openEdit = (person) => {
    setFormMode('edit');
    setEditingId(person.id);
    setForm({ name: person.name || '', email: person.email || '', phone: person.phone || '', password: '', role: person.role });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.email && !form.phone) {
      setFormError('Email or phone is required.');
      return;
    }
    setSaving(true);
    try {
      const res =
        formMode === 'add'
          ? await apiFetch('/staff', {
              method: 'POST',
              ...jsonBody({ name: form.name, email: form.email || undefined, phone: form.phone || undefined, password: form.password, role: form.role })
            })
          : await apiFetch(`/staff/${editingId}`, {
              method: 'PATCH',
              ...jsonBody({ name: form.name, email: form.email || null, phone: form.phone || null })
            });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message || 'Failed to save.');
        return;
      }
      await load();
      setShowForm(false);
    } catch (e) {
      console.error('Failed to save staff account:', e);
      setFormError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const submitResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    if (resetPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    try {
      const res = await apiFetch(`/staff/${resetTargetId}/password`, {
        method: 'PATCH',
        ...jsonBody({ newPassword: resetPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.message || 'Failed to reset password.');
        return;
      }
      setResetTargetId(null);
      setResetPassword('');
    } catch (e) {
      console.error('Failed to reset password:', e);
      setResetError('Network error — please try again.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>Cook &amp; Manager Accounts</h2>
        <Button variant="primary" onClick={openAdd}>
          + Add Staff
        </Button>
      </div>

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
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--status-cancelled)' }}>
          {error}
        </div>
      ) : staff.length === 0 ? (
        <div
          className="glass-card"
          style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}
        >
          <Users size={28} strokeWidth={1.5} />
          No staff accounts yet.
        </div>
      ) : (
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} variants={listVariants} initial="hidden" animate="show">
          {staff.map((person) => (
            <motion.div key={person.id} className="glass-card staff-row" variants={rowVariants}>
              <div className="staff-avatar">{(person.name || '?')[0].toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{person.name}</strong>
                  <span className={`role-badge role-${person.role}`}>{person.role}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{person.email || person.phone || 'No contact on file'}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="icon-btn" onClick={() => openEdit(person)} title="Edit">
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-btn"
                  title="Reset password"
                  onClick={() => {
                    setResetTargetId(person.id);
                    setResetPassword('');
                    setResetError('');
                  }}
                >
                  <KeyRound size={15} />
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} maxWidth={420}>
          <div style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>{formMode === 'add' ? 'Add Staff Account' : 'Edit Staff Account'}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="text" className="field-input" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <input type="email" className="field-input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input type="text" className="field-input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              {formMode === 'add' && (
                <>
                  <input
                    type="password"
                    className="field-input"
                    placeholder="Password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={6}
                  />
                  <select className="field-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="cook">Cook</option>
                    <option value="manager">Manager</option>
                  </select>
                </>
              )}
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

      {resetTargetId && (
        <Modal onClose={() => setResetTargetId(null)} maxWidth={360}>
          <div style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Reset Password</h2>
            <form onSubmit={submitResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                type="password"
                className="field-input"
                placeholder="New password (min 6 characters)"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
              />
              {resetError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{resetError}</div>}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <Button type="button" variant="ghost" fullWidth onClick={() => setResetTargetId(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" fullWidth>
                  Reset
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
