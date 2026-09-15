'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, X, Check, Moon, Sun, Sparkles } from 'lucide-react';
import { THEME_PRESETS, applyAppTheme } from '@/lib/themeManager';

export const ADMIN_THEMES = THEME_PRESETS;

export default function AdminThemeSettings() {
  const [open, setOpen] = useState(false);
  const [activeTheme, setActiveTheme] = useState('sunset_orange');
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem('app_theme_preset') || 'sunset_orange';
    const savedMode = localStorage.getItem('app_theme') || 'dark';
    setActiveTheme(savedTheme);
    setIsDark(savedMode === 'dark');
    applyAppTheme(savedTheme, savedMode === 'dark');
  }, []);

  const selectTheme = (themeId) => {
    setActiveTheme(themeId);
    applyAppTheme(themeId, isDark);
  };

  const toggleDarkMode = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    applyAppTheme(activeTheme, newDark);
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
        <span>Theme Settings</span>
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
                maxWidth: '520px',
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
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>System Theme Controls</h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>10 3-Color Dynamic Palette Presets (Global UI Scope)</p>
                  </div>
                </div>
                <button type="button" className="icon-btn" onClick={() => setOpen(false)} title="Close">
                  <X size={16} />
                </button>
              </div>

              {/* Dark / Light Toggle Switch */}
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
                    {isDark ? 'Dark Theme' : 'Light Theme'}
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

              {/* 3-Color Swatches Grid */}
              <div>
                <label className="field-label" style={{ marginBottom: '0.75rem', display: 'block' }}>
                  Select Theme Palette (3 Internal Color Tokens)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                  {THEME_PRESETS.map((theme) => {
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
                          padding: '0.75rem 0.85rem',
                          borderRadius: 'var(--radius-md)',
                          background: isSelected ? 'var(--accent-wash)' : 'var(--bg-surface-elevated)',
                          border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* 3-Color Trio Dots */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: theme.primary }} />
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: theme.secondary }} />
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: theme.tertiary }} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {theme.name}
                          </div>
                        </div>

                        {isSelected && <Check size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} strokeWidth={3} />}
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
