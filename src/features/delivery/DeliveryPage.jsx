'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bike, MapPin, Truck, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import SegmentedToggle from '@/components/ui/SegmentedToggle';
import { jsonBody } from '@/lib/apiClient.js';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

const DELIVERY_STATUSES = ['unassigned', 'assigned', 'picked_up', 'delivered'];
const SUB_TABS = [
  { key: 'orders', label: 'Delivery Orders' },
  { key: 'riders', label: 'Riders' },
  { key: 'zones', label: 'Zones' }
];

/**
 * Owner/Manager delivery console: riders + zones (create/list only — the
 * backend exposes no PATCH/DELETE for either yet, so "CRUD" here is really
 * "list + create"; zones re-POST as an upsert by site+pincode, which
 * doubles as editing one), plus assigning a rider and moving a delivery
 * order's own status track (independent of the kitchen-side order.status —
 * see orders/[orderId]/delivery/route.js's own comment) for orders with
 * orderType === 'delivery'.
 */
export default function DeliveryPage({ apiFetch, orders, onOrderUpdated }) {
  const [subTab, setSubTab] = useState('orders');
  const [riders, setRiders] = useState([]);
  const [ridersLoading, setRidersLoading] = useState(true);
  const [ridersError, setRidersError] = useState('');

  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [zonesError, setZonesError] = useState('');

  const [sites, setSites] = useState([]);

  const loadRiders = async () => {
    setRidersLoading(true);
    setRidersError('');
    try {
      const res = await apiFetch('/delivery/riders');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load riders');
      setRiders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load riders:', e);
      setRidersError('Could not load riders.');
    } finally {
      setRidersLoading(false);
    }
  };

  const loadZones = async () => {
    setZonesLoading(true);
    setZonesError('');
    try {
      const res = await apiFetch('/delivery/zones');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load zones');
      setZones(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load zones:', e);
      setZonesError('Could not load delivery zones.');
    } finally {
      setZonesLoading(false);
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
    loadRiders();
    loadZones();
    loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deliveryOrders = (orders || []).filter((o) => o.orderType === 'delivery');

  return (
    <div style={{ display: 'flex', gap: '1.5rem', width: '100%', maxWidth: 1400, margin: '0 auto', alignItems: 'flex-start' }}>
      {/* Left Sidebar Control Panel (320px Sticky) */}
      <div
        className="glass-card"
        style={{
          width: 320,
          flexShrink: 0,
          position: 'sticky',
          top: '1.5rem',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          maxHeight: 'calc(100vh - 3rem)',
          overflowY: 'auto'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={22} color="var(--accent-primary)" /> Delivery Console
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.3rem', lineHeight: 1.4 }}>
            Manage delivery orders, riders, and pincode service zones.
          </p>
        </div>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* Sub Tab Navigation */}
        <div>
          <label className="field-label" style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-secondary)', display: 'block' }}>
            Console Section
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'var(--bg-surface)', padding: 4, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            {SUB_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSubTab(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: 'none',
                  background: subTab === tab.key ? 'var(--accent-primary)' : 'transparent',
                  color: subTab === tab.key ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease'
                }}
              >
                {tab.key === 'orders' ? <Truck size={15} /> : tab.key === 'riders' ? <Bike size={15} /> : <MapPin size={15} />}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* Delivery Metrics Summary */}
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div>Active Delivery Orders: <strong>{deliveryOrders.length}</strong></div>
          <div>Registered Riders: <strong>{riders.length}</strong></div>
          <div>Active Delivery Zones: <strong>{zones.length}</strong></div>
        </div>
      </div>

      {/* Main Right Content Panel */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {subTab === 'orders' && <DeliveryOrdersPanel orders={deliveryOrders} riders={riders} apiFetch={apiFetch} onOrderUpdated={onOrderUpdated} />}
        {subTab === 'riders' && (
          <RidersPanel riders={riders} loading={ridersLoading} error={ridersError} apiFetch={apiFetch} onCreated={loadRiders} />
        )}
        {subTab === 'zones' && (
          <ZonesPanel zones={zones} loading={zonesLoading} error={zonesError} sites={sites} apiFetch={apiFetch} onSaved={loadZones} />
        )}
      </div>
    </div>
  );
}

function DeliveryOrdersPanel({ orders, riders, apiFetch, onOrderUpdated }) {
  const [pendingKey, setPendingKey] = useState('');
  const [errorsByOrder, setErrorsByOrder] = useState({});

  const patchDelivery = async (orderId, payload, key) => {
    setPendingKey(key);
    setErrorsByOrder((prev) => ({ ...prev, [orderId]: '' }));
    try {
      const res = await apiFetch(`/orders/${orderId}/delivery`, { method: 'PATCH', ...jsonBody(payload) });
      const data = await res.json();
      if (!res.ok) {
        setErrorsByOrder((prev) => ({ ...prev, [orderId]: data.message || 'Update failed' }));
        return;
      }
      onOrderUpdated?.(data.order);
    } catch (e) {
      console.error('Failed to update delivery:', e);
      setErrorsByOrder((prev) => ({ ...prev, [orderId]: 'Network error — please try again.' }));
    } finally {
      setPendingKey('');
    }
  };

  if (orders.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
        <Truck size={28} strokeWidth={1.5} />
        No delivery orders right now.
      </div>
    );
  }

  return (
    <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} variants={listVariants} initial="hidden" animate="show">
      {orders.map((order) => {
        const riderKey = `${order._id}-rider`;
        const statusKey = `${order._id}-status`;
        return (
          <motion.div key={order._id} className="glass-card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }} variants={rowVariants}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span className="order-id">#{order._id.slice(-6).toUpperCase()}</span>
                <span style={{ marginLeft: '0.6rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {order.user?.name || 'Customer'} · {order.deliveryAddress || 'No address on file'}
                </span>
              </div>
              <span className="order-total">${(order.totalAmount || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <select
                className="status-select"
                value={order.assignedRiderId || ''}
                disabled={pendingKey === riderKey}
                onChange={(e) => patchDelivery(order._id, { riderId: e.target.value || null }, riderKey)}
              >
                <option value="">Unassigned rider</option>
                {riders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <select
                className="status-select"
                value={order.deliveryStatus || 'unassigned'}
                disabled={pendingKey === statusKey}
                onChange={(e) => patchDelivery(order._id, { deliveryStatus: e.target.value }, statusKey)}
              >
                {DELIVERY_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            {errorsByOrder[order._id] && <span style={{ fontSize: '0.78rem', color: 'var(--status-cancelled)' }}>{errorsByOrder[order._id]}</span>}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

function RidersPanel({ riders, loading, error, apiFetch, onCreated }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setFormError('');
    try {
      const res = await apiFetch('/delivery/riders', { method: 'POST', ...jsonBody({ name: name.trim(), phone: phone.trim() || undefined }) });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message || 'Could not add rider.');
        return;
      }
      setName('');
      setPhone('');
      setShowForm(false);
      onCreated();
    } catch (e) {
      console.error('Failed to add rider:', e);
      setFormError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} /> Add Rider
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '1.1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <input type="text" className="field-input" style={{ maxWidth: 220 }} placeholder="Rider name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input type="text" className="field-input" style={{ maxWidth: 200 }} placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button type="submit" variant="primary" loading={saving} disabled={saving || !name.trim()}>
            Save
          </Button>
          {formError && <span style={{ width: '100%', fontSize: '0.8rem', color: 'var(--status-cancelled)' }}>{formError}</span>}
        </form>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card staff-row">
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div className="skeleton" style={{ width: '30%', height: '0.9rem' }} />
                <div className="skeleton" style={{ width: '45%', height: '0.75rem' }} />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--status-cancelled)' }}>
          {error}
        </div>
      ) : riders.length === 0 ? (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <Bike size={28} strokeWidth={1.5} />
          No riders added yet.
        </div>
      ) : (
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} variants={listVariants} initial="hidden" animate="show">
          {riders.map((rider) => (
            <motion.div key={rider.id} className="glass-card entity-row" variants={rowVariants}>
              <div className="entity-icon">
                <Bike size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{rider.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{rider.phone || 'No phone on file'}</div>
              </div>
              <span className="status-pill" style={{ background: rider.isActive === false ? 'rgba(220,38,38,0.1)' : 'rgba(5,150,105,0.1)', color: rider.isActive === false ? '#b91c1c' : '#047857' }}>
                {rider.isActive === false ? 'Inactive' : 'Active'}
              </span>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function ZonesPanel({ zones, loading, error, sites, apiFetch, onSaved }) {
  const [showForm, setShowForm] = useState(false);
  const [siteId, setSiteId] = useState('');
  const [pincode, setPincode] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [etaMinutes, setEtaMinutes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Clicking an existing zone prefills the form for editing — there's no
  // PATCH endpoint, but re-POSTing the same (siteId, pincode) upserts it
  // (see the route's own comment), so this doubles as "edit".
  const openEditZone = (zone) => {
    setSiteId(zone.siteId);
    setPincode(zone.pincode);
    setDeliveryFee(String(zone.deliveryFee ?? ''));
    setEtaMinutes(zone.etaMinutes != null ? String(zone.etaMinutes) : '');
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!siteId || !pincode.trim()) return;
    setSaving(true);
    setFormError('');
    try {
      const res = await apiFetch('/delivery/zones', {
        method: 'POST',
        ...jsonBody({
          siteId,
          pincode: pincode.trim(),
          deliveryFee: deliveryFee === '' ? 0 : Number(deliveryFee),
          etaMinutes: etaMinutes === '' ? null : Number(etaMinutes)
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message || 'Could not save zone.');
        return;
      }
      setPincode('');
      setDeliveryFee('');
      setEtaMinutes('');
      setShowForm(false);
      onSaved();
    } catch (e) {
      console.error('Failed to save delivery zone:', e);
      setFormError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)} disabled={sites.length === 0}>
          <Plus size={14} /> Add / Update Zone
        </Button>
        {sites.length === 0 && <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Add a site first.</span>}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '1.1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <select className="field-input" style={{ maxWidth: 200 }} value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
            <option value="">Select site…</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input type="text" className="field-input" style={{ maxWidth: 140 }} placeholder="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} required />
          <input type="number" className="field-input" style={{ maxWidth: 130 }} placeholder="Fee" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} min="0" step="0.01" />
          <input type="number" className="field-input" style={{ maxWidth: 130 }} placeholder="ETA (min)" value={etaMinutes} onChange={(e) => setEtaMinutes(e.target.value)} min="0" />
          <Button type="submit" variant="primary" loading={saving} disabled={saving || !siteId || !pincode.trim()}>
            Save
          </Button>
          {formError && <span style={{ width: '100%', fontSize: '0.8rem', color: 'var(--status-cancelled)' }}>{formError}</span>}
        </form>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card" style={{ padding: '1rem 1.1rem' }}>
              <div className="skeleton" style={{ width: '40%', height: '0.9rem' }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--status-cancelled)' }}>
          {error}
        </div>
      ) : zones.length === 0 ? (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <MapPin size={28} strokeWidth={1.5} />
          No delivery zones configured yet.
        </div>
      ) : (
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} variants={listVariants} initial="hidden" animate="show">
          {zones.map((zone) => (
            <motion.button
              key={zone.id}
              type="button"
              className="glass-card entity-row"
              variants={rowVariants}
              onClick={() => openEditZone(zone)}
              style={{ border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', font: 'inherit', color: 'inherit' }}
              title="Click to edit this zone"
            >
              <div className="entity-icon">
                <MapPin size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{zone.pincode}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Fee ${Number(zone.deliveryFee).toFixed(2)} {zone.etaMinutes ? `· ~${zone.etaMinutes} min` : ''}
                </div>
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
