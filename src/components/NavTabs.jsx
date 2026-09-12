'use client';

import { useId } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardList,
  UtensilsCrossed,
  Users,
  MessageCircle,
  MessagesSquare,
  Sparkles,
  Building2,
  LayoutGrid,
  Receipt,
  Banknote,
  Cpu,
  Truck,
  Wallet
} from 'lucide-react';

// Ported from react_app/src/components/NavTabs.jsx, extended (plan Phase 2a/
// 2b) with Sites/Layout Builder and Owner as a first-class staff role —
// Owner logs in through the same staff-login as Manager/Cook/Waiter
// (src/app/api/auth/staff-login/route.js's STAFF_LOGIN_ROLES) and needs the
// same back-office console, plus the two org-structure tabs only an
// Owner/Manager ever sees.
/**
 * Role-based top-level nav. Staff (owner/manager/cook/waiter) get the
 * back-office console: Orders, Menu (CRUD for owner/manager), Sites/Layout
 * Builder (owner/manager only), Staff (owner/manager only), Chat
 * Oversight/Customer Chats, Team Chat. A customer gets the ordering surface
 * instead: their own order history, Menu (browse + cart + order), Smart AI
 * (merged voice + text AI ordering, see features/ai/SmartAiPage.jsx), and
 * their own chat with their cook — Sites, Layout, Staff and Team Chat are
 * internal-only and never shown to a customer.
 */
export default function NavTabs({ activeTab, onChange, authRole, badges = {} }) {
  const isCustomer = authRole === 'customer';
  const isOwnerOrManager = authRole === 'owner' || authRole === 'manager';
  const layoutId = useId();

  const tabs = isCustomer
    ? [
        { key: 'orders', label: 'My Orders', icon: ClipboardList },
        { key: 'menu', label: 'Menu', icon: UtensilsCrossed },
        { key: 'smart-ai', label: 'Smart AI', icon: Sparkles },
        { key: 'billing', label: 'Billing', icon: Receipt },
        { key: 'chats', label: 'My Chat', icon: MessageCircle }
      ]
    : [
        { key: 'orders', label: 'Live Orders', icon: ClipboardList },
        { key: 'menu', label: 'Menu Catalog', icon: UtensilsCrossed },
        ...(isOwnerOrManager ? [{ key: 'sites', label: 'Sites', icon: Building2 }] : []),
        ...(isOwnerOrManager ? [{ key: 'layout', label: 'Layout Builder', icon: LayoutGrid }] : []),
        ...(isOwnerOrManager ? [{ key: 'staff', label: 'Staff', icon: Users }] : []),
        ...(isOwnerOrManager ? [{ key: 'cash-bills', label: 'Cash Bills', icon: Banknote }] : []),
        ...(isOwnerOrManager ? [{ key: 'devices', label: 'Devices', icon: Cpu }] : []),
        ...(isOwnerOrManager ? [{ key: 'delivery', label: 'Delivery', icon: Truck }] : []),
        ...(isOwnerOrManager ? [{ key: 'wallet', label: 'Wallet', icon: Wallet }] : []),
        { key: 'chats', label: isOwnerOrManager ? 'Chat Oversight' : 'Customer Chats', icon: MessageCircle },
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
