'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// /admin has no content of its own — Organizations is the console's home.
export default function AdminIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/organizations');
  }, [router]);
  return null;
}
