'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Lock, User, Eye, EyeOff, Sparkles, Activity, Server, Database, KeyRound } from 'lucide-react';
import { API_BASE } from '@/lib/apiClient';
import Button from '@/components/ui/Button';

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
        minHeight: '100vh',
        width: '100vw',
        position: 'relative',
        overflowX: 'hidden',
        background: 'var(--bg-page)',
        color: 'var(--text-primary)'
      }}
    >
      {/* Animated Ambient Background Grid Mesh */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.25, 0.45, 0.25]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: '-15%',
            left: '-10%',
            width: '50vw',
            height: '50vw',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%)',
            filter: 'blur(80px)'
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

      {/* Main Full-Bleed 100vw/100vh Split Grid */}
      <div
        style={{
          width: '100vw',
          minHeight: '100vh',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          position: 'relative',
          zIndex: 10
        }}
      >
        {/* Left 50vw: Master Console Visual Showcase */}
        <div
          style={{
            padding: '6rem 3.5rem 3.5rem',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '2.5rem' }}>
              <motion.div
                animate={{ rotate: [0, 6, -6, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center',
                  color: '#fff',
                  boxShadow: '0 0 24px rgba(99, 102, 241, 0.4)'
                }}
              >
                <ShieldCheck size={30} />
              </motion.div>
              <div>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>PREMISE.IO</h1>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6366f1', letterSpacing: '0.8px', textTransform: 'uppercase' }}>MASTER CONSOLE GATEWAY</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', margin: '2.5rem 0' }}>
              <FeaturePill icon={Server} title="Platform-Wide Multi-Tenancy" desc="Manage tenant organizations, custom domains & data plane connections" />
              <FeaturePill icon={Sparkles} title="AI Model Orchestration" desc="Configure platform defaults, OpenRouter, Groq & local Ollama LLM models" />
              <FeaturePill icon={Database} title="Security & Audit Logs" desc="Encrypted credential storage, coin plans & activity tracking" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>100%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Uptime Target</div>
            </div>
            <div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#6366f1' }}>AES-256</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Encrypted Keys</div>
            </div>
            <div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>&lt;50ms</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gateway Latency</div>
            </div>
          </div>
        </div>

        {/* Right 50vw: Master Admin Form Panel */}
        <div
          style={{
            padding: '6rem 3rem 3.5rem',
            display: 'flex',
            flexDirection: 'column',
            justify: 'center',
            alignItems: 'center',
            background: 'var(--bg-surface)'
          }}
        >
          <div style={{ width: '100%', maxWidth: '420px' }}>
            <div style={{ marginBottom: '2rem' }}>
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
