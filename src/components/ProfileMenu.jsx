'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut } from 'lucide-react';

// Ported unchanged from react_app/src/components/ProfileMenu.jsx.
/**
 * Header's avatar + name — click to reveal a small profile card (name,
 * role, Log out) instead of always showing a bare "Log out" button inline.
 * Closes on outside click or Escape, matching standard profile-menu UX.
 */
export default function ProfileMenu({ authName, authRole, onLogout }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const initial = (authName || 'Guest')[0].toUpperCase();

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.3rem 0.75rem 0.3rem 0.3rem',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--border)',
          background: open ? 'var(--bg-surface-elevated)' : 'transparent',
          cursor: 'pointer'
        }}
      >
        <span className="staff-avatar" style={{ width: 32, height: 32, fontSize: '0.85rem' }}>
          {initial}
        </span>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{authName || 'Guest'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="glass-card"
            style={{
              position: 'absolute',
              top: 'calc(100% + 0.5rem)',
              right: 0,
              minWidth: 220,
              padding: '1rem',
              background: 'var(--bg-card-solid)',
              transformOrigin: 'top right',
              zIndex: 60
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                paddingBottom: '0.9rem',
                borderBottom: '1px solid var(--border)'
              }}
            >
              <span className="staff-avatar" style={{ width: 42, height: 42, fontSize: '1.05rem' }}>
                {initial}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {authName || 'Guest'}
                </div>
                <span className={`role-badge role-${authRole}`}>{authRole}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="logout-menu-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                marginTop: '0.75rem',
                padding: '0.55rem 0.7rem',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'transparent',
                color: 'var(--status-cancelled)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <LogOut size={15} /> Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
