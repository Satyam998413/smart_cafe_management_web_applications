'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE, getOrCreateHiveId } from '@/lib/apiClient';
import Button from '@/components/ui/Button';

// Ported from react_app/src/pages/LoginPage.jsx — lives under
// src/features/auth/ rather than src/pages/ specifically to avoid Next.js's
// Pages Router treating every file there as a route (this app uses the App
// Router exclusively, under src/app/). Behavior is otherwise unchanged:
// customer ordering is the primary audience, so it's the default view —
// staff (manager/cook) sign in via a small text link below.
export default function LoginPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('customer'); // 'customer' | 'staff'

  return (
    <div className="app-root" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <motion.div
        className="glass-card"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: '90%', maxWidth: '380px', padding: '2.5rem' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <motion.div
            className="brand-icon"
            style={{ margin: '0 auto 1rem' }}
            initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
          >
            ☕
          </motion.div>
          <h1 className="brand-title" style={{ fontSize: '1.5rem' }}>Smart Cafe</h1>
          <AnimatePresence mode="wait">
            <motion.span
              key={mode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}
            >
              {mode === 'customer' ? 'Order ahead & track your order' : 'Manager & cook access only'}
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

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button type="button" className="text-link" onClick={() => setMode(mode === 'staff' ? 'customer' : 'staff')}>
            {mode === 'staff' ? '← Back to customer login' : 'Staff login'}
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
      style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}
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
    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <input
        type="text"
        className="field-input"
        placeholder="Email or phone"
        value={loginIdentifier}
        onChange={(e) => setLoginIdentifier(e.target.value)}
        required
      />
      <input
        type="password"
        className="field-input"
        placeholder="Password"
        value={loginPassword}
        onChange={(e) => setLoginPassword(e.target.value)}
        required
      />
      <ErrorText>{loginError}</ErrorText>
      <Button type="submit" variant="primary" fullWidth loading={loginLoading} disabled={loginLoading}>
        {loginLoading ? 'Signing in…' : 'Sign In'}
      </Button>
    </form>
  );
}

/**
 * Passwordless, mirroring flutter_app's AuthRepository — one merged flow, no
 * explicit "new here / returning" choice. Always POSTs to /auth/register,
 * which is idempotent: an existing account matched by hiveId/email/phone
 * just gets logged in (moved onto this device); no match creates one.
 */
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
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <input
        type="text"
        className="field-input"
        placeholder="Your name (skip if you've ordered before)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="text"
        className="field-input"
        placeholder="Email or phone number"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        required
      />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading}>
        {loading ? 'Continuing…' : 'Continue'}
      </Button>
    </form>
  );
}
