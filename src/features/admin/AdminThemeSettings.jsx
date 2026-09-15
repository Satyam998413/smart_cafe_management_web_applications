'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, X, Check, Moon, Sun, Sparkles } from 'lucide-react';

export const ADMIN_THEMES = [
  {
    id: 'cyber_neon',
    name: 'Cyber Neon (Default)',
    primary: '#6366f1',
    secondary: '#38bdf8',
    bgPage: '#090a0f',
    bgSurface: '#10121b',
    wash: 'rgba(99, 102, 241, 0.15)'
  },
  {
    id: 'obsidian_gold',
    name: 'Obsidian Gold',
    primary: '#f59e0b',
    secondary: '#d97706',
    bgPage: '#0c0a09',
    bgSurface: '#1c1917',
    wash: 'rgba(245, 158, 11, 0.15)'
  },
  {
    id: 'emerald_matrix',
    name: 'Emerald Matrix',
    primary: '#10b981',
    secondary: '#059669',
    bgPage: '#06130e',
    bgSurface: '#0b1d16',
    wash: 'rgba(16, 185, 129, 0.15)'
  },
  {
    id: 'sunset_blaze',
    name: 'Sunset Blaze',
    primary: '#ff7a00',
    secondary: '#e06900',
    bgPage: '#110a05',
    bgSurface: '#1a1008',
    wash: 'rgba(255, 122, 0, 0.15)'
  },
  {
    id: 'midnight_purple',
    name: 'Velvet Purple',
    primary: '#a855f7',
    secondary: '#7e22ce',
    bgPage: '#0f0a17',
    bgSurface: '#171024',
    wash: 'rgba(168, 85, 247, 0.15)'
  },
  {
    id: 'frost_steel',
    name: 'Frost Steel',
    primary: '#0ea5e9',
    secondary: '#0284c7',
    bgPage: '#0b111e',
    bgSurface: '#131b2e',
    wash: 'rgba(14, 165, 233, 0.15)'
  }
];

export default function AdminThemeSettings() {
  const [open, setOpen] = useState(false);
  const [activeTheme, setActiveTheme] = useState('cyber_neon');
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem('admin_console_theme') || 'cyber_neon';
    const savedMode = localStorage.getItem('admin_console_mode') || 'dark';
    setActiveTheme(savedTheme);
    setIsDark(savedMode === 'dark');
    applyAdminTheme(savedTheme, savedMode === 'dark');
  }, []);

  const applyAdminTheme = (themeId, darkMode) => {
    const theme = ADMIN_THEMES.find((t) => t.id === themeId) || ADMIN_THEMES[0];
    const root = document.documentElement;

    root.setAttribute('data-admin-theme', themeId);
    root.setAttribute('data-theme', darkMode ? 'dark' : 'light');

    if (darkMode) {
      root.style.setProperty('--accent-primary', theme.primary);
      root.style.setProperty('--accent-secondary', theme.secondary);
      root.style.setProperty('--accent-wash', theme.wash);
      root.style.setProperty('--accent-glow', `${theme.primary}40`);
      root.style.setProperty('--border-focus', `${theme.primary}80`);
    }

    localStorage.setItem('admin_console_theme', themeId);
    localStorage.setItem('admin_console_mode', darkMode ? 'dark' : 'light');
  };

  const selectTheme = (themeId) => {
    setActiveTheme(themeId);
    applyAdminTheme(themeId, isDark);
  };

  const toggleDarkMode = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    applyAdminTheme(activeTheme, newDark);
  };

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen(true)}
        title="Master Admin Console Theme Settings"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.45rem 0.85rem',
          width: 'auto',
          borderRadius: 'var(--radius-full)',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        <Palette size={15} style={{ color: 'var(--accent-primary)' }} />
        <span>Admin Theme</span>
      </button>

      <AnimatePresence>
        {open && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              padding: '1.5rem',
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(8px)'
            }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 16 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="glass-card"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '460px',
                padding: '1.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-wash)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Master Admin Theme</h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Console visual presets (Master Admin view only)</p>
                  </div>
                </div>
                <button type="button" className="icon-btn" onClick={() => setOpen(false)} title="Close">
                  <X size={16} />
                </button>
              </div>

              {/* Dark / Light Toggle Switch for Master Admin */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'space-between',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {isDark ? <Moon size={18} style={{ color: 'var(--accent-primary)' }} /> : <Sun size={18} style={{ color: '#f59e0b' }} />}
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isDark ? 'Dark Console Mode' : 'Light Console Mode'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  className={`switch ${isDark ? 'on' : ''}`}
                  role="switch"
                  aria-checked={isDark}
                  aria-label="Toggle console mode"
                >
                  <span className="switch-knob" />
                </button>
              </div>

              {/* Theme Swatches */}
              <div>
                <label className="field-label" style={{ marginBottom: '0.75rem', display: 'block' }}>
                  Accent &amp; Palette Presets
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                  {ADMIN_THEMES.map((theme) => {
                    const isSelected = activeTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => selectTheme(theme.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.75rem 0.9rem',
                          borderRadius: 'var(--radius-md)',
                          background: isSelected ? 'var(--accent-wash)' : 'var(--bg-surface-elevated)',
                          border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
                            display: 'flex',
                            alignItems: 'center',
                            justify: 'center',
                            color: '#fff',
                            flexShrink: 0
                          }}
                        >
                          {isSelected && <Check size={14} strokeWidth={3} />}
                        </div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {theme.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
