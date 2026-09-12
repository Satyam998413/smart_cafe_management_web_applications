'use client';

import { useState } from 'react';
import { X, ImageOff } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { CATEGORY_IMAGE_SUGGESTIONS } from '@/lib/menuImageSuggestions.js';

// Ported unchanged from react_app/src/components/MenuItemModal.jsx.
const EMPTY_ITEM = { name: '', category: 'breakfast', price: '', description: '', imageUrl: '', isAvailable: true };

/**
 * Add/edit menu item modal, including the options (modifiers) editor —
 * groups of choices like "Sugar Level" / "Milk". Owns its own form state;
 * [onSave] receives (payload, optionGroups, removedGroupIds) and does the
 * actual API orchestration (create/update item, then reconcile groups).
 */
export default function MenuItemModal({ mode, initialItem, onClose, onSave }) {
  const [newItem, setNewItem] = useState(() =>
    mode === 'edit' && initialItem
      ? {
          name: initialItem.name || '',
          category: initialItem.category || 'breakfast',
          price: initialItem.price ?? '',
          description: initialItem.description || '',
          imageUrl: initialItem.imageUrl || '',
          isAvailable: initialItem.isAvailable !== undefined ? initialItem.isAvailable : true
        }
      : EMPTY_ITEM
  );
  const [imgPreviewError, setImgPreviewError] = useState(false);
  const [optionGroups, setOptionGroups] = useState(() =>
    (initialItem?.optionGroups || []).map((g) => ({
      id: g.id,
      name: g.name || '',
      selectionType: g.selectionType || 'single',
      isRequired: !!g.isRequired,
      choices: (g.choices || []).map((c) => ({
        id: c.id,
        label: c.label || '',
        priceDelta: c.priceDelta ?? 0,
        isDefault: !!c.isDefault
      }))
    }))
  );
  const [removedGroupIds, setRemovedGroupIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const addOptionGroup = () => {
    setOptionGroups((prev) => [...prev, { id: null, name: '', selectionType: 'single', isRequired: false, choices: [] }]);
  };

  const removeOptionGroup = (index) => {
    setOptionGroups((prev) => {
      const group = prev[index];
      if (group.id) setRemovedGroupIds((ids) => [...ids, group.id]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateOptionGroupField = (index, field, value) => {
    setOptionGroups((prev) => prev.map((g, i) => (i === index ? { ...g, [field]: value } : g)));
  };

  const addChoice = (groupIndex) => {
    setOptionGroups((prev) =>
      prev.map((g, i) => (i === groupIndex ? { ...g, choices: [...g.choices, { id: null, label: '', priceDelta: 0, isDefault: false }] } : g))
    );
  };

  const removeChoice = (groupIndex, choiceIndex) => {
    setOptionGroups((prev) =>
      prev.map((g, i) => (i === groupIndex ? { ...g, choices: g.choices.filter((_, ci) => ci !== choiceIndex) } : g))
    );
  };

  const updateChoiceField = (groupIndex, choiceIndex, field, value) => {
    setOptionGroups((prev) =>
      prev.map((g, i) =>
        i === groupIndex ? { ...g, choices: g.choices.map((c, ci) => (ci === choiceIndex ? { ...c, [field]: value } : c)) } : g
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newItem.name || !newItem.price) return;
    setSaving(true);
    try {
      await onSave(
        {
          name: newItem.name,
          category: newItem.category,
          price: newItem.price,
          description: newItem.description,
          imageUrl: newItem.imageUrl,
          isAvailable: newItem.isAvailable
        },
        optionGroups,
        removedGroupIds
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <div style={{ padding: '2rem' }}>
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>{mode === 'edit' ? 'Edit Menu Item' : 'Add New Menu Item'}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="text"
            className="field-input"
            placeholder="Item Name (e.g. Cold Brew)"
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            required
          />
          <select className="field-input" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
            <option value="beverage">Beverage</option>
          </select>
          <input
            type="number"
            step="0.01"
            className="field-input"
            placeholder="Price (e.g. 4.99)"
            value={newItem.price}
            onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
            required
          />
          <textarea
            className="field-input"
            placeholder="Description"
            value={newItem.description}
            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
            rows="3"
          />

          {/* Image */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <input
              type="url"
              className="field-input"
              placeholder="Image URL (optional)"
              value={newItem.imageUrl}
              onChange={(e) => {
                setImgPreviewError(false);
                setNewItem({ ...newItem, imageUrl: e.target.value });
              }}
            />
            <div
              style={{
                height: 140,
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                background: 'var(--bg-surface-elevated)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {newItem.imageUrl && !imgPreviewError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={newItem.imageUrl}
                  alt="Preview"
                  onError={() => setImgPreviewError(true)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <ImageOff size={28} color="var(--text-muted)" strokeWidth={1.5} />
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Suggested photos</span>
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {(CATEGORY_IMAGE_SUGGESTIONS[newItem.category] || []).map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => {
                    setImgPreviewError(false);
                    setNewItem({ ...newItem, imageUrl: url });
                  }}
                  style={{
                    flexShrink: 0,
                    width: 64,
                    height: 64,
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    padding: 0,
                    cursor: 'pointer',
                    border: newItem.imageUrl === url ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    background: 'var(--bg-surface-elevated)'
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          </div>

          {/* Options section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Options</strong>
              <Button type="button" variant="secondary" size="sm" onClick={addOptionGroup}>
                + Add Group
              </Button>
            </div>

            {optionGroups.map((group, gi) => (
              <div
                key={group.id || `new-group-${gi}`}
                className="glass-card"
                style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg-surface-elevated)' }}
              >
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="Group name (e.g. Sugar Level)"
                    value={group.name}
                    onChange={(e) => updateOptionGroupField(gi, 'name', e.target.value)}
                    style={{ flex: 1, padding: '0.5rem 0.75rem' }}
                  />
                  <Button type="button" variant="danger" size="sm" onClick={() => removeOptionGroup(gi)}>
                    Remove
                  </Button>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.85rem' }}>
                  <select
                    className="field-input"
                    value={group.selectionType}
                    onChange={(e) => updateOptionGroupField(gi, 'selectionType', e.target.value)}
                    style={{ padding: '0.4rem 0.6rem', width: 'auto' }}
                  >
                    <option value="single">Single choice</option>
                    <option value="multiple">Multiple choice</option>
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={group.isRequired} onChange={(e) => updateOptionGroupField(gi, 'isRequired', e.target.checked)} />
                    Required
                  </label>
                </div>

                {group.choices.map((choice, ci) => (
                  <div key={choice.id || `new-choice-${ci}`} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="field-input"
                      placeholder="Choice label"
                      value={choice.label}
                      onChange={(e) => updateChoiceField(gi, ci, 'label', e.target.value)}
                      style={{ flex: 2, padding: '0.4rem 0.6rem' }}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="field-input"
                      placeholder="+/- price"
                      value={choice.priceDelta}
                      onChange={(e) => updateChoiceField(gi, ci, 'priceDelta', e.target.value)}
                      style={{ flex: 1, padding: '0.4rem 0.6rem' }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={choice.isDefault} onChange={(e) => updateChoiceField(gi, ci, 'isDefault', e.target.checked)} />
                      Default
                    </label>
                    <button type="button" className="icon-btn" onClick={() => removeChoice(gi, ci)} style={{ width: 30, height: 30, flexShrink: 0 }}>
                      <X size={13} />
                    </button>
                  </div>
                ))}

                <Button type="button" variant="ghost" size="sm" onClick={() => addChoice(gi)} style={{ alignSelf: 'flex-start' }}>
                  + Add Choice
                </Button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <Button type="button" variant="ghost" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" fullWidth disabled={saving} loading={saving}>
              {saving ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Save Item'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
