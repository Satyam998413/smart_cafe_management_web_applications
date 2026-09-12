'use client';

import { motion } from 'framer-motion';
import MiniOrb from './ui/MiniOrb';

// Ported unchanged from react_app/src/components/TypingIndicator.jsx.
/** AI "thinking" bubble — a small pulsing orb, same visual language as the big Smart Waiter orb's thinking state. */
export default function TypingIndicator({ senderLabel }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.5rem' }}>
      <div className="chat-bubble" style={{ background: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}>
        {senderLabel && <div className="chat-bubble-sender">{senderLabel}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.15rem 0' }}>
          <MiniOrb size={16} tone="thinking" />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Thinking…</span>
        </div>
      </div>
    </motion.div>
  );
}
