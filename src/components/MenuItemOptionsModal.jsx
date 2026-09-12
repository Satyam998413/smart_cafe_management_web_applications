'use client';

import { useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';

// Ported unchanged from react_app/src/components/MenuItemOptionsModal.jsx.
/**
 * Customer-facing "customize this item" picker — shown before adding an
 * item with option groups (e.g. Cappuccino's Sugar/Milk choices) to the
 * cart, mirroring flutter_app's menu_catalog_screen.dart options sheet
 * (showMenuItemOptionsSheet) rather than smart_waiter_screen.dart's carousel
 * "+" button, which skips this step and silently adds with no options.
 */
export default function MenuItemOptionsModal({ item, onClose, onConfirm }) {
  const groups = item.optionGroups || [];
  const [selections, setSelections] = useState(() => {
    const initial = {};
    for (const group of groups) {
      const defaults = (group.choices || []).filter((c) => c.isDefault).map((c) => c.id);
      initial[group.id] = group.selectionType === 'multiple' ? defaults : defaults[0] || null;
    }
    return initial;
  });

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

  const handleConfirm = () => {
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
    onConfirm(selectedOptions);
  };

  return (
    <Modal onClose={onClose} maxWidth={440}>
      <div style={{ padding: '1.75rem' }}>
        <h2 style={{ marginBottom: '0.25rem', color: 'var(--text-primary)', fontSize: '1.15rem' }}>{item.name}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>Customize before adding to cart</p>

        {groups.map((group) => (
          <div key={group.id} style={{ marginBottom: '1.25rem' }}>
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

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <Button type="button" variant="ghost" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" fullWidth disabled={missingRequired} onClick={handleConfirm}>
            Add to Cart
          </Button>
        </div>
      </div>
    </Modal>
  );
}
