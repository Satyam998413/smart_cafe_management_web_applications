'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, PackageOpen } from 'lucide-react';
import OrderCard from '@/components/OrderCard';
import SegmentedToggle from '@/components/ui/SegmentedToggle';
import { SkeletonGrid } from '@/components/ui/Skeleton';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <motion.section className="stats-grid" variants={gridVariants} initial="hidden" animate="show">
        <motion.div className="glass-card stat-card" variants={cardVariants}>
          <span className="stat-value" style={{ color: 'var(--status-pending)' }}>
            {pendingCount}
          </span>
          <span className="stat-label">Pending Orders</span>
        </motion.div>
        <motion.div className="glass-card stat-card" variants={cardVariants}>
          <span className="stat-value" style={{ color: 'var(--status-preparing)' }}>
            {preparingCount}
          </span>
          <span className="stat-label">Preparing in Kitchen</span>
        </motion.div>
        <motion.div className="glass-card stat-card" variants={cardVariants}>
          <span className="stat-value" style={{ color: 'var(--status-ready)' }}>
            {readyCount}
          </span>
          <span className="stat-label">Ready for Pickup</span>
        </motion.div>
        <motion.div className="glass-card stat-card" variants={cardVariants}>
          <span className="stat-value" style={{ color: 'var(--status-completed)' }}>
            ${totalRevenue.toFixed(2)}
          </span>
          <span className="stat-label">Total Revenue ({completedOrders.length} orders)</span>
        </motion.div>
        <motion.div className="glass-card stat-card" variants={cardVariants}>
          <span className="stat-value" style={{ color: 'var(--accent-primary)' }}>
            ${avgOrderValue.toFixed(2)}
          </span>
          <span className="stat-label">Avg Order Value</span>
        </motion.div>
      </motion.section>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '400px' }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="field-input"
            placeholder="Search orders by ID, user, or item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ borderRadius: 'var(--radius-full)', paddingLeft: '2.4rem' }}
          />
        </div>

        <SegmentedToggle
          options={[
            { key: 'today', label: 'Today' },
            { key: 'all', label: 'All History' }
          ]}
          value={showAllHistory ? 'all' : 'today'}
          onChange={(key) => setShowAllHistory(key === 'all')}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {STATUS_OPTIONS.map((st) => (
          <button key={st} className={`chip ${statusFilter === st ? 'active' : ''}`} onClick={() => setStatusFilter(st)}>
            {st}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonGrid count={6} gridClassName="order-grid" />
      ) : (
        <motion.div className="order-grid" variants={gridVariants} initial="hidden" animate="show">
          {filteredOrders.length === 0 ? (
            <motion.div
              className="glass-card"
              variants={cardVariants}
              style={{
                padding: '3rem',
                textAlign: 'center',
                gridColumn: '1 / -1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <PackageOpen size={32} color="var(--text-muted)" strokeWidth={1.5} />
              <p style={{ color: 'var(--text-muted)' }}>
                {showAllHistory ? 'No orders match your criteria.' : 'No orders today yet — try "All History".'}
              </p>
            </motion.div>
          ) : (
            filteredOrders.map((order) => (
              <motion.div key={order._id} variants={cardVariants} layout>
                <OrderCard order={order} authRole={authRole} onClaim={onClaim} onStatusChange={onStatusChange} />
              </motion.div>
            ))
          )}
        </motion.div>
      )}
    </div>
  );
}
