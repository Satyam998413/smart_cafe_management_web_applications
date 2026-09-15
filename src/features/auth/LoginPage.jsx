'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, Lock, User, Mail, Eye, EyeOff, ShieldCheck, UtensilsCrossed, Sparkles, Cpu, Activity, Zap, CheckCircle2 } from 'lucide-react';
import { API_BASE, getOrCreateHiveId } from '@/lib/apiClient';
import ThemeToggle from '@/components/ThemeToggle';
import Button from '@/components/ui/Button';
import { initAppTheme } from '@/lib/themeManager';

export default function LoginPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('customer'); // 'customer' | 'staff'

  useEffect(() => {
    initAppTheme();
  }, []);

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
      {/* Animated Ambient Background Grid Mesh & Glow Orbs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            x: [0, 30, 0],
            y: [0, -20, 0]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: '-15%',
            left: '-10%',
            width: '50vw',
            height: '50vw',
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--accent-wash) 0%, transparent 70%)',
            filter: 'blur(80px)'
          }}
        />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            x: [0, -40, 0],
            y: [0, 30, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          style={{
            position: 'absolute',
            bottom: '-15%',
            right: '-10%',
            width: '55vw',
            height: '55vw',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
            filter: 'blur(90px)'
          }}
        />
        <motion.div
          animate={{
            opacity: [0.25, 0.45, 0.25]
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

      {/* Header Bar */}
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
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              color: 'var(--text-on-accent)',
              boxShadow: 'var(--shadow-accent)'
            }}
          >
            <Coffee size={22} />
          </div>
          <div>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Smart Cafe
            </span>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-primary)', marginLeft: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              PRO PLATFORM
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
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: 'var(--accent-emerald)',
              fontSize: '0.78rem',
              fontWeight: 700
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-emerald)', boxShadow: '0 0 8px var(--accent-emerald)' }} />
            SYSTEM ONLINE
          </div>
          <ThemeToggle />
        </div>
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
        {/* Left 50vw: Interactive Animated Showcase Panel */}
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
            <div style={{ marginBottom: '1.5rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--accent-wash)',
                  color: 'var(--accent-primary)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  marginBottom: '1rem',
                  border: '1px solid var(--border-focus)'
                }}
              >
                <Sparkles size={14} /> Next-Gen Restaurant &amp; Office Management
              </span>
              <h1 style={{ fontSize: '2.4rem', fontWeight: 800, lineHeight: 1.18, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                Elevate Every Meal, Order &amp; IoT Room Space
              </h1>
              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: 1.5, maxWidth: '520px' }}>
                Seamless customer ordering, real-time kitchen dispatching, smart room automation, and AI waiter assistance in one unified platform.
              </p>
            </div>

            {/* Animated SVG Graphic (Coffee Steam & IoT Node Orbit) */}
            <AnimatedCafeGraphic />

            {/* Floating Live Activity Widgets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  padding: '0.9rem 1.25rem',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-md)',
                  backdropFilter: 'blur(16px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}
              >
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255, 122, 0, 0.15)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 800 }}>
                  ☕
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>Order #1048 • Table 4</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: 'rgba(59, 130, 246, 0.15)', color: 'var(--status-preparing)' }}>KITCHEN PREPARING</span>
                  </div>
                  <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                    <motion.div
                      animate={{ width: ['20%', '85%', '20%'] }}
                      transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
                      style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-emerald))' }}
                    />
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 5, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                style={{
                  padding: '0.9rem 1.25rem',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-md)',
                  backdropFilter: 'blur(16px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}
              >
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Cpu size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>Smart IoT Control • Room #102</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.85rem', marginTop: 3 }}>
                    <span>🌡️ 21°C Climate</span>
                    <span>💡 80% Warm Amber</span>
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>⚡ 65W Active</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Metric Counter Footer */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '2rem' }}>
            <div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>1,480+</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Locations</div>
            </div>
            <div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-primary)' }}>99.9%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>IoT Uptime</div>
            </div>
            <div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>&lt;100ms</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Realtime Sync</div>
            </div>
          </div>
        </div>

        {/* Right 50vw: Form Panel */}
        <div
          style={{
            padding: '6rem 3rem 3.5rem',
            display: 'flex',
            flexDirection: 'column',
            justify: 'center',
            alignItems: 'center',
            background: 'var(--bg-surface)',
            position: 'relative'
          }}
        >
          <div style={{ width: '100%', maxWidth: '420px' }}>
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'inline-flex', padding: '4px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)', marginBottom: '1.5rem', width: '100%' }}>
                <button
                  type="button"
                  onClick={() => setMode('customer')}
                  style={{
                    flex: 1,
                    padding: '0.55rem',
                    borderRadius: 'var(--radius-md)',
                    background: mode === 'customer' ? 'var(--accent-primary)' : 'transparent',
                    color: mode === 'customer' ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Customer Access
                </button>
                <button
                  type="button"
                  onClick={() => setMode('staff')}
                  style={{
                    flex: 1,
                    padding: '0.55rem',
                    borderRadius: 'var(--radius-md)',
                    background: mode === 'staff' ? 'var(--accent-primary)' : 'transparent',
                    color: mode === 'staff' ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Staff Portal
                </button>
              </div>

              <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {mode === 'customer' ? 'Welcome Guest 👋' : 'Staff & Manager Sign In 🛡️'}
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                {mode === 'customer' ? 'Order ahead, claim discounts & track live order status' : 'Access cafe management, kitchen queue & IoT room controls'}
              </p>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: mode === 'staff' ? 16 : -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === 'staff' ? -16 : 16 }}
                transition={{ duration: 0.25 }}
              >
                {mode === 'staff' ? <StaffLoginForm onLoginSuccess={onLoginSuccess} /> : <CustomerAuthForm onLoginSuccess={onLoginSuccess} />}
              </motion.div>
            </AnimatePresence>

            <div style={{ textAlign: 'center', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setMode(mode === 'staff' ? 'customer' : 'staff')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.15s ease'
                }}
              >
                {mode === 'staff' ? '← Looking to order as a Guest?' : 'Are you a staff member or manager? Sign In →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnimatedCafeGraphic() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '210px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.5rem 0' }}>
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.65, 0.35] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          width: 190,
          height: 190,
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
          filter: 'blur(25px)'
        }}
      />

      <svg width="220" height="190" viewBox="0 0 220 190" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Animated Steam Waves */}
        <motion.path
          d="M85 65 C 80 48, 95 35, 90 15"
          stroke="var(--accent-primary)"
          strokeWidth="3.5"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.2 }}
          animate={{ pathLength: [0, 1, 0], opacity: [0, 0.85, 0], y: [-2, -18, -32] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0 }}
        />
        <motion.path
          d="M110 60 C 105 42, 120 30, 115 10"
          stroke="var(--accent-secondary)"
          strokeWidth="4"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.2 }}
          animate={{ pathLength: [0, 1, 0], opacity: [0, 0.95, 0], y: [-2, -18, -32] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }}
        />
        <motion.path
          d="M135 65 C 130 48, 145 35, 140 15"
          stroke="var(--accent-primary)"
          strokeWidth="3.5"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.2 }}
          animate={{ pathLength: [0, 1, 0], opacity: [0, 0.85, 0], y: [-2, -18, -32] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 1.4 }}
        />

        {/* Coffee Mug Base */}
        <path d="M60 80 H160 V128 C160 148 140 162 110 162 C80 162 60 148 60 128 V80 Z" fill="url(#mugGrad)" stroke="var(--border-strong)" strokeWidth="2" />
        <path d="M160 90 H180 C192 90 200 100 200 112 C200 125 192 135 180 135 H160" stroke="var(--accent-primary)" strokeWidth="5.5" strokeLinecap="round" />

        {/* Coffee Surface & Ring */}
        <ellipse cx="110" cy="80" rx="50" ry="11" fill="var(--bg-surface-elevated)" stroke="var(--border)" strokeWidth="1.5" />
        <ellipse cx="110" cy="80" rx="42" ry="8" fill="var(--accent-wash)" />

        {/* Floating IoT Orbit Badges */}
        <motion.circle
          cx="42" cy="60" r="12"
          fill="var(--bg-surface)"
          stroke="var(--accent-emerald)" strokeWidth="2"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.circle
          cx="178" cy="50" r="10"
          fill="var(--bg-surface)"
          stroke="var(--accent-indigo)" strokeWidth="2"
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        />

        <defs>
          <linearGradient id="mugGrad" x1="60" y1="80" x2="160" y2="162" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--bg-card-solid)" />
            <stop offset="1" stopColor="var(--bg-surface-elevated)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function ErrorText({ children }) {
  if (!children) return null;
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      style={{ padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '0.82rem', fontWeight: 600 }}
    >
      {children}
    </motion.div>
  );
}

function StaffLoginForm({ onLoginSuccess }) {
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/staff-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: loginIdentifier, password: loginPassword })
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setLoginError(data.message || 'Login failed. Check your staff credentials.');
        return;
      }
      onLoginSuccess(data.token, data.user?.role || '', data.user?.name || '', data.user?.id || '');
      setLoginPassword('');
    } catch (e) {
      console.error('Login request failed:', e);
      setLoginError('Network error — is the server running?');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      <div>
        <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
          <User size={14} style={{ color: 'var(--accent-primary)' }} /> Staff Email or Phone
        </label>
        <input
          type="text"
          className="field-input"
          placeholder="admin@smartcafe.com"
          value={loginIdentifier}
          onChange={(e) => setLoginIdentifier(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
          <Lock size={14} style={{ color: 'var(--accent-primary)' }} /> Staff Password
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            className="field-input"
            style={{ paddingRight: '2.5rem' }}
            placeholder="••••••••"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
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

      <ErrorText>{loginError}</ErrorText>

      <Button type="submit" variant="primary" fullWidth loading={loginLoading} disabled={loginLoading} style={{ height: 46, fontSize: '0.92rem', fontWeight: 700, marginTop: '0.3rem' }}>
        {loginLoading ? 'Authenticating Staff Access…' : 'Sign In to Dashboard'}
      </Button>
    </form>
  );
}

function CustomerAuthForm({ onLoginSuccess }) {
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      setError('Enter your email or phone number.');
      return;
    }
    const isEmail = trimmedIdentifier.includes('@');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          hiveId: getOrCreateHiveId(),
          email: isEmail ? trimmedIdentifier : undefined,
          phone: isEmail ? undefined : trimmedIdentifier
        })
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setError(data.message || 'Could not sign you in');
        return;
      }
      onLoginSuccess(data.token, data.user?.role || 'customer', data.user?.name || name.trim(), data.user?.id || '');
    } catch (e) {
      console.error('Customer auth request failed:', e);
      setError('Network error — gateway server unresponsive.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      <div>
        <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
          <User size={14} style={{ color: 'var(--accent-primary)' }} /> Your Name <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Optional)</span>
        </label>
        <input
          type="text"
          className="field-input"
          placeholder="e.g. Satyam Barman"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
          <Mail size={14} style={{ color: 'var(--accent-primary)' }} /> Email or Mobile Number
        </label>
        <input
          type="text"
          className="field-input"
          placeholder="name@example.com or +91 9876543210"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
      </div>

      <ErrorText>{error}</ErrorText>

      <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading} style={{ height: 46, fontSize: '0.92rem', fontWeight: 700, marginTop: '0.3rem' }}>
        {loading ? 'Entering Cafe…' : 'Continue to Cafe Menu'}
      </Button>
    </form>
  );
}
