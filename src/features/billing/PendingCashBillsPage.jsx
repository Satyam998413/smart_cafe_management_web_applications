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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>Pending Cash Collection</h2>
      </div>

      {!socket && (
        <div
          className="glass-card"
          style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--status-cancelled)', fontSize: '0.85rem' }}
        >
          <WifiOff size={16} />
          Real-time updates aren&apos;t connected — new cash payments may not appear until you reconnect.
        </div>
      )}

      {pendingCash.length === 0 ? (
        <div
          className="glass-card"
          style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}
        >
          <Banknote size={28} strokeWidth={1.5} />
          No cash payments waiting right now — new ones will appear here the moment a guest chooses to pay with cash.
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
  );
}
