'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Cpu, Lightbulb, Fan, Snowflake, Plus, Trash2, Edit3, X, Check, Building2, Sliders } from 'lucide-react';
import { useOrgDetail } from '@/features/admin/OrgDetailContext';
import { buildSpaceTree, flattenSpaceTree, spaceLabel, SPACE_KIND_LABELS } from '@/lib/spaceTree.js';
import { Skeleton } from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';

const TYPE_ICONS = { lamp: Lightbulb, fan: Fan, ac: Snowflake, other: Cpu };
const getTypeIcon = (type) => TYPE_ICONS[type] || Cpu;

export default function OrgLayoutDevicesPage() {
  const { org, apiFetch } = useOrgDetail();

  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState('');
  const [siteId, setSiteId] = useState('');

  const [spaces, setSpaces] = useState([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [spacesError, setSpacesError] = useState('');
  const [spaceId, setSpaceId] = useState('');

  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState('');

  // Space modal state (Create / Edit)
  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [editingSpace, setEditingSpace] = useState(null); // null for create
  const [spaceForm, setSpaceForm] = useState({
    parentSpaceId: '',
    kind: 'floor',
    label: '',
    number: '',
    length: '',
    width: '',
    isBookable: false,
    pricePerNight: '',
    maxOccupancy: '',
    description: ''
  });
  const [spaceSubmitting, setSpaceSubmitting] = useState(false);

  // Delete modal state
  const [deletingSpace, setDeletingSpace] = useState(null);

  const loadSites = async () => {
    setSitesLoading(true);
    setSitesError('');
    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/sites`);
      const data = await res.json();
      if (!res.ok) {
        setSitesError(data.message || 'Could not load sites.');
        return;
      }
      const list = Array.isArray(data) ? data : [];
      setSites(list);
      setSiteId((prev) => prev || list[0]?.id || '');
    } catch (e) {
      console.error('Failed to load organization sites (admin):', e);
      setSitesError('Network error — please try again.');
    } finally {
      setSitesLoading(false);
    }
  };

  const loadSpaces = async (currentSiteId) => {
    if (!currentSiteId) {
      setSpaces([]);
      return;
    }
    setSpacesLoading(true);
    setSpacesError('');
    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/spaces?siteId=${currentSiteId}`);
      const data = await res.json();
      if (!res.ok) {
        setSpacesError(data.message || 'Could not load the layout.');
        return;
      }
      setSpaces(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load organization spaces (admin):', e);
      setSpacesError('Network error — please try again.');
    } finally {
      setSpacesLoading(false);
    }
  };

  const loadDevices = async (currentSpaceId) => {
    if (!currentSpaceId) {
      setDevices([]);
      return;
    }
    setDevicesLoading(true);
    setDevicesError('');
    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/devices?spaceId=${currentSpaceId}`);
      const data = await res.json();
      if (!res.ok) {
        setDevicesError(data.message || 'Could not load devices.');
        return;
      }
      setDevices(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load organization devices (admin):', e);
      setDevicesError('Network error — please try again.');
    } finally {
      setDevicesLoading(false);
    }
  };

  useEffect(() => {
    loadSites();
  }, [org.id]);

  useEffect(() => {
    setSpaceId('');
    setDevices([]);
    loadSpaces(siteId);
  }, [siteId]);

  useEffect(() => {
    loadDevices(spaceId);
  }, [spaceId]);

  const tree = buildSpaceTree(spaces);
  const flatSpaces = flattenSpaceTree(tree);
  const selectedSpace = flatSpaces.find((s) => s.id === spaceId);

  // Space CRUD Handlers
  const openCreateSpaceModal = () => {
    setEditingSpace(null);
    setSpaceForm({
      parentSpaceId: spaceId || '',
      kind: spaceId ? 'table' : 'floor',
      label: '',
      number: '',
      length: '',
      width: '',
      isBookable: false,
      pricePerNight: '',
      maxOccupancy: '',
      description: ''
    });
    setShowSpaceModal(true);
  };

  const openEditSpaceModal = (sp) => {
    setEditingSpace(sp);
    setSpaceForm({
      parentSpaceId: sp.parentSpaceId || '',
      kind: sp.kind || 'floor',
      label: sp.label || '',
      number: sp.number || '',
      length: sp.length || '',
      width: sp.width || '',
      isBookable: !!sp.isBookable,
      pricePerNight: sp.pricePerNight || '',
      maxOccupancy: sp.maxOccupancy || '',
      description: sp.description || ''
    });
    setShowSpaceModal(true);
  };

  const handleSaveSpace = async (e) => {
    e.preventDefault();
    if (!spaceForm.label || !siteId) return;

    setSpaceSubmitting(true);
    try {
      let res;
      if (editingSpace) {
        res = await apiFetch(`/admin/organizations/${org.id}/spaces`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spaceId: editingSpace.id,
            ...spaceForm
          })
        });
      } else {
        res = await apiFetch(`/admin/organizations/${org.id}/spaces`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteId,
            ...spaceForm
          })
        });
      }

      if (res.ok) {
        setShowSpaceModal(false);
        loadSpaces(siteId);
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to save space');
      }
    } catch (err) {
      console.error('Failed to save space:', err);
    } finally {
      setSpaceSubmitting(false);
    }
  };

  const handleDeleteSpace = async (sp) => {
    if (!confirm(`Are you sure you want to delete "${sp.label}"? This will remove all child spaces and devices.`)) {
      return;
    }

    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/spaces?spaceId=${sp.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        if (spaceId === sp.id) setSpaceId('');
        loadSpaces(siteId);
      }
    } catch (err) {
      console.error('Failed to delete space:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Site Selector & Add Action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {sites.length > 0 && (
            <select className="field-input" style={{ maxWidth: 320 }} value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={sitesLoading}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <Button variant="primary" onClick={openCreateSpaceModal} disabled={!siteId}>
          <Plus size={16} /> Add Space to Layout
        </Button>
      </div>

      {sitesError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{sitesError}</div>}
      {!sitesLoading && sites.length === 0 && !sitesError && (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          This organization has no sites yet.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '1.25rem', alignItems: 'start' }}>
        {/* Space tree with Full CRUD Controls */}
        <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <LayoutGrid size={15} /> Layout Tree ({flatSpaces.length})
            </span>
          </div>

          {spacesLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Skeleton width="80%" height="1.2rem" />
              <Skeleton width="70%" height="1.2rem" />
              <Skeleton width="60%" height="1.2rem" />
            </div>
          ) : spacesError ? (
            <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{spacesError}</div>
          ) : flatSpaces.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No spaces in this site yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {flatSpaces.map((space) => (
                <div
                  key={space.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyBetween: 'space-between',
                    padding: '0.4rem 0.5rem',
                    paddingLeft: `${0.6 + space.depth * 1.1}rem`,
                    borderRadius: 'var(--radius-md)',
                    background: spaceId === space.id ? 'var(--bg-surface-elevated)' : 'transparent',
                    border: spaceId === space.id ? '1px solid var(--accent-primary)' : '1px solid transparent'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSpaceId(space.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', flex: 1, minWidth: 0, fontSize: '0.82rem', fontWeight: spaceId === space.id ? 700 : 500 }}
                  >
                    <span className={`kind-badge kind-${space.kind}`} style={{ marginRight: '0.4rem' }}>
                      {SPACE_KIND_LABELS[space.kind]}
                    </span>
                    {spaceLabel(space)}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <button
                      onClick={() => openEditSpaceModal(space)}
                      title="Edit Space"
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteSpace(space)}
                      title="Delete Space"
                      style={{ background: 'none', border: 'none', color: 'var(--status-cancelled)', cursor: 'pointer', padding: '0.2rem' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected space's details & equipment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!spaceId ? (
            <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a space from the layout tree to view or add registered hardware devices.
            </div>
          ) : (
            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', borderBottom: '1px solid var(--border)', pb: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {selectedSpace ? spaceLabel(selectedSpace) : 'Space Details'}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Type: <strong style={{ textTransform: 'capitalize' }}>{selectedSpace?.kind}</strong> {selectedSpace?.length && selectedSpace?.width ? `· ${selectedSpace.length}m x ${selectedSpace.width}m` : ''}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button variant="secondary" onClick={() => openEditSpaceModal(selectedSpace)}>
                    <Edit3 size={14} /> Edit Space
                  </Button>
                </div>
              </div>

              {/* Devices list */}
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Registered Devices ({devices.length})
                </h4>

                {devicesLoading ? (
                  <Skeleton height="4rem" />
                ) : devices.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '1.5rem', textAlign: 'center', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
                    No IoT devices or smart locks registered in this space.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    {devices.map((device) => {
                      const Icon = getTypeIcon(device.type);
                      return (
                        <div
                          key={device.id}
                          style={{
                            padding: '0.85rem',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-surface-elevated)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                          }}
                        >
                          <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--accent-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{device.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>#{device.deviceNo || device.id.substring(0, 6)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Space Create / Edit Modal */}
      {showSpaceModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-card" style={{ maxWidth: 500, width: '100%', padding: '1.75rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {editingSpace ? 'Edit Space' : 'Create New Space'}
              </h3>
              <button onClick={() => setShowSpaceModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSpace} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="field-label">Space Kind</label>
                <select
                  className="field-input"
                  value={spaceForm.kind}
                  onChange={(e) => setSpaceForm({ ...spaceForm, kind: e.target.value })}
                >
                  <option value="floor">Floor / Level</option>
                  <option value="hall">Hall / Corridor</option>
                  <option value="room">Room / Suite</option>
                  <option value="table">Table / Station</option>
                  <option value="canteen">Canteen / Dining Area</option>
                  <option value="gallery">Gallery / Open Space</option>
                </select>
              </div>

              <div>
                <label className="field-label">Space Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ground Floor, Table 101, Executive Suite 201"
                  className="field-input"
                  value={spaceForm.label}
                  onChange={(e) => setSpaceForm({ ...spaceForm, label: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="field-label">Number / Code</label>
                  <input
                    type="text"
                    placeholder="101"
                    className="field-input"
                    value={spaceForm.number}
                    onChange={(e) => setSpaceForm({ ...spaceForm, number: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Parent Space</label>
                  <select
                    className="field-input"
                    value={spaceForm.parentSpaceId}
                    onChange={(e) => setSpaceForm({ ...spaceForm, parentSpaceId: e.target.value })}
                  >
                    <option value="">None (Top Level)</option>
                    {flatSpaces.map((s) => (
                      <option key={s.id} value={s.id}>{spaceLabel(s)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="field-label">Length (meters)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="10.0"
                    className="field-input"
                    value={spaceForm.length}
                    onChange={(e) => setSpaceForm({ ...spaceForm, length: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Width (meters)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="8.0"
                    className="field-input"
                    value={spaceForm.width}
                    onChange={(e) => setSpaceForm({ ...spaceForm, width: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem' }}>
                <Button variant="ghost" type="button" onClick={() => setShowSpaceModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={spaceSubmitting}>
                  {spaceSubmitting ? 'Saving...' : 'Save Space'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
