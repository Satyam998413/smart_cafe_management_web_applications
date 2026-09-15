'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Palette, UserPlus, Coins, ArrowLeft, CheckCircle2 } from 'lucide-react';
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

const ONBOARDING_STEPS = [
  { step: '01', label: 'Organization Info', desc: 'Name, premise type & contact', icon: Building2 },
  { step: '02', label: 'Branding & Theme', desc: 'Logo URL & color preset', icon: Palette },
  { step: '03', label: 'Owner Account', desc: 'Initial manager/owner user', icon: UserPlus },
  { step: '04', label: 'Coin Wallet', desc: 'Auto 1000 free coins granted', icon: Coins }
];

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
    <div style={{ display: 'flex', gap: '1.5rem', width: '100%', alignItems: 'flex-start' }}>
      {/* 300px Left Steps Sidebar */}
      <div
        className="glass-card"
        style={{
          width: 300,
          flexShrink: 0,
          position: 'sticky',
          top: '1.5rem',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}
      >
        <button
          type="button"
          className="text-link"
          onClick={() => router.push('/admin/organizations')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={14} /> Back to Organizations
        </button>

        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Onboard Tenant</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
            Follow steps to provision a new organization.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {ONBOARDING_STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isCompleted = idx === 0 && Boolean(form.name && form.contactEmail);
            return (
              <div
                key={s.step}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border)'
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent-primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Icon size={15} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.label}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.desc}</div>
                </div>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{s.step}</span>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '0.85rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          🎁 <strong>Automated Bonus:</strong> 1,000 free platform coins are auto-credited to the organization wallet upon creation.
        </div>
      </div>

      {/* Right Form Workspace */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section 1 */}
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              1. Organization Information
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Primary business details and operating type.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <label className="field-label" htmlFor="org-name">
                Organization name *
              </label>
              <input id="org-name" type="text" className="field-input" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Apex Cafe & Bistro" required />
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
          </div>

          <div>
            <label className="field-label" htmlFor="org-email">
              Contact email *
            </label>
            <input
              id="org-email"
              type="email"
              className="field-input"
              value={form.contactEmail}
              onChange={(e) => set({ contactEmail: e.target.value })}
              placeholder="owner@apexcafe.com"
              required
            />
          </div>

          {/* Section 2 */}
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', paddingTop: '0.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              2. Branding & Theme Preset
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Configure logo and initial color identity.</p>
          </div>

          <div>
            <label className="field-label" htmlFor="org-logo">
              Logo URL <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <input id="org-logo" type="url" className="field-input" value={form.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} placeholder="https://domain.com/logo.png" />
          </div>

          <div>
            <span className="field-label">Branding preset (optional)</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem', marginTop: '0.4rem' }}>
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

          {/* Section 3 */}
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', paddingTop: '0.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              3. Initial Owner Account
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Optionally create the primary owner user right now.</p>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.createOwner} onChange={(e) => set({ createOwner: e.target.checked })} />
            Create Owner user account immediately
          </label>

          {form.createOwner && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)' }}>
              <div>
                <label className="field-label">Owner Name</label>
                <input
                  type="text"
                  className="field-input"
                  placeholder="e.g. Sarah Jenkins"
                  value={form.ownerName}
                  onChange={(e) => set({ ownerName: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label">Owner Email</label>
                <input
                  type="email"
                  className="field-input"
                  placeholder="sarah@apexcafe.com"
                  value={form.ownerEmail}
                  onChange={(e) => set({ ownerEmail: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label">Owner Password</label>
                <input
                  type="password"
                  className="field-input"
                  placeholder="Min 6 characters"
                  value={form.ownerPassword}
                  onChange={(e) => set({ ownerPassword: e.target.value })}
                  minLength={6}
                />
              </div>
            </div>
          )}

          {error && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
            <Button type="button" variant="ghost" onClick={() => router.push('/admin/organizations')}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving} disabled={saving}>
              {saving ? 'Creating…' : 'Create Organization'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
