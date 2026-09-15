'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Palette,
  Type,
  Maximize2,
  Check,
  Moon,
  Sun,
  Sparkles,
  Sliders,
  Eye,
  RefreshCw,
  Layers,
  Zap
} from 'lucide-react';
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

export default function AdminThemePage() {
  const [headerFont, setHeaderFont] = useState('Plus Jakarta Sans');
  const [bodyFont, setBodyFont] = useState('Inter');
  const [scale, setScale] = useState(100);
  const [activeTheme, setActiveTheme] = useState('sunset_orange');
  const [isDark, setIsDark] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const savedHeader = localStorage.getItem('app_font_header') || 'Plus Jakarta Sans';
    const savedBody = localStorage.getItem('app_font_body') || 'Inter';
    const savedScaleVal = localStorage.getItem('app_font_scale') || '100';
    const savedPreset = localStorage.getItem('app_theme_preset') || 'sunset_orange';
    const savedMode = localStorage.getItem('app_theme') || 'dark';

    setHeaderFont(savedHeader);
    setBodyFont(savedBody);
    setScale(Number(savedScaleVal));
    setActiveTheme(savedPreset);
    setIsDark(savedMode === 'dark');

    applyGoogleFontHeader(savedHeader);
    applyGoogleFontBody(savedBody);
    applyFontAndIconScale(Number(savedScaleVal));
    applyAppTheme(savedPreset, savedMode === 'dark');
  }, []);

  const handleHeaderFontChange = (fontId) => {
    setHeaderFont(fontId);
    applyGoogleFontHeader(fontId);
    triggerSavedFeedback();
  };

  const handleBodyFontChange = (fontId) => {
    setBodyFont(fontId);
    applyGoogleFontBody(fontId);
    triggerSavedFeedback();
  };

  const handleScaleChange = (val) => {
    const num = Number(val);
    setScale(num);
    applyFontAndIconScale(num);
    triggerSavedFeedback();
  };

  const handleThemePresetSelect = (themeId) => {
    setActiveTheme(themeId);
    applyAppTheme(themeId, isDark);
    triggerSavedFeedback();
  };

  const handleDarkModeToggle = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    applyAppTheme(activeTheme, newDark);
    triggerSavedFeedback();
  };

  const handleResetDefaults = () => {
    setHeaderFont('Plus Jakarta Sans');
    setBodyFont('Inter');
    setScale(100);
    setActiveTheme('sunset_orange');
    setIsDark(true);

    applyGoogleFontHeader('Plus Jakarta Sans');
    applyGoogleFontBody('Inter');
    applyFontAndIconScale(100);
    applyAppTheme('sunset_orange', true);
    triggerSavedFeedback();
  };

  const triggerSavedFeedback = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const currentThemePreset = THEME_PRESETS.find((t) => t.id === activeTheme) || THEME_PRESETS[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
      {/* Header Banner */}
      <div
        className="glass-card"
        style={{
          padding: '1.75rem 2rem',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, var(--bg-surface), var(--accent-wash))',
          border: '1px solid var(--border)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: 'var(--shadow-accent)'
            }}
          >
            <Palette size={26} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Master Console Theme & Typography Engine
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Customize dual Google Fonts, UI scale ratio & 3-color palette themes across all management consoles.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {savedSuccess && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#10b981',
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}
            >
              <Check size={14} /> Theme Applied!
            </motion.span>
          )}

          <Button variant="secondary" onClick={handleResetDefaults}>
            <RefreshCw size={15} style={{ marginRight: '0.4rem' }} /> Reset Defaults
          </Button>
        </div>
      </div>

      {/* Main 2-Column Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1.75rem', alignItems: 'flex-start' }}>
        {/* Left Column: Controls (Fonts, Scale, Color Palettes) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* Section 1: Google Fonts Selector */}
          <div className="glass-card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
              <Type size={20} style={{ color: 'var(--accent-primary)' }} />
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Google Fonts Engine</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Configure distinct web fonts for Headers vs Body Content</p>
              </div>
            </div>

            {/* Header Font Picker */}
            <div>
              <label className="field-label" style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Header & Title Font (`--font-heading`)</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                  {headerFont}
                </span>
              </label>
              <select
                className="select-input"
                value={headerFont}
                onChange={(e) => handleHeaderFontChange(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontWeight: 600 }}
              >
                {GOOGLE_HEADER_FONTS.map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Body Font Picker */}
            <div>
              <label className="field-label" style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Body & UI Content Font (`--font-body`)</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                  {bodyFont}
                </span>
              </label>
              <select
                className="select-input"
                value={bodyFont}
                onChange={(e) => handleBodyFontChange(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontWeight: 600 }}
              >
                {GOOGLE_BODY_FONTS.map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: Font & Icon Scale Slider */}
          <div className="glass-card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Maximize2 size={20} style={{ color: 'var(--accent-primary)' }} />
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>UI Typography & Icon Scale</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Dynamically scale fonts, icons and component heights (80% – 130%)</p>
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  color: 'var(--accent-primary)',
                  padding: '0.3rem 0.75rem',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--accent-wash)'
                }}
              >
                {scale}% Scale
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                type="range"
                min="80"
                max="130"
                step="5"
                value={scale}
                onChange={(e) => handleScaleChange(e.target.value)}
                style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer', height: '6px' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                <span>80% Compact</span>
                <span>100% Standard</span>
                <span>115% Comfortable</span>
                <span>130% Large</span>
              </div>

              {/* Quick Scale Presets */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                {[
                  { label: '85% Small', val: 85 },
                  { label: '100% Standard', val: 100 },
                  { label: '115% Large', val: 115 },
                  { label: '125% Extra Large', val: 125 }
                ].map((p) => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => handleScaleChange(p.val)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: scale === p.val ? 700 : 500,
                      background: scale === p.val ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)',
                      color: scale === p.val ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Theme Palette Presets */}
          <div className="glass-card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Sparkles size={20} style={{ color: 'var(--accent-primary)' }} />
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>16 Dynamic Color Themes</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>3-Color tokens (Primary, Secondary & Tertiary accents)</p>
                </div>
              </div>

              {/* Dark/Light Switch */}
              <button
                type="button"
                onClick={handleDarkModeToggle}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {isDark ? <Moon size={15} style={{ color: 'var(--accent-primary)' }} /> : <Sun size={15} style={{ color: '#f59e0b' }} />}
                <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
              </button>
            </div>

            {/* Grid of Palette Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem' }}>
              {THEME_PRESETS.map((t) => {
                const selected = activeTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleThemePresetSelect(t.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      background: selected ? 'var(--accent-wash)' : 'var(--bg-surface-elevated)',
                      border: selected ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: t.primary }} />
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: t.secondary }} />
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: t.tertiary }} />
                      </div>
                      {selected && <Check size={16} style={{ color: 'var(--accent-primary)' }} strokeWidth={3} />}
                    </div>

                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>{t.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive UI Preview */}
        <div style={{ position: 'sticky', top: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.75rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Eye size={20} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Live UI Preview</h3>
              </div>
              <span className="status-badge" style={{ background: 'var(--accent-wash)', color: 'var(--accent-primary)' }}>
                Realtime Render
              </span>
            </div>

            {/* Typography Sample Card */}
            <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Header Font Preview ({headerFont})
              </span>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Cremen Smart Cafe Management Console
              </h1>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                Sub-heading Typography in {headerFont}
              </h3>
            </div>

            {/* Body Content Sample Card */}
            <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Body Font Preview ({bodyFont})
              </span>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Experience clean legibility, dynamic contrast, and responsive scaling across all admin modules, live kitchen tickets, and organization telemetry.
              </p>
            </div>

            {/* Component Buttons & Pills Sample */}
            <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Buttons & Palette Accents ({currentThemePreset.name})
              </span>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Button variant="primary">
                  <Zap size={15} style={{ marginRight: '0.4rem' }} /> Primary Action
                </Button>
                <Button variant="secondary">Secondary Action</Button>
                <Button variant="outline">Outline</Button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className="status-badge" style={{ background: 'var(--accent-wash)', color: 'var(--accent-primary)', border: '1px solid var(--border-focus)' }}>
                  <Sparkles size={12} style={{ marginRight: '4px' }} /> Active Accent
                </span>
                <span className="status-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669' }}>
                  Online
                </span>
                <span className="status-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#0284c7' }}>
                  99.9% Uptime
                </span>
              </div>
            </div>

            {/* Active Theme Summary Card */}
            <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-wash)', border: '1px solid var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{currentThemePreset.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Header: {headerFont} | Body: {bodyFont}</div>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: currentThemePreset.primary }} />
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: currentThemePreset.secondary }} />
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: currentThemePreset.tertiary }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
