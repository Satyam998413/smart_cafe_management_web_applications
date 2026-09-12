'use client';

import { API_BASE } from './apiClient.js';

// Mirrors apiClient.js's createApiFetch but keyed on a separate
// 'admin_token' — the Master Admin console (src/app/admin/**) is a distinct
// session from the customer/staff dashboard at '/', so signing into one
// doesn't silently log the other out in the same browser.
export function createAdminApiFetch(onUnauthorized) {
  return async function adminApiFetch(path, options = {}) {
    const token = localStorage.getItem('admin_token');
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (res.status === 401) onUnauthorized();
    return res;
  };
}
