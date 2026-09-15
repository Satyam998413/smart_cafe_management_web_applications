'use client';

import { useContext, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Palette, Type, Maximize2, Check, Moon, Sun, Sparkles, RefreshCw, Eye, Zap, Save } from 'lucide-react';
import { OrgDetailContext } from '@/features/admin/OrgDetailContext';
import {
  GOOGLE_HEADER_FONTS,
  GOOGLE_BODY_FONTS,
  THEME_PRESETS,
  applyGoogleFontHeader,
  applyGoogleFontBody,
  applyFontAndIconScale,
  applyAppTheme
} from '@/lib/themeManager';
import Button from '@/components/ui/Button';

export default function OrgThemePage() {
  const { org, apiFetch, reload } = useContext(OrgDetailContext);

  const [headerFont, setHeaderFont] = useState(org?.customBranding?.headerFont || 'Plus Jakarta Sans');
  const [bodyFont, setBodyFont] = useState(org?.customBranding?.bodyFont || 'Inter');
  const [scale, setScale] = useState(org?.customBranding?.fontScale || 100);
  const [activeTheme, setActiveTheme] = useState(org?.customBranding?.themePreset || 'sunset_orange');
  const [isDark, setIsDark] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (org?.customBranding) {
      if (org.customBranding.headerFont) setHeaderFont(org.customBranding.headerFont);
      if (org.customBranding.bodyFont) setBodyFont(org.customBranding.bodyFont);
      if (org.customBranding.fontScale) setScale(Number(org.customBranding.fontScale));
      if (org.customBranding.themePreset) setActiveTheme(org.customBranding.themePreset);
    }
  }, [org]);

  const handleHeaderFontChange = (fontId) => {
    setHeaderFont(fontId);
    applyGoogleFontHeader(fontId);
  };

  const handleBodyFontChange = (fontId) => {
    setBodyFont(fontId);
    applyGoogleFontBody(fontId);
  };

  const handleScaleChange = (val) => {
    const num = Number(val);
    setScale(num);
    applyFontAndIconScale(num);
  };

  const handleThemePresetSelect = (themeId) => {
    setActiveTheme(themeId);
    applyAppTheme(themeId, isDark);
  };

  const handleSaveBranding = async () => {
    setSaving(true);
    setError('');
    setSaveSuccess(false);

    try {
      const res = await apiFetch(`/admin/organizations/${org.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          customBranding: {
            ...org.customBranding,
            headerFont,
            bodyFont,
            fontScale: scale,
            themePreset: activeTheme,
            mode: isDark ? 'dark' : 'light'
          }
        })
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || 'Failed to save organization theme settings');
        return;
      }

      setSaveSuccess(true);
      if (reload) await reload();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error('Save org theme error:', e);
      setError('Network error saving theme settings');
    } finally {
      setSaving(false);
    }
  };

  const currentPreset = THEME_PRESETS.find((t) => t.id === activeTheme) || THEME_PRESETS[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
      {/* Header Banner */}
      <div
        className="glass-card"
        style={{
          padding: '1.5rem 1.75rem',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          background: 'linear-gradient(135deg, var(--bg-surface), var(--accent-wash))',
          border: '1px solid var(--border)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              color: '#fff'
            }}
          >
            <Palette size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {org?.name} — Theme & Fonts Configuration
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Set tenant custom Google Fonts, typography scaling & theme palette preset for {org?.name}.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {saveSuccess && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#10b981',
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}
            >
              Saved to Tenant Config!
            </motion.span>
          )}

          <Button variant="primary" onClick={handleSaveBranding} disabled={saving}>
            <Save size={15} style={{ marginRight: '0.4rem' }} />
            {saving ? 'Saving…' : 'Save Theme Config'}
          </Button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(244, 63, 94, 0.15)', color: '#e11d48', fontSize: '0.85rem', fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* 2-Column Controls & Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1.75rem', alignItems: 'flex-start' }}>
        {/* Controls Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Dual Google Fonts */}
          <div className="glass-card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
              <Type size={18} style={{ color: 'var(--accent-primary)' }} />
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Google Fonts Engine</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tenant Header & Body Typography</p>
              </div>
            </div>

            <div>
              <label className="field-label" style={{ marginBottom: '0.4rem', display: 'block' }}>
                Header / Display Font (`--font-heading`)
              </label>
              <select className="select-input" value={headerFont} onChange={(e) => handleHeaderFontChange(e.target.value)} style={{ width: '100%', padding: '0.65rem' }}>
                {GOOGLE_HEADER_FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" style={{ marginBottom: '0.4rem', display: 'block' }}>
                Body / UI Font (`--font-body`)
              </label>
              <select className="select-input" value={bodyFont} onChange={(e) => handleBodyFontChange(e.target.value)} style={{ width: '100%', padding: '0.65rem' }}>
                {GOOGLE_BODY_FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Scale Slider */}
          <div className="glass-card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Maximize2 size={18} style={{ color: 'var(--accent-primary)' }} />
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Typography & Icon Scale</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Global Tenant UI Scale Ratio</p>
                </div>
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-primary)', padding: '0.25rem 0.65rem', borderRadius: 'var(--radius-full)', background: 'var(--accent-wash)' }}>
                {scale}% Scale
              </span>
            </div>

            <input
              type="range"
              min="80"
              max="130"
              step="5"
              value={scale}
              onChange={(e) => handleScaleChange(e.target.value)}
              style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
          </div>

          {/* Color Palettes */}
          <div className="glass-card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Tenant Color Palette</h3>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
              {THEME_PRESETS.map((t) => {
                const isSelected = activeTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleThemePresetSelect(t.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--accent-wash)' : 'var(--bg-surface-elevated)',
                      border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.primary }} />
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.secondary }} />
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.tertiary }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.name}
                      </div>
                    </div>
                    {isSelected && <Check size={14} style={{ color: 'var(--accent-primary)' }} strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live Preview Panel */}
        <div style={{ position: 'sticky', top: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justify: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Eye size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Live Tenant Preview</h3>
              </div>
            </div>

            <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Header: {headerFont}</span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{org?.name || 'Venue Name'}</h2>
            </div>

            <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Body: {bodyFont}</span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Welcome to {org?.name}. Enjoy seamless QR ordering, automated table reservations and instant bill settlements.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="primary">
                <Zap size={14} style={{ marginRight: '4px' }} /> Quick Action
              </Button>
              <Button variant="secondary">Cancel</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
