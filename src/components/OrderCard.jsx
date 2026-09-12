'use client';

import { User, ShoppingBag, Utensils, Truck } from 'lucide-react';
import Button from './ui/Button';
import ItemThumb from './ui/ItemThumb';

// Ported unchanged from react_app/src/components/OrderCard.jsx.
const MANAGER_STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
const COOK_STATUSES = ['ready', 'completed', 'cancelled'];

const FULFILLMENT = {
  pickup: { icon: ShoppingBag, label: 'Pickup' },
  dine_in: { icon: Utensils, label: (order) => `Table ${order.tableNumber || '—'}` },
  delivery: { icon: Truck, label: (order) => order.deliveryAddress || 'Delivery' }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'pending':
      return 'var(--status-pending)';
    case 'preparing':
      return 'var(--status-preparing)';
    case 'ready':
      return 'var(--status-ready)';
    case 'completed':
      return 'var(--status-completed)';
    case 'cancelled':
      return 'var(--status-cancelled)';
    default:
      return 'var(--text-secondary)';
  }
};

export default function OrderCard({ order, authRole, onClaim, onStatusChange }) {
  const isCustomer = authRole === 'customer';
  const canClaim = authRole === 'cook' && order.status === 'pending' && !order.assignedCookId;
  const statusChoices = authRole === 'cook' ? COOK_STATUSES : MANAGER_STATUSES;
  const fulfillment = FULFILLMENT[order.orderType] || FULFILLMENT.pickup;
  const FulfillmentIcon = fulfillment.icon;
  const fulfillmentLabel = typeof fulfillment.label === 'function' ? fulfillment.label(order) : fulfillment.label;

  return (
    <div className="glass-card order-card">
      <div className="order-header">
        <span className="order-id">#{order._id ? order._id.slice(-6).toUpperCase() : 'UNKNOWN'}</span>
        <span
          className="status-badge"
          style={{
            backgroundColor: `${getStatusColor(order.status)}22`,
            color: getStatusColor(order.status),
            border: `1px solid ${getStatusColor(order.status)}55`
          }}
        >
          {order.status}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <User size={14} /> {order.user?.name || 'Customer'} {order.mealType ? `• ${order.mealType}` : ''}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.8rem',
          color: 'var(--accent-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
        title={fulfillmentLabel}
      >
        <FulfillmentIcon size={13} /> {fulfillmentLabel}
      </div>

      <div className="order-items">
        {order.items?.map((it, idx) => (
          <div key={idx} className="order-item-row" style={{ alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
              <ItemThumb src={it.menuItem?.imageUrl} alt={it.menuItem?.name} size={32} />
              <div style={{ minWidth: 0 }}>
                <span>
                  {it.quantity}x {it.menuItem?.name || 'Item'}
                </span>
                {it.selectedOptions?.length > 0 && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={it.selectedOptions.map((o) => o.choiceLabel).join(', ')}
                  >
                    {it.selectedOptions.map((o) => o.choiceLabel).join(', ')}
                  </div>
                )}
              </div>
            </div>
            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>${((it.priceAtPurchase || 0) * it.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="order-footer">
        <span className="order-total">${(order.totalAmount || 0).toFixed(2)}</span>
        {isCustomer ? (
          <span
            className="status-badge"
            style={{
              backgroundColor: `${getStatusColor(order.status)}22`,
              color: getStatusColor(order.status),
              border: `1px solid ${getStatusColor(order.status)}55`
            }}
          >
            {order.status}
          </span>
        ) : canClaim ? (
          <Button variant="primary" size="sm" onClick={() => onClaim(order._id)}>
            Claim
          </Button>
        ) : (
          <select className="status-select" value={order.status} onChange={(e) => onStatusChange(order._id, e.target.value)}>
            {authRole === 'cook' && order.status === 'preparing' && (
              <option value="preparing" disabled>
                Preparing
              </option>
            )}
            {statusChoices.map((st) => (
              <option key={st} value={st}>
                {st[0].toUpperCase() + st.slice(1)}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
