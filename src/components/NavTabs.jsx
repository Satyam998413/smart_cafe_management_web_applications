'use client';

import { useId } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, UtensilsCrossed, Users, MessageCircle, MessagesSquare, Sparkles } from 'lucide-react';

// Ported unchanged from react_app/src/components/NavTabs.jsx.
/**
 * Role-based top-level nav. Staff (manager/cook) get the back-office console:
 * Orders, Menu (CRUD for a manager), Staff (manager-only), Chat
 * Oversight/Customer Chats, Team Chat. A customer gets the ordering surface
 * instead: their own order history, Menu (browse + cart + order), Smart AI
 * (merged voice + text AI ordering, see features/ai/SmartAiPage.jsx), and
 * their own chat with their cook — Staff and Team Chat are internal-only and
 * never shown to a customer.
 */
export default function NavTabs({ activeTab, onChange, authRole, badges = {} }) {
  const isCustomer = authRole === 'customer';
  const layoutId = useId();

  const tabs = isCustomer
    ? [
        { key: 'orders', label: 'My Orders', icon: ClipboardList },
        { key: 'menu', label: 'Menu', icon: UtensilsCrossed },
        { key: 'smart-ai', label: 'Smart AI', icon: Sparkles },
        { key: 'chats', label: 'My Chat', icon: MessageCircle }
      ]
    : [
        { key: 'orders', label: 'Live Orders', icon: ClipboardList },
        { key: 'menu', label: 'Menu Catalog', icon: UtensilsCrossed },
        ...(authRole === 'manager' ? [{ key: 'staff', label: 'Staff', icon: Users }] : []),
        { key: 'chats', label: authRole === 'manager' ? 'Chat Oversight' : 'Customer Chats', icon: MessageCircle },
        { key: 'team', label: 'Team Chat', icon: MessagesSquare }
      ];

  return (
    <nav className="tabs-bar">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = activeTab === t.key;
        return (
          <button key={t.key} className={`tab-button ${isActive ? 'active' : ''}`} onClick={() => onChange(t.key)}>
            {isActive && (
              <motion.span
                layoutId={layoutId}
                className="tab-pill"
                transition={{ type: 'spring', stiffness: 500, damping: 34 }}
              />
            )}
            <Icon size={16} strokeWidth={2} style={{ position: 'relative', zIndex: 1 }} />
            <span style={{ position: 'relative', zIndex: 1 }}>{t.label}</span>
            {badges[t.key] > 0 && (
              <span className="nav-badge" style={{ position: 'relative', zIndex: 1 }}>
                {badges[t.key]}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
