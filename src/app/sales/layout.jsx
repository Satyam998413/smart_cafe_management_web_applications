'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  ShoppingBag,
  Building2,
  Ticket,
  LogOut,
  UserCheck,
  PlusCircle,
  Package,
  Layers
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const SALES_NAV_ITEMS = [
  { href: '/sales/dashboard', label: 'Sales Dashboard', icon: TrendingUp },
  { href: '/sales/onboarding', label: 'Client Onboarding', icon: PlusCircle },
  { href: '/sales/orders', label: 'Onboarding Orders', icon: Package },
  { href: '/sales/catalog', label: 'Hardware Catalog', icon: ShoppingBag }
];

export default function SalesmanLayout({ children }) {
  const [user, setUser] = useState(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const name = localStorage.getItem('userName');

    if (!token || (role !== 'salesman' && role !== 'master_admin')) {
      // If not logged in as salesman or master_admin, redirect to login
      router.replace('/login');
      return;
    }
    setUser({ name: name || 'Sales Executive', role });
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    router.replace('/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header Navbar */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20">
            <UserCheck size={20} />
          </div>
          <div>
            <div className="font-extrabold text-base md:text-lg text-white tracking-tight flex items-center gap-2">
              CREMEN <span className="text-emerald-400 font-semibold text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 uppercase tracking-wider">Sales Portal</span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Client Premises Onboarding & Hardware Sales Suite</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-full px-3 py-1.5 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active Executive: <strong>{user.name}</strong></span>
          </div>
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-3 py-1.5 rounded-xl transition"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Navigation Sidebar */}
        <aside className="w-64 bg-slate-900/60 border-r border-slate-800 p-4 hidden md:flex flex-col gap-2 shrink-0">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 px-3 mb-2">Sales Workspace</div>
          <nav className="flex flex-col gap-1 flex-1">
            {SALES_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold shadow-lg shadow-emerald-500/5'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-emerald-400' : 'text-slate-400'} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl text-xs space-y-2 text-slate-400">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Layers size={14} className="text-emerald-400" /> Sales Support
            </div>
            <p>18% GST auto-applied to quotes. Discount codes: <code className="text-emerald-300 bg-emerald-950 px-1 py-0.5 rounded">ONETIME10</code>, <code className="text-emerald-300 bg-emerald-950 px-1 py-0.5 rounded">FLAT2000</code>.</p>
          </div>
        </aside>

        {/* Mobile Horizontal Top Sub-Nav */}
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-3 py-2 flex overflow-x-auto gap-2 w-full shrink-0">
          {SALES_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium transition ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold'
                    : 'text-slate-400 bg-slate-800/40'
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Main Sales Workspace Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
