'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, UtensilsCrossed } from 'lucide-react';

// Ported unchanged from react_app/src/components/MenuCard.jsx.
export default function MenuCard({ item, authRole, onEdit, onToggleAvailability, onSelect, cartQuantity = 0 }) {
  const [imgError, setImgError] = useState(false);
  const isCustomer = authRole === 'customer';

  return (
    <div
      className="glass-card menu-card"
      onClick={isCustomer ? () => onSelect(item) : undefined}
      onKeyDown={
        isCustomer
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(item);
              }
            }
          : undefined
      }
      role={isCustomer ? 'button' : undefined}
      tabIndex={isCustomer ? 0 : undefined}
    >
      <div className="menu-card-image">
        {item.imageUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} onError={() => setImgError(true)} />
        ) : (
          <div className="menu-card-placeholder">
            <UtensilsCrossed size={32} strokeWidth={1.5} />
          </div>
        )}
        <div className="menu-card-image-scrim" />
        {!item.isAvailable && (
          <span
            className="status-badge"
            style={{ position: 'absolute', top: '0.6rem', right: '0.6rem', background: 'var(--status-cancelled)', color: '#fff' }}
          >
            Sold Out
          </span>
        )}
      </div>

      <div className="menu-card-body">
        <div>
          <span className="menu-category">{item.category}</span>
          <h3 className="menu-title" style={{ marginTop: '0.5rem' }}>
            {item.name}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {item.description || 'Delicious cafe item'}
          </p>
          {item.optionGroups && item.optionGroups.length > 0 && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Options: {item.optionGroups.map((g) => g.name).join(', ')}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <span className="menu-price">${item.price?.toFixed(2)}</span>
          {authRole === 'manager' ? (
            <div style={{ display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
              <button className="icon-btn" onClick={() => onEdit(item)} title="Edit item">
                <Pencil size={15} />
              </button>
              <button
                className={`toggle-button ${item.isAvailable ? 'available' : 'unavailable'}`}
                onClick={() => onToggleAvailability(item)}
              >
                {item.isAvailable ? 'Available' : 'Sold Out'}
              </button>
            </div>
          ) : authRole === 'customer' ? (
            <span
              className="toggle-button available"
              style={{ cursor: 'default', opacity: cartQuantity > 0 ? 1 : 0.85, overflow: 'hidden' }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={cartQuantity > 0 ? `in-cart-${cartQuantity}` : 'view'}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  style={{ display: 'inline-block' }}
                >
                  {cartQuantity > 0 ? `In cart · ${cartQuantity}` : 'View & Add'}
                </motion.span>
              </AnimatePresence>
            </span>
          ) : (
            <span className={`toggle-button ${item.isAvailable ? 'available' : 'unavailable'}`} style={{ cursor: 'default' }}>
              {item.isAvailable ? 'Available' : 'Sold Out'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
