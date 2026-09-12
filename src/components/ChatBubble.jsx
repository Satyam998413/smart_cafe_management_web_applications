'use client';

import { motion } from 'framer-motion';

// Ported unchanged from react_app/src/components/ChatBubble.jsx.
const formatTime = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
};

export default function ChatBubble({ body, createdAt, isMe, senderLabel }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '0.5rem' }}
    >
      <div
        className="chat-bubble"
        style={{
          background: isMe ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'var(--bg-surface-elevated)',
          color: isMe ? 'var(--text-on-accent)' : 'var(--text-primary)'
        }}
      >
        {senderLabel && !isMe && <div className="chat-bubble-sender">{senderLabel}</div>}
        <div style={{ fontSize: '0.9rem', lineHeight: 1.4, whiteSpace: 'pre-line' }}>{body}</div>
        <div style={{ fontSize: '0.7rem', marginTop: '0.25rem', opacity: 0.7, textAlign: 'right' }}>{formatTime(createdAt)}</div>
      </div>
    </motion.div>
  );
}
