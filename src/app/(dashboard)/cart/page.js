'use client';

import { useRouter } from 'next/navigation';
import { useDashboard } from '@/features/dashboard/DashboardContext';
import CartPage from '@/features/cart/CartPage';

export default function CartRoute() {
  const router = useRouter();
  const { cartApi } = useDashboard();

  return <CartPage cartApi={cartApi} onDone={() => router.push('/orders')} onBack={() => router.push('/menu')} />;
}
