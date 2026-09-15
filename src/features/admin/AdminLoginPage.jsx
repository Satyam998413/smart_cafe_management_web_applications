'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Lock, User, Eye, EyeOff, Sparkles, Activity, Server, Database, KeyRound, Cpu, ShieldAlert } from 'lucide-react';
import { API_BASE } from '@/lib/apiClient';
import Button from '@/components/ui/Button';
import ThemeToggle from '@/components/ThemeToggle';

export default function AdminLoginPage({ onLoginSuccess }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/staff-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setError(data.message || 'Authentication failed. Please verify credentials.');
        return;
      }
      if (data.user?.role !== 'master_admin') {
        setError('Access denied: Account does not hold Master Admin authority.');
        return;
      }
      onLoginSuccess(data.token, data.user);
    } catch (e) {
      console.error('Admin login request failed:', e);
      setError('Network error — gateway server unresponsive.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        maxHeight: '100vh',
        width: '100vw',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--bg-page)',
        color: 'var(--text-primary)'
      }}
    >
      {/* Background Cyber Mesh & Radial Glow Orbs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <motion.div
          animate={{
            scale: [1, 1.18, 1],
            x: [0, 20, 0],
            y: [0, -15, 0]
          }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: '-15%',
            left: '-10%',
            width: '50vw',
            height: '50vw',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, transparent 70%)',
            filter: 'blur(90px)'
          }}
        />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            x: [0, -30, 0],
            y: [0, 25, 0]
          }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          style={{
            position: 'absolute',
            bottom: '-15%',
            right: '-10%',
            width: '55vw',
            height: '55vw',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.14) 0%, transparent 70%)',
            filter: 'blur(90px)'
          }}
        />
        <motion.div
          animate={{
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `radial-gradient(circle at 30px 30px, var(--border) 1.5px, transparent 0)`,
            backgroundSize: '48px 48px'
          }}
        />
      </div>

      {/* Floating Header Actions Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4.5rem',
          padding: '0 2rem',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          zIndex: 40
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              color: '#fff',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)'
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              PREMISE.IO
            </span>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6366f1', marginLeft: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              MASTER CONSOLE
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#6366f1',
              fontSize: '0.78rem',
              fontWeight: 700
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 8px #6366f1' }} />
            ENCRYPTED GATEWAY
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Main Full-Bleed 100vh Split Grid */}
      <div
        style={{
          width: '100vw',
          height: '100vh',
          maxHeight: '100vh',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          position: 'relative',
          zIndex: 10
        }}
      >
        {/* Left 50vw: Master Console Cyber Visual Showcase */}
        <div
          style={{
            padding: '5.5rem 3.5rem 2.5rem',
            background: 'linear-gradient(135deg, var(--bg-surface-elevated), var(--bg-surface))',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            justify: 'space-between',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(99, 102, 241, 0.12)',
                  color: '#6366f1',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  marginBottom: '0.85rem',
                  border: '1px solid rgba(99, 102, 241, 0.3)'
                }}
              >
                <Sparkles size={14} /> Multi-Tenant Operator Control Plane
              </span>
              <h1 style={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1.18, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                Master Operator Gateway
              </h1>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.45, maxWidth: '500px' }}>
                Full control over tenant organizations, AI model routing, encrypted key vaults, coin economy, and platform audit logs.
              </p>
            </div>

            {/* Animated Cyber Shield SVG Illustration */}
            <AnimatedCyberShield />

            {/* Floating Live Telemetry Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  padding: '0.8rem 1.15rem',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-md)',
                  backdropFilter: 'blur(16px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem'
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Server size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Multi-Tenant Mesh • 148 Orgs</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: 99, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>HEALTHY</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Data Plane Isolation • Custom Domains • Zero Outages
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                style={{
                  padding: '0.8rem 1.15rem',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-md)',
                  backdropFilter: 'blur(16px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem'
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Cpu size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>AI Orchestration Pipeline</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem', marginTop: 2 }}>
                    <span>⚡ OpenRouter</span>
                    <span>🤖 Groq Engine</span>
                    <span style={{ color: '#38bdf8', fontWeight: 700 }}>🦙 Ollama Local</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Metric Counter Footer */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>100%</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Uptime Target</div>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#6366f1' }}>AES-256</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Encrypted Keys</div>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>&lt;50ms</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Gateway Speed</div>
            </div>
          </div>
        </div>

        {/* Right 50vw: Master Admin Form Panel */}
        <div
          style={{
            padding: '5.5rem 3rem 2.5rem',
            display: 'flex',
            flexDirection: 'column',
            justify: 'center',
            alignItems: 'center',
            background: 'var(--bg-surface)',
            position: 'relative'
          }}
        >
          <div style={{ width: '100%', maxWidth: '390px' }}>
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-full)', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#6366f1', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.6px', marginBottom: '0.75rem' }}>
                <Activity size={13} /> ENCRYPTED CONSOLE
              </div>
              <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Master Admin Sign In</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                Enter platform operator credentials to access the Master Console
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div>
                <label className="field-label" htmlFor="admin-identifier" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                  <User size={14} style={{ color: '#6366f1' }} /> Administrator ID
                </label>
                <input
                  id="admin-identifier"
                  type="text"
                  className="field-input"
                  placeholder="admin@smartcafemanager.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <label className="field-label" htmlFor="admin-password" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                  <Lock size={14} style={{ color: '#6366f1' }} /> Security Key / Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    className="field-input"
                    style={{ paddingRight: '2.5rem' }}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    fontSize: '0.82rem',
                    fontWeight: 600
                  }}
                >
                  {error}
                </motion.div>
              )}

              <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading} style={{ height: 46, fontSize: '0.95rem', fontWeight: 700, marginTop: '0.4rem' }}>
                {loading ? 'Authenticating Console Access…' : 'Access Master Console'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnimatedCyberShield() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '185px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.25rem 0' }}>
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.65, 0.35] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          width: 170,
          height: 170,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%)',
          filter: 'blur(22px)'
        }}
      />

      <svg width="200" height="175" viewBox="0 0 200 175" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Rotating Outer Radar Rings */}
        <motion.circle
          cx="100" cy="85" r="75"
          stroke="rgba(99, 102, 241, 0.25)" strokeWidth="1.5" strokeDasharray="6 6"
          animate={{ rotate: 360 }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '100px 85px' }}
        />
        <motion.circle
          cx="100" cy="85" r="60"
          stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1.5" strokeDasharray="4 8"
          animate={{ rotate: -360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '100px 85px' }}
        />

        {/* Central Shield Graphic */}
        <motion.path
          d="M100 35 L140 50 V95 C140 120 100 138 100 138 C100 138 60 120 60 95 V50 L100 35 Z"
          fill="url(#shieldGrad)"
          stroke="#6366f1"
          strokeWidth="2.5"
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '100px 85px' }}
        />

        {/* Inner Lock Accent */}
        <path d="M92 80 V72 C92 68 95 65 100 65 C105 65 108 68 108 72 V80" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="88" y="80" width="24" height="20" rx="4" fill="#6366f1" stroke="#fff" strokeWidth="1.5" />
        <circle cx="100" cy="90" r="2.5" fill="#fff" />

        {/* Pulsing Orbit Nodes */}
        <motion.circle
          cx="25" cy="85" r="5" fill="#6366f1"
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.circle
          cx="175" cy="85" r="5" fill="#38bdf8"
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        />

        <defs>
          <linearGradient id="shieldGrad" x1="60" y1="35" x2="140" y2="138" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(99, 102, 241, 0.4)" />
            <stop offset="1" stopColor="rgba(56, 189, 248, 0.15)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function FeaturePill({ icon: Icon, title, desc }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', flexShrink: 0, marginTop: 2 }}>
        <Icon size={17} />
      </div>
      <div>
        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>{desc}</div>
      </div>
    </div>
  );
}
