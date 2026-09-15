'use client';

import { motion } from 'framer-motion';

export default function WebSplashScreen() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justify: 'center',
        background: 'radial-gradient(1200px 600px at 50% 40%, rgba(255, 122, 0, 0.12), transparent 70%), var(--bg-page)',
        color: 'var(--text-primary)'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', textAlign: 'center' }}>
        {/* Animated Hero Mascot Badge */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [0.6, 1.05, 1], opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: 'relative' }}
        >
          {/* Pulsing Outer Aura */}
          <motion.div
            animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: 'rgba(255, 122, 0, 0.12)',
              border: '2px solid rgba(255, 122, 0, 0.3)',
              position: 'absolute',
              top: -10,
              left: -10
            }}
          />

          {/* Inner Glowing Badge */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              boxShadow: 'var(--shadow-accent)',
              fontSize: '3.5rem',
              position: 'relative'
            }}
          >
            ☕
            <span style={{ position: 'absolute', top: 12, right: 12, fontSize: '1.4rem' }}>✨</span>
          </div>
        </motion.div>

        {/* Title & Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}
        >
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Cremen Smart Spaces
          </h1>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '2.5px', textTransform: 'uppercase' }}>
            AI-Powered Smart Venues & Ordering
          </span>

          {/* Feature Highlights */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <span className="chip" style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem' }}>🎙️ Voice AI</span>
            <span className="chip" style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem' }}>⚡ IoT Smart Spaces</span>
            <span className="chip" style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem' }}>☕ Fast Orders</span>
          </div>
        </motion.div>

        {/* Animated Loading Bar */}
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 140, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          style={{
            height: 4,
            borderRadius: 'var(--radius-full)',
            background: 'var(--bg-surface-elevated)',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <motion.div
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: '50%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, var(--accent-primary), transparent)',
              borderRadius: 'var(--radius-full)'
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
