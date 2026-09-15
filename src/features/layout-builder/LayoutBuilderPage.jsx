'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Wifi, WifiOff, RotateCcw, BedDouble } from 'lucide-react';
import { jsonBody } from '@/lib/apiClient.js';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';
import { buildSpaceTree, flattenSpaceTree, spaceLabel, SPACE_KIND_LABELS, TOP_LEVEL_KINDS, CHILD_KINDS } from '@/lib/spaceTree.js';

/**
 * Layout Builder — visual tree editor for one site's floors/halls ->
 * tables/rooms/canteens (plan Phase 2a). No drag-and-drop dependency per
 * the plan's scoped-down ask: add/edit/delete plus sort_order-swap
 * up/down buttons for reordering. Owner-only for structural edits
 * (create/edit/delete/reorder/IoT toggle), matching POST/PATCH/DELETE
 * /api/spaces' requireRole('owner') gating — a Manager gets a read-only
 * tree (GET /api/spaces is owner/manager).
 */
export default function LayoutBuilderPage({ apiFetch, authRole, initialSiteId }) {
  const isOwner = authRole === 'owner';

  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState(initialSiteId || '');

  const [spaces, setSpaces] = useState([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [spacesError, setSpacesError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' | 'edit'
  const [editingId, setEditingId] = useState(null);
  const [parentSpaceId, setParentSpaceId] = useState(null);
  const [form, setForm] = useState({ kind: 'floor', label: '', number: '', isBookable: false, iotEnabled: false, length: '', width: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [busyId, setBusyId] = useState(null);

  const loadSites = async () => {
    setSitesLoading(true);
    setSitesError('');
    try {
      const res = await apiFetch('/sites');
      const data = await res.json();
      if (!res.ok) {
        setSitesError(data.message || 'Could not load sites.');
        return;
      }
      const list = Array.isArray(data) ? data : [];
      setSites(list);
      setSelectedSiteId((prev) => prev || list[0]?.id || '');
    } catch (e) {
      console.error('Failed to load sites:', e);
      setSitesError('Network error — please try again.');
    } finally {
      setSitesLoading(false);
    }
  };

  const loadSpaces = async (siteId) => {
    if (!siteId) {
      setSpaces([]);
      return;
    }
    setSpacesLoading(true);
    setSpacesError('');
    try {
      const res = await apiFetch(`/spaces?siteId=${siteId}`);
      const data = await res.json();
      if (!res.ok) {
        setSpacesError(data.message || 'Could not load the layout.');
        return;
      }
      setSpaces(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load spaces:', e);
      setSpacesError('Network error — please try again.');
    } finally {
      setSpacesLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSpaces(selectedSiteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSiteId]);

  const rows = useMemo(() => flattenSpaceTree(buildSpaceTree(spaces)), [spaces]);
  const hasChildren = (spaceId) => spaces.some((s) => s.parentSpaceId === spaceId);

  const openAdd = (parent) => {
    setFormMode('add');
    setEditingId(null);
    setParentSpaceId(parent ? parent.id : null);
    setForm({ kind: parent ? 'table' : 'floor', label: '', number: '', isBookable: false, iotEnabled: false, length: '', width: '' });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (space) => {
    setFormMode('edit');
    setEditingId(space.id);
    setParentSpaceId(space.parentSpaceId);
    setForm({
      kind: space.kind,
      label: space.label,
      number: space.number || '',
      isBookable: !!space.isBookable,
      iotEnabled: !!space.iotEnabled,
      length: space.length ?? '',
      width: space.width ?? ''
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.label.trim()) {
      setFormError('Label is required.');
      return;
    }
    setSaving(true);
    try {
      if (formMode === 'add') {
        const siblingCount = spaces.filter((s) => (s.parentSpaceId || null) === parentSpaceId).length;
        const res = await apiFetch('/spaces', {
          method: 'POST',
          ...jsonBody({
            siteId: selectedSiteId,
            parentSpaceId: parentSpaceId || undefined,
            kind: form.kind,
            label: form.label,
            number: form.number || undefined,
            isBookable: form.isBookable,
            iotEnabled: form.iotEnabled,
            sortOrder: siblingCount,
            length: form.length === '' ? undefined : Number(form.length),
            width: form.width === '' ? undefined : Number(form.width)
          })
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.message || 'Failed to add.');
          return;
        }
        setSpaces((prev) => [...prev, data]);
      } else {
        const res = await apiFetch(`/spaces/${editingId}`, {
          method: 'PATCH',
          ...jsonBody({
            label: form.label,
            number: form.number || null,
            isBookable: form.isBookable,
            iotEnabled: form.iotEnabled,
            length: form.length === '' ? null : Number(form.length),
            width: form.width === '' ? null : Number(form.width)
          })
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.message || 'Failed to save.');
          return;
        }
        setSpaces((prev) => prev.map((s) => (s.id === data.id ? data : s)));
      }
      setShowForm(false);
    } catch (e) {
      console.error('Failed to save space:', e);
      setFormError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleIot = async (space) => {
    setBusyId(space.id);
    try {
      const res = await apiFetch(`/spaces/${space.id}`, { method: 'PATCH', ...jsonBody({ iotEnabled: !space.iotEnabled }) });
      const data = await res.json();
      if (res.ok) setSpaces((prev) => prev.map((s) => (s.id === data.id ? data : s)));
    } catch (e) {
      console.error('Failed to toggle IoT:', e);
    } finally {
      setBusyId(null);
    }
  };

  // Reorders `space` against its immediate previous/next sibling (same
  // parent) by swapping their sort_order values — a dependency-free
  // stand-in for drag-and-drop, per the plan's scoped-down ask for this UI.
  const move = async (space, direction) => {
    const siblings = spaces.filter((s) => (s.parentSpaceId || null) === (space.parentSpaceId || null)).sort((a, b) => a.sortOrder - b.sortOrder);
    const index = siblings.findIndex((s) => s.id === space.id);
    const swapWith = siblings[direction === 'up' ? index - 1 : index + 1];
    if (!swapWith) return;

    setBusyId(space.id);
    try {
      const [resA, resB] = await Promise.all([
        apiFetch(`/spaces/${space.id}`, { method: 'PATCH', ...jsonBody({ sortOrder: swapWith.sortOrder }) }),
        apiFetch(`/spaces/${swapWith.id}`, { method: 'PATCH', ...jsonBody({ sortOrder: space.sortOrder }) })
      ]);
      const [dataA, dataB] = await Promise.all([resA.json(), resB.json()]);
      if (resA.ok && resB.ok) {
        setSpaces((prev) => prev.map((s) => (s.id === dataA.id ? dataA : s.id === dataB.id ? dataB : s)));
      }
    } catch (e) {
      console.error('Failed to reorder:', e);
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    setDeleting(true);
    try {
      const res = await apiFetch(`/spaces/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.message || 'Failed to delete.');
        return;
      }
      setSpaces((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      console.error('Failed to delete space:', e);
      setDeleteError('Network error — please try again.');
    } finally {
      setDeleting(false);
    }
  };

  // Only relevant in 'add' mode — kind is fixed once created (PATCH doesn't
  // accept it), so the edit form shows it as read-only text instead.
  const kindOptions = parentSpaceId ? CHILD_KINDS : TOP_LEVEL_KINDS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>Layout Builder</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>Floors/halls, and the tables/rooms/canteens under them.</p>
        </div>

        {!sitesLoading && !sitesError && sites.length > 0 && (
          <select className="field-input" style={{ width: 'auto', minWidth: 200 }} value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)}>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {sitesLoading ? (
        <Skeleton height="2.5rem" width={220} />
      ) : sitesError ? (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--status-cancelled)' }}>{sitesError}</span>
          <Button variant="secondary" onClick={loadSites}>
            <RotateCcw size={15} /> Retry
          </Button>
        </div>
      ) : sites.length === 0 ? (
        <div
          className="glass-card"
          style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}
        >
          <LayoutGrid size={28} strokeWidth={1.5} />
          Add a site first — the layout builder needs one to attach floors and tables to.
        </div>
      ) : spacesLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="3rem" />
          ))}
        </div>
      ) : spacesError ? (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--status-cancelled)' }}>{spacesError}</span>
          <Button variant="secondary" onClick={() => loadSpaces(selectedSiteId)}>
            <RotateCcw size={15} /> Retry
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div
          className="glass-card"
          style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}
        >
          <LayoutGrid size={28} strokeWidth={1.5} />
          No floors or halls yet.
          {isOwner && (
            <Button variant="primary" size="sm" onClick={() => openAdd(null)}>
              <Plus size={15} /> Add a floor/hall
            </Button>
          )}
        </div>
      ) : (
        <motion.div className="glass-card" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }} variants={listVariants} initial="hidden" animate="show">
          {rows.map((space) => {
            const siblings = spaces.filter((s) => (s.parentSpaceId || null) === (space.parentSpaceId || null)).sort((a, b) => a.sortOrder - b.sortOrder);
            const isFirst = siblings[0]?.id === space.id;
            const isLast = siblings[siblings.length - 1]?.id === space.id;
            const busy = busyId === space.id;

            return (
              <motion.div
                key={space.id}
                variants={rowVariants}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.6rem 0.75rem',
                  marginLeft: `${space.depth * 1.75}rem`,
                  borderRadius: 'var(--radius-md)',
                  background: space.depth === 0 ? 'var(--bg-surface-elevated)' : 'transparent'
                }}
              >
                <span className={`kind-badge kind-${space.kind}`}>{SPACE_KIND_LABELS[space.kind]}</span>
                <strong style={{ color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>{spaceLabel(space)}</strong>
                {space.isBookable && <BedDouble size={14} color="var(--text-muted)" title="Bookable" />}

                {isOwner && (
                  <button className="icon-btn" title={space.iotEnabled ? 'IoT enabled — click to disable' : 'IoT disabled — click to enable'} disabled={busy} onClick={() => toggleIot(space)}>
                    {space.iotEnabled ? <Wifi size={14} /> : <WifiOff size={14} />}
                  </button>
                )}
                {isOwner && (
                  <>
                    <button className="icon-btn" title="Move up" disabled={busy || isFirst} onClick={() => move(space, 'up')}>
                      <ArrowUp size={14} />
                    </button>
                    <button className="icon-btn" title="Move down" disabled={busy || isLast} onClick={() => move(space, 'down')}>
                      <ArrowDown size={14} />
                    </button>
                    {space.depth === 0 && (
                      <button className="icon-btn" title="Add table/room/canteen here" onClick={() => openAdd(space)}>
                        <Plus size={14} />
                      </button>
                    )}
                    <button className="icon-btn" title="Edit" onClick={() => openEdit(space)}>
                      <Pencil size={14} />
                    </button>
                    <button
                      className="icon-btn"
                      title={hasChildren(space.id) ? 'Delete its children first' : 'Delete'}
                      disabled={hasChildren(space.id)}
                      onClick={() => {
                        setDeleteError('');
                        setDeleteTarget(space);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </motion.div>
            );
          })}

          {isOwner && (
            <div style={{ padding: '0.5rem 0.75rem' }}>
              <Button variant="ghost" size="sm" onClick={() => openAdd(null)}>
                <Plus size={14} /> Add floor/hall
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} maxWidth={420}>
          <div style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
              {formMode === 'add' ? (parentSpaceId ? 'Add table/room/canteen' : 'Add floor/hall') : `Edit ${SPACE_KIND_LABELS[form.kind]}`}
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {formMode === 'add' && (
                <div>
                  <label className="field-label" htmlFor="space-kind">
                    Kind
                  </label>
                  <select id="space-kind" className="field-input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                    {kindOptions.map((k) => (
                      <option key={k} value={k}>
                        {SPACE_KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="field-label" htmlFor="space-label">
                  Label
                </label>
                <input
                  id="space-label"
                  type="text"
                  className="field-input"
                  placeholder="e.g. Floor 2, Table 12, Room 214"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="space-number">
                  Number <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <input id="space-number" type="text" className="field-input" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="field-label" htmlFor="space-length">
                    Length (m) <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                  </label>
                  <input
                    id="space-length"
                    type="number"
                    min="0.1"
                    step="0.1"
                    className="field-input"
                    placeholder="e.g. 6"
                    value={form.length}
                    onChange={(e) => setForm({ ...form, length: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="field-label" htmlFor="space-width">
                    Width (m) <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                  </label>
                  <input
                    id="space-width"
                    type="number"
                    min="0.1"
                    step="0.1"
                    className="field-input"
                    placeholder="e.g. 4"
                    value={form.width}
                    onChange={(e) => setForm({ ...form, width: e.target.value })}
                  />
                </div>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.5rem' }}>
                Used to draw this space to real proportions on the Devices → Floor Plan view.
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isBookable} onChange={(e) => setForm({ ...form, isBookable: e.target.checked })} />
                Bookable (e.g. hotel rooms)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.iotEnabled} onChange={(e) => setForm({ ...form, iotEnabled: e.target.checked })} />
                IoT enabled
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

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} maxWidth={380}>
          <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ color: 'var(--text-primary)' }}>Delete {spaceLabel(deleteTarget)}?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>This can&apos;t be undone.</p>
            {deleteError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{deleteError}</div>}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Button type="button" variant="ghost" fullWidth onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" fullWidth disabled={deleting} loading={deleting} onClick={confirmDelete}>
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
