'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, PackageOpen, ClipboardList } from 'lucide-react';
import OrderCard from '@/components/OrderCard';
import SegmentedToggle from '@/components/ui/SegmentedToggle';
import { SkeletonGrid } from '@/components/ui/Skeleton';
import TiltCard from '@/components/ui/TiltCard';

// Ported unchanged from react_app/src/pages/OrdersPage.jsx.
const STATUS_OPTIONS = ['all', 'pending', 'preparing', 'ready', 'completed', 'cancelled'];

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } }
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }
};

/**
 * Live Orders. Defaults to today's orders only (the "showAllHistory" flag
 * flips to full history) — mirrors the same default the Flutter app now
 * uses in Order History / Cook Dashboard, so a growing order history never
 * clutters the default view on either client.
 */
export default function OrdersPage({ orders, loading, authRole, onClaim, onStatusChange, onRefetch }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);

  useEffect(() => {
    onRefetch(showAllHistory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAllHistory]);

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const preparingCount = orders.filter((o) => o.status === 'preparing').length;
  const readyCount = orders.filter((o) => o.status === 'ready').length;
  const completedOrders = orders.filter((o) => o.status === 'completed');
  const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const idMatch = o._id?.toLowerCase().includes(q);
      const userMatch = o.user?.name?.toLowerCase().includes(q);
      const itemMatch = o.items?.some((i) => i.menuItem?.name?.toLowerCase().includes(q));
      return idMatch || userMatch || itemMatch;
    }
    return true;
  });

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
            <ClipboardList size={22} color="var(--accent-primary)" /> Live Orders
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.3rem', lineHeight: 1.4 }}>
            Real-time kitchen order dispatch, table status & revenue metrics.
          </p>
        </div>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* Date Scope Segmented Toggle */}
        <div>
          <label className="field-label" style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-secondary)', display: 'block' }}>
            Order History Scope
          </label>
          <SegmentedToggle
            options={[
              { key: 'today', label: 'Today Only' },
              { key: 'all', label: 'All History' }
            ]}
            value={showAllHistory ? 'all' : 'today'}
            onChange={(key) => setShowAllHistory(key === 'all')}
          />
        </div>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* Search Box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label className="field-label" style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.1rem', color: 'var(--text-secondary)', display: 'block' }}>
            Search & Filter Status
          </label>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="field-input"
              style={{ paddingLeft: '2.2rem', height: '2.2rem', fontSize: '0.82rem', width: '100%' }}
              placeholder="Search ID, user, item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Status Filter Chips */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {STATUS_OPTIONS.map((st) => (
              <button
                key={st}
                className={`chip ${statusFilter === st ? 'active' : ''}`}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem', textTransform: 'capitalize' }}
                onClick={() => setStatusFilter(st)}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* Live Metrics Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-md)', background: 'rgba(255, 122, 0, 0.08)', border: '1px solid rgba(255, 122, 0, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Pending Orders</span>
            <strong style={{ fontSize: '1rem', color: 'var(--status-pending)' }}>{pendingCount}</strong>
          </div>
          <div style={{ padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-md)', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Kitchen Preparing</span>
            <strong style={{ fontSize: '1rem', color: 'var(--status-preparing)' }}>{preparingCount}</strong>
          </div>
          <div style={{ padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-md)', background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Ready for Pickup</span>
            <strong style={{ fontSize: '1rem', color: 'var(--status-ready)' }}>{readyCount}</strong>
          </div>
          <div style={{ padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Revenue</span>
            <strong style={{ fontSize: '1rem', color: 'var(--status-completed)' }}>₹{totalRevenue.toFixed(0)}</strong>
          </div>
        </div>
      </div>

      {/* Main Right Content Panel (Order Grid) */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {loading ? (
          <SkeletonGrid count={6} gridClassName="order-grid" />
        ) : (
          <motion.div className="order-grid" variants={gridVariants} initial="hidden" animate="show">
            {filteredOrders.length === 0 ? (
              <motion.div
                className="glass-card"
                variants={cardVariants}
                style={{
                  padding: '3.5rem 2rem',
                  textAlign: 'center',
                  gridColumn: '1 / -1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
              >
                <PackageOpen size={36} color="var(--text-muted)" strokeWidth={1.5} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {showAllHistory ? 'No orders match your criteria.' : 'No orders today yet — try switching to "All History".'}
                </p>
              </motion.div>
            ) : (
              filteredOrders.map((order) => (
                <OrderCard
                  key={order._id}
                  order={order}
                  authRole={authRole}
                  onClaim={onClaim}
                  onStatusChange={onStatusChange}
                />
              ))
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
