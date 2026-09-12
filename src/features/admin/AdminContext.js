'use client';

import { createContext, useContext } from 'react';

// Provided by src/app/admin/layout.js — every page under src/app/admin/**
// reads its bound apiFetch/current-user/logout from here instead of each
// page re-deriving them from localStorage, same role a prop would play if
// Next.js layouts could pass props to their routed children.
export const AdminContext = createContext(null);

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin() must be called from a page under src/app/admin/**');
  return ctx;
}
