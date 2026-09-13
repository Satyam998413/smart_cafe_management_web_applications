'use client';

import { useRouter } from 'next/navigation';
import { useDashboard } from '@/features/dashboard/DashboardContext';
import MenuPage from '@/features/menu/MenuPage';

export default function MenuRoute() {
  const router = useRouter();
  const { menu, menuLoading, setMenu, authRole, apiFetch, cartApi } = useDashboard();

  return (
    <MenuPage
      menu={menu}
      loading={menuLoading}
      setMenu={setMenu}
      authRole={authRole}
      apiFetch={apiFetch}
      cartApi={cartApi}
      onOpenCart={() => router.push('/cart')}
    />
  );
}
