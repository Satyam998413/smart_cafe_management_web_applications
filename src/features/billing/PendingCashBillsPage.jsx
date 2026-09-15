'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Banknote, WifiOff } from 'lucide-react';
import Button from '@/components/ui/Button';
import { jsonBody } from '@/lib/apiClient.js';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';

/**
 * Manager/Owner view of bills a guest chose to pay with cash, waiting to be
 * physically collected. There is no GET /api/bills?status=pending&
 * paymentMethod=cash endpoint (see pay/cash/route.js's own comment) — by
 * design, this list is built live from the shared socket's `bill_update`
 * event, the same "socket push builds an in-memory list" pattern
 * ManagerDashboardScreen already uses for new orders. That means a page
 * reload starts this list empty again; only bills that transition to
 * pending-cash *while this tab is open* will appear, until the next one
 * arrives.
 */
export default function PendingCashBillsPage({ apiFetch, socket }) {
  const [billsById, setBillsById] = useState({});
  const [collectingIds, setCollectingIds] = useState(() => new Set());
  const [errorsById, setErrorsById] = useState({});

  useEffect(() => {
    if (!socket) return undefined;
    const onBillUpdate = (bill) => {
      if (!bill?.id) return;
      setBillsById((prev) => ({ ...prev, [bill.id]: bill }));
    };
    socket.on('bill_update', onBillUpdate);
    return () => socket.off('bill_update', onBillUpdate);
  }, [socket]);

  const pendingCash = Object.values(billsById)
    .filter((b) => b.status === 'pending' && b.paymentMethod === 'cash')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const handleCollect = async (billId) => {
    setCollectingIds((prev) => new Set(prev).add(billId));
    setErrorsById((prev) => ({ ...prev, [billId]: '' }));
    try {
      const res = await apiFetch(`/bills/${billId}/collect-cash`, { method: 'POST', ...jsonBody({}) });
      const data = await res.json();
      if (!res.ok) {
        setErrorsById((prev) => ({ ...prev, [billId]: data.message || 'Could not confirm collection.' }));
        return;
      }
      setBillsById((prev) => ({ ...prev, [billId]: data }));
    } catch (e) {
      console.error('Failed to confirm cash collection:', e);
      setErrorsById((prev) => ({ ...prev, [billId]: 'Network error — please try again.' }));
    } finally {
      setCollectingIds((prev) => {
        const next = new Set(prev);
        next.delete(billId);
        return next;
      });
    }
  };

  const pendingTotal = pendingCash.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);

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
            <Banknote size={22} color="var(--accent-primary)" /> Cash Bills
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.3rem', lineHeight: 1.4 }}>
            Monitor and collect pending cash payments from guests in real time.
          </p>
        </div>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* Live Socket Connection Badge */}
        {!socket ? (
          <div style={{ padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <WifiOff size={15} /> Real-time feed disconnected
          </div>
        ) : (
          <div style={{ padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#10b981', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="dot" /> Real-time live feed connected
          </div>
        )}

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* Cash Metrics */}
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div>Pending Cash Bills: <strong>{pendingCash.length}</strong></div>
          <div>Total Cash to Collect: <strong>₹{pendingTotal.toFixed(0)}</strong></div>
        </div>
      </div>

      {/* Main Right Content Panel */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {pendingCash.length === 0 ? (
          <div
            className="glass-card"
            style={{ padding: '3.5rem 2rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}
          >
            <Banknote size={36} strokeWidth={1.5} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>No Cash Payments Pending</h3>
            <p style={{ fontSize: '0.85rem', maxWidth: 380 }}>New cash bill notifications will appear here instantly when guests request cash payment.</p>
          </div>
        ) : (
          <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} variants={listVariants} initial="hidden" animate="show">
            {pendingCash.map((bill) => (
              <motion.div key={bill.id} className="glass-card entity-row" variants={rowVariants} layout>
                <div className="entity-icon">
                  <Banknote size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>₹{Number(bill.totalAmount).toFixed(2)}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Bill #{bill.id.slice(-6).toUpperCase()} · {new Date(bill.createdAt).toLocaleTimeString()}
                  </div>
                  {errorsById[bill.id] && <div style={{ fontSize: '0.78rem', color: 'var(--status-cancelled)', marginTop: '0.2rem' }}>{errorsById[bill.id]}</div>}
                </div>
                <Button variant="primary" size="sm" loading={collectingIds.has(bill.id)} disabled={collectingIds.has(bill.id)} onClick={() => handleCollect(bill.id)}>
                  Mark Collected
                </Button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
