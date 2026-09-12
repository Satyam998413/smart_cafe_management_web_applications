'use client';

import { createContext, useContext } from 'react';

// Provided by src/app/admin/organizations/[id]/layout.js — the org row
// fetched once at that level, plus apiFetch and a reload() callback, shared
// by the Overview/Domain/AI/Data-plane sub-pages so none of them re-fetch
// the org independently or need their own apiFetch wiring.
export const OrgDetailContext = createContext(null);

export function useOrgDetail() {
  const ctx = useContext(OrgDetailContext);
  if (!ctx) throw new Error('useOrgDetail() must be called from a page under src/app/admin/organizations/[id]/**');
  return ctx;
}
