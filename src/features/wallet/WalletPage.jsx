'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, Wallet as WalletIcon, TriangleAlert, CircleCheck, History } from 'lucide-react';
import Button from '@/components/ui/Button';
import { jsonBody } from '@/lib/apiClient.js';
import { openRazorpayCheckout } from '@/lib/loadRazorpayCheckout.js';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

const PENDING_PURCHASE_KEY = 'pendingCoinPurchaseId';
const POLL_MS = 4000;

const readPendingPurchaseId = () => (typeof window !== 'undefined' ? localStorage.getItem(PENDING_PURCHASE_KEY) : null);
const savePendingPurchaseId = (id) => {
  if (typeof window !== 'undefined') localStorage.setItem(PENDING_PURCHASE_KEY, id);
};
const clearPendingPurchaseId = () => {
  if (typeof window !== 'undefined') localStorage.removeItem(PENDING_PURCHASE_KEY);
};

/**
 * Org coin wallet. Balance + recent ledger are visible to Owner and
 * Manager (GET /api/wallet has no role restriction); starting a recharge
 * is Owner-only (coin-plans/coin-purchases both 403 a Manager), so that
 * section only renders for authRole === 'owner'.
 *
 * Recharge follows the same "never trust the SDK callback alone" shape as
 * BillingCheckoutPage / flutter_app's recharge_sheet.dart: the purchase id
 * persists to localStorage the moment one starts, so a refresh mid-payment
 * recovers into the same "confirming" state instead of losing track of it.
 */
export default function WalletPage({ apiFetch, authRole, authName }) {
  const isOwner = authRole === 'owner';

  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState('');

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(isOwner);
  const [plansError, setPlansError] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [couponCode, setCouponCode] = useState('');

  const [purchase, setPurchase] = useState(null);
  const [recovering, setRecovering] = useState(isOwner);
  const [starting, setStarting] = useState(false);
  const [rechargeError, setRechargeError] = useState('');
  const [justPaid, setJustPaid] = useState(false);

  const loadWallet = async () => {
    setWalletLoading(true);
    setWalletError('');
    try {
      const res = await apiFetch('/wallet');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load wallet');
      setWallet(data);
    } catch (e) {
      console.error('Failed to load wallet:', e);
      setWalletError('Could not load your wallet.');
    } finally {
      setWalletLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    (async () => {
      setPlansLoading(true);
      setPlansError('');
      try {
        const res = await apiFetch('/wallet/coin-plans');
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load plans');
        setPlans(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Failed to load coin plans:', e);
        setPlansError('Could not load recharge plans.');
      } finally {
        setPlansLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  // --- Recovery: a purchase id left over from a previous session/tab. ----
  useEffect(() => {
    if (!isOwner) return;
    const id = readPendingPurchaseId();
    if (!id) {
      setRecovering(false);
      return;
    }
    (async () => {
      try {
        const res = await apiFetch(`/wallet/coin-purchases/${id}`);
        if (res.status === 404) {
          clearPendingPurchaseId();
        } else {
          const data = await res.json();
          if (res.ok && data.status === 'pending') setPurchase(data);
          else clearPendingPurchaseId();
        }
      } catch (e) {
        console.error('Failed to recover pending coin purchase:', e);
      } finally {
        setRecovering(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  // --- Poll while a purchase is pending — no socket event exists for coin
  // purchases, so this is the only freshness mechanism (same reconcile
  // GET /api/wallet/coin-purchases/[id] already double-checks Razorpay). ---
  useEffect(() => {
    if (!purchase || purchase.status !== 'pending') return undefined;
    const id = setInterval(async () => {
      try {
        const res = await apiFetch(`/wallet/coin-purchases/${purchase.id}`);
        if (res.ok) {
          const data = await res.json();
          setPurchase(data);
          if (data.status === 'paid') {
            clearPendingPurchaseId();
            setJustPaid(true);
            loadWallet();
            setTimeout(() => setJustPaid(false), 2500);
          }
        }
      } catch (e) {
        console.error('Coin purchase reconcile poll failed:', e);
      }
    }, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase?.id, purchase?.status]);

  const handleRecharge = async () => {
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan) return;
    setStarting(true);
    setRechargeError('');
    try {
      const res = await apiFetch('/wallet/coin-purchases', {
        method: 'POST',
        ...jsonBody({ coinPlanId: plan.id, couponCode: couponCode.trim() || undefined })
      });
      const params = await res.json();
      if (!res.ok) {
        setRechargeError(params.message || 'Could not start recharge.');
        return;
      }
      savePendingPurchaseId(params.coinPurchaseId);
      setPurchase({ id: params.coinPurchaseId, status: 'pending' });

      try {
        await openRazorpayCheckout({
          keyId: params.keyId,
          amount: params.amount,
          currency: params.currency,
          orderId: params.razorpayOrderId,
          description: `${plan.name} coin recharge`,
          prefill: authName ? { name: authName } : undefined
        });
      } catch (checkoutError) {
        console.error('Razorpay checkout reported a failure:', checkoutError);
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        const check = await apiFetch(`/wallet/coin-purchases/${params.coinPurchaseId}`);
        if (check.ok) {
          const data = await check.json();
          setPurchase(data);
          if (data.status === 'paid') {
            clearPendingPurchaseId();
            setJustPaid(true);
            loadWallet();
            setTimeout(() => setJustPaid(false), 2500);
            break;
          }
        }
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (e) {
      console.error('Failed to start coin recharge:', e);
      setRechargeError('Network error — please try again.');
    } finally {
      setStarting(false);
    }
  };

  const handleCancelPurchase = async () => {
    if (!purchase) return;
    try {
      const res = await apiFetch(`/wallet/coin-purchases/${purchase.id}/cancel`, { method: 'POST', ...jsonBody({}) });
      const data = await res.json();
      if (res.ok && data.status === 'paid') {
        clearPendingPurchaseId();
        setJustPaid(true);
        loadWallet();
        setTimeout(() => setJustPaid(false), 2500);
      } else {
        clearPendingPurchaseId();
      }
    } catch (e) {
      console.error('Failed to cancel coin purchase:', e);
    } finally {
      setPurchase(null);
      setSelectedPlanId('');
      setCouponCode('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>Wallet</h2>

      {walletLoading ? (
        <div className="glass-card stat-card">
          <div className="skeleton" style={{ width: '40%', height: '2.25rem' }} />
          <div className="skeleton" style={{ width: '30%', height: '0.85rem' }} />
        </div>
      ) : walletError ? (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--status-cancelled)', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
          {walletError}
          <Button variant="secondary" size="sm" onClick={loadWallet}>
            Retry
          </Button>
        </div>
      ) : !wallet ? (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <WalletIcon size={28} strokeWidth={1.5} />
          No wallet set up for this organization yet.
        </div>
      ) : (
        <>
          <motion.div className="glass-card stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <span className="stat-value" style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Coins size={28} /> {wallet.balanceCoins}
            </span>
            <span className="stat-label">Coin Balance</span>
            {wallet.balanceCoins < wallet.lowBalanceThreshold && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#b91c1c', marginTop: '0.3rem' }}>
                <TriangleAlert size={13} /> Below your low-balance threshold ({wallet.lowBalanceThreshold})
              </span>
            )}
          </motion.div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <History size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Recent Transactions</span>
            </div>
            {wallet.recentTransactions.length === 0 ? (
              <div className="glass-card" style={{ padding: '1.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No transactions yet.
              </div>
            ) : (
              <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} variants={listVariants} initial="hidden" animate="show">
                {wallet.recentTransactions.map((tx) => (
                  <motion.div key={tx.id} className="glass-card entity-row" style={{ padding: '0.75rem 1rem' }} variants={rowVariants}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize' }}>{tx.type?.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(tx.createdAt).toLocaleString()}</div>
                    </div>
                    <span style={{ fontWeight: 700, color: tx.amount < 0 ? 'var(--status-cancelled)' : 'var(--status-completed)' }}>
                      {tx.amount > 0 ? '+' : ''}
                      {tx.amount} coins
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </>
      )}

      {isOwner && (
        <div>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.75rem' }}>Recharge Coins</span>

          {recovering ? (
            <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Checking for a recharge in progress…
            </div>
          ) : justPaid ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card"
              style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}
            >
              <CircleCheck size={40} color="var(--status-completed)" strokeWidth={1.5} />
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Coins added!</span>
            </motion.div>
          ) : purchase?.status === 'pending' ? (
            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div className="skeleton" style={{ width: 120, height: 36, borderRadius: 'var(--radius-md)' }} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Confirming your recharge…</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>This can take a few seconds — don&apos;t close this tab.</span>
              <Button variant="ghost" onClick={handleCancelPurchase}>
                Cancel
              </Button>
            </div>
          ) : plansLoading ? (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div className="skeleton" style={{ flex: 1, height: 90, borderRadius: 'var(--radius-md)' }} />
              <div className="skeleton" style={{ flex: 1, height: 90, borderRadius: 'var(--radius-md)' }} />
            </div>
          ) : plansError ? (
            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--status-cancelled)' }}>
              {plansError}
            </div>
          ) : plans.length === 0 ? (
            <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No recharge plans available right now.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className="glass-card"
                    onClick={() => setSelectedPlanId(plan.id)}
                    style={{
                      padding: '1rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      border: selectedPlanId === plan.id ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                      boxShadow: selectedPlanId === plan.id ? 'var(--shadow-accent)' : 'var(--shadow-md)'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{plan.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.3rem 0' }}>
                      {plan.coinsGranted + plan.bonusCoins} coins {plan.bonusCoins > 0 ? `(+${plan.bonusCoins} bonus)` : ''}
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--accent-secondary)' }}>₹{plan.priceInr}</div>
                  </button>
                ))}
              </div>

              <input
                type="text"
                className="field-input"
                placeholder="Coupon code (optional)"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                style={{ maxWidth: 260, textTransform: 'uppercase' }}
              />

              {rechargeError && <span style={{ fontSize: '0.8rem', color: 'var(--status-cancelled)' }}>{rechargeError}</span>}

              <button className="btn-orange" style={{ alignSelf: 'flex-start' }} disabled={starting || !selectedPlanId} onClick={handleRecharge}>
                {starting ? 'Starting Recharge…' : 'Recharge Now'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
