'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  UploadCloud,
  Image as ImageIcon,
  User,
  UserPlus,
  ShieldCheck,
  Mail,
  Phone,
  Calendar,
  Lock,
  X,
  Building2,
  Sparkles,
  Trash2
} from 'lucide-react';
import { jsonBody } from '@/lib/apiClient';
import { useOrgDetail } from '@/features/admin/OrgDetailContext';
import { THEME_PRESET_OPTIONS } from '@/lib/themePresetOptions';
import Button from '@/components/ui/Button';

const PREMISE_LABELS = { cafe_restaurant: 'Cafe / Restaurant', company_office: 'Company / Office', hotel: 'Hotel' };
const PLAN_TIERS = ['free', 'standard', 'pro', 'enterprise'];

export default function OrgOverviewPage() {
  const { org, apiFetch, reload } = useOrgDetail();

  // Profile Form state
  const [form, setForm] = useState(() => ({
    name: org.name || '',
    contactEmail: org.contactEmail || '',
    logoUrl: org.logoUrl || '',
    planTier: org.planTier || 'standard',
    accountingWebhookUrl: org.accountingWebhookUrl || ''
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Logo upload state
  const fileInputRef = useRef(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Owner accounts state
  const [owners, setOwners] = useState([]);
  const [loadingOwners, setLoadingOwners] = useState(true);
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [ownerForm, setOwnerForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [savingOwner, setSavingOwner] = useState(false);
  const [ownerError, setOwnerError] = useState('');
  const [ownerSuccess, setOwnerSuccess] = useState('');

  // Preset state
  const [applyingPreset, setApplyingPreset] = useState('');
  const [themeError, setThemeError] = useState('');

  useEffect(() => {
    setForm({
      name: org.name || '',
      contactEmail: org.contactEmail || '',
      logoUrl: org.logoUrl || '',
      planTier: org.planTier || 'standard',
      accountingWebhookUrl: org.accountingWebhookUrl || ''
    });
  }, [org]);

  // Load organization staff/owner accounts
  const loadOwners = async () => {
    setLoadingOwners(true);
    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/staff`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        const orgOwners = data.filter((u) => u.role === 'owner');
        setOwners(orgOwners);
      }
    } catch (e) {
      console.error('Failed to load organization owners:', e);
    } finally {
      setLoadingOwners(false);
    }
  };

  useEffect(() => {
    loadOwners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id]);

  const set = (patch) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  // Profile Save
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
        setError(data.message || 'Failed to save organization settings.');
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

  // Logo Image Upload Handler (Supabase Storage cremen_media bucket max 3MB)
  const handleLogoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith('image/')) {
      setUploadError('Only image files (PNG, JPG, WEBP, SVG) are allowed.');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setUploadError('Image size must be 3MB or smaller.');
      return;
    }

    setUploadError('');
    setUploadingLogo(true);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'logo');
      formData.append('entityId', org.id);

      const res = await apiFetch('/uploads', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.message || 'Failed to upload logo.');
        return;
      }

      if (data.url) {
        set({ logoUrl: data.url });
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Logo upload error:', err);
      setUploadError('Network error uploading image.');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Add / Provision Owner handler
  const handleProvisionOwner = async (e) => {
    e.preventDefault();
    setOwnerError('');
    setOwnerSuccess('');
    setSavingOwner(true);

    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/staff`, {
        method: 'POST',
        ...jsonBody({
          name: ownerForm.name,
          email: ownerForm.email || undefined,
          phone: ownerForm.phone || undefined,
          password: ownerForm.password,
          role: 'owner'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setOwnerError(data.message || 'Failed to provision owner account.');
        return;
      }

      setOwnerSuccess(`Owner account "${data.name}" created successfully!`);
      setOwnerForm({ name: '', email: '', phone: '', password: '' });
      setShowAddOwner(false);
      await loadOwners();
    } catch (e) {
      console.error('Provision owner error:', e);
      setOwnerError('Network error creating owner account.');
    } finally {
      setSavingOwner(false);
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
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: '1.75rem', width: '100%', alignItems: 'flex-start' }}>
      {/* Left Column: Organization Profile & Logo Upload */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
        <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
            Organization Profile & Media Branding
          </h2>

          {/* Logo Upload System Card */}
          <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Organization Logo (Supabase cremen_media Bucket)
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              {/* Logo Preview Thumbnail */}
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '2px dashed var(--border-focus)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                  flexShrink: 0
                }}
              >
                {form.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logoUrl} alt="Org logo preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <ImageIcon size={28} style={{ color: 'var(--text-muted)' }} />
                )}
              </div>

              {/* Upload Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoFileChange} style={{ display: 'none' }} />

                <div style={{ display: 'flex', gap: '0.65rem' }}>
                  <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}>
                    <UploadCloud size={14} style={{ marginRight: '0.4rem' }} />
                    {uploadingLogo ? 'Uploading logo…' : 'Upload logo image'}
                  </Button>

                  {form.logoUrl && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => set({ logoUrl: '' })}>
                      <Trash2 size={14} style={{ color: 'var(--status-cancelled)' }} />
                    </Button>
                  )}
                </div>

                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Max file size: 3MB. Formats: PNG, JPG, WEBP, SVG.
                </span>

                {uploadSuccess && (
                  <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={14} /> Logo uploaded to storage! Click &quot;Save changes&quot; below.
                  </span>
                )}
                {uploadError && <span style={{ fontSize: '0.78rem', color: 'var(--status-cancelled)', fontWeight: 600 }}>{uploadError}</span>}
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="ov-logo" style={{ fontSize: '0.78rem' }}>
                Or Direct Public Image URL
              </label>
              <input
                id="ov-logo"
                type="url"
                className="field-input"
                value={form.logoUrl}
                onChange={(e) => set({ logoUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>

          <div>
            <span className="field-label">Premise Type</span>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 700, marginTop: '2px' }}>
              {PREMISE_LABELS[org.premiseType] || org.premiseType}
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="ov-name">
              Organization Name
            </label>
            <input id="ov-name" type="text" className="field-input" value={form.name} onChange={(e) => set({ name: e.target.value })} required />
          </div>

          <div>
            <label className="field-label" htmlFor="ov-email">
              Contact Email
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
            <label className="field-label" htmlFor="ov-plan">
              Plan Tier <span style={{ fontWeight: 600, color: 'var(--accent-primary)', marginLeft: '0.4rem' }}>(Master Admin Direct Override — No Payment)</span>
            </label>
            <select id="ov-plan" className="field-input" value={form.planTier} onChange={(e) => set({ planTier: e.target.value })}>
              {PLAN_TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier.toUpperCase()} PLAN
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="ov-webhook">
              Accounting Webhook URL <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional — Phase 5 export)</span>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            <Button type="submit" variant="primary" loading={saving} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            {saved && (
              <span style={{ color: '#047857', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700 }}>
                <Check size={16} /> Saved!
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Right Column: Organization Owner Details & Quick Branding Theme Swatches */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
        {/* Organization Owner Section */}
        <div className="glass-card" style={{ padding: '1.75rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <User size={20} style={{ color: 'var(--accent-primary)' }} />
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Organization Owner Details</h2>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tenant administrator account details</p>
              </div>
            </div>

            <Button variant="secondary" size="sm" onClick={() => setShowAddOwner(!showAddOwner)}>
              <UserPlus size={14} style={{ marginRight: '0.4rem' }} />
              {showAddOwner ? 'Cancel' : 'Provision Owner'}
            </Button>
          </div>

          {ownerSuccess && (
            <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.12)', color: '#059669', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Check size={16} /> {ownerSuccess}
            </div>
          )}

          {/* Provision Owner Account Form */}
          {showAddOwner && (
            <form onSubmit={handleProvisionOwner} style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Provision New Owner Account</h3>

              <div>
                <label className="field-label">Owner Full Name *</label>
                <input type="text" className="field-input" placeholder="e.g. Sarah Jenkins" value={ownerForm.name} onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label className="field-label">Email Address</label>
                  <input type="email" className="field-input" placeholder="sarah@venue.com" value={ownerForm.email} onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Mobile Number (10 Digits Max)</label>
                  <input
                    type="tel"
                    maxLength={10}
                    className="field-input"
                    placeholder="9876543210"
                    value={ownerForm.phone}
                    onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Initial Password *</label>
                <input type="password" className="field-input" placeholder="••••••••" value={ownerForm.password} onChange={(e) => setOwnerForm({ ...ownerForm, password: e.target.value })} required />
              </div>

              {ownerError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.82rem' }}>{ownerError}</div>}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <Button type="submit" variant="primary" size="sm" loading={savingOwner} disabled={savingOwner}>
                  Create Owner Account
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddOwner(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* List of Current Owners */}
          {loadingOwners ? (
            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading owner details…</div>
          ) : owners.length === 0 ? (
            <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No Owner account assigned to this organization yet. Click &quot;Provision Owner&quot; above to add one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {owners.map((owner) => (
                <div key={owner.id} style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>
                      {(owner.name || 'O')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{owner.name}</h4>
                        <span className="status-badge" style={{ background: 'var(--accent-wash)', color: 'var(--accent-primary)', fontSize: '0.68rem', fontWeight: 700 }}>
                          OWNER
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        {owner.email && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Mail size={12} /> {owner.email}
                          </span>
                        )}
                        {owner.phone && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={12} /> {owner.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    ID: {owner.id?.slice(0, 8)}…
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Theme Presets */}
        <div className="glass-card" style={{ padding: '1.75rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              Quick Theme Swatches
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.5rem' }}>
              Applying a preset replaces the tenant theme immediately (light & dark tokens).
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
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
    </div>
  );
}
