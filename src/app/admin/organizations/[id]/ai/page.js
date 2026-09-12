'use client';

import { useState } from 'react';
import { jsonBody } from '@/lib/apiClient';
import { useOrgDetail } from '@/features/admin/OrgDetailContext';
import Button from '@/components/ui/Button';

const EMPTY_FORM = { provider: '', apiKey: '', baseUrl: '', model: '' };

// Plan Phase 7 — per-tenant AI provider credentials. There's no GET route
// for these (api_key_encrypted is never returned, by design — same
// discipline as password_hash), so this page can only add/rotate a key,
// not list what's already on file; a confirmation banner is the only
// feedback after a successful add.
export default function OrgAiCredentialsPage() {
  const { org, apiFetch } = useOrgDetail();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(null);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setAdded(null);
    setSaving(true);
    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/ai-credentials`, {
        method: 'POST',
        ...jsonBody({
          provider: form.provider,
          apiKey: form.apiKey,
          baseUrl: form.baseUrl || undefined,
          model: form.model || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Failed to add the credential.');
        return;
      }
      setAdded(data);
      setForm(EMPTY_FORM);
    } catch (e) {
      console.error('Failed to add AI credential:', e);
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 560 }}>
      <div>
        <h2 style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>AI provider credentials</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Adding a provider here lets this tenant&rsquo;s Smart Waiter/AI Chat use their own key instead of
          the platform&rsquo;s shared fallback providers. Keys are encrypted at rest and never shown again.
        </p>
      </div>

      <div>
        <label className="field-label" htmlFor="ai-provider">
          Provider
        </label>
        <input
          id="ai-provider"
          type="text"
          className="field-input"
          value={form.provider}
          onChange={(e) => set({ provider: e.target.value })}
          placeholder="openrouter, groq, gemini, local…"
          required
        />
      </div>

      <div>
        <label className="field-label" htmlFor="ai-key">
          API key
        </label>
        <input id="ai-key" type="password" className="field-input" value={form.apiKey} onChange={(e) => set({ apiKey: e.target.value })} required />
      </div>

      <div>
        <label className="field-label" htmlFor="ai-base-url">
          Base URL <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
        </label>
        <input id="ai-base-url" type="url" className="field-input" value={form.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} placeholder="https://…" />
      </div>

      <div>
        <label className="field-label" htmlFor="ai-model">
          Model <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
        </label>
        <input id="ai-model" type="text" className="field-input" value={form.model} onChange={(e) => set({ model: e.target.value })} placeholder="e.g. deepseek/deepseek-v4-flash" />
      </div>

      {error && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{error}</div>}
      {added && (
        <div style={{ color: '#047857', fontSize: '0.85rem' }}>
          Added {added.provider}{added.model ? ` (${added.model})` : ''} — active since {new Date(added.createdAt).toLocaleString()}.
        </div>
      )}

      <Button type="submit" variant="primary" loading={saving} disabled={saving}>
        {saving ? 'Adding…' : 'Add credential'}
      </Button>
    </form>
  );
}
