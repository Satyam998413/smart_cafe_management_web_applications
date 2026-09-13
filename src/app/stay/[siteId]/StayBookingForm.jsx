'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BedDouble, Users, CalendarDays, CircleCheck, CreditCard, Banknote, Clock, ArrowLeft, ImageOff } from 'lucide-react';
import Button from '@/components/ui/Button';
import { SkeletonGrid } from '@/components/ui/Skeleton';
import { createApiFetch, jsonBody, getOrCreateHiveId, todayIso } from '@/lib/apiClient.js';
import { openRazorpayCheckout } from '@/lib/loadRazorpayCheckout.js';

const PENDING_BOOKING_KEY = 'pendingStayBookingId';
const POLL_MS = 4000;

const readPendingBookingId = () => (typeof window !== 'undefined' ? localStorage.getItem(PENDING_BOOKING_KEY) : null);
const savePendingBookingId = (id) => {
  if (typeof window !== 'undefined') localStorage.setItem(PENDING_BOOKING_KEY, id);
};
const clearPendingBookingId = () => {
  if (typeof window !== 'undefined') localStorage.removeItem(PENDING_BOOKING_KEY);
};
const hasToken = () => typeof window !== 'undefined' && Boolean(localStorage.getItem('token'));

const addDays = (isoDate, days) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const nightsBetween = (checkIn, checkOut) =>
  Math.round((new Date(`${checkOut}T00:00:00Z`) - new Date(`${checkIn}T00:00:00Z`)) / (24 * 60 * 60 * 1000));

/**
 * The interactive half of the guest room-booking page — its own 'use
 * client' file since the parent page.js is an async Server Component.
 *
 * Steps: dates -> rooms -> [guest-info, only if not already signed in] ->
 * confirm -> payment -> confirmed. Recovers a payment left in progress from
 * a previous visit the same way BillingCheckoutPage/WalletPage do: the
 * booking id persists to localStorage the moment it exists, read back on
 * mount, with the current status re-fetched (GET /api/bookings/[id], which
 * also reconciles against Razorpay) rather than trusted from local state
 * alone. This page has no ambient socket connection (unlike the dashboard
 * shell's BillingCheckoutPage) so freshness while a payment is pending
 * comes from polling only — the same approach WalletPage already uses for
 * coin purchases, which has the identical "no live socket available" shape.
 */
export default function StayBookingForm({ siteId, orgName }) {
  // Lazy useState initializer (runs exactly once), not a ref — reading a
  // ref's .current during render is itself a lint violation, and this value
  // never needs to trigger a re-render anyway.
  const [apiFetch] = useState(() =>
    createApiFetch(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('userName');
      localStorage.removeItem('userId');
    })
  );

  const [step, setStep] = useState('recovering');
  const [recoverError, setRecoverError] = useState('');

  const today = todayIso();
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(addDays(today, 1));
  const [numGuests, setNumGuests] = useState(1);
  const [datesError, setDatesError] = useState('');

  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);

  const [guestName, setGuestName] = useState('');
  const [guestIdentifier, setGuestIdentifier] = useState('');
  const [guestError, setGuestError] = useState('');
  const [guestSubmitting, setGuestSubmitting] = useState(false);

  const [specialRequests, setSpecialRequests] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const [booking, setBooking] = useState(null);
  const [payingCash, setPayingCash] = useState(false);
  const [payingOnline, setPayingOnline] = useState(false);
  const [payError, setPayError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const bookingRef = useRef(booking);
  useEffect(() => {
    bookingRef.current = booking;
  }, [booking]);

  // --- Recovery: a booking id left over from a previous session/tab. -----
  useEffect(() => {
    const id = readPendingBookingId();
    if (!id || !hasToken()) {
      if (id && !hasToken()) clearPendingBookingId();
      setStep('dates');
      return;
    }
    (async () => {
      try {
        const res = await apiFetch(`/bookings/${id}`);
        if (res.status === 404) {
          clearPendingBookingId();
          setStep('dates');
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          clearPendingBookingId();
          setStep('dates');
          return;
        }
        setBooking(data);
        if (data.status === 'pending_payment') {
          setStep('payment');
        } else {
          clearPendingBookingId();
          setStep('confirmed');
        }
      } catch (e) {
        console.error('Failed to recover pending booking:', e);
        setRecoverError('Could not check your pending booking — starting a fresh search instead.');
        setStep('dates');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Poll while a payment is pending (see file header: no ambient socket
  // on this standalone page, so polling is the only freshness mechanism). --
  useEffect(() => {
    if (!booking || booking.status !== 'pending_payment' || !booking.paymentMethod) return undefined;
    const id = setInterval(async () => {
      try {
        const res = await apiFetch(`/bookings/${booking.id}`);
        if (res.ok) {
          const data = await res.json();
          setBooking(data);
          if (data.status !== 'pending_payment') clearPendingBookingId();
        }
      } catch (e) {
        console.error('Booking reconcile poll failed:', e);
      }
    }, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id, booking?.status, booking?.paymentMethod]);

  const loadRooms = async (nextCheckIn, nextCheckOut) => {
    setRoomsLoading(true);
    setRoomsError('');
    try {
      const params = new URLSearchParams({ siteId, checkIn: nextCheckIn, checkOut: nextCheckOut });
      const res = await fetch(`/api/rooms?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setRoomsError(data.message || 'Could not load rooms for those dates.');
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

  const handleSubmitDates = async (e) => {
    e.preventDefault();
    setDatesError('');
    if (checkOut <= checkIn) {
      setDatesError('Check-out must be after check-in.');
      return;
    }
    if (checkIn < today) {
      setDatesError('Check-in cannot be in the past.');
      return;
    }
    setStep('rooms');
    await loadRooms(checkIn, checkOut);
  };

  const handlePickRoom = (room) => {
    setSelectedRoom(room);
    setConfirmError('');
    setSpecialRequests('');
    setStep(hasToken() ? 'confirm' : 'guest-info');
  };

  const handleSubmitGuestInfo = async (e) => {
    e.preventDefault();
    setGuestError('');
    const trimmedIdentifier = guestIdentifier.trim();
    if (!trimmedIdentifier) {
      setGuestError('Enter your email or phone number.');
      return;
    }
    const isEmail = trimmedIdentifier.includes('@');
    setGuestSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: guestName.trim() || undefined,
          hiveId: getOrCreateHiveId(),
          email: isEmail ? trimmedIdentifier : undefined,
          phone: isEmail ? undefined : trimmedIdentifier
        })
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setGuestError(data.message || 'Could not sign you in — please try again.');
        return;
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.user?.role || 'customer');
      localStorage.setItem('userName', data.user?.name || guestName.trim());
      localStorage.setItem('userId', data.user?.id || '');
      setStep('confirm');
    } catch (e) {
      console.error('Guest sign-in failed:', e);
      setGuestError('Network error — check your connection and try again.');
    } finally {
      setGuestSubmitting(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedRoom) return;
    if (selectedRoom.maxOccupancy && numGuests > selectedRoom.maxOccupancy) {
      setConfirmError(`This room sleeps at most ${selectedRoom.maxOccupancy} guests.`);
      return;
    }
    setConfirming(true);
    setConfirmError('');
    try {
      const res = await apiFetch('/bookings', {
        method: 'POST',
        ...jsonBody({ spaceId: selectedRoom.id, checkIn, checkOut, numGuests, specialRequests: specialRequests.trim() || undefined })
      });
      const data = await res.json();
      if (!res.ok) {
        setConfirmError(data.message || 'Could not create your booking.');
        return;
      }
      setBooking(data);
      savePendingBookingId(data.id);
      setStep('payment');
    } catch (e) {
      console.error('Failed to create booking:', e);
      setConfirmError('Network error — please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const handlePayCash = async () => {
    if (!booking) return;
    setPayingCash(true);
    setPayError('');
    try {
      const res = await apiFetch(`/bookings/${booking.id}/pay/cash`, { method: 'POST', ...jsonBody({}) });
      const data = await res.json();
      if (!res.ok) {
        setPayError(data.message || 'Could not record your cash choice.');
        return;
      }
      setBooking(data);
    } catch (e) {
      console.error('Failed to choose cash payment:', e);
      setPayError('Network error — please try again.');
    } finally {
      setPayingCash(false);
    }
  };

  const handlePayOnline = async () => {
    if (!booking) return;
    setPayingOnline(true);
    setPayError('');
    try {
      const res = await apiFetch(`/bookings/${booking.id}/pay/razorpay`, { method: 'POST', ...jsonBody({}) });
      const params = await res.json();
      if (!res.ok) {
        setPayError(params.message || 'Could not start online payment.');
        return;
      }
      setBooking((prev) => (prev ? { ...prev, paymentMethod: 'online', razorpayOrderId: params.razorpayOrderId } : prev));

      try {
        await openRazorpayCheckout({
          keyId: params.keyId,
          amount: params.amount,
          currency: params.currency,
          orderId: params.razorpayOrderId,
          description: `${orgName} — ${selectedRoom?.label || 'Room booking'}`,
          prefill: guestName ? { name: guestName } : undefined
        });
      } catch (checkoutError) {
        console.error('Razorpay checkout reported a failure:', checkoutError);
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        const check = await apiFetch(`/bookings/${booking.id}`);
        if (check.ok) {
          const data = await check.json();
          setBooking(data);
          if (data.status !== 'pending_payment') {
            clearPendingBookingId();
            break;
          }
        }
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (e) {
      console.error('Failed to start online payment:', e);
      setPayError('Network error — please try again.');
    } finally {
      setPayingOnline(false);
    }
  };

  const handleCancelPayment = async () => {
    if (!booking) return;
    setCancelling(true);
    setPayError('');
    try {
      const res = await apiFetch(`/bookings/${booking.id}/cancel-payment`, { method: 'POST', ...jsonBody({}) });
      const data = await res.json();
      if (!res.ok) {
        setPayError(data.message || 'Could not cancel — your payment may have just gone through.');
        setBooking((prev) => (data.status ? data : prev));
        return;
      }
      setBooking(data);
    } catch (e) {
      console.error('Failed to cancel booking payment attempt:', e);
      setPayError('Network error — please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const startOver = () => {
    clearPendingBookingId();
    setBooking(null);
    setSelectedRoom(null);
    setRooms([]);
    setSpecialRequests('');
    setPayError('');
    setStep('dates');
  };

  const isPendingCash = booking?.status === 'pending_payment' && booking?.paymentMethod === 'cash';
  const isAwaitingOnline = booking?.status === 'pending_payment' && booking?.paymentMethod === 'online';
  const isChoosingPayment = booking?.status === 'pending_payment' && !booking?.paymentMethod;

  return (
    <div className="guest-form stay-booking-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {recoverError && <span style={{ fontSize: '0.8rem', color: 'var(--status-cancelled)' }}>{recoverError}</span>}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {step === 'recovering' && (
            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
              <div className="skeleton" style={{ width: 120, height: 36, borderRadius: 'var(--radius-md)' }} />
              <span>Checking for a booking in progress…</span>
            </div>
          )}

          {step === 'dates' && (
            <form onSubmit={handleSubmitDates} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 140px' }}>
                  <label className="field-label" htmlFor="stay-checkin">
                    Check-in
                  </label>
                  <input
                    id="stay-checkin"
                    type="date"
                    className="field-input"
                    value={checkIn}
                    min={today}
                    onChange={(e) => {
                      setCheckIn(e.target.value);
                      if (checkOut <= e.target.value) setCheckOut(addDays(e.target.value, 1));
                    }}
                    required
                  />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label className="field-label" htmlFor="stay-checkout">
                    Check-out
                  </label>
                  <input
                    id="stay-checkout"
                    type="date"
                    className="field-input"
                    value={checkOut}
                    min={addDays(checkIn, 1)}
                    onChange={(e) => setCheckOut(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="stay-guests">
                  Guests
                </label>
                <input
                  id="stay-guests"
                  type="number"
                  className="field-input"
                  min={1}
                  value={numGuests}
                  onChange={(e) => setNumGuests(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  style={{ maxWidth: 120 }}
                />
              </div>
              {datesError && <div className="guest-form-error">{datesError}</div>}
              <Button type="submit" variant="primary" fullWidth>
                <CalendarDays size={16} /> Search rooms
              </Button>
            </form>
          )}

          {step === 'rooms' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <button type="button" className="text-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', alignSelf: 'flex-start' }} onClick={() => setStep('dates')}>
                <ArrowLeft size={14} /> Change dates
              </button>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {checkIn} → {checkOut} · {nightsBetween(checkIn, checkOut)} night{nightsBetween(checkIn, checkOut) === 1 ? '' : 's'} · {numGuests} guest
                {numGuests === 1 ? '' : 's'}
              </div>

              {roomsLoading ? (
                <SkeletonGrid count={4} gridClassName="menu-grid" />
              ) : roomsError ? (
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--status-cancelled)' }}>{roomsError}</span>
                  <Button variant="secondary" onClick={() => loadRooms(checkIn, checkOut)}>
                    Retry
                  </Button>
                </div>
              ) : rooms.length === 0 ? (
                <div
                  className="glass-card"
                  style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}
                >
                  <BedDouble size={28} strokeWidth={1.5} />
                  No rooms are set up at this property yet.
                </div>
              ) : (
                <div className="menu-grid">
                  {rooms.map((room) => (
                    <div key={room.id} className="glass-card menu-card">
                      <div className="menu-card-image">
                        {room.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={room.images[0]} alt={room.label} />
                        ) : (
                          <div className="menu-card-placeholder">
                            <ImageOff size={28} strokeWidth={1.5} />
                          </div>
                        )}
                        <div className="menu-card-image-scrim" />
                      </div>
                      <div className="menu-card-body">
                        <div>
                          <div className="menu-title">{room.label}</div>
                          {room.description && (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>{room.description}</p>
                          )}
                          {room.maxOccupancy && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.35rem' }}>
                              <Users size={11} /> Sleeps up to {room.maxOccupancy}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                          <span className="menu-price">
                            ₹{room.pricePerNight}
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>/night</span>
                          </span>
                          <Button variant="primary" size="sm" disabled={room.available === false} onClick={() => handlePickRoom(room)}>
                            {room.available === false ? 'Unavailable' : 'Book this room'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'guest-info' && (
            <form onSubmit={handleSubmitGuestInfo} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button type="button" className="text-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', alignSelf: 'flex-start' }} onClick={() => setStep('rooms')}>
                <ArrowLeft size={14} /> Back to rooms
              </button>
              <label className="field-label" htmlFor="stay-guest-name">
                Your name
              </label>
              <input
                id="stay-guest-name"
                type="text"
                className="field-input"
                placeholder="Who's this booking for?"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                autoComplete="name"
                required
              />
              <label className="field-label" htmlFor="stay-guest-identifier">
                Email or phone number
              </label>
              <input
                id="stay-guest-identifier"
                type="text"
                className="field-input"
                placeholder="you@example.com"
                value={guestIdentifier}
                onChange={(e) => setGuestIdentifier(e.target.value)}
                autoComplete="email"
                required
              />
              {guestError && <div className="guest-form-error">{guestError}</div>}
              <Button type="submit" variant="primary" fullWidth loading={guestSubmitting} disabled={guestSubmitting}>
                {guestSubmitting ? 'Continuing…' : 'Continue'}
              </Button>
            </form>
          )}

          {step === 'confirm' && selectedRoom && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <button type="button" className="text-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', alignSelf: 'flex-start' }} onClick={() => setStep('rooms')}>
                <ArrowLeft size={14} /> Choose a different room
              </button>
              <div className="glass-card" style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{selectedRoom.label}</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {checkIn} → {checkOut} · {nightsBetween(checkIn, checkOut)} night{nightsBetween(checkIn, checkOut) === 1 ? '' : 's'} · {numGuests} guest
                  {numGuests === 1 ? '' : 's'}
                </span>
                <span style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>
                  ₹{(selectedRoom.pricePerNight * nightsBetween(checkIn, checkOut)).toFixed(2)} total
                </span>
              </div>
              <div>
                <label className="field-label" htmlFor="stay-special-requests">
                  Special requests (optional)
                </label>
                <textarea
                  id="stay-special-requests"
                  className="field-input"
                  rows={3}
                  placeholder="Early check-in, extra bed, accessibility needs…"
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
              {confirmError && <div className="guest-form-error">{confirmError}</div>}
              <Button variant="primary" fullWidth loading={confirming} disabled={confirming} onClick={handleConfirmBooking}>
                {confirming ? 'Booking…' : 'Confirm booking & continue to payment'}
              </Button>
            </div>
          )}

          {step === 'payment' && booking && isChoosingPayment && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <BookingTotal booking={booking} />
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.6rem' }}>
                  How would you like to pay?
                </span>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <Button variant="secondary" fullWidth loading={payingCash} disabled={payingCash || payingOnline} onClick={handlePayCash}>
                    <Banknote size={16} /> Pay at check-in
                  </Button>
                  <Button variant="primary" fullWidth loading={payingOnline} disabled={payingCash || payingOnline} onClick={handlePayOnline}>
                    <CreditCard size={16} /> Pay Online
                  </Button>
                </div>
              </div>
              {payError && <span style={{ fontSize: '0.8rem', color: 'var(--status-cancelled)' }}>{payError}</span>}
            </div>
          )}

          {step === 'payment' && booking && isPendingCash && (
            <PendingPanel
              icon={<Banknote size={32} strokeWidth={1.5} />}
              title="Room reserved — pay at check-in"
              detail={`Show this screen at the front desk and pay ₹${Number(booking.totalPrice).toFixed(2)} — this page updates automatically once staff confirm.`}
              booking={booking}
              payError={payError}
              cancelling={cancelling}
              onCancel={handleCancelPayment}
            />
          )}

          {step === 'payment' && booking && isAwaitingOnline && (
            <PendingPanel
              icon={<Clock size={32} strokeWidth={1.5} />}
              title="Confirming your payment"
              detail="This can take a few seconds — please don't close this tab."
              booking={booking}
              payError={payError}
              cancelling={cancelling}
              onCancel={handleCancelPayment}
            />
          )}

          {step === 'confirmed' && booking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ padding: '2rem 0.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}
            >
              <CircleCheck size={48} color="var(--status-completed)" strokeWidth={1.5} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.05rem' }}>Booking confirmed!</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {booking.checkIn} → {booking.checkOut} · ₹{Number(booking.totalPrice).toFixed(2)}
              </span>
              <Button variant="ghost" onClick={startOver}>
                Book another stay
              </Button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function BookingTotal({ booking }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)' }}>
      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Total due</span>
      <span style={{ color: 'var(--accent-secondary)', fontWeight: 800, fontSize: '1.3rem' }}>₹{Number(booking.totalPrice).toFixed(2)}</span>
    </div>
  );
}

function PendingPanel({ icon, title, detail, booking, payError, cancelling, onCancel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ color: 'var(--accent-primary)' }}>{icon}</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{title}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{detail}</span>
      </div>
      <BookingTotal booking={booking} />
      {payError && <span style={{ fontSize: '0.8rem', color: 'var(--status-cancelled)', textAlign: 'center' }}>{payError}</span>}
      <Button variant="ghost" fullWidth loading={cancelling} disabled={cancelling} onClick={onCancel}>
        Cancel &amp; choose another method
      </Button>
    </div>
  );
}
