'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { API_BASE, getOrCreateHiveId } from '@/lib/apiClient';

export default function LoginPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('customer'); // 'customer' | 'staff'

  return (
    <div className="app-root" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: 'radial-gradient(1200px 600px at 50% 30%, rgba(255, 122, 0, 0.08), transparent 70%), var(--bg-page)' }}>
      <motion.div
        className="glass-card"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: '100%', maxWidth: '420px', padding: '2.5rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <motion.div
            style={{ margin: '0 auto 1.25rem', width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #ff7a00, #e06900)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: 'var(--shadow-accent)' }}
            initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
          >
            <Coffee size={28} />
          </motion.div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Smart Cafe</h1>
          <AnimatePresence mode="wait">
            <motion.span
              key={mode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}
            >
              {mode === 'customer' ? 'Order ahead & track your order in real-time' : 'Owner, manager & staff access portal'}
            </motion.span>
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: mode === 'staff' ? 16 : -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            {mode === 'staff' ? <StaffLoginForm onLoginSuccess={onLoginSuccess} /> : <CustomerAuthForm onLoginSuccess={onLoginSuccess} />}
          </motion.div>
        </AnimatePresence>

        <div style={{ textAlign: 'center', marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
          <button type="button" className="text-link" style={{ fontSize: '0.88rem', fontWeight: 600 }} onClick={() => setMode(mode === 'staff' ? 'customer' : 'staff')}>
            {mode === 'staff' ? '← Back to customer ordering' : 'Staff & Management Login →'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ErrorText({ children }) {
  if (!children) return null;
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem', fontWeight: 600 }}
    >
      {children}
    </motion.div>
  );
}

function StaffLoginForm({ onLoginSuccess }) {
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
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
        setLoginError(data.message || 'Login failed');
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
    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      <div>
        <label className="field-label">Email or Phone</label>
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
        <label className="field-label">Password</label>
        <input
          type="password"
          className="field-input"
          placeholder="••••••••"
          value={loginPassword}
          onChange={(e) => setLoginPassword(e.target.value)}
          required
        />
      </div>
      <ErrorText>{loginError}</ErrorText>
      <button type="submit" className="btn-orange" style={{ width: '100%', height: 44, marginTop: '0.5rem' }} disabled={loginLoading}>
        {loginLoading ? 'Signing in…' : 'Sign In'}
      </button>
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
      setError('Network error — is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      <div>
        <label className="field-label">Your Name (Optional)</label>
        <input
          type="text"
          className="field-input"
          placeholder="e.g. Satyam Barman"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="field-label">Email or Mobile Number</label>
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
      <button type="submit" className="btn-orange" style={{ width: '100%', height: 44, marginTop: '0.5rem' }} disabled={loading}>
        {loading ? 'Continuing…' : 'Continue to Menu'}
      </button>
    </form>
  );
}
