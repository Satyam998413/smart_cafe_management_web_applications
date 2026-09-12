'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { API_BASE } from '@/lib/apiClient';
import Button from '@/components/ui/Button';

// Dedicated Master Admin sign-in — deliberately separate from
// features/auth/LoginPage.jsx's staff mode: this console is a different
// audience (platform operator, not org staff) with its own route tree
// (src/app/admin/**), so it gets its own gate rather than reusing the
// customer/staff dashboard's login screen and role-switching afterward.
export default function AdminLoginPage({ onLoginSuccess }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
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
        setError(data.message || 'Login failed');
        return;
      }
      if (data.user?.role !== 'master_admin') {
        setError('This account does not have Master Admin access.');
        return;
      }
      onLoginSuccess(data.token, data.user);
    } catch (e) {
      console.error('Admin login request failed:', e);
      setError('Network error — is the server running?');
    } finally {
      setLoading(false);
    }
  };

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
          <div className="brand-icon" style={{ margin: '0 auto 1rem' }}>
            🛡️
          </div>
          <h1 className="brand-title" style={{ fontSize: '1.5rem' }}>Master Admin</h1>
          <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Platform console — tenant onboarding &amp; management
          </span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="text"
            className="field-input"
            placeholder="Email or phone"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            required
          />
          <input
            type="password"
            className="field-input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{error}</div>}
          <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
