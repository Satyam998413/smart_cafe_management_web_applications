'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, X, ShoppingCart } from 'lucide-react';
import MenuCard from '@/components/MenuCard';
import MenuItemModal from '@/components/MenuItemModal';
import MenuItemDetailView from '@/components/MenuItemDetailView';
import Button from '@/components/ui/Button';
import ItemThumb from '@/components/ui/ItemThumb';
import { SkeletonGrid } from '@/components/ui/Skeleton';
import { jsonBody } from '@/lib/apiClient.js';

// Ported unchanged from react_app/src/pages/MenuPage.jsx.
const CATEGORIES = ['all', 'breakfast', 'lunch', 'dinner', 'snack', 'beverage'];

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } }
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } }
};

export default function MenuPage({ menu, loading, setMenu, authRole, apiFetch, cartApi, onOpenCart }) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [editingItem, setEditingItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const filteredMenu = menu.filter((m) => {
    if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
    if (searchQuery) return m.name.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });

  const toggleItemAvailability = async (item) => {
    try {
      const res = await apiFetch(`/menu/${item._id}`, {
        method: 'PATCH',
        ...jsonBody({ isAvailable: !item.isAvailable })
      });
      const updated = await res.json();
      if (updated._id) {
        setMenu((prev) => prev.map((m) => (m._id === item._id ? updated : m)));
      }
    } catch (e) {
      console.error('Failed to toggle availability:', e);
    }
  };

  // Reconciles the modal's working option groups against the server: removed
  // groups get deleted, existing groups get PATCHed (choices replaced
  // wholesale), brand new groups get POSTed.
  const saveOptionGroups = async (itemId, groups, deletedIds) => {
    for (const groupId of deletedIds) {
      await apiFetch(`/menu/options/${groupId}`, { method: 'DELETE' });
    }
    for (const group of groups) {
      if (!group.name.trim() || group.choices.length === 0) continue;
      const payload = {
        name: group.name,
        selectionType: group.selectionType,
        isRequired: group.isRequired,
        choices: group.choices.map((c) => ({
          label: c.label,
          priceDelta: parseFloat(c.priceDelta) || 0,
          isDefault: !!c.isDefault
        }))
      };
      if (group.id) {
        await apiFetch(`/menu/options/${group.id}`, { method: 'PATCH', ...jsonBody(payload) });
      } else {
        await apiFetch(`/menu/${itemId}/options`, { method: 'POST', ...jsonBody(payload) });
      }
    }
  };

  const handleSaveMenuItem = async (payload, optionGroups, removedGroupIds) => {
    try {
      const res =
        modalMode === 'edit'
          ? await apiFetch(`/menu/${editingItem._id}`, { method: 'PATCH', ...jsonBody(payload) })
          : await apiFetch('/menu', { method: 'POST', ...jsonBody(payload) });

      const savedItem = await res.json();
      if (!savedItem._id) return;

      await saveOptionGroups(savedItem._id, optionGroups, removedGroupIds);

      const finalRes = await apiFetch(`/menu/${savedItem._id}`);
      const finalItem = await finalRes.json();

      setMenu((prev) => {
        const exists = prev.some((m) => m._id === finalItem._id);
        return exists ? prev.map((m) => (m._id === finalItem._id ? finalItem : m)) : [finalItem, ...prev];
      });
      setShowModal(false);
      setEditingItem(null);
    } catch (e) {
      console.error('Failed to save menu item:', e);
    }
  };

  const handleConfirmAdd = (quantity, selectedOptions) => {
    cartApi.addToCart(selectedItem, quantity, selectedOptions);
    setSelectedItem(null);
  };

  if (selectedItem) {
    return (
      <AnimatePresence mode="wait">
        <MenuItemDetailView key={selectedItem._id} item={selectedItem} onBack={() => setSelectedItem(null)} onConfirm={handleConfirmAdd} />
      </AnimatePresence>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '400px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="field-input"
            placeholder="Search menu items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ borderRadius: 'var(--radius-full)', paddingLeft: '2.4rem' }}
          />
        </div>
        {authRole === 'manager' && (
          <Button
            variant="primary"
            onClick={() => {
              setModalMode('add');
              setEditingItem(null);
              setShowModal(true);
            }}
          >
            <Plus size={16} /> Add Menu Item
          </Button>
        )}
        {authRole === 'customer' && (
          <button type="button" className="icon-btn" onClick={onOpenCart} title="View cart" style={{ position: 'relative', width: 44, height: 44 }}>
            <ShoppingCart size={18} />
            <AnimatePresence>
              {cartApi.cartItemCount > 0 && (
                <motion.span
                  key={cartApi.cartItemCount}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className="nav-badge"
                  style={{ position: 'absolute', top: -4, right: -4, marginLeft: 0 }}
                >
                  {cartApi.cartItemCount}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat) => (
          <button key={cat} className={`chip ${categoryFilter === cat ? 'active' : ''}`} onClick={() => setCategoryFilter(cat)}>
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonGrid count={8} gridClassName="menu-grid" />
      ) : (
        <motion.div className="menu-grid" variants={gridVariants} initial="hidden" animate="show">
          {filteredMenu.map((item) => {
            const cartQuantity =
              authRole === 'customer'
                ? (cartApi?.cart || []).filter((c) => c.item._id === item._id).reduce((sum, c) => sum + c.quantity, 0)
                : 0;
            return (
              <motion.div key={item._id} variants={cardVariants} layout>
                <MenuCard
                  item={item}
                  authRole={authRole}
                  onEdit={(it) => {
                    setModalMode('edit');
                    setEditingItem(it);
                    setShowModal(true);
                  }}
                  onToggleAvailability={toggleItemAvailability}
                  onSelect={setSelectedItem}
                  cartQuantity={cartQuantity}
                />
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {showModal && authRole === 'manager' && (
        <MenuItemModal
          mode={modalMode}
          initialItem={editingItem}
          onClose={() => {
            setShowModal(false);
            setEditingItem(null);
          }}
          onSave={handleSaveMenuItem}
        />
      )}

      <AnimatePresence>
        {authRole === 'customer' && cartApi.cart.length > 0 && (
          <motion.div
            className="glass-card"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            style={{
              position: 'sticky',
              bottom: '1rem',
              padding: '1rem 1.25rem',
              background: 'var(--bg-card-solid)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: '220px' }}>
              {cartApi.cart.map((c, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                    <ItemThumb src={c.item.imageUrl} alt={c.item.name} size={30} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.quantity}× {c.item.name}
                      {c.selectedOptions.length > 0 && (
                        <span style={{ color: 'var(--text-muted)' }}> ({c.selectedOptions.map((o) => o.choiceLabel).join(', ')})</span>
                      )}
                    </span>
                  </div>
                  <button className="icon-btn" onClick={() => cartApi.updateCartQuantityAt(i, 0)} style={{ width: 26, height: 26, flexShrink: 0 }}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <strong style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>${cartApi.cartTotal.toFixed(2)}</strong>
              <Button variant="primary" onClick={onOpenCart}>
                <ShoppingCart size={16} /> Checkout
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
