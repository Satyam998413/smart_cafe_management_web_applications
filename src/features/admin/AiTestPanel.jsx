'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles } from 'lucide-react';
import { jsonBody } from '@/lib/apiClient';
import Button from '@/components/ui/Button';

const DEFAULT_MESSAGE = 'Say hello in one short sentence.';

// "Send a test message, see the reply" — shown on both the org AI
// Credentials tab and the platform AI Configuration page, below the full
// credential list (AiCredentialList). `credentials` is that same list —
// the dropdown lets the tester target *any* configured model, not just the
// one most recently added, since testEndpoint tests exactly whichever
// credentialId is selected rather than the full org->platform->env
// fallback chain (a real failure there still demotes that credential's
// priority the same way a live chat failure would — this is a genuine
// attempt to use it, not a dry run).
export default function AiTestPanel({ apiFetch, testEndpoint, credentials = [] }) {
  const [credentialId, setCredentialId] = useState(credentials[0]?.id || '');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Keep the selection valid as the list refreshes (e.g. after adding or
    // deleting a credential) — default to the current highest-priority one
    // whenever the previously-selected id no longer exists.
    if (!credentials.some((c) => c.id === credentialId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCredentialId(credentials[0]?.id || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!credentialId) return;
    setSending(true);
    setError('');
    setReply('');
    try {
      const res = await apiFetch(testEndpoint, { method: 'POST', ...jsonBody({ credentialId, message }) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'The test message failed.');
        return;
      }
      setReply(data.reply);
    } catch (e) {
      console.error('AI credential test failed:', e);
      setError('Network error — please try again.');
    } finally {
      setSending(false);
    }
  };

  if (credentials.length === 0) return null;

  return (
    <form onSubmit={handleSend} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Sparkles size={16} color="var(--accent-primary)" />
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Test a model</span>
      </div>

      <div>
        <label className="field-label" htmlFor="ai-test-credential">
          Model
        </label>
        <select id="ai-test-credential" className="field-input" value={credentialId} onChange={(e) => setCredentialId(e.target.value)}>
          {credentials.map((credential) => (
            <option key={credential.id} value={credential.id}>
              {credential.provider}
              {credential.model ? ` — ${credential.model}` : ''}
              {credential.isActive ? '' : ' (inactive)'}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '0.6rem' }}>
        <input
          className="field-input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a test message…"
          required
        />
        <Button type="submit" variant="secondary" loading={sending} disabled={sending || !message.trim() || !credentialId}>
          <Send size={14} /> Send
        </Button>
      </div>

      {error && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{error}</div>}
      {reply && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="chat-bubble"
          style={{ background: 'var(--bg-surface-elevated)', alignSelf: 'flex-start' }}
        >
          {reply}
        </motion.div>
      )}
    </form>
  );
}
