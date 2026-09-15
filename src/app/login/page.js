'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LoginPage from '@/features/auth/LoginPage';

export default function LoginPageContainer() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.replace('/orders');
    } else {
      setChecking(false);
    }
  }, [router]);

  const handleLoginSuccess = (token, role, name, userId) => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    localStorage.setItem('userName', name);
    localStorage.setItem('userId', userId);

    if (role === 'owner' || role === 'manager') {
      router.replace('/orders');
    } else {
      router.replace('/orders');
    }
  };

  if (checking) return null;

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
}
