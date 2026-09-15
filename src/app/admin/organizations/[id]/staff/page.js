'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, RotateCcw, MapPin, ShieldCheck, UserPlus, Edit2, Trash2, KeyRound, Check, X, ShieldAlert } from 'lucide-react';
import { useOrgDetail } from '@/features/admin/OrgDetailContext';
import { jsonBody } from '@/lib/apiClient';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

const ALL_ROLES = ['owner', 'manager', 'cook', 'waiter', 'customer'];

export default function OrgStaffPage() {
  const { org, apiFetch } = useOrgDetail();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [deletingStaff, setDeletingStaff] = useState(null);

  // Form states
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'manager',
    canResetStaffPassword: true,
    canControlIot: true
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'manager',
    canResetStaffPassword: false,
    canControlIot: false
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [deleteSaving, setDeleteSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/staff`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not load this organization\'s staff.');
        return;
      }
      setStaff(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load organization staff:', e);
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id]);

  // Create Staff
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setAddError('');
    setAddSaving(true);
    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/staff`, {
        method: 'POST',
        ...jsonBody({
          name: addForm.name,
          email: addForm.email || undefined,
          phone: addForm.phone || undefined,
          password: addForm.password,
          role: addForm.role,
          permissions: {
            canResetStaffPassword: Boolean(addForm.canResetStaffPassword),
            canControlIot: Boolean(addForm.canControlIot)
          }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.message || 'Failed to create staff account.');
        return;
      }
      setShowAddModal(false);
      setAddForm({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: 'manager',
        canResetStaffPassword: true,
        canControlIot: true
      });
      await load();
    } catch (e) {
      console.error('Failed to create staff:', e);
      setAddError('Network error — please try again.');
    } finally {
      setAddSaving(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (person) => {
    setEditError('');
    setEditForm({
      id: person.id,
      name: person.name || '',
      email: person.email || '',
      phone: person.phone || '',
      password: '',
      role: person.role || 'manager',
      canResetStaffPassword: Boolean(person.permissions?.canResetStaffPassword),
      canControlIot: Boolean(person.permissions?.canControlIot)
    });
    setEditingStaff(person);
  };

  // Save Edit Staff
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSaving(true);
    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/staff/${editForm.id}`, {
        method: 'PATCH',
        ...jsonBody({
          name: editForm.name,
          email: editForm.email || undefined,
          phone: editForm.phone || undefined,
          password: editForm.password || undefined,
          role: editForm.role,
          permissions: {
            canResetStaffPassword: Boolean(editForm.canResetStaffPassword),
            canControlIot: Boolean(editForm.canControlIot)
          }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.message || 'Failed to update staff account.');
        return;
      }
      setEditingStaff(null);
      await load();
    } catch (e) {
      console.error('Failed to update staff:', e);
      setEditError('Network error — please try again.');
    } finally {
      setEditSaving(false);
    }
  };

  // Toggle Quick Permission
  const togglePermission = async (person, permKey) => {
    const currentVal = Boolean(person.permissions?.[permKey]);
    const nextPermissions = {
      ...(person.permissions || {}),
      [permKey]: !currentVal
    };

    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/staff/${person.id}`, {
        method: 'PATCH',
        ...jsonBody({ permissions: nextPermissions })
      });
      if (res.ok) {
        setStaff((prev) =>
          prev.map((item) =>
            item.id === person.id ? { ...item, permissions: nextPermissions } : item
          )
        );
      }
    } catch (e) {
      console.error('Failed to toggle permission:', e);
    }
  };

  // Delete Staff
  const handleDeleteStaff = async () => {
    if (!deletingStaff) return;
    setDeleteSaving(true);
    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/staff/${deletingStaff.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.message || 'Failed to delete staff member');
        return;
      }
      setDeletingStaff(null);
      await load();
    } catch (e) {
      console.error('Failed to delete staff:', e);
    } finally {
      setDeleteSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Header Bar */}
      <div className="glass-card" style={{ padding: '1.25rem 1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Staff Roster & Permissions Control</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Manage staff accounts, assign roles (`owner`, `manager`, `cook`, `waiter`), and toggle granular permissions.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
          <UserPlus size={15} style={{ marginRight: '0.4rem' }} /> Add Staff Member
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
        <div className="glass-card" style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Users size={36} strokeWidth={1.5} />
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>No staff accounts created yet</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>Click &quot;Add Staff Member&quot; above to create accounts for this venue.</p>
          </div>
        </div>
      ) : (
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} variants={listVariants} initial="hidden" animate="show">
          {staff.map((person) => (
            <motion.div key={person.id} className="glass-card staff-row" variants={rowVariants} style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 240 }}>
                <div className="staff-avatar" style={{ width: 44, height: 44, fontSize: '1.1rem', fontWeight: 800 }}>
                  {(person.name || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.98rem' }}>{person.name}</strong>
                    <span className={`role-badge role-${person.role}`}>{person.role}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {person.email || person.phone || 'No contact info'}
                  </div>
                  {person.spaceId && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem' }}>
                      <MapPin size={11} /> Space ID: {person.spaceId}
                    </div>
                  )}
                </div>
              </div>

              {/* Permission Toggles & Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                {person.role === 'manager' && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <PermissionToggleBtn
                      label="Password reset"
                      granted={Boolean(person.permissions?.canResetStaffPassword)}
                      onClick={() => togglePermission(person, 'canResetStaffPassword')}
                    />
                    <PermissionToggleBtn
                      label="IoT control"
                      granted={Boolean(person.permissions?.canControlIot)}
                      onClick={() => togglePermission(person, 'canControlIot')}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <Button variant="secondary" size="sm" onClick={() => openEditModal(person)}>
                    <Edit2 size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeletingStaff(person)}>
                    <Trash2 size={14} style={{ color: 'var(--status-cancelled)' }} />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Add Staff Modal */}
      {showAddModal && (
        <div style={modalOverlayStyle}>
          <div className="glass-card" style={modalContentStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Add New Staff Member</h3>
              <button type="button" onClick={() => setShowAddModal(false)} style={iconBtnStyle}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label className="field-label">Full Name *</label>
                <input type="text" className="field-input" placeholder="e.g. Alex Rivera" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label className="field-label">Role *</label>
                  <select className="field-input" value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}>
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Password *</label>
                  <input type="password" className="field-input" placeholder="••••••••" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label className="field-label">Email Address</label>
                  <input type="email" className="field-input" placeholder="alex@venue.com" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Phone Number</label>
                  <input type="tel" className="field-input" placeholder="+1234567890" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} />
                </div>
              </div>

              {addForm.role === 'manager' && (
                <div style={{ padding: '0.85rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Manager Permission Flags</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={addForm.canResetStaffPassword} onChange={(e) => setAddForm({ ...addForm, canResetStaffPassword: e.target.checked })} />
                    Allow Staff Password Resets (`canResetStaffPassword`)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={addForm.canControlIot} onChange={(e) => setAddForm({ ...addForm, canControlIot: e.target.checked })} />
                    Allow IoT Devices Control (`canControlIot`)
                  </label>
                </div>
              )}

              {addError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.82rem' }}>{addError}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={addSaving} disabled={addSaving}>
                  Create Staff Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div style={modalOverlayStyle}>
          <div className="glass-card" style={modalContentStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Edit Staff: {editingStaff.name}</h3>
              <button type="button" onClick={() => setEditingStaff(null)} style={iconBtnStyle}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label className="field-label">Full Name *</label>
                <input type="text" className="field-input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label className="field-label">Role *</label>
                  <select className="field-input" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">New Password (leave blank to keep current)</label>
                  <input type="password" className="field-input" placeholder="••••••••" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label className="field-label">Email Address</label>
                  <input type="email" className="field-input" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Phone Number</label>
                  <input type="tel" className="field-input" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
              </div>

              {editForm.role === 'manager' && (
                <div style={{ padding: '0.85rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Manager Permission Flags</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={editForm.canResetStaffPassword} onChange={(e) => setEditForm({ ...editForm, canResetStaffPassword: e.target.checked })} />
                    Allow Staff Password Resets (`canResetStaffPassword`)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={editForm.canControlIot} onChange={(e) => setEditForm({ ...editForm, canControlIot: e.target.checked })} />
                    Allow IoT Devices Control (`canControlIot`)
                  </label>
                </div>
              )}

              {editError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.82rem' }}>{editError}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <Button type="button" variant="ghost" onClick={() => setEditingStaff(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={editSaving} disabled={editSaving}>
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingStaff && (
        <div style={modalOverlayStyle}>
          <div className="glass-card" style={{ ...modalContentStyle, maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--status-cancelled)' }}>
              <ShieldAlert size={24} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>Delete Staff Account?</h3>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.85rem', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete <strong>{deletingStaff.name}</strong> ({deletingStaff.role})? This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <Button type="button" variant="ghost" onClick={() => setDeletingStaff(null)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" loading={deleteSaving} onClick={handleDeleteStaff}>
                Delete Account
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PermissionToggleBtn({ label, granted, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.25rem 0.65rem',
        borderRadius: 'var(--radius-full)',
        fontSize: '0.72rem',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        background: granted ? 'rgba(5, 150, 105, 0.14)' : 'var(--bg-surface-elevated)',
        color: granted ? '#047857' : 'var(--text-muted)',
        border: `1px solid ${granted ? 'rgba(5, 150, 105, 0.35)' : 'var(--border)'}`,
        transition: 'all 0.15s ease'
      }}
    >
      <ShieldCheck size={12} style={{ color: granted ? '#047857' : 'var(--text-muted)' }} />
      {label} {granted ? '✓' : '✕'}
    </button>
  );
}

const modalOverlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.55)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: '1.5rem'
};

const modalContentStyle = {
  width: '100%',
  maxWidth: 520,
  padding: '1.75rem',
  borderRadius: 'var(--radius-lg)'
};

const iconBtnStyle = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  padding: '0.2rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
