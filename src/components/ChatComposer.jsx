'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import Button from './ui/Button';

// Ported unchanged from react_app/src/components/ChatComposer.jsx.
export default function ChatComposer({ onSend, sending, disabled, disabledHint }) {
  const [text, setText] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;
    setText('');
    onSend(trimmed);
  };

  if (disabled) {
    return (
      <div style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        {disabledHint || 'Chat unavailable'}
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem' }}>
      <input
        type="text"
        className="field-input"
        placeholder="Type a message..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ flex: 1, borderRadius: 'var(--radius-full)' }}
      />
      <Button type="submit" variant="primary" disabled={sending || !text.trim()} loading={sending}>
        {sending ? null : <Send size={16} />}
      </Button>
    </form>
  );
}
