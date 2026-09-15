'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarRange, RotateCcw, Users2 } from 'lucide-react';
import { jsonBody } from '@/lib/apiClient.js';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import SegmentedToggle from '@/components/ui/SegmentedToggle';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

// Mirrors PATCH /api/bookings/[id]/status's own ALLOWED_TRANSITIONS map
// exactly — this page must never offer a button the backend would reject.
const ALLOWED_TRANSITIONS = {
  pending_payment: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled'],
  checked_in: ['checked_out'],
  checked_out: [],
  cancelled: []
};

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'pending_payment', label: 'Pending Payment' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'checked_in', label: 'Checked In' },
  { key: 'checked_out', label: 'Checked Out' },
  { key: 'cancelled', label: 'Cancelled' }
];

const STATUS_LABELS = {
  pending_payment: 'Pending Payment',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled'
};

const ACTION_LABELS = {
  confirmed: 'Confirm',
  checked_in: 'Check In',
  checked_out: 'Check Out',
  cancelled: 'Cancel'
};

const getStatusColor = (status) => {
  switch (status) {
    case 'pending_payment':
      return 'var(--status-pending)';
    case 'confirmed':
      return 'var(--status-ready)';
    case 'checked_in':
      return 'var(--status-preparing)';
    case 'checked_out':
      return 'var(--status-completed)';
    case 'cancelled':
      return 'var(--status-cancelled)';
    default:
      return 'var(--text-secondary)';
  }
};

// The backend only lets a `confirmed` transition through for a cash
// booking (an online booking confirms itself via the Razorpay webhook) —
// filtered out here too so this page never shows a "Confirm" button the
// PATCH would 400 on.
const availableActions = (booking) => {
  const next = ALLOWED_TRANSITIONS[booking.status] || [];
  return next.filter((status) => status !== 'confirmed' || booking.paymentMethod === 'cash');
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Bookings — org-wide view of hotel room reservations (owner/manager),
 * with the same status-transition actions PATCH /api/bookings/[id]/status
 * exposes on the backend (confirm a cash booking, check in, check out,
 * cancel). No edit/delete here — a booking's lifecycle only ever moves
 * forward through `status`.
 */
export default function BookingsPage({ apiFetch }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  const load = async (status) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/bookings${status ? `?status=${status}` : ''}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not load bookings.');
        return;
      }
      setBookings(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load bookings:', e);
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleStatusChange = async (booking, status) => {
    setActionError('');
    setBusyId(booking.id);
    try {
      const res = await apiFetch(`/bookings/${booking.id}/status`, { method: 'PATCH', ...jsonBody({ status }) });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.message || 'Failed to update booking.');
        return;
      }
      setBookings((prev) => (statusFilter && data.status !== statusFilter ? prev.filter((b) => b.id !== data.id) : prev.map((b) => (b.id === data.id ? data : b))));
    } catch (e) {
      console.error('Failed to update booking status:', e);
      setActionError('Network error — please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.totalPrice || 0), 0);

  return (
    <div style={{ display: 'flex', gap: '1.5rem', width: '100%', alignItems: 'flex-start' }}>
      {/* 320px Sticky Left Sidebar Control Panel */}
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
          <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700 }}>Bookings</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
            Hotel room reservations across your organization.
          </p>
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Filter Status
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {STATUS_TABS.map((tab) => {
              const isActive = statusFilter === tab.key;
              const count = tab.key ? bookings.filter((b) => b.status === tab.key).length : bookings.length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`chip ${isActive ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    padding: '0.55rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'left',
                    width: '100%'
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.1rem 0.4rem',
                      borderRadius: 'var(--radius-full)',
                      background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--bg-surface)',
                      color: isActive ? '#fff' : 'var(--text-secondary)'
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Metrics Summary */}
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
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Reservation Stats
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Bookings</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{bookings.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Revenue</span>
            <span style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>${totalRevenue.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Right Main Content Panel */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {actionError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{actionError}</div>}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <Skeleton width="35%" height="1rem" />
                <Skeleton width="60%" height="0.85rem" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: 'var(--status-cancelled)' }}>{error}</span>
            <Button variant="secondary" onClick={() => load(statusFilter)}>
              <RotateCcw size={15} /> Retry
            </Button>
          </div>
        ) : bookings.length === 0 ? (
          <div
            className="glass-card"
            style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}
          >
            <CalendarRange size={28} strokeWidth={1.5} />
            No bookings {statusFilter ? `in ${STATUS_LABELS[statusFilter] || statusFilter}` : 'yet'}.
          </div>
        ) : (
          <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} variants={listVariants} initial="hidden" animate="show">
            {bookings.map((booking) => {
              const actions = availableActions(booking);
              const busy = busyId === booking.id;
              const statusColor = getStatusColor(booking.status);
              return (
                <motion.div key={booking.id} className="glass-card" variants={rowVariants} style={{ padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {booking.space?.label || 'Room'}
                        {booking.space?.number ? ` · ${booking.space.number}` : ''}
                      </strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{booking.site?.name || '—'}</div>
                    </div>
                    <span className="status-badge" style={{ backgroundColor: `${statusColor}22`, color: statusColor }}>
                      {STATUS_LABELS[booking.status] || booking.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span>Guest #{booking.customerId ? booking.customerId.slice(-6).toUpperCase() : '—'}</span>
                    <span>
                      {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Users2 size={13} /> {booking.numGuests}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>${Number(booking.totalPrice || 0).toFixed(2)}</span>
                    <span style={{ textTransform: 'capitalize' }}>{booking.paymentMethod || 'unpaid'}</span>
                  </div>

                  {actions.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                      {actions.map((status) => (
                        <button
                          key={status}
                          className={status === 'cancelled' ? 'btn-outline-dark' : 'btn-orange'}
                          style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
                          disabled={busy}
                          onClick={() => handleStatusChange(booking, status)}
                        >
                          {ACTION_LABELS[status]}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}

