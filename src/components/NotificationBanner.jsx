'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TriangleAlert, CircleAlert } from 'lucide-react';
import Button from '@/components/ui/Button';

// Ambient, always-visible banner (not a tab) for the coin-balance alerts
// wired up in src/lib/walletService.js's checkBalanceThresholdNotification
// (plan Phase 1B.b) — inserted once per threshold crossing on an order's
// wallet debit, so this is almost always rendering nothing.
//
// Owner sees `zero_coin_balance` (the org can no longer take orders — the
// plan's "Please recharge now" framing, deliberately not dismissible so it
// can't be waved away without addressing it: the only action is jumping to
// the Wallet tab to actually recharge). Manager sees `low_coin_balance` (a
// heads-up, dismissible once acknowledged). GET /api/notifications already
// scopes rows to the caller's own role/org, so this only ever needs to
// pick the single most urgent row to show, not re-filter by role itself.
export default function NotificationBanner({ apiFetch, authRole, socket, onNavigateToWallet }) {
  const isEligible = authRole === 'owner' || authRole === 'manager';
  const [notifications, setNotifications] = useState([]);
  const [dismissingId, setDismissingId] = useState(null);

  useEffect(() => {
    if (!isEligible) return;
    (async () => {
      try {
        const res = await apiFetch('/notifications');
        const data = await res.json();
        if (res.ok && Array.isArray(data.notifications)) setNotifications(data.notifications);
      } catch (e) {
        console.error('Failed to load notifications:', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEligible]);

  // Live update: a low/zero balance crossing that happens while this
  // dashboard is already open shows up without a refresh.
  useEffect(() => {
    if (!socket || !isEligible) return undefined;
    const onNotification = (notification) => {
      if (!notification?.id) return;
      setNotifications((prev) => [notification, ...prev.filter((n) => n.id !== notification.id)]);
    };
    socket.on('notification', onNotification);
    return () => socket.off('notification', onNotification);
  }, [socket, isEligible]);

  if (!isEligible) return null;

  const relevant = notifications.filter((n) => !n.isRead && (n.type === 'zero_coin_balance' || n.type === 'low_coin_balance'));
  const top = relevant.find((n) => n.type === 'zero_coin_balance') || relevant[0] || null;
  if (!top) return null;

  const isUrgent = top.type === 'zero_coin_balance';

  const handleDismiss = async () => {
    setDismissingId(top.id);
    // Optimistic — this is an ambient nudge, not a source of truth the rest
    // of the UI depends on, so it disappears immediately rather than
    // waiting on the round-trip.
    setNotifications((prev) => prev.filter((n) => n.id !== top.id));
    try {
      await apiFetch(`/notifications/${top.id}/read`, { method: 'PATCH' });
    } catch (e) {
      console.error('Failed to mark notification read:', e);
    } finally {
      setDismissingId(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        role="alert"
        aria-live={isUrgent ? 'assertive' : 'polite'}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.85rem 1.1rem',
          margin: '0 0 1rem',
          border: isUrgent ? '1px solid rgba(220, 38, 38, 0.35)' : '1px solid var(--border)',
          background: isUrgent ? 'rgba(220, 38, 38, 0.08)' : 'var(--bg-surface-elevated)'
        }}
      >
        {isUrgent ? (
          <CircleAlert size={20} color="#b91c1c" style={{ flexShrink: 0 }} />
        ) : (
          <TriangleAlert size={20} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
        )}

        <span style={{ flex: 1, minWidth: 0, fontSize: '0.88rem', fontWeight: 600, color: isUrgent ? '#b91c1c' : 'var(--text-primary)' }}>
          {top.message}
        </span>

        {isUrgent ? (
          <Button variant="danger" size="sm" onClick={onNavigateToWallet}>
            Recharge Now
          </Button>
        ) : (
          <Button variant="ghost" size="sm" loading={dismissingId === top.id} onClick={handleDismiss}>
            Dismiss
          </Button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
