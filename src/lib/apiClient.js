'use client';

// Ported from react_app/src/api/client.js, simplified: the API now lives at
// the same origin as the page (one Next.js app serves both), so there's no
// separate base URL / CORS to configure — API_BASE is just the local /api
// prefix, kept as a named constant so call sites read the same as before
// ("${API_BASE}/auth/...") rather than hardcoding the prefix everywhere.
export const API_BASE = '/api';

/**
 * Builds an authenticated fetch bound to the current token, forcing a
 * re-login if the session is gone/expired/invalid (server 401s almost
 * everything). onUnauthorized is called once on any 401 response.
 */
export function createApiFetch(onUnauthorized) {
  return async function apiFetch(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (res.status === 401) onUnauthorized();
    return res;
  };
}

/** Shorthand for a JSON POST/PATCH body — sets the header and stringifies. */
export function jsonBody(payload) {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  };
}

/** Today's date as YYYY-MM-DD, matching the chat endpoints' `date` param. */
export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The server's /auth/register and /auth/customer-login treat `hiveId` as an
 * opaque per-device identifier — a random UUID generated once and cached in
 * localStorage.
 */
export function getOrCreateHiveId() {
  const existing = localStorage.getItem('hiveId');
  if (existing) return existing;
  const hiveId = crypto.randomUUID();
  localStorage.setItem('hiveId', hiveId);
  return hiveId;
}
