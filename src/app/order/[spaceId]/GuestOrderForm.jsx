'use client';

import { useState } from 'react';
import { API_BASE, getOrCreateHiveId } from '@/lib/apiClient';
import Button from '@/components/ui/Button';

// The interactive half of the guest QR landing page — its own 'use client'
// file since the parent page.js is an async Server Component (it fetches
// the space/org context directly from Supabase) and can't itself hold form
// state. Deliberately the same passwordless flow as
// src/features/auth/LoginPage.jsx's CustomerAuthForm (POST /auth/register,
// idempotent — an existing account gets logged in, no match creates one),
// with `spaceId` threaded through so the new/returning guest's account gets
// attached to this org/space (see resolveQrSpace in src/lib/authService.js)
// exactly like the flutter_app deep-link flow already does.
//
// On success this hands off into the existing dashboard shell at `/`
// (src/app/page.js already renders the full Menu/Cart/Orders experience
// once a token is in localStorage) rather than rebuilding any ordering UI
// here — a hard navigation (not router.push) so that shell's useState
// initializers re-read the freshly-written localStorage on mount.
export default function GuestOrderForm({ spaceId }) {
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
          phone: isEmail ? undefined : trimmedIdentifier,
          spaceId
        })
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setError(data.message || 'Could not sign you in — that QR code may be stale, try scanning again.');
        return;
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.user?.role || 'customer');
      localStorage.setItem('userName', data.user?.name || name.trim());
      localStorage.setItem('userId', data.user?.id || '');
      window.location.href = '/';
    } catch (err) {
      console.error('Guest order sign-in failed:', err);
      setError('Network error — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="guest-form">
      <label className="field-label" htmlFor="guest-name">
        Your name
      </label>
      <input
        id="guest-name"
        type="text"
        className="field-input"
        placeholder="Skip if you've ordered here before"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
      />

      <label className="field-label" htmlFor="guest-identifier">
        Email or phone number
      </label>
      <input
        id="guest-identifier"
        type="text"
        className="field-input"
        placeholder="you@example.com"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        autoComplete="email"
        required
      />

      {error && <div className="guest-form-error">{error}</div>}

      <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading}>
        {loading ? 'Continuing…' : 'Continue to menu'}
      </Button>
    </form>
  );
}
