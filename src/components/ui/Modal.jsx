'use client';

import { motion } from 'framer-motion';

// Ported unchanged from react_app/src/components/ui/Modal.jsx.
/**
 * Animated modal shell — replaces the 3 hand-rolled `.modal-overlay` +
 * fixed-panel markup blocks duplicated across MenuItemModal,
 * MenuItemOptionsModal and StaffPage. Callers keep their existing
 * conditional-mount pattern (`{show && <Modal>...}`); this just adds the
 * backdrop fade + panel spring-in on mount.
 */
export default function Modal({ onClose, children, maxWidth = 480 }) {
  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <motion.div
        className="glass-card"
        style={{ width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card-solid)' }}
        initial={{ opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
