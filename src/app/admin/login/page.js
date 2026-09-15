'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLoginPage from '@/features/admin/AdminLoginPage';

export default function MasterAdminLoginPageContainer() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const role = localStorage.getItem('admin_role');
    if (token && role === 'master_admin') {
      router.replace('/admin/organizations');
    } else {
      setChecking(false);
    }
  }, [router]);

  const handleLoginSuccess = (token, user) => {
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_role', user.role || 'master_admin');
    localStorage.setItem('admin_name', user.name || 'Alex Mercer');
    localStorage.setItem('admin_user_id', user.id || '');
    router.replace('/admin/organizations');
  };

  if (checking) return null;

  return <AdminLoginPage onLoginSuccess={handleLoginSuccess} />;
}
