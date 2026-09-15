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
            <UtensilsCrossed size={22} color="var(--accent-primary)" /> Menu Catalog
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.3rem', lineHeight: 1.4 }}>
            Explore dishes, beverages, categories & customization options.
          </p>
        </div>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* Primary Actions */}
        <div>
          {authRole === 'manager' && (
            <Button
              variant="primary"
              fullWidth
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
            <Button variant="primary" fullWidth onClick={onOpenCart}>
              <ShoppingCart size={16} /> View Cart ({cartApi.cartItems?.length || 0})
            </Button>
          )}
        </div>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* Search & Category Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label className="field-label" style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.1rem', color: 'var(--text-secondary)', display: 'block' }}>
            Search & Categories
          </label>

          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="field-input"
              style={{ paddingLeft: '2.2rem', height: '2.2rem', fontSize: '0.82rem', width: '100%' }}
              placeholder="Search dishes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`chip ${categoryFilter === cat ? 'active' : ''}`}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem', textTransform: 'capitalize' }}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* Catalog Summary Badge */}
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div>Total Menu Items: <strong>{menu.length}</strong></div>
          <div>Available Items: <strong>{menu.filter((m) => m.isAvailable).length}</strong></div>
        </div>
      </div>

      {/* Main Right Content Panel (Menu Grid) */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {loading ? (
          <SkeletonGrid count={6} gridClassName="menu-grid" />
        ) : (
          <motion.div className="menu-grid" variants={gridVariants} initial="hidden" animate="show">
            {filteredMenu.length === 0 ? (
              <div className="glass-card" style={{ padding: '3.5rem 2rem', textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
                No menu items found.
              </div>
            ) : (
              filteredMenu.map((item) => (
                <MenuCard
                  key={item._id}
                  item={item}
                  authRole={authRole}
                  onEdit={() => {
                    setModalMode('edit');
                    setEditingItem(item);
                    setShowModal(true);
                  }}
                  onToggleAvailability={() => toggleItemAvailability(item)}
                  onSelect={() => setSelectedItem(item)}
                  cartQuantity={cartApi.getCartQuantity(item._id)}
                  onAddToCart={(item, qty) => cartApi.addToCart(item, qty)}
                />
              ))
            )}
          </motion.div>
        )}
      </div>

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
