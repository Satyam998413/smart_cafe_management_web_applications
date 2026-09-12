'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ShoppingBag, Minus, Plus, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import SegmentedToggle from '@/components/ui/SegmentedToggle';
import ItemThumb from '@/components/ui/ItemThumb';

// Leaflet touches `window` at module-load time, which crashes Next.js's
// server-side render pass (this page is a Client Component, but Client
// Components still get pre-rendered on the server by default). ssr:false
// defers loading it until after hydration, client-side only — react_app
// never hit this since Vite's build was pure client-side, with no SSR pass
// to evaluate browser-only code against.
const LocationPicker = dynamic(() => import('@/components/LocationPicker'), { ssr: false });

// Ported unchanged from react_app/src/pages/CartPage.jsx.
const ORDER_TYPE_OPTIONS = [
  { key: 'pickup', label: 'Pickup' },
  { key: 'dine_in', label: 'Dine-In' },
  { key: 'delivery', label: 'Delivery' }
];

/** Dedicated cart/checkout page — reached via the cart icon on MenuPage. */
export default function CartPage({ cartApi, onDone, onBack }) {
  const [orderType, setOrderType] = useState('pickup');
  const [tableNumber, setTableNumber] = useState('');
  const [delivery, setDelivery] = useState({ lat: null, lng: null, address: '', pincode: '' });
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  const canPlace =
    cartApi.cart.length > 0 &&
    (orderType === 'pickup' || (orderType === 'dine_in' && tableNumber.trim()) || (orderType === 'delivery' && delivery.address.trim()));

  const handlePlaceOrder = async () => {
    if (!canPlace) return;
    setError('');
    setPlacing(true);
    const fulfillment = { orderType };
    if (orderType === 'dine_in') {
      fulfillment.tableNumber = tableNumber.trim();
    } else if (orderType === 'delivery') {
      fulfillment.deliveryAddress = delivery.address.trim();
      if (delivery.lat != null) fulfillment.deliveryLat = delivery.lat;
      if (delivery.lng != null) fulfillment.deliveryLng = delivery.lng;
      if (delivery.pincode) fulfillment.deliveryPincode = delivery.pincode;
    }
    const success = await cartApi.placeCartOrder(fulfillment);
    setPlacing(false);
    if (success) {
      onDone();
    } else {
      setError('Could not place your order — please try again.');
    }
  };

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      style={{ padding: '1.75rem', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button type="button" className="icon-btn" onClick={onBack} title="Back to menu">
          <ArrowLeft size={16} />
        </button>
        <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Your Cart</h2>
      </div>

      {cartApi.cart.length === 0 ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <ShoppingBag size={32} strokeWidth={1.5} />
          Your cart is empty — add something tasty from the Menu.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <AnimatePresence initial={false}>
              {cartApi.cart.map((c, i) => (
                <motion.div
                  key={`${c.item._id}-${i}`}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}
                >
                  <ItemThumb src={c.item.imageUrl} alt={c.item.name} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>{c.item.name}</div>
                    {c.selectedOptions.length > 0 && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.selectedOptions.map((o) => o.choiceLabel).join(', ')}</div>
                    )}
                  </div>
                  <div className="qty-stepper">
                    <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => cartApi.updateCartQuantityAt(i, c.quantity - 1)}>
                      <Minus size={12} />
                    </button>
                    <span className="qty-stepper-value">{c.quantity}</span>
                    <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => cartApi.updateCartQuantityAt(i, c.quantity + 1)}>
                      <Plus size={12} />
                    </button>
                  </div>
                  <span style={{ color: 'var(--accent-secondary)', fontWeight: 700, minWidth: 60, textAlign: 'right' }}>
                    ${((c.item.price + c.selectedOptions.reduce((s, o) => s + (o.priceDelta || 0), 0)) * c.quantity).toFixed(2)}
                  </span>
                  <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => cartApi.updateCartQuantityAt(i, 0)}>
                    <X size={12} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.6rem' }}>
              How would you like your order?
            </span>
            <SegmentedToggle options={ORDER_TYPE_OPTIONS} value={orderType} onChange={setOrderType} />
          </div>

          <AnimatePresence mode="wait">
            {orderType === 'dine_in' && (
              <motion.div key="dine-in" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <input type="text" className="field-input" placeholder="Table number" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} />
              </motion.div>
            )}
            {orderType === 'delivery' && (
              <motion.div key="delivery" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <LocationPicker value={delivery} onChange={setDelivery} />
              </motion.div>
            )}
          </AnimatePresence>

          {error && <span style={{ fontSize: '0.85rem', color: 'var(--status-cancelled)' }}>{error}</span>}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Total: ${cartApi.cartTotal.toFixed(2)}</span>
            <Button variant="primary" disabled={!canPlace} loading={placing} onClick={handlePlaceOrder}>
              {placing ? 'Placing order…' : 'Place Order'}
            </Button>
          </div>
        </>
      )}
    </motion.div>
  );
}
