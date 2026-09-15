'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BedDouble, Users2, Pencil, Trash2, ImagePlus, RotateCcw, Plus, X } from 'lucide-react';
import { jsonBody } from '@/lib/apiClient.js';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

const EMPTY_FORM = { label: '', number: '', pricePerNight: '', description: '', maxOccupancy: '' };

/**
 * Rooms — hotel room inventory (price/night, description, occupancy, photos)
 * built on top of the generic `spaces` tree (kind='room', isBookable=true).
 * Only meaningful for a `hotel` premise-type org, so this page independently
 * confirms that via GET /api/organizations/me before rendering anything else
 * — NavLinks also hides the nav entry for a non-hotel org, but per this
 * feature's own build notes the in-page check is the one that actually
 * matters (the route stays reachable by direct URL either way).
 *
 * Owner can add/edit/delete rooms and manage photos; Manager gets a
 * read-only view (mirrors GET /api/spaces being owner/manager while
 * POST/PATCH/DELETE and the photo routes are owner-only).
 */
export default function RoomsPage({ apiFetch, authRole }) {
  const isOwner = authRole === 'owner';

  const [org, setOrg] = useState(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgError, setOrgError] = useState('');

  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');

  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' | 'edit'
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [photosTarget, setPhotosTarget] = useState(null); // the room currently open in the photo manager
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef(null);

  const loadOrg = async () => {
    setOrgLoading(true);
    setOrgError('');
    try {
      const res = await apiFetch('/organizations/me');
      const data = await res.json();
      if (!res.ok) {
        setOrgError(data.message || 'Could not load your organization.');
        return;
      }
      setOrg(data);
    } catch (e) {
      console.error('Failed to load organization:', e);
      setOrgError('Network error — please try again.');
    } finally {
      setOrgLoading(false);
    }
  };

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

  const loadRooms = async (siteId) => {
    if (!siteId) {
      setRooms([]);
      return;
    }
    setRoomsLoading(true);
    setRoomsError('');
    try {
      const res = await apiFetch(`/spaces?siteId=${siteId}&kind=room&includeImages=1`);
      const data = await res.json();
      if (!res.ok) {
        setRoomsError(data.message || 'Could not load rooms.');
        return;
      }
      setRooms(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load rooms:', e);
      setRoomsError('Network error — please try again.');
    } finally {
      setRoomsLoading(false);
    }
  };

  useEffect(() => {
    loadOrg();
    loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadRooms(selectedSiteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSiteId]);

  const isHotel = org?.premiseType === 'hotel';

  const openAdd = () => {
    setFormMode('add');
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (room) => {
    setFormMode('edit');
    setEditingId(room.id);
    setForm({
      label: room.label || '',
      number: room.number || '',
      pricePerNight: room.pricePerNight ?? '',
      description: room.description || '',
      maxOccupancy: room.maxOccupancy ?? ''
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
    if (form.pricePerNight !== '' && Number(form.pricePerNight) < 0) {
      setFormError('Price per night must not be negative.');
      return;
    }
    setSaving(true);
    try {
      const sharedPayload = {
        label: form.label,
        number: form.number || undefined,
        pricePerNight: form.pricePerNight === '' ? null : Number(form.pricePerNight),
        description: form.description || undefined,
        maxOccupancy: form.maxOccupancy === '' ? null : Number(form.maxOccupancy)
      };
      const res =
        formMode === 'add'
          ? await apiFetch('/spaces', {
              method: 'POST',
              ...jsonBody({ siteId: selectedSiteId, kind: 'room', isBookable: true, ...sharedPayload })
            })
          : await apiFetch(`/spaces/${editingId}`, { method: 'PATCH', ...jsonBody(sharedPayload) });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message || 'Failed to save.');
        return;
      }
      setRooms((prev) => (formMode === 'add' ? [{ ...data, images: [] }, ...prev] : prev.map((r) => (r.id === data.id ? { ...data, images: r.images } : r))));
      setShowForm(false);
    } catch (e) {
      console.error('Failed to save room:', e);
      setFormError('Network error — please try again.');
    } finally {
      setSaving(false);
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
      setRooms((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      console.error('Failed to delete room:', e);
      setDeleteError('Network error — please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const openPhotos = (room) => {
    setPhotoError('');
    setPhotosTarget(room);
  };

  const syncRoomImages = (roomId, images) => {
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, images } : r)));
    setPhotosTarget((prev) => (prev && prev.id === roomId ? { ...prev, images } : prev));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file || !photosTarget) return;

    setPhotoError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'room');
      const uploadRes = await apiFetch('/uploads', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setPhotoError(uploadData.message || 'Upload failed.');
        return;
      }

      const attachRes = await apiFetch(`/spaces/${photosTarget.id}/images`, { method: 'POST', ...jsonBody({ imageUrl: uploadData.url }) });
      const attached = await attachRes.json();
      if (!attachRes.ok) {
        setPhotoError(attached.message || 'Failed to attach photo.');
        return;
      }

      syncRoomImages(photosTarget.id, [...(photosTarget.images || []), attached]);
    } catch (e) {
      console.error('Failed to upload room photo:', e);
      setPhotoError('Network error — please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (image) => {
    if (!photosTarget) return;
    setPhotoError('');
    try {
      const res = await apiFetch(`/spaces/${photosTarget.id}/images/${image.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setPhotoError(data.message || 'Failed to remove photo.');
        return;
      }
      syncRoomImages(photosTarget.id, (photosTarget.images || []).filter((img) => img.id !== image.id));
    } catch (e) {
      console.error('Failed to remove room photo:', e);
      setPhotoError('Network error — please try again.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>Rooms</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>Hotel room inventory, rates, and photos.</p>
        </div>
        {!sitesLoading && !sitesError && sites.length > 0 && isHotel && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <select className="field-input" style={{ width: 'auto', minWidth: 200 }} value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)}>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
            {isOwner && (
              <button className="btn-orange" onClick={openAdd}>
                <Plus size={16} /> + Add Room
              </button>
            )}
          </div>
        )}
      </div>

      {orgLoading ? (
        <Skeleton height="2.5rem" width={220} />
      ) : orgError ? (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--status-cancelled)' }}>{orgError}</span>
          <Button variant="secondary" onClick={loadOrg}>
            <RotateCcw size={15} /> Retry
          </Button>
        </div>
      ) : !isHotel ? (
        <div
          className="glass-card"
          style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}
        >
          <BedDouble size={28} strokeWidth={1.5} />
          Room management is only available for hotel organizations.
        </div>
      ) : sitesLoading ? (
        <div className="menu-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Skeleton height="9rem" />
              <Skeleton width="60%" height="1rem" />
              <Skeleton width="40%" height="0.85rem" />
            </div>
          ))}
        </div>
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
          <BedDouble size={28} strokeWidth={1.5} />
          Add a site first — rooms need one to attach to.
        </div>
      ) : roomsLoading ? (
        <div className="menu-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Skeleton height="9rem" />
              <Skeleton width="60%" height="1rem" />
              <Skeleton width="40%" height="0.85rem" />
            </div>
          ))}
        </div>
      ) : roomsError ? (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--status-cancelled)' }}>{roomsError}</span>
          <Button variant="secondary" onClick={() => loadRooms(selectedSiteId)}>
            <RotateCcw size={15} /> Retry
          </Button>
        </div>
      ) : rooms.length === 0 ? (
        <div
          className="glass-card"
          style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}
        >
          <BedDouble size={28} strokeWidth={1.5} />
          No rooms yet.
          {isOwner && (
            <Button variant="primary" size="sm" onClick={openAdd}>
              Add your first room
            </Button>
          )}
        </div>
      ) : (
        <motion.div className="menu-grid" variants={listVariants} initial="hidden" animate="show">
          {rooms.map((room) => {
            const cover = room.images && room.images.length > 0 ? room.images[0] : null;
            return (
              <motion.div key={room.id} className="glass-card" variants={rowVariants} style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', width: '100%', height: 160, background: 'var(--bg-surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover.imageUrl} alt={room.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <BedDouble size={32} strokeWidth={1.5} color="var(--text-muted)" />
                  )}
                  {room.images && room.images.length > 1 && (
                    <span className="nav-badge" style={{ position: 'absolute', bottom: '0.5rem', right: '0.5rem' }}>
                      +{room.images.length - 1}
                    </span>
                  )}
                </div>
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {room.label}
                    {room.number ? ` · ${room.number}` : ''}
                  </strong>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', flex: 1 }}>{room.description || 'No description yet.'}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>
                      {room.pricePerNight != null ? `$${Number(room.pricePerNight).toFixed(2)}/night` : 'No rate set'}
                    </span>
                    {room.maxOccupancy != null && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <Users2 size={14} /> {room.maxOccupancy}
                      </span>
                    )}
                  </div>
                  {isOwner && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button className="icon-btn" onClick={() => openPhotos(room)} aria-label={`Manage photos for ${room.label}`} title="Manage photos">
                        <ImagePlus size={15} />
                      </button>
                      <button className="icon-btn" onClick={() => openEdit(room)} aria-label={`Edit ${room.label}`} title="Edit room">
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => {
                          setDeleteError('');
                          setDeleteTarget(room);
                        }}
                        aria-label={`Delete ${room.label}`}
                        title="Delete room"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} maxWidth={460}>
          <div style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>{formMode === 'add' ? 'Add Room' : 'Edit Room'}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="field-label" htmlFor="room-label">
                  Label
                </label>
                <input
                  id="room-label"
                  type="text"
                  className="field-input"
                  placeholder="e.g. Deluxe Room"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="room-number">
                  Number <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <input id="room-number" type="text" className="field-input" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
              </div>
              <div>
                <label className="field-label" htmlFor="room-price">
                  Price per night
                </label>
                <input
                  id="room-price"
                  type="number"
                  min="0"
                  step="0.01"
                  className="field-input"
                  placeholder="0.00"
                  value={form.pricePerNight}
                  onChange={(e) => setForm({ ...form, pricePerNight: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="room-occupancy">
                  Max occupancy <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <input
                  id="room-occupancy"
                  type="number"
                  min="1"
                  step="1"
                  className="field-input"
                  value={form.maxOccupancy}
                  onChange={(e) => setForm({ ...form, maxOccupancy: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="room-description">
                  Description <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <textarea
                  id="room-description"
                  className="field-input"
                  rows={3}
                  style={{ resize: 'vertical' }}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
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

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} maxWidth={380}>
          <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ color: 'var(--text-primary)' }}>Delete {deleteTarget.label}?</h2>
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

      {photosTarget && (
        <Modal onClose={() => setPhotosTarget(null)} maxWidth={520}>
          <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: 'var(--text-primary)' }}>Photos — {photosTarget.label}</h2>
              <button className="icon-btn" onClick={() => setPhotosTarget(null)} aria-label="Close photo manager">
                <X size={16} />
              </button>
            </div>

            {(photosTarget.images || []).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No photos yet.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.75rem' }}>
                {photosTarget.images.map((image) => (
                  <div key={image.id} style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '1' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.imageUrl} alt={`${photosTarget.label} photo`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {isOwner && (
                      <button
                        className="icon-btn"
                        onClick={() => handleDeletePhoto(image)}
                        aria-label="Remove this photo"
                        title="Remove photo"
                        style={{ position: 'absolute', top: '0.35rem', right: '0.35rem', background: 'rgba(0,0,0,0.55)', color: '#fff' }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {photoError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{photoError}</div>}

            {isOwner && (
              <>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} style={{ display: 'none' }} id="room-photo-input" />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={uploading}
                  loading={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload a new photo"
                >
                  {uploading ? 'Uploading…' : (
                    <>
                      <ImagePlus size={15} /> Upload photo
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
