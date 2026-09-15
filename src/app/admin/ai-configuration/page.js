'use client';

import { useState } from 'react';
import { jsonBody } from '@/lib/apiClient';
import { useAdmin } from '@/features/admin/AdminContext';
import Button from '@/components/ui/Button';
import AiCredentialList from '@/features/admin/AiCredentialList';
import AiTestPanel from '@/features/admin/AiTestPanel';

const EMPTY_FORM = { provider: '', apiKey: '', baseUrl: '', model: '' };

// The platform-wide AI default(s) — tried in src/lib/aiClient.js's
// sendChatCompletion after an org's own credentials but before the
// raw-env-var global providers, so a tenant with no working AI credential
// of their own still gets a working Smart Waiter/AI Chat. Same shape as
// the per-org AI Credentials tab (src/app/admin/organizations/[id]/ai/
// page.js): AiCredentialList owns the "what's configured" list (priority,
// active state, delete), this page only owns the add form.
export default function AiConfigurationPage() {
  const { apiFetch } = useAdmin();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [listRefreshToken, setListRefreshToken] = useState(0);
  const [credentials, setCredentials] = useState([]);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await apiFetch('/admin/ai-configuration', {
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
        setError(data.message || 'Failed to save the platform default.');
        return;
      }
      setForm(EMPTY_FORM);
      setListRefreshToken((n) => n + 1);
    } catch (e) {
      console.error('Failed to add platform AI credential:', e);
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Configured platform models</h2>
        <AiCredentialList
          apiFetch={apiFetch}
          listEndpoint="/admin/ai-configuration"
          manageEndpoint={(credentialId) => `/admin/ai-configuration/${credentialId}`}
          refreshToken={listRefreshToken}
          onListChange={setCredentials}
        />
      </div>

      <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 560 }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>Add a platform default</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Used by every organization that has no working AI credential of its own — tried after an org&rsquo;s
            own key but before the server&rsquo;s environment-variable fallback. Keys are encrypted at rest and
            never shown again.
          </p>
        </div>

        <div>
          <label className="field-label" htmlFor="platform-ai-provider">
            Provider
          </label>
          <input
            id="platform-ai-provider"
            type="text"
            className="field-input"
            value={form.provider}
            onChange={(e) => set({ provider: e.target.value })}
            placeholder="openrouter, groq, gemini, local…"
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="platform-ai-key">
            API key
          </label>
          <input id="platform-ai-key" type="password" className="field-input" value={form.apiKey} onChange={(e) => set({ apiKey: e.target.value })} required />
        </div>

        <div>
          <label className="field-label" htmlFor="platform-ai-base-url">
            Base URL <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
          </label>
          <input id="platform-ai-base-url" type="url" className="field-input" value={form.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} placeholder="https://…" />
        </div>

        <div>
          <label className="field-label" htmlFor="platform-ai-model">
            Model <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
          </label>
          <input id="platform-ai-model" type="text" className="field-input" value={form.model} onChange={(e) => set({ model: e.target.value })} placeholder="e.g. deepseek/deepseek-v4-flash" />
        </div>

        {error && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{error}</div>}

        <Button type="submit" variant="primary" loading={saving} disabled={saving}>
          {saving ? 'Saving…' : 'Save platform default'}
        </Button>
      </form>

      <AiTestPanel apiFetch={apiFetch} testEndpoint="/admin/ai-configuration/test" credentials={credentials} />
    </div>
  );
}
