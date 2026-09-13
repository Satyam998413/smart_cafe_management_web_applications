'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// The dashboard shell used to live here (tab-switching Home component) —
// it's now src/app/(dashboard)/layout.js plus one route per former tab.
// `/` just hands off to each role's default route — a client component
// (not a plain server-side redirect()) because the role only lives in
// localStorage, written at login (see useDashboardState.js). Customers land
// on /smart-ai first, matching flutter_app's home_screen.dart tab order
// (AI, then Menu, Order History, Chat); every other role keeps landing on
// /orders, unchanged.
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem('role') || '';
    router.replace(role === 'customer' ? '/smart-ai' : '/orders');
  }, [router]);

  return null;
}
