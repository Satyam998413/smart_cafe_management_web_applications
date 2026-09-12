'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, KeyRound, Users, MapPin, RotateCcw } from 'lucide-react';
import { jsonBody } from '@/lib/apiClient.js';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';
import { buildSpaceTree, flattenSpaceTree, spaceLabel } from '@/lib/spaceTree.js';
import { canResetPassword } from '@/lib/staffHelpers.js';

// Ported from react_app/src/pages/StaffPage.jsx, extended (plan Phase 2c/2d)
// with the waiter role, site/space assignment, and permission-gated
// password reset — was cook/manager-only, now also waiter.
const EMPTY_FORM = { name: '', email: '', phone: '', password: '', role: 'cook' };

/** Owner/Manager staff (cook/manager/waiter account) management. */
export default function StaffPage({ apiFetch, authRole }) {
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

  // My own permissions (plan Phase 2d) — only a Manager's canResetStaffPassword
  // flag matters here; an Owner can always reset cook/waiter/manager
  // passwords, so this only needs fetching for the Manager case. See
  // src/app/api/users/me/route.js for why this is the one place `permissions`
  // is safe to expose client-side (self-only, never another user's row).
  const [myPermissions, setMyPermissions] = useState({});

  // Sites + an org-wide spaceId -> "label · site name" lookup, loaded once
  // in the background so every staff row can show its current assignment
  // without an extra fetch per row. Org-sized (a handful of sites/spaces),
  // not paginated.
  const [sites, setSites] = useState([]);
  const [spaceLookup, setSpaceLookup] = useState({});

  // Assignment modal (PATCH /api/staff/:id/assignment).
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignSiteId, setAssignSiteId] = useState('');
  const [assignSpaceId, setAssignSpaceId] = useState('');
  const [assignSpaces, setAssignSpaces] = useState([]);
  const [assignSpacesLoading, setAssignSpacesLoading] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assigning, setAssigning] = useState(false);

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

  // Background, non-blocking — the staff list itself doesn't wait on this.
  const loadSitesAndSpaceLookup = async () => {
    try {
      const res = await apiFetch('/sites');
      const siteList = await res.json();
      if (!res.ok || !Array.isArray(siteList)) return;
      setSites(siteList);

      const perSite = await Promise.all(
        siteList.map(async (site) => {
          const spacesRes = await apiFetch(`/spaces?siteId=${site.id}`);
          const spaces = await spacesRes.json();
          return spacesRes.ok && Array.isArray(spaces) ? { site, spaces } : { site, spaces: [] };
        })
      );

      const lookup = {};
      for (const { site, spaces } of perSite) {
        for (const space of spaces) {
          lookup[space.id] = { label: spaceLabel(space), siteId: site.id, siteName: site.name };
        }
      }
      setSpaceLookup(lookup);
    } catch (e) {
      console.error('Failed to load sites/spaces for staff assignment:', e);
    }
  };

  const loadMyPermissions = async () => {
    if (authRole !== 'manager') return;
    try {
      const res = await apiFetch('/users/me');
      const data = await res.json();
      if (res.ok) setMyPermissions(data.permissions || {});
    } catch (e) {
      console.error('Failed to load own permissions:', e);
    }
  };

  useEffect(() => {
    load();
    loadSitesAndSpaceLookup();
    loadMyPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Client-side mirror of src/lib/staffHelpers.js's canResetPassword, for
  // deciding whether to *show* the reset-password button — the server
  // re-checks this for real (fetching permissions fresh, not trusting the
  // JWT) on the actual PATCH, this is display-only.
  const canResetTarget = (person) =>
    canResetPassword({
      isMasterAdmin: false,
      actorRole: authRole,
      actorOrgId: 'self',
      actorPermissions: myPermissions,
      targetRole: person.role,
      targetOrgId: 'self'
    });

  const openAssign = async (person) => {
    setAssignTarget(person);
    setAssignError('');
    setAssignSpaceId(person.spaceId || '');
    const initialSiteId = (person.spaceId && spaceLookup[person.spaceId]?.siteId) || sites[0]?.id || '';
    setAssignSiteId(initialSiteId);
    if (initialSiteId) await loadAssignSpaces(initialSiteId);
  };

  const loadAssignSpaces = async (siteId) => {
    setAssignSpacesLoading(true);
    try {
      const res = await apiFetch(`/spaces?siteId=${siteId}`);
      const data = await res.json();
      setAssignSpaces(res.ok && Array.isArray(data) ? flattenSpaceTree(buildSpaceTree(data)) : []);
    } catch (e) {
      console.error('Failed to load spaces for assignment:', e);
      setAssignSpaces([]);
    } finally {
      setAssignSpacesLoading(false);
    }
  };

  const handleSiteChange = (siteId) => {
    setAssignSiteId(siteId);
    setAssignSpaceId('');
    loadAssignSpaces(siteId);
  };

  const submitAssign = async (e) => {
    e.preventDefault();
    setAssignError('');
    setAssigning(true);
    try {
      const res = await apiFetch(`/staff/${assignTarget.id}/assignment`, {
        method: 'PATCH',
        ...jsonBody({ spaceId: assignSpaceId || null })
      });
      const data = await res.json();
      if (!res.ok) {
        setAssignError(data.message || 'Failed to assign.');
        return;
      }
      setStaff((prev) => prev.map((p) => (p.id === assignTarget.id ? { ...p, spaceId: data.spaceId } : p)));
      setAssignTarget(null);
    } catch (e) {
      console.error('Failed to assign staff:', e);
      setAssignError('Network error — please try again.');
    } finally {
      setAssigning(false);
    }
  };

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
        <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>Staff Accounts</h2>
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
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--status-cancelled)' }}>{error}</span>
          <Button variant="secondary" onClick={load}>
            <RotateCcw size={15} /> Retry
          </Button>
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
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                  <MapPin size={11} />
                  {person.spaceId ? spaceLookup[person.spaceId]?.label && `${spaceLookup[person.spaceId].label} · ${spaceLookup[person.spaceId].siteName}` : 'Unassigned'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="icon-btn" onClick={() => openAssign(person)} title="Assign to site/space">
                  <MapPin size={15} />
                </button>
                <button className="icon-btn" onClick={() => openEdit(person)} title="Edit">
                  <Pencil size={15} />
                </button>
                {canResetTarget(person) && (
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
                )}
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
                    <option value="waiter">Waiter</option>
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

      {assignTarget && (
        <Modal onClose={() => setAssignTarget(null)} maxWidth={400}>
          <div style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '0.35rem', color: 'var(--text-primary)' }}>Assign {assignTarget.name}</h2>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Which site and space is this person stationed at?</p>

            {sites.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No sites yet — add one from the Sites tab first.</p>
            ) : (
              <form onSubmit={submitAssign} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="field-label" htmlFor="assign-site">
                    Site
                  </label>
                  <select id="assign-site" className="field-input" value={assignSiteId} onChange={(e) => handleSiteChange(e.target.value)}>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="assign-space">
                    Space
                  </label>
                  <select
                    id="assign-space"
                    className="field-input"
                    value={assignSpaceId}
                    onChange={(e) => setAssignSpaceId(e.target.value)}
                    disabled={assignSpacesLoading}
                  >
                    <option value="">— Unassigned —</option>
                    {assignSpaces.map((space) => (
                      <option key={space.id} value={space.id}>
                        {'  '.repeat(space.depth)}
                        {spaceLabel(space)}
                      </option>
                    ))}
                  </select>
                </div>
                {assignError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{assignError}</div>}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <Button type="button" variant="ghost" fullWidth onClick={() => setAssignTarget(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" fullWidth disabled={assigning} loading={assigning}>
                    {assigning ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
