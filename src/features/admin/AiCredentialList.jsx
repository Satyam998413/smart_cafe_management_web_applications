'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Trash2, Loader2, Power, PowerOff } from 'lucide-react';
import { jsonBody } from '@/lib/apiClient';
import { Skeleton } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';
import Button from '@/components/ui/Button';

// The "full list of configured models" at the top of both AI pages
// (org AI Credentials tab and the platform AI Configuration page) — plain
// GET + PATCH (toggle isActive) + DELETE against whichever scope's routes
// the caller passes in. `priority` (lower = tried first) is never edited
// here directly — it only moves when a real request through that
// credential fails (src/lib/aiProviders.js's demotePersistedCredential) —
// so a priority number changing between refreshes is expected, not a bug.
// `refreshToken` is a value the parent bumps after adding a credential to
// trigger a refetch, since the add form lives outside this component.
export default function AiCredentialList({ apiFetch, listEndpoint, manageEndpoint, refreshToken, onListChange }) {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(listEndpoint);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not load AI credentials.');
        return;
      }
      const list = Array.isArray(data) ? data : [];
      setCredentials(list);
      onListChange?.(list);
    } catch (e) {
      console.error('Failed to load AI credentials:', e);
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const toggleActive = async (credential) => {
    setBusyId(credential.id);
    try {
      const res = await apiFetch(manageEndpoint(credential.id), { method: 'PATCH', ...jsonBody({ isActive: !credential.isActive }) });
      if (res.ok) await load();
    } catch (e) {
      console.error('Failed to toggle AI credential:', e);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (credential) => {
    if (!window.confirm(`Remove this ${credential.provider} credential? This can't be undone.`)) return;
    setBusyId(credential.id);
    try {
      const res = await apiFetch(manageEndpoint(credential.id), { method: 'DELETE' });
      if (res.ok) await load();
    } catch (e) {
      console.error('Failed to delete AI credential:', e);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <Skeleton height="3.5rem" />
        <Skeleton height="3.5rem" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
        <span style={{ color: 'var(--status-cancelled)' }}>{error}</span>
        <Button variant="secondary" size="sm" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  if (credentials.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
        <Bot size={26} strokeWidth={1.5} />
        No AI credentials configured yet.
      </div>
    );
  }

  return (
    <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }} variants={listVariants} initial="hidden" animate="show">
      {credentials.map((credential, index) => {
        const busy = busyId === credential.id;
        return (
          <motion.div
            key={credential.id}
            variants={rowVariants}
            className="glass-card"
            style={{ padding: '0.9rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <span
              className="order-id"
              title="Priority — lower is tried first; moves automatically when a request through this credential fails"
              style={{ minWidth: 28, textAlign: 'center' }}
            >
              #{index + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{credential.provider}</strong>
                {credential.model && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>({credential.model})</span>}
                {credential.baseUrl && (
                  <span style={{ fontSize: '0.75rem', background: 'var(--bg-surface-elevated)', color: 'var(--accent-primary)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    {credential.baseUrl}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Added {new Date(credential.createdAt).toLocaleDateString()}</div>
            </div>
            <span
              className={`status-pill`}
              style={{
                background: credential.isActive ? 'rgba(5, 150, 105, 0.12)' : 'var(--bg-surface-elevated)',
                color: credential.isActive ? '#047857' : 'var(--text-muted)'
              }}
            >
              {credential.isActive ? 'Active' : 'Inactive'}
            </span>
            <button
              type="button"
              className="icon-btn"
              title={credential.isActive ? 'Deactivate' : 'Activate'}
              disabled={busy}
              onClick={() => toggleActive(credential)}
            >
              {busy ? <Loader2 size={14} className="spin" /> : credential.isActive ? <PowerOff size={14} /> : <Power size={14} />}
            </button>
            <button type="button" className="icon-btn" title="Remove" disabled={busy} onClick={() => remove(credential)}>
              <Trash2 size={14} />
            </button>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
