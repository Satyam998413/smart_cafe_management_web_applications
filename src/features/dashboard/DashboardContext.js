'use client';

import { createContext, useContext } from 'react';

// Provided by src/app/(dashboard)/layout.js — every route under that group
// reads its auth/socket/cart/orders/menu state from here instead of each
// page re-deriving it, same role AdminContext plays for src/app/admin/**.
export const DashboardContext = createContext(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard() must be called from a page under src/app/(dashboard)/**');
  return ctx;
}
