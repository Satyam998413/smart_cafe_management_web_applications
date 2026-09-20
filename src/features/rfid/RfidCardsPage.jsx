'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, User, DoorOpen, Pencil } from 'lucide-react';
import { jsonBody } from '@/lib/apiClient.js';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';
import { buildSpaceTree, flattenSpaceTree, spaceLabel } from '@/lib/spaceTree.js';

const ACCESS_LEVELS = ['unassigned', 'staff', 'manager', 'guest'];
const STATUS_OPTIONS = ['active', 'blocked', 'lost'];

const STATUS_COLOR = {
  active: 'var(--status-confirmed, #10b981)',
  blocked: 'var(--status-cancelled, #ef4444)',
  lost: 'var(--accent-warning, #f59e0b)'
};

const EMPTY_FORM = { assignedToUserId: '', spaceId: '', accessLevel: 'unassigned', validUntil: '', status: 'active' };

/**
 * Owner/Manager RFID card assignment. A card's existence is decided
 * elsewhere entirely — a technician (or master admin) reads the physical
 * card through a paired RFID reader and registers it via
 * POST /api/technician/rfid-cards, unassigned. This page only ever
 * UPDATES that assignment (who holds it, which room it opens, its access
 * level/expiry/status) via PATCH /api/rfid/[id] — there's no create or
 * delete button here on purpose; those stay technician/master-admin-only
 * (DELETE /api/rfid/[id]).
 */
export default function RfidCardsPage({ apiFetch }) {
  const [cards, setCards] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [sites, setSites] = useState([]);
  const [editTarget, setEditTarget] = useState(null);
  const [editSiteId, setEditSiteId] = useState('');
  const [editSpaces, setEditSpaces] = useState([]);
  const [editSpacesLoading, setEditSpacesLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const staffLookup = Object.fromEntries(staff.map((s) => [s.id, s.name]));

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [cardsRes, staffRes] = await Promise.all([apiFetch('/rfid'), apiFetch('/staff')]);
      const cardsData = await cardsRes.json();
      const staffData = await staffRes.json();
      if (cardsRes.ok && Array.isArray(cardsData)) setCards(cardsData);
      else setError(cardsData.message || 'Could not load RFID cards.');
      if (staffRes.ok && Array.isArray(staffData)) setStaff(staffData);
    } catch (e) {
      console.error('Failed to load RFID cards:', e);
      setError('Could not load RFID cards.');
    } finally {
      setLoading(false);
    }
  };

  const loadSites = async () => {
    try {
      const res = await apiFetch('/sites');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setSites(data);
    } catch (e) {
      console.error('Failed to load sites:', e);
    }
  };

  useEffect(() => {
    load();
    loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadEditSpaces = async (siteId) => {
    setEditSpacesLoading(true);
    try {
      const res = await apiFetch(`/spaces?siteId=${siteId}`);
      const data = await res.json();
      setEditSpaces(res.ok && Array.isArray(data) ? flattenSpaceTree(buildSpaceTree(data)) : []);
    } catch (e) {
      console.error('Failed to load spaces:', e);
      setEditSpaces([]);
    } finally {
      setEditSpacesLoading(false);
    }
  };

  const handleEditSiteChange = (siteId) => {
    setEditSiteId(siteId);
    setForm((prev) => ({ ...prev, spaceId: '' }));
    if (siteId) loadEditSpaces(siteId);
    else setEditSpaces([]);
  };

  const openEdit = async (card) => {
    setEditTarget(card);
    setSaveError('');
    setForm({
      assignedToUserId: card.assignedToUserId || '',
      spaceId: card.spaceId || '',
      accessLevel: card.accessLevel || 'unassigned',
      validUntil: card.validUntil ? card.validUntil.slice(0, 10) : '',
      status: card.status || 'active'
    });
    const initialSiteId = sites[0]?.id || '';
    setEditSiteId(initialSiteId);
    if (initialSiteId) await loadEditSpaces(initialSiteId);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaving(true);
    try {
      const res = await apiFetch(`/rfid/${editTarget.id}`, {
        method: 'PATCH',
        ...jsonBody({
          assignedToUserId: form.assignedToUserId || null,
          spaceId: form.spaceId || null,
          accessLevel: form.accessLevel,
          validUntil: form.validUntil || null,
          status: form.status
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.message || 'Failed to save.');
        return;
      }
      setCards((prev) => prev.map((c) => (c.id === editTarget.id ? data : c)));
      setEditTarget(null);
    } catch (e) {
      console.error('Failed to update RFID card:', e);
      setSaveError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CreditCard size={22} color="var(--accent-primary)" /> RFID Cards
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.3rem', lineHeight: 1.4 }}>
          A technician registers a physical card by scanning it on-site — this page only assigns who holds it, which room it
          opens, its access level, and its status. Adding or removing a card itself is technician/master-admin only.
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Skeleton width={40} height={40} radius="50%" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <Skeleton width="30%" height="0.9rem" />
                <Skeleton width="45%" height="0.75rem" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="glass-card" style={{ padding: '1.5rem', color: 'var(--status-cancelled)' }}>{error}</div>
      ) : cards.length === 0 ? (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No RFID cards registered yet. A technician needs to scan one on-site first.
        </div>
      ) : (
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} variants={listVariants} initial="hidden" animate="show">
          {cards.map((card) => (
            <motion.div
              key={card.id}
              className="glass-card"
              variants={rowVariants}
              style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 180 }}>
                <CreditCard size={18} color="var(--text-secondary)" />
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>{card.cardNumber}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 160, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <User size={15} />
                {card.assignedToUserId ? staffLookup[card.assignedToUserId] || 'Unknown staff' : '— Unassigned —'}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 160, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <DoorOpen size={15} />
                {card.spaceName || '— No room —'}
              </div>

              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '0.2rem 0.55rem',
                  borderRadius: 999,
                  color: STATUS_COLOR[card.status] || 'var(--text-secondary)',
                  border: `1px solid ${STATUS_COLOR[card.status] || 'var(--border)'}`
                }}
              >
                {card.status}
              </span>

              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{card.accessLevel}</span>

              {card.validUntil && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Expires {card.validUntil.slice(0, 10)}</span>
              )}

              <div style={{ marginLeft: 'auto' }}>
                <Button variant="ghost" size="sm" onClick={() => openEdit(card)}>
                  <Pencil size={14} /> Assign
                </Button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {editTarget && (
        <Modal onClose={() => setEditTarget(null)} maxWidth={440}>
          <div style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '0.35rem', color: 'var(--text-primary)' }}>Assign card {editTarget.cardNumber}</h2>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Who holds this card, and which room (if any) does it open?
            </p>

            <form onSubmit={submitEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="field-label" htmlFor="rfid-staff">
                  Assigned Staff Member
                </label>
                <select
                  id="rfid-staff"
                  className="field-input"
                  value={form.assignedToUserId}
                  onChange={(e) => setForm((prev) => ({ ...prev, assignedToUserId: e.target.value }))}
                >
                  <option value="">— Unassigned —</option>
                  {staff.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} ({person.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label" htmlFor="rfid-site">
                  Site
                </label>
                <select id="rfid-site" className="field-input" value={editSiteId} onChange={(e) => handleEditSiteChange(e.target.value)}>
                  <option value="">— Select a site —</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label" htmlFor="rfid-space">
                  Room / Space
                </label>
                <select
                  id="rfid-space"
                  className="field-input"
                  value={form.spaceId}
                  onChange={(e) => setForm((prev) => ({ ...prev, spaceId: e.target.value }))}
                  disabled={editSpacesLoading || !editSiteId}
                >
                  <option value="">— No room —</option>
                  {editSpaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {'  '.repeat(space.depth)}
                      {spaceLabel(space)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="field-label" htmlFor="rfid-access">
                    Access Level
                  </label>
                  <select
                    id="rfid-access"
                    className="field-input"
                    value={form.accessLevel}
                    onChange={(e) => setForm((prev) => ({ ...prev, accessLevel: e.target.value }))}
                  >
                    {ACCESS_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="field-label" htmlFor="rfid-status">
                    Status
                  </label>
                  <select
                    id="rfid-status"
                    className="field-input"
                    value={form.status}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="rfid-valid-until">
                  Valid Until (optional)
                </label>
                <input
                  id="rfid-valid-until"
                  type="date"
                  className="field-input"
                  value={form.validUntil}
                  onChange={(e) => setForm((prev) => ({ ...prev, validUntil: e.target.value }))}
                />
              </div>

              {saveError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{saveError}</div>}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <Button type="button" variant="ghost" fullWidth onClick={() => setEditTarget(null)}>
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
