'use client';

import { useState } from 'react';
import { jsonBody } from '@/lib/apiClient';
import { useOrgDetail } from '@/features/admin/OrgDetailContext';
import Button from '@/components/ui/Button';
import AiCredentialList from '@/features/admin/AiCredentialList';
import AiTestPanel from '@/features/admin/AiTestPanel';

const EMPTY_FORM = { provider: '', apiKey: '', baseUrl: '', model: '' };

// Plan Phase 7 — per-tenant AI provider credentials, multiple allowed.
// AiCredentialList shows every credential this org has on file (priority,
// active state, delete) and owns its own fetch; this page only owns the
// "add a new one" form (there's still no edit/rotate-in-place — adding a
// new credential and deactivating/removing the old one is how a key gets
// rotated) and bumps `listRefreshToken` after a successful add so the list
// refetches. AiTestPanel gets the same list so its dropdown can target any
// configured model, not just the newest.
const PROVIDER_PRESETS = [
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'deepseek/deepseek-v4-flash' },
  { id: 'gemini', label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-1.5-flash' },
  { id: 'anthropic', label: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-3-5-sonnet-20241022' },
  { id: 'ollama', label: 'Ollama (Local LLM)', baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3' },
  { id: 'lmstudio', label: 'LM Studio (Local)', baseUrl: 'http://localhost:1234/v1', defaultModel: 'local-model' },
  { id: 'custom', label: 'Custom Provider (Any Base URL)', baseUrl: '', defaultModel: '' }
];

export default function OrgAiCredentialsPage() {
  const { org, apiFetch } = useOrgDetail();
  const [form, setForm] = useState(EMPTY_FORM);
  const [presetSelected, setPresetSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [listRefreshToken, setListRefreshToken] = useState(0);
  const [credentials, setCredentials] = useState([]);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSelectPreset = (presetId) => {
    setPresetSelected(presetId);
    const found = PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (found) {
      if (found.id === 'custom') {
        setForm((prev) => ({ ...prev, provider: prev.provider || 'custom' }));
      } else {
        setForm({
          provider: found.id,
          apiKey: form.apiKey,
          baseUrl: found.baseUrl,
          model: found.defaultModel
        });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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
      setForm(EMPTY_FORM);
      setPresetSelected('');
      setListRefreshToken((n) => n + 1);
    } catch (e) {
      console.error('Failed to add AI credential:', e);
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Configured models</h2>
        <AiCredentialList
          apiFetch={apiFetch}
          listEndpoint={`/admin/organizations/${org.id}/ai-credentials`}
          manageEndpoint={(credentialId) => `/admin/organizations/${org.id}/ai-credentials/${credentialId}`}
          refreshToken={listRefreshToken}
          onListChange={setCredentials}
        />
      </div>

      <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 620 }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>Add an organization AI credential</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Lets this tenant&rsquo;s Smart Waiter/AI Chat use their own key and custom Base URL. Supports OpenAI, Groq, Gemini, Ollama local, vLLM, and custom endpoints. Keys are encrypted at rest.
          </p>
        </div>

        <div>
          <label className="field-label" htmlFor="ai-preset">
            Quick Provider Preset
          </label>
          <select
            id="ai-preset"
            className="field-input"
            value={presetSelected}
            onChange={(e) => handleSelectPreset(e.target.value)}
          >
            <option value="">-- Choose Provider Preset or Custom --</option>
            {PROVIDER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="ai-provider">
            Provider Name
          </label>
          <input
            id="ai-provider"
            type="text"
            className="field-input"
            value={form.provider}
            onChange={(e) => set({ provider: e.target.value })}
            placeholder="openai, groq, openrouter, gemini, ollama, custom…"
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="ai-key">
            API Key
          </label>
          <input id="ai-key" type="password" className="field-input" value={form.apiKey} onChange={(e) => set({ apiKey: e.target.value })} placeholder="sk-…" required />
        </div>

        <div>
          <label className="field-label" htmlFor="ai-base-url">
            Base URL <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Custom API Endpoint URL)</span>
          </label>
          <input
            id="ai-base-url"
            type="url"
            className="field-input"
            value={form.baseUrl}
            onChange={(e) => set({ baseUrl: e.target.value })}
            placeholder="e.g. https://api.openai.com/v1 or http://localhost:11434/v1"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="ai-model">
            Model Name <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
          </label>
          <input id="ai-model" type="text" className="field-input" value={form.model} onChange={(e) => set({ model: e.target.value })} placeholder="e.g. gpt-4o or deepseek/deepseek-v4-flash" />
        </div>

        {error && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{error}</div>}

        <Button type="submit" variant="primary" loading={saving} disabled={saving}>
          {saving ? 'Adding…' : 'Add credential'}
        </Button>
      </form>

      <AiTestPanel apiFetch={apiFetch} testEndpoint={`/admin/organizations/${org.id}/ai-credentials/test`} credentials={credentials} />
    </div>
  );
}
