'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { jsonBody } from '@/lib/apiClient';
import { useOrgDetail } from '@/features/admin/OrgDetailContext';
import { THEME_PRESET_OPTIONS } from '@/lib/themePresetOptions';
import Button from '@/components/ui/Button';

const PREMISE_LABELS = { cafe_restaurant: 'Cafe / Restaurant', company_office: 'Company / Office', hotel: 'Hotel' };
const PLAN_TIERS = ['standard', 'enterprise'];

export default function OrgOverviewPage() {
  const { org, apiFetch, reload } = useOrgDetail();

  const [form, setForm] = useState(() => ({
    name: org.name || '',
    contactEmail: org.contactEmail || '',
    logoUrl: org.logoUrl || '',
    planTier: org.planTier,
    accountingWebhookUrl: org.accountingWebhookUrl || ''
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [applyingPreset, setApplyingPreset] = useState('');
  const [themeError, setThemeError] = useState('');

  // Re-sync the form if a different org loads under this same mounted
  // component (e.g. navigating from one org's Overview straight to another's).
  useEffect(() => {
    setForm({
      name: org.name || '',
      contactEmail: org.contactEmail || '',
      logoUrl: org.logoUrl || '',
      planTier: org.planTier,
      accountingWebhookUrl: org.accountingWebhookUrl || ''
    });
  }, [org]);

  const set = (patch) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await apiFetch(`/admin/organizations/${org.id}`, {
        method: 'PATCH',
        ...jsonBody({
          name: form.name,
          contactEmail: form.contactEmail,
          logoUrl: form.logoUrl || null,
          planTier: form.planTier,
          accountingWebhookUrl: form.accountingWebhookUrl || null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Failed to save.');
        return;
      }
      await reload();
      setSaved(true);
    } catch (e) {
      console.error('Failed to update organization:', e);
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = async (presetKey) => {
    setThemeError('');
    setApplyingPreset(presetKey);
    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/theme`, {
        method: 'POST',
        ...jsonBody({ themePreset: presetKey })
      });
      const data = await res.json();
      if (!res.ok) {
        setThemeError(data.message || 'Failed to apply theme.');
        return;
      }
      await reload();
    } catch (e) {
      console.error('Failed to apply theme preset:', e);
      setThemeError('Network error — please try again.');
    } finally {
      setApplyingPreset('');
    }
  };

  const currentPrimary = org.theme?.light?.primary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 640 }}>
      <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h2 style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>Profile</h2>

        <div>
          <span className="field-label">Premise type</span>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{PREMISE_LABELS[org.premiseType] || org.premiseType}</div>
        </div>

        <div>
          <label className="field-label" htmlFor="ov-name">
            Organization name
          </label>
          <input id="ov-name" type="text" className="field-input" value={form.name} onChange={(e) => set({ name: e.target.value })} required />
        </div>

        <div>
          <label className="field-label" htmlFor="ov-email">
            Contact email
          </label>
          <input
            id="ov-email"
            type="email"
            className="field-input"
            value={form.contactEmail}
            onChange={(e) => set({ contactEmail: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="ov-logo">
            Logo URL
          </label>
          <input id="ov-logo" type="url" className="field-input" value={form.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} placeholder="https://…" />
        </div>

        <div>
          <label className="field-label" htmlFor="ov-plan">
            Plan tier
          </label>
          <select id="ov-plan" className="field-input" value={form.planTier} onChange={(e) => set({ planTier: e.target.value })}>
            {PLAN_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="ov-webhook">
            Accounting webhook URL <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional — Phase 5 export)</span>
          </label>
          <input
            id="ov-webhook"
            type="url"
            className="field-input"
            value={form.accountingWebhookUrl}
            onChange={(e) => set({ accountingWebhookUrl: e.target.value })}
            placeholder="https://…"
          />
        </div>

        {error && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button type="submit" variant="primary" loading={saving} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          {saved && (
            <span style={{ color: '#047857', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <Check size={15} /> Saved
            </span>
          )}
        </div>
      </form>

      <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>Branding</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Applying a preset replaces the current theme immediately — both light and dark tokens.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {THEME_PRESET_OPTIONS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className={`theme-swatch ${currentPrimary === preset.light.primary ? 'selected' : ''}`}
              disabled={applyingPreset !== ''}
              onClick={() => applyPreset(preset.key)}
              style={{ opacity: applyingPreset && applyingPreset !== preset.key ? 0.5 : 1 }}
            >
              <div className="theme-swatch-colors">
                <span className="theme-swatch-dot" style={{ background: preset.light.primary }} />
                <span className="theme-swatch-dot" style={{ background: preset.light.secondary }} />
                <span className="theme-swatch-dot" style={{ background: preset.light.accent }} />
              </div>
              <span className="theme-swatch-label">
                {applyingPreset === preset.key ? 'Applying…' : preset.label}
                {currentPrimary === preset.light.primary && applyingPreset !== preset.key ? ' ✓' : ''}
              </span>
            </button>
          ))}
        </div>

        {themeError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{themeError}</div>}
      </div>
    </div>
  );
}
