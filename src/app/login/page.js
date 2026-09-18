'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LoginPage from '@/features/auth/LoginPage';

export default function LoginPageContainer() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (token) {
      if (role === 'master_admin') {
        router.replace('/admin/organizations');
      } else if (role === 'salesman') {
        router.replace('/sales/dashboard');
      } else if (role === 'technician') {
        router.replace('/technician/dashboard');
      } else {
        router.replace('/orders');
      }
    } else {
      setChecking(false);
    }
  }, [router]);

  const handleLoginSuccess = (token, role, name, userId) => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    localStorage.setItem('userName', name);
    localStorage.setItem('userId', userId);

    if (role === 'master_admin') {
      router.replace('/admin/organizations');
    } else if (role === 'salesman') {
      router.replace('/sales/dashboard');
    } else if (role === 'technician') {
      router.replace('/technician/dashboard');
    } else {
      router.replace('/orders');
    }
  };

  if (checking) return null;

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
}
