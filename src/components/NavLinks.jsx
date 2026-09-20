'use client';

import { useId } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  Wallet,
  BedDouble,
  CalendarRange,
  CreditCard
} from 'lucide-react';

// Routed replacement for the old NavTabs.jsx (tab-state onClick/onChange) —
// same role-conditional list and the same sliding-pill visual, but each
// entry is a real <Link> and "active" is derived from the URL instead of
// activeTab state.
//
// `premiseType` (org.premiseType from GET /api/organizations/me, fetched by
// the layout) only affects the Rooms entry — a hotel-only surface — and is
// undefined until that fetch resolves, so Rooms simply doesn't render for a
// beat on first paint rather than flashing then disappearing for a non-hotel
// org. Bookings stays visible for every owner/manager regardless of premise
// type, same as every other owner/manager nav entry here.
export default function NavLinks({ authRole, premiseType, badges = {} }) {
  const isCustomer = authRole === 'customer';
  const isOwnerOrManager = authRole === 'owner' || authRole === 'manager';
  const isHotel = premiseType === 'hotel';
  const pathname = usePathname();
  const layoutId = useId();

    // Same order as flutter_app's home_screen.dart tab bar: AI first, then
    // Menu, Order History, Chat, and whatever doesn't have a Flutter
    // equivalent (Billing) last.
  const links = isCustomer
    ? [
        { href: '/smart-ai', label: 'Smart AI', icon: Sparkles },
        { href: '/menu', label: 'Menu', icon: UtensilsCrossed },
        { href: '/orders', label: 'My Orders', icon: ClipboardList },
        { href: '/chats', label: 'My Chat', icon: MessageCircle },
        { href: '/billing', label: 'Billing', icon: Receipt }
      ]
    : [
        { href: '/orders', label: 'Live Orders', icon: ClipboardList },
        { href: '/menu', label: 'Menu Catalog', icon: UtensilsCrossed },
        ...(isOwnerOrManager ? [{ href: '/sites', label: 'Sites', icon: Building2 }] : []),
        ...(isOwnerOrManager ? [{ href: '/layout', label: 'Layout Builder', icon: LayoutGrid }] : []),
        ...(isOwnerOrManager ? [{ href: '/staff', label: 'Staff', icon: Users }] : []),
        ...(isOwnerOrManager ? [{ href: '/cash-bills', label: 'Cash Bills', icon: Banknote }] : []),
        ...(isOwnerOrManager ? [{ href: '/devices', label: 'Devices', icon: Cpu }] : []),
        ...(isOwnerOrManager ? [{ href: '/delivery', label: 'Delivery', icon: Truck }] : []),
        ...(isOwnerOrManager ? [{ href: '/wallet', label: 'Wallet', icon: Wallet }] : []),
        ...(isOwnerOrManager ? [{ href: '/rfid-cards', label: 'RFID Cards', icon: CreditCard }] : []),
        ...(isOwnerOrManager && isHotel ? [{ href: '/rooms', label: 'Rooms', icon: BedDouble }] : []),
        ...(isOwnerOrManager ? [{ href: '/bookings', label: 'Bookings', icon: CalendarRange }] : []),
        { href: '/chats', label: isOwnerOrManager ? 'Chat Oversight' : 'Customer Chats', icon: MessageCircle },
        { href: '/team', label: 'Team Chat', icon: MessagesSquare }
      ];

  return (
    <nav className="main-nav-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
      {links.map((t) => {
        const Icon = t.icon;
        const isActive = pathname === t.href || (t.href !== '/' && pathname.startsWith(`${t.href}/`));
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`tab-button ${isActive ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.65rem 1rem',
              borderRadius: 'var(--radius-md)',
              width: '100%',
              fontSize: '0.88rem',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                className="tab-pill"
                style={{ borderRadius: 'var(--radius-md)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 34 }}
              />
            )}
            <Icon size={18} strokeWidth={2} style={{ position: 'relative', zIndex: 1 }} />
            <span style={{ position: 'relative', zIndex: 1, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</span>
            {badges[t.href] > 0 && (
              <span className="nav-badge" style={{ position: 'relative', zIndex: 1 }}>
                {badges[t.href]}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

