'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { jsonBody } from '@/lib/apiClient';
import { useAdmin } from '@/features/admin/AdminContext';
import { THEME_PRESET_OPTIONS } from '@/lib/themePresetOptions';
import Button from '@/components/ui/Button';

const PREMISE_TYPES = [
  { value: 'cafe_restaurant', label: 'Cafe / Restaurant' },
  { value: 'company_office', label: 'Company / Office' },
  { value: 'hotel', label: 'Hotel' }
];

const EMPTY_FORM = {
  name: '',
  premiseType: 'cafe_restaurant',
  contactEmail: '',
  logoUrl: '',
  themePreset: '',
  createOwner: false,
  ownerName: '',
  ownerEmail: '',
  ownerPassword: ''
};

export default function NewOrganizationPage() {
  const { apiFetch } = useAdmin();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.createOwner && (!form.ownerName || !form.ownerEmail || !form.ownerPassword)) {
      setError('Owner name, email, and password are all required to create the Owner account now.');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch('/admin/organizations', {
        method: 'POST',
        ...jsonBody({
          name: form.name,
          premiseType: form.premiseType,
          contactEmail: form.contactEmail,
          logoUrl: form.logoUrl || undefined,
          themePreset: form.themePreset || undefined,
          ...(form.createOwner
            ? { ownerName: form.ownerName, ownerEmail: form.ownerEmail, ownerPassword: form.ownerPassword }
            : {})
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Failed to create organization.');
        return;
      }
      router.push(`/admin/organizations/${data.id}`);
    } catch (e) {
      console.error('Failed to create organization:', e);
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text-primary)' }}>New organization</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Onboard a tenant. A wallet with 1000 free coins is granted automatically.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 560 }}>
        <div>
          <label className="field-label" htmlFor="org-name">
            Organization name
          </label>
          <input id="org-name" type="text" className="field-input" value={form.name} onChange={(e) => set({ name: e.target.value })} required />
        </div>

        <div>
          <label className="field-label" htmlFor="org-premise">
            Premise type
          </label>
          <select id="org-premise" className="field-input" value={form.premiseType} onChange={(e) => set({ premiseType: e.target.value })}>
            {PREMISE_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="org-email">
            Contact email
          </label>
          <input
            id="org-email"
            type="email"
            className="field-input"
            value={form.contactEmail}
            onChange={(e) => set({ contactEmail: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="org-logo">
            Logo URL <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
          </label>
          <input id="org-logo" type="url" className="field-input" value={form.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} placeholder="https://…" />
        </div>

        <div>
          <span className="field-label">Branding preset (optional — can be applied later)</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
            {THEME_PRESET_OPTIONS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={`theme-swatch ${form.themePreset === preset.key ? 'selected' : ''}`}
                onClick={() => set({ themePreset: form.themePreset === preset.key ? '' : preset.key })}
              >
                <div className="theme-swatch-colors">
                  <span className="theme-swatch-dot" style={{ background: preset.light.primary }} />
                  <span className="theme-swatch-dot" style={{ background: preset.light.secondary }} />
                  <span className="theme-swatch-dot" style={{ background: preset.light.accent }} />
                </div>
                <span className="theme-swatch-label">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.createOwner} onChange={(e) => set({ createOwner: e.target.checked })} />
          Create the Owner account now
        </label>

        {form.createOwner && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)' }}>
            <input
              type="text"
              className="field-input"
              placeholder="Owner full name"
              value={form.ownerName}
              onChange={(e) => set({ ownerName: e.target.value })}
            />
            <input
              type="email"
              className="field-input"
              placeholder="Owner email"
              value={form.ownerEmail}
              onChange={(e) => set({ ownerEmail: e.target.value })}
            />
            <input
              type="password"
              className="field-input"
              placeholder="Owner password (min 6 characters)"
              value={form.ownerPassword}
              onChange={(e) => set({ ownerPassword: e.target.value })}
              minLength={6}
            />
          </div>
        )}

        {error && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button type="button" variant="ghost" onClick={() => router.push('/admin/organizations')}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={saving}>
            {saving ? 'Creating…' : 'Create organization'}
          </Button>
        </div>
      </form>
    </div>
  );
}
