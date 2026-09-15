'use client';

import { motion } from 'framer-motion';
import ProfileMenu from './ProfileMenu';
import ThemeToggle from './ThemeToggle';

export default function Header({ connected, authName, authRole, onLogout }) {
  return (
    <motion.header
      className="header"
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="brand">
        <div className="brand-icon">☕</div>
        <div>
          <h1 className="brand-title">Smart Cafe</h1>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {authRole === 'customer' ? 'Order ahead & track your order' : 'Real-time Manager Hub'}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div className={`live-badge ${connected ? '' : 'offline'}`}>
          <motion.span
            className="dot"
            animate={connected ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
            transition={connected ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : undefined}
          />
          {connected ? 'Real-time Live' : 'Offline / Reconnecting'}
        </div>
        <ThemeToggle />
        <ProfileMenu authName={authName} authRole={authRole} onLogout={onLogout} />
      </div>
    </motion.header>
  );
}
