'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Minus, UtensilsCrossed } from 'lucide-react';
import Button from './ui/Button';

// Ported unchanged from react_app/src/components/MenuItemDetailView.jsx.
/**
 * Customer's "view details, then add to cart" experience — opened by
 * tapping anywhere on a MenuCard. Renders inline in MenuPage's main content
 * area (swapped in for the grid), not as a modal overlay — a modal-in-a-card
 * felt heavy/disconnected; a dedicated in-page view with a Back button reads
 * more like a real product page.
 *
 * The lighter MenuItemOptionsModal is left as-is for the AI-chat
 * "needs options" flow (SmartAiPage's pendingOptions) — that's a different,
 * lower-ceremony interaction that doesn't need a full page.
 */
export default function MenuItemDetailView({ item, onBack, onConfirm }) {
  const groups = item.optionGroups || [];
  const [selections, setSelections] = useState(() => {
    const initial = {};
    for (const group of groups) {
      const defaults = (group.choices || []).filter((c) => c.isDefault).map((c) => c.id);
      initial[group.id] = group.selectionType === 'multiple' ? defaults : defaults[0] || null;
    }
    return initial;
  });
  const [quantity, setQuantity] = useState(1);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onBack();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  const selectSingle = (groupId, choiceId) => setSelections((prev) => ({ ...prev, [groupId]: choiceId }));

  const toggleMultiple = (groupId, choiceId) =>
    setSelections((prev) => {
      const current = prev[groupId] || [];
      const next = current.includes(choiceId) ? current.filter((id) => id !== choiceId) : [...current, choiceId];
      return { ...prev, [groupId]: next };
    });

  const missingRequired = groups.some((g) => {
    if (!g.isRequired) return false;
    const selected = selections[g.id];
    return g.selectionType === 'multiple' ? !selected || selected.length === 0 : !selected;
  });

  const selectedOptionsList = () => {
    const selectedOptions = [];
    for (const group of groups) {
      const selected = selections[group.id];
      const choiceIds = group.selectionType === 'multiple' ? selected || [] : selected ? [selected] : [];
      for (const choiceId of choiceIds) {
        const choice = (group.choices || []).find((c) => c.id === choiceId);
        if (choice) {
          selectedOptions.push({
            choiceId: choice.id,
            groupLabel: group.name,
            choiceLabel: choice.label,
            priceDelta: choice.priceDelta || 0
          });
        }
      }
    }
    return selectedOptions;
  };

  const optionsDelta = selectedOptionsList().reduce((sum, o) => sum + (o.priceDelta || 0), 0);
  const unitPrice = (item.price || 0) + optionsDelta;
  const total = unitPrice * quantity;
  const disabled = missingRequired || !item.isAvailable;

  const handleConfirm = () => {
    if (disabled) return;
    onConfirm(quantity, selectedOptionsList());
  };

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ maxWidth: 640, margin: '0 auto', overflow: 'hidden' }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 280,
          background: 'var(--bg-surface-elevated)',
          overflow: 'hidden'
        }}
      >
        {item.imageUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)'
            }}
          >
            <UtensilsCrossed size={40} strokeWidth={1.5} />
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(28,25,23,0.08), rgba(28,25,23,0.55))' }} />
        <button
          type="button"
          onClick={onBack}
          className="icon-btn"
          style={{ position: 'absolute', top: '0.85rem', left: '0.85rem', background: 'rgba(255,255,255,0.9)', borderColor: 'transparent' }}
          title="Back to menu"
        >
          <ArrowLeft size={16} />
        </button>
        <span
          style={{
            position: 'absolute',
            bottom: '0.75rem',
            left: '0.85rem',
            padding: '0.2rem 0.65rem',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(255,255,255,0.92)',
            color: 'var(--accent-secondary)',
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase'
          }}
        >
          {item.category}
        </span>
        {!item.isAvailable && (
          <span
            className="status-badge"
            style={{ position: 'absolute', top: '0.85rem', right: '0.85rem', background: 'var(--status-cancelled)', color: '#fff' }}
          >
            Sold Out
          </span>
        )}
      </div>

      <div style={{ padding: '1.75rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>{item.name}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '0.75rem' }}>
          {item.description || 'Delicious cafe item'}
        </p>
        <span className="menu-price">${(item.price || 0).toFixed(2)}</span>

        {groups.length > 0 && (
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {groups.map((group) => (
              <div key={group.id}>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  {group.name}
                  {group.isRequired && <span style={{ color: 'var(--status-cancelled)' }}> *</span>}
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                  {(group.choices || []).map((choice) => {
                    const isMultiple = group.selectionType === 'multiple';
                    const checked = isMultiple
                      ? (selections[group.id] || []).includes(choice.id)
                      : selections[group.id] === choice.id;
                    return (
                      <label
                        key={choice.id}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
                      >
                        <input
                          type={isMultiple ? 'checkbox' : 'radio'}
                          name={`group-${group.id}`}
                          checked={checked}
                          onChange={() => (isMultiple ? toggleMultiple(group.id, choice.id) : selectSingle(group.id, choice.id))}
                        />
                        {choice.label}
                        {choice.priceDelta ? ` (${choice.priceDelta > 0 ? '+' : ''}$${choice.priceDelta.toFixed(2)})` : ''}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.5rem' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Quantity</span>
          <div className="qty-stepper">
            <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
              <Minus size={14} />
            </button>
            <span className="qty-stepper-value">{quantity}</span>
            <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setQuantity((q) => q + 1)}>
              <Plus size={14} />
            </button>
          </div>
        </div>

        <Button variant="primary" fullWidth disabled={disabled} onClick={handleConfirm} style={{ marginTop: '1.5rem' }}>
          {!item.isAvailable ? 'Sold Out' : `Add to Cart · $${total.toFixed(2)}`}
        </Button>
      </div>
    </motion.div>
  );
}
