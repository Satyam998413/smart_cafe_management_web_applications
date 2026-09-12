'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Receipt, CircleCheck, CreditCard, Banknote, Clock, Building2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { jsonBody } from '@/lib/apiClient.js';
import { openRazorpayCheckout } from '@/lib/loadRazorpayCheckout.js';
import RatingPicker from './RatingPicker';

const PENDING_BILL_KEY = 'pendingBillId';
const POLL_MS = 4000;

const readPendingBillId = () => (typeof window !== 'undefined' ? localStorage.getItem(PENDING_BILL_KEY) : null);
const savePendingBillId = (id) => {
  if (typeof window !== 'undefined') localStorage.setItem(PENDING_BILL_KEY, id);
};
const clearPendingBillId = () => {
  if (typeof window !== 'undefined') localStorage.removeItem(PENDING_BILL_KEY);
};

/**
 * Customer checkout: generate a bill from unbilled orders -> optional
 * coupon -> Cash or Online (Razorpay) -> wait for confirmation -> rate the
 * experience. Continues from CartPage.jsx (place order -> ... -> here ->
 * rating), reached via its own "Billing" tab rather than being wired
 * straight into CartPage's onDone, since a customer may place several
 * orders across a visit before settling up in one bill.
 *
 * Robust to a refresh/close mid-payment (task's own standard): the bill id
 * persists to localStorage the moment a bill exists, and is read back on
 * mount to recover — same shape as flutter_app's
 * HiveDatasource.savePendingPaymentBillId + BillingCubit.
 * checkPendingPaymentOnLogin.
 */
export default function BillingCheckoutPage({ apiFetch, socket, authName }) {
  const [bill, setBill] = useState(null);
  const [recovering, setRecovering] = useState(true);
  const [recoverError, setRecoverError] = useState('');

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [generateEmpty, setGenerateEmpty] = useState(false);

  const [couponCode, setCouponCode] = useState('');
  const [couponSubmitting, setCouponSubmitting] = useState(false);
  const [couponError, setCouponError] = useState('');

  const [payingCash, setPayingCash] = useState(false);
  const [payingOnline, setPayingOnline] = useState(false);
  const [payError, setPayError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [foodRating, setFoodRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [suggestion, setSuggestion] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // "Latest ref" pattern — kept in sync via its own effect (not assigned
  // directly in the render body) purely so the socket listener below can
  // read the current bill without re-subscribing every time it changes.
  const billRef = useRef(bill);
  useEffect(() => {
    billRef.current = bill;
  }, [bill]);

  const isPendingCash = bill?.status === 'pending' && bill?.paymentMethod === 'cash';
  const isAwaitingOnline = bill?.status === 'pending' && bill?.paymentMethod === 'online';
  const isChoosingPayment = bill?.status === 'pending' && !bill?.paymentMethod;
  const isPaid = bill?.status === 'paid';
  const isCompanyCharged = bill?.status === 'company_charged';

  // --- Recovery: a bill id left over from a previous session/tab. --------
  useEffect(() => {
    const id = readPendingBillId();
    if (!id) {
      setRecovering(false);
      return;
    }
    (async () => {
      try {
        const res = await apiFetch(`/bills/${id}`);
        if (res.status === 404) {
          clearPendingBillId();
        } else {
          const data = await res.json();
          if (res.ok) setBill(data);
          else clearPendingBillId();
        }
      } catch (e) {
        console.error('Failed to recover pending bill:', e);
        setRecoverError('Could not check your pending bill — showing the last-known state may be stale.');
      } finally {
        setRecovering(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Live updates: the shared socket, when it delivers one. ------------
  useEffect(() => {
    if (!socket) return undefined;
    const onBillUpdate = (updated) => {
      if (billRef.current && updated?.id === billRef.current.id) setBill(updated);
    };
    socket.on('bill_update', onBillUpdate);
    return () => socket.off('bill_update', onBillUpdate);
  }, [socket]);

  // --- Polling fallback: the socket path above isn't guaranteed (missed
  // events, an Owner session — see socketServer.js — or no socket at all),
  // so this is the safety net for both "waiting for cash" and "waiting for
  // Razorpay" the same way GET /api/bills/[id] itself double-checks
  // Razorpay directly instead of only trusting the webhook. -----------------
  useEffect(() => {
    if (!bill || bill.status !== 'pending' || !bill.paymentMethod) return undefined;
    const id = setInterval(async () => {
      try {
        const res = await apiFetch(`/bills/${bill.id}`);
        if (res.ok) {
          const data = await res.json();
          setBill(data);
        }
      } catch (e) {
        console.error('Bill reconcile poll failed:', e);
      }
    }, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill?.id, bill?.status, bill?.paymentMethod]);

  const resetAll = () => {
    setBill(null);
    clearPendingBillId();
    setCouponCode('');
    setCouponError('');
    setPayError('');
    setFoodRating(0);
    setServiceRating(0);
    setSuggestion('');
    setRatingError('');
    setRatingSubmitted(false);
    setGenerateEmpty(false);
    setGenerateError('');
  };

  const handleGenerateBill = async () => {
    setGenerating(true);
    setGenerateError('');
    setGenerateEmpty(false);
    try {
      const res = await apiFetch('/bills/generate', { method: 'POST', ...jsonBody({}) });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400 && /no unbilled orders/i.test(data.message || '')) {
          setGenerateEmpty(true);
        } else {
          setGenerateError(data.message || 'Could not generate your bill.');
        }
        return;
      }
      setBill(data);
      savePendingBillId(data.id);
    } catch (e) {
      console.error('Failed to generate bill:', e);
      setGenerateError('Network error — please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim() || !bill) return;
    setCouponSubmitting(true);
    setCouponError('');
    try {
      const res = await apiFetch(`/bills/${bill.id}/apply-coupon`, { method: 'POST', ...jsonBody({ couponCode: couponCode.trim() }) });
      const data = await res.json();
      if (!res.ok) {
        setCouponError(data.message || 'Could not apply that coupon.');
        return;
      }
      setBill(data);
      setCouponCode('');
    } catch (e) {
      console.error('Failed to apply coupon:', e);
      setCouponError('Network error — please try again.');
    } finally {
      setCouponSubmitting(false);
    }
  };

  const handlePayCash = async () => {
    if (!bill) return;
    setPayingCash(true);
    setPayError('');
    try {
      const res = await apiFetch(`/bills/${bill.id}/pay/cash`, { method: 'POST', ...jsonBody({}) });
      const data = await res.json();
      if (!res.ok) {
        setPayError(data.message || 'Could not record your cash choice.');
        return;
      }
      setBill(data);
    } catch (e) {
      console.error('Failed to choose cash payment:', e);
      setPayError('Network error — please try again.');
    } finally {
      setPayingCash(false);
    }
  };

  const handlePayOnline = async () => {
    if (!bill) return;
    setPayingOnline(true);
    setPayError('');
    try {
      const res = await apiFetch(`/bills/${bill.id}/pay/razorpay`, { method: 'POST', ...jsonBody({}) });
      const params = await res.json();
      if (!res.ok) {
        setPayError(params.message || 'Could not start online payment.');
        return;
      }
      // Reflects the server's payment_method='online' stamp locally right
      // away, same as billing_notifier.dart's startOnlinePayment — the UI
      // switches to "confirming payment" the instant checkout is handed
      // off, not just once a callback fires.
      setBill((prev) => (prev ? { ...prev, paymentMethod: 'online', razorpayOrderId: params.razorpayOrderId } : prev));

      try {
        await openRazorpayCheckout({
          keyId: params.keyId,
          amount: params.amount,
          currency: params.currency,
          orderId: params.razorpayOrderId,
          description: 'Bill payment',
          prefill: authName ? { name: authName } : undefined
        });
      } catch (checkoutError) {
        console.error('Razorpay checkout reported a failure:', checkoutError);
      }

      // Whatever happened in the widget (paid, cancelled, or a reported
      // failure), ask the server what actually happened — it re-checks
      // Razorpay directly rather than trusting the client-side callback.
      for (let attempt = 0; attempt < 3; attempt++) {
        const check = await apiFetch(`/bills/${bill.id}`);
        if (check.ok) {
          const data = await check.json();
          setBill(data);
          if (data.status === 'paid') break;
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
    if (!bill) return;
    setCancelling(true);
    setPayError('');
    try {
      const res = await apiFetch(`/bills/${bill.id}/cancel-payment`, { method: 'POST', ...jsonBody({}) });
      const data = await res.json();
      if (!res.ok) {
        setPayError(data.message || 'Could not cancel — your payment may have just gone through.');
        setBill((prev) => (data.status ? data : prev));
        return;
      }
      setBill(data);
    } catch (e) {
      console.error('Failed to cancel payment attempt:', e);
      setPayError('Network error — please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!bill) return;
    if (!foodRating && !serviceRating) {
      setRatingError('Pick at least one rating, or Skip.');
      return;
    }
    setRatingSubmitting(true);
    setRatingError('');
    try {
      const res = await apiFetch(`/bills/${bill.id}/rating`, {
        method: 'POST',
        ...jsonBody({
          foodRating: foodRating || undefined,
          serviceRating: serviceRating || undefined,
          suggestion: suggestion.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setRatingError(data.message || 'Could not submit your rating.');
        return;
      }
      setRatingSubmitted(true);
      clearPendingBillId();
      setTimeout(resetAll, 1600);
    } catch (e) {
      console.error('Failed to submit rating:', e);
      setRatingError('Network error — please try again.');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const stepKey = recovering
    ? 'recovering'
    : !bill
      ? 'start'
      : isCompanyCharged
        ? 'company'
        : isPaid
          ? ratingSubmitted
            ? 'thanks'
            : 'rating'
          : isPendingCash
            ? 'cash-pending'
            : isAwaitingOnline
              ? 'online-pending'
              : 'payment';

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      style={{ padding: '1.75rem', maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <Receipt size={20} color="var(--accent-secondary)" />
        <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Billing</h2>
      </div>

      {recoverError && <span style={{ fontSize: '0.8rem', color: 'var(--status-cancelled)' }}>{recoverError}</span>}

      <AnimatePresence mode="wait">
        <motion.div
          key={stepKey}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {stepKey === 'recovering' && (
            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
              <div className="skeleton" style={{ width: 120, height: 36, borderRadius: 'var(--radius-md)' }} />
              <span>Checking for a bill in progress…</span>
            </div>
          )}

          {stepKey === 'start' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <Receipt size={32} strokeWidth={1.5} />
                {generateEmpty ? (
                  <span>You have no unbilled orders right now — place an order first, then come back to settle up.</span>
                ) : (
                  <span>Ready to settle up? Generate your bill for every order you haven&apos;t paid yet.</span>
                )}
              </div>
              {generateError && <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--status-cancelled)' }}>{generateError}</div>}
              <Button variant="primary" fullWidth loading={generating} disabled={generating} onClick={handleGenerateBill}>
                {generating ? 'Generating…' : 'Generate My Bill'}
              </Button>
            </div>
          )}

          {stepKey === 'payment' && bill && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <BillTotal bill={bill} />

              <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: '0.6rem' }}>
                <input
                  type="text"
                  className="field-input"
                  placeholder="Coupon code (optional)"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  style={{ textTransform: 'uppercase' }}
                />
                <Button type="submit" variant="secondary" loading={couponSubmitting} disabled={couponSubmitting || !couponCode.trim()}>
                  Apply
                </Button>
              </form>
              {couponError && <span style={{ fontSize: '0.8rem', color: 'var(--status-cancelled)' }}>{couponError}</span>}

              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.6rem' }}>
                  How would you like to pay?
                </span>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <Button variant="secondary" fullWidth loading={payingCash} disabled={payingCash || payingOnline} onClick={handlePayCash}>
                    <Banknote size={16} /> Pay with Cash
                  </Button>
                  <Button variant="primary" fullWidth loading={payingOnline} disabled={payingCash || payingOnline} onClick={handlePayOnline}>
                    <CreditCard size={16} /> Pay Online
                  </Button>
                </div>
              </div>
              {payError && <span style={{ fontSize: '0.8rem', color: 'var(--status-cancelled)' }}>{payError}</span>}
            </div>
          )}

          {stepKey === 'cash-pending' && bill && (
            <PendingPanel
              icon={<Banknote size={32} strokeWidth={1.5} />}
              title="Waiting for staff to collect cash"
              detail={`Show this screen and pay ₹${bill.totalAmount.toFixed(2)} to a Manager — this page updates automatically once they confirm.`}
              bill={bill}
              payError={payError}
              cancelling={cancelling}
              onCancel={handleCancelPayment}
            />
          )}

          {stepKey === 'online-pending' && bill && (
            <PendingPanel
              icon={<Clock size={32} strokeWidth={1.5} />}
              title="Confirming your payment"
              detail="This can take a few seconds — please don't close this tab."
              bill={bill}
              payError={payError}
              cancelling={cancelling}
              onCancel={handleCancelPayment}
            />
          )}

          {stepKey === 'company' && bill && (
            <div style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <Building2 size={32} color="var(--status-completed)" strokeWidth={1.5} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Charged to your company account</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No payment needed from you for this bill.</span>
              <Button variant="ghost" onClick={resetAll}>
                Done
              </Button>
            </div>
          )}

          {stepKey === 'rating' && bill && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-completed)' }}>
                <CircleCheck size={20} />
                <span style={{ fontWeight: 700 }}>Payment confirmed — thanks!</span>
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>How was everything today?</span>
              <RatingPicker label="Food" value={foodRating} onChange={setFoodRating} />
              <RatingPicker label="Service" value={serviceRating} onChange={setServiceRating} />
              <div>
                <span className="field-label">Anything we should know?</span>
                <textarea
                  className="field-input"
                  rows={3}
                  placeholder="Optional suggestion…"
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
              {ratingError && <span style={{ fontSize: '0.8rem', color: 'var(--status-cancelled)' }}>{ratingError}</span>}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Button variant="ghost" fullWidth onClick={resetAll} disabled={ratingSubmitting}>
                  Skip
                </Button>
                <Button variant="primary" fullWidth loading={ratingSubmitting} disabled={ratingSubmitting} onClick={handleSubmitRating}>
                  Submit
                </Button>
              </div>
            </div>
          )}

          {stepKey === 'thanks' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}
            >
              <CircleCheck size={48} color="var(--status-completed)" strokeWidth={1.5} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.05rem' }}>Thanks for the feedback!</span>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

function BillTotal({ bill }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)' }}>
      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Total due</span>
      <span style={{ color: 'var(--accent-secondary)', fontWeight: 800, fontSize: '1.3rem' }}>₹{Number(bill.totalAmount).toFixed(2)}</span>
    </div>
  );
}

function PendingPanel({ icon, title, detail, bill, payError, cancelling, onCancel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ color: 'var(--accent-primary)' }}>{icon}</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{title}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{detail}</span>
      </div>
      <BillTotal bill={bill} />
      {payError && <span style={{ fontSize: '0.8rem', color: 'var(--status-cancelled)', textAlign: 'center' }}>{payError}</span>}
      <Button variant="ghost" fullWidth loading={cancelling} disabled={cancelling} onClick={onCancel}>
        Cancel &amp; choose another method
      </Button>
    </div>
  );
}
