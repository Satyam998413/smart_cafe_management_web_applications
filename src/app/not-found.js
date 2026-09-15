'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Home, Sparkles, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justify: 'center',
        padding: '2rem',
        background: 'radial-gradient(1000px 500px at 50% 30%, rgba(255, 122, 0, 0.12), transparent 70%), var(--bg-page)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background Ambient Glow Elements */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          right: '-5%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'rgba(99, 102, 241, 0.12)',
          filter: 'blur(90px)',
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          left: '-5%',
          width: 450,
          height: 450,
          borderRadius: '50%',
          background: 'rgba(255, 122, 0, 0.14)',
          filter: 'blur(100px)',
          pointerEvents: 'none'
        }}
      />

      <motion.div
        className="glass-card"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{
          maxWidth: 480,
          width: '100%',
          padding: '3rem 2rem',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Animated 404 Hero Mascot */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'relative' }}
        >
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              boxShadow: 'var(--shadow-accent)',
              fontSize: '3rem',
              position: 'relative'
            }}
          >
            ☕
            <span style={{ position: 'absolute', top: 6, right: 6, fontSize: '1.2rem' }}>✨</span>
          </div>
          <span
            style={{
              position: 'absolute',
              bottom: -10,
              right: -10,
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border)',
              padding: '0.2rem 0.6rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 800,
              color: 'var(--accent-primary)'
            }}
          >
            404
          </span>
        </motion.div>

        <div>
          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              marginBottom: '0.5rem'
            }}
          >
            Lost in Smart Space?
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.5, margin: '0 auto', maxWidth: 380 }}>
            The page, room, or space you are looking for has been moved, renamed, or doesn&apos;t exist.
          </p>
        </div>

        {/* Feature Tags */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span className="chip" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', cursor: 'default' }}>
            <Sparkles size={13} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} /> Cremen Smart Spaces
          </span>
          <span className="chip" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', cursor: 'default' }}>
            <Compass size={13} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} /> Page Not Found
          </span>
        </div>

        <div style={{ width: '100%', height: 1, background: 'var(--border)', margin: '0.5rem 0' }} />

        {/* Redirect Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', width: '100%', flexWrap: 'wrap' }}>
          <Link
            href="/"
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justify: 'center',
              gap: '0.5rem',
              padding: '0.8rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.9rem',
              textDecoration: 'none',
              boxShadow: 'var(--shadow-accent)',
              transition: 'transform 0.15s ease'
            }}
          >
            <Home size={18} /> Go to Home Page
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
