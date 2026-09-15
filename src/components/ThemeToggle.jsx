'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { applyAppTheme, initAppTheme } from '@/lib/themeManager';

export default function ThemeToggle() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    initAppTheme();
    const savedMode = localStorage.getItem('app_theme') || 'dark';
    setTheme(savedMode);
  }, []);

  const toggleTheme = () => {
    const nextMode = theme === 'dark' ? 'light' : 'dark';
    const activePreset = localStorage.getItem('app_theme_preset') || 'sunset_orange';
    setTheme(nextMode);
    applyAppTheme(activePreset, nextMode === 'dark');
  };

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      className="icon-btn"
      whileTap={{ scale: 0.92 }}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle dark and light theme"
      style={{
        width: 38,
        height: 38,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.06)',
        border: '1px solid var(--border)',
        color: theme === 'dark' ? '#fbbf24' : '#6366f1',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
    >
      <motion.div
        key={theme}
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        exit={{ rotate: 90, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </motion.div>
    </motion.button>
  );
}
