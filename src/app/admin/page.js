'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// /admin has no content of its own — Organizations is the console's home.
export default function AdminIndexPage() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const role = localStorage.getItem('admin_role');
    if (token && role === 'master_admin') {
      router.replace('/admin/organizations');
    } else {
      router.replace('/admin/login');
    }
  }, [router]);
  return null;
}
