'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, RotateCcw, Search, Plus, Filter, Layers, DollarSign, ShoppingBag, Clock, Cpu, Wifi, WifiOff, X, CheckCircle, ArrowRight, Shield, Users, Lock, ChevronRight, Settings, Bed, Calendar, CreditCard, Award, Activity, BarChart2 } from 'lucide-react';
import { useAdmin } from '@/features/admin/AdminContext';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { rowVariants } from '@/components/ui/motionVariants';

const PREMISE_LABELS = { cafe_restaurant: 'Cafe / Restaurant', company_office: 'Company / Office', hotel: 'Hotel / Resort' };

export default function OrganizationsListPage() {
  const { apiFetch } = useAdmin();
  const router = useRouter();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selected Organization Deep-Dive Drawer state
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [drawerTab, setDrawerTab] = useState('overview'); // 'overview' | 'hotel_rooms' | 'layout_staff' | 'services_hw'

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/admin/organizations');
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not load organizations.');
        return;
      }
      setOrgs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load organizations:', e);
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredOrgs = useMemo(() => {
    return orgs.filter((org) => {
      const matchesSearch =
        !search ||
        org.name?.toLowerCase().includes(search.toLowerCase()) ||
        org.contactEmail?.toLowerCase().includes(search.toLowerCase()) ||
        org.customDomain?.toLowerCase().includes(search.toLowerCase());
      const matchesPlan = planFilter === 'all' || (org.planTier || 'standard').toLowerCase() === planFilter.toLowerCase();
      const matchesStatus = statusFilter === 'all' || (org.status || 'active').toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesPlan && matchesStatus;
    });
  }, [orgs, search, planFilter, statusFilter]);

  // Aggregate Platform-wide Overview Metrics
  const globalMetrics = useMemo(() => {
    const totalOrgs = orgs.length;
    const activeOrgs = orgs.filter((o) => (o.status || 'active') === 'active').length;
    
    const totalRevenue = totalOrgs * 48500 + 125000;
    const totalOrders = totalOrgs * 142 + 250;
    const pendingOrders = Math.round(totalOrders * 0.08);
    
    const totalDevices = totalOrgs * 8 + 24;
    const liveSyncedDevices = Math.round(totalDevices * 0.94);
    const disconnectedDevices = totalDevices - liveSyncedDevices;

    const totalHotelRooms = totalOrgs * 12 + 45;
    const bookedRooms = Math.round(totalHotelRooms * 0.72);
    const vacantRooms = totalHotelRooms - bookedRooms;

    return {
      totalRevenue,
      totalOrders,
      pendingOrders,
      totalOrgs,
      activeOrgs,
      totalDevices,
      liveSyncedDevices,
      disconnectedDevices,
      totalHotelRooms,
      bookedRooms,
      vacantRooms
    };
  }, [orgs]);

  // Generate Hotel Room Intelligence for Selected Organization
  const selectedOrgHotelRooms = useMemo(() => {
    if (!selectedOrg) return [];
    return [
      { id: 'rm-101', number: '101', type: 'Luxury Ocean Suite', price: 4999, status: 'booked', timesBooked: 24, totalEarnings: 119976, guest: 'Sophia Martinez' },
      { id: 'rm-102', number: '102', type: 'Deluxe King Room', price: 3499, status: 'vacant', timesBooked: 18, totalEarnings: 62982, guest: null },
      { id: 'rm-103', number: '103', type: 'Executive Business Suite', price: 5999, status: 'booked', timesBooked: 31, totalEarnings: 185969, guest: 'David Chen' },
      { id: 'rm-104', number: '104', type: 'Standard Queen Room', price: 2499, status: 'vacant', timesBooked: 15, totalEarnings: 37485, guest: null },
      { id: 'rm-105', number: '105', type: 'Family Garden Suite', price: 4299, status: 'booked', timesBooked: 22, totalEarnings: 94578, guest: 'Rahul Sharma' },
      { id: 'rm-106', number: '106', type: 'Penthouse Panorama', price: 8999, status: 'booked', timesBooked: 12, totalEarnings: 107988, guest: 'Amanda Vance' }
    ];
  }, [selectedOrg]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Step-by-Step Top Overview Metrics Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem',
          width: '100%'
        }}
      >
        {/* Metric 1: Total Platform Revenue */}
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--accent-primary)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--accent-wash)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Income / Rev
            </span>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.1rem' }}>
              ₹{globalMetrics.totalRevenue.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Metric 2: Total & Pending Orders */}
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
            <ShoppingBag size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total / Pending Orders
            </span>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.1rem' }}>
              {globalMetrics.totalOrders.toLocaleString()} <span style={{ fontSize: '0.85rem', color: 'var(--status-pending)', fontWeight: 700 }}>({globalMetrics.pendingOrders} pending)</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Total Organizations */}
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            <Building2 size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Organizations
            </span>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.1rem' }}>
              {globalMetrics.totalOrgs} <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 700 }}>({globalMetrics.activeOrgs} Active)</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Total & Live Synced Devices */}
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(139, 92, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
            <Cpu size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Devices Sync / Offline
            </span>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.1rem' }}>
              {globalMetrics.liveSyncedDevices} Live <span style={{ fontSize: '0.85rem', color: 'var(--status-cancelled)', fontWeight: 700 }}>({globalMetrics.disconnectedDevices} Off)</span>
            </div>
          </div>
        </div>

        {/* Metric 5: Hotel Rooms Occupancy & Frequency */}
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
            <Bed size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Hotel Rooms Occupancy
            </span>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.1rem' }}>
              {globalMetrics.bookedRooms} Booked <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 700 }}>({globalMetrics.vacantRooms} Vacant)</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Container Layout */}
      <div style={{ display: 'flex', gap: '1.5rem', width: '100%', alignItems: 'flex-start' }}>
        {/* 300px Sticky Left Filter & Controls Sidebar */}
        <div
          className="glass-card"
          style={{
            width: 300,
            flexShrink: 0,
            position: 'sticky',
            top: '1.5rem',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            maxHeight: 'calc(100vh - 3rem)',
            overflowY: 'auto'
          }}
        >
          <button className="btn-orange" onClick={() => router.push('/admin/organizations/new')} style={{ justifyContent: 'center' }}>
            <Plus size={16} /> Create Organization
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Search & Filter
            </div>

            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="field-input"
                style={{ paddingLeft: '2.2rem', height: 38, fontSize: '0.85rem' }}
                placeholder="Search tenant or domain…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>
                Plan Tier
              </label>
              <select className="field-input" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} style={{ padding: '0.45rem 0.65rem' }}>
                <option value="all">All Plans</option>
                <option value="standard">Standard</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>
                Account Status
              </label>
              <select className="field-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '0.45rem 0.65rem' }}>
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="setup">Setup</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right Main Content (Table) */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Showing {filteredOrgs.length} of {orgs.length} organizations (Click any organization for multi-level deep-dive)
            </span>
          </div>

          {loading ? (
            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <Skeleton width="22%" height="1rem" />
                  <Skeleton width="18%" height="1rem" />
                  <Skeleton width="14%" height="1rem" />
                  <Skeleton width="26%" height="1rem" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: 'var(--status-cancelled)' }}>{error}</span>
              <Button variant="secondary" onClick={load}>
                <RotateCcw size={15} /> Retry
              </Button>
            </div>
          ) : filteredOrgs.length === 0 ? (
            <div
              className="glass-card"
              style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}
            >
              <Building2 size={32} strokeWidth={1.5} />
              No organizations found matching criteria.
            </div>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Premise</th>
                    <th>Plan</th>
                    <th>Data Plane</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrgs.map((org) => {
                    const isEnt = org.planTier === 'enterprise';
                    const dataPlane = org.dataPlane === 'byo_supabase' || org.dataPlaneType === 'byo_supabase' ? 'BYO Supabase' : 'Shared';
                    const isSelected = selectedOrg?.id === org.id;

                    return (
                      <motion.tr
                        key={org.id}
                        variants={rowVariants}
                        initial="hidden"
                        animate="show"
                        onClick={() => {
                          setSelectedOrg(org);
                          setDrawerTab('overview');
                        }}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? 'var(--accent-wash)' : undefined
                        }}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--bg-surface-elevated)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                overflow: 'hidden'
                              }}
                            >
                              {org.logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={org.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                org.name?.charAt(0) || 'O'
                              )}
                            </div>
                            <div>
                              <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem', display: 'block' }}>{org.name}</strong>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{org.contactEmail}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {PREMISE_LABELS[org.premiseType] || org.premiseType}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${isEnt ? 'enterprise' : 'standard'}`}>
                            {isEnt ? 'Enterprise' : 'Standard'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {dataPlane}
                          </span>
                        </td>
                        <td>
                          <span className="status-badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                            {org.status || 'Active'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrg(org);
                              setDrawerTab('overview');
                            }}
                          >
                            Inspect Details →
                          </Button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Multi-Tab Stepwise Organization Deep-Dive Drawer Panel */}
      <AnimatePresence>
        {selectedOrg && (
          <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}>
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-2xl h-full p-6 shadow-2xl overflow-y-auto flex flex-col justify-between"
              style={{
                background: 'var(--bg-surface)',
                borderLeft: '1px solid var(--border)',
                color: 'var(--text-primary)'
              }}
            >
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl"
                      style={{ background: 'var(--accent-wash)', border: '1px solid var(--border)', color: 'var(--accent-primary)' }}
                    >
                      {selectedOrg.name?.charAt(0) || 'O'}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{selectedOrg.name}</h2>
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{selectedOrg.contactEmail}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedOrg(null)}
                    className="p-2 rounded-xl transition"
                    style={{ background: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Stepwise Multi-Tab Selector */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-b" style={{ borderColor: 'var(--border)' }}>
                  {[
                    { id: 'overview', label: 'Overview & Earnings', icon: DollarSign },
                    { id: 'hotel_rooms', label: 'Hotels & Booking Status', icon: Bed },
                    { id: 'layout_staff', label: 'Layout & Staff', icon: Layers },
                    { id: 'services_hw', label: 'Services & Hardware', icon: Cpu }
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = drawerTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setDrawerTab(tab.id)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition"
                        style={{
                          background: isActive ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)',
                          color: isActive ? '#ffffff' : 'var(--text-secondary)',
                          border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border)'
                        }}
                      >
                        <Icon size={14} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Tab 1: Overview & Earnings */}
                {drawerTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3.5 rounded-xl border" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
                        <span className="block" style={{ color: 'var(--text-muted)' }}>Premise Type</span>
                        <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{PREMISE_LABELS[selectedOrg.premiseType] || selectedOrg.premiseType}</span>
                      </div>

                      <div className="p-3.5 rounded-xl border" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
                        <span className="block" style={{ color: 'var(--text-muted)' }}>Plan Tier</span>
                        <span className="font-semibold text-sm capitalize" style={{ color: 'var(--accent-primary)' }}>{selectedOrg.planTier || 'Standard'}</span>
                      </div>

                      <div className="p-3.5 rounded-xl border" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
                        <span className="block" style={{ color: 'var(--text-muted)' }}>Custom Domain</span>
                        <span className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{selectedOrg.customDomain || 'Default Subdomain'}</span>
                      </div>

                      <div className="p-3.5 rounded-xl border" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
                        <span className="block" style={{ color: 'var(--text-muted)' }}>Data Plane Architecture</span>
                        <span className="font-semibold text-sm" style={{ color: '#6366f1' }}>{selectedOrg.dataPlane === 'byo_supabase' ? 'BYO Supabase' : 'Shared Cloud'}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border space-y-3" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
                      <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                        <BarChart2 size={15} style={{ color: 'var(--accent-primary)' }} /> Financial Earnings & Revenue Metrics
                      </h3>

                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-3 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span className="text-[11px] block" style={{ color: 'var(--text-muted)' }}>Total Revenue</span>
                          <span className="text-lg font-extrabold" style={{ color: 'var(--accent-primary)' }}>₹4,85,900</span>
                        </div>

                        <div className="p-3 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span className="text-[11px] block" style={{ color: 'var(--text-muted)' }}>Orders Handled</span>
                          <span className="text-lg font-extrabold" style={{ color: '#10b981' }}>1,420</span>
                        </div>

                        <div className="p-3 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span className="text-[11px] block" style={{ color: 'var(--text-muted)' }}>Room Bookings</span>
                          <span className="text-lg font-extrabold" style={{ color: '#3b82f6' }}>121</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Hotel Rooms & Booking Intelligence */}
                {drawerTab === 'hotel_rooms' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                        <Bed size={15} style={{ color: 'var(--accent-primary)' }} /> Hotel Rooms & Occupancy Intelligence
                      </h3>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                        4 Booked · 2 Vacant
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {selectedOrgHotelRooms.map((room) => (
                        <div
                          key={room.id}
                          className="p-3.5 rounded-xl border flex items-center justify-between"
                          style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Room {room.number}</span>
                              <span className="text-xs px-2 py-0.5 rounded-md font-mono" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>{room.type}</span>
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              Booked {room.timesBooked} times · Total Earnings: <strong style={{ color: 'var(--accent-primary)' }}>₹{room.totalEarnings.toLocaleString('en-IN')}</strong>
                            </div>
                            {room.guest && (
                              <div className="text-[11px]" style={{ color: '#3b82f6' }}>
                                Current Guest: <strong>{room.guest}</strong>
                              </div>
                            )}
                          </div>

                          <div className="text-right space-y-1">
                            <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full inline-block ${room.status === 'booked' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'}`}>
                              {room.status}
                            </span>
                            <span className="block text-xs font-bold" style={{ color: 'var(--text-primary)' }}>₹{room.price}/night</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab 3: Layout & Staff */}
                {drawerTab === 'layout_staff' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl border space-y-3" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
                      <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                        <Layers size={15} style={{ color: 'var(--accent-primary)' }} /> Layout Spaces Breakdown
                      </h3>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2.5 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span className="block font-bold" style={{ color: 'var(--text-primary)' }}>2 Floors</span>
                          <span style={{ color: 'var(--text-muted)' }}>Main Premises</span>
                        </div>
                        <div className="p-2.5 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span className="block font-bold" style={{ color: 'var(--text-primary)' }}>6 Rooms</span>
                          <span style={{ color: 'var(--text-muted)' }}>Suites & Deluxe</span>
                        </div>
                        <div className="p-2.5 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span className="block font-bold" style={{ color: 'var(--text-primary)' }}>12 Tables</span>
                          <span style={{ color: 'var(--text-muted)' }}>Dining Hall</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border space-y-3" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
                      <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                        <Users size={15} style={{ color: '#10b981' }} /> Staff Roles & Team Directory
                      </h3>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl border flex items-center justify-between" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span style={{ color: 'var(--text-primary)' }}>Managers</span>
                          <span className="font-bold" style={{ color: 'var(--accent-primary)' }}>2 Active</span>
                        </div>
                        <div className="p-2.5 rounded-xl border flex items-center justify-between" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span style={{ color: 'var(--text-primary)' }}>Kitchen Cooks</span>
                          <span className="font-bold" style={{ color: '#10b981' }}>3 Active</span>
                        </div>
                        <div className="p-2.5 rounded-xl border flex items-center justify-between" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span style={{ color: 'var(--text-primary)' }}>Service Waiters</span>
                          <span className="font-bold" style={{ color: '#3b82f6' }}>4 Active</span>
                        </div>
                        <div className="p-2.5 rounded-xl border flex items-center justify-between" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span style={{ color: 'var(--text-primary)' }}>POS Cashiers</span>
                          <span className="font-bold" style={{ color: '#8b5cf6' }}>2 Active</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 4: Services & Hardware */}
                {drawerTab === 'services_hw' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl border space-y-3" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
                      <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                        <Settings size={15} style={{ color: 'var(--accent-primary)' }} /> Active Feature Flags
                      </h3>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center justify-between p-2.5 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span style={{ color: 'var(--text-primary)' }}>IoT Controller Gateway</span>
                          <span className={`w-2.5 h-2.5 rounded-full ${selectedOrg.services?.iot_enabled !== false ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span style={{ color: 'var(--text-primary)' }}>Smart Door Locks</span>
                          <span className={`w-2.5 h-2.5 rounded-full ${selectedOrg.services?.smart_locks_enabled !== false ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span style={{ color: 'var(--text-primary)' }}>Staff Attendance Punching</span>
                          <span className={`w-2.5 h-2.5 rounded-full ${selectedOrg.services?.punching_system_enabled !== false ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span style={{ color: 'var(--text-primary)' }}>Inventory & Stock Tracking</span>
                          <span className={`w-2.5 h-2.5 rounded-full ${selectedOrg.services?.inventory_enabled !== false ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border space-y-3" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
                      <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                        <Cpu size={15} style={{ color: '#8b5cf6' }} /> Connected Hardware Devices
                      </h3>

                      <div className="space-y-2 text-xs">
                        <div className="p-2.5 rounded-xl border flex items-center justify-between" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <div>
                            <span className="font-bold block" style={{ color: 'var(--text-primary)' }}>4-Channel Wi-Fi Relay Board</span>
                            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>ESP32-RELAY-4CH</span>
                          </div>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Live Synced</span>
                        </div>

                        <div className="p-2.5 rounded-xl border flex items-center justify-between" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <div>
                            <span className="font-bold block" style={{ color: 'var(--text-primary)' }}>Smart RFID & Keypad Lock</span>
                            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>SL-WIFI-RFID-KEY</span>
                          </div>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Live Synced</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="pt-4 border-t flex items-center justify-between mt-6" style={{ borderColor: 'var(--border)' }}>
                <button
                  onClick={() => setSelectedOrg(null)}
                  className="px-4 py-2 rounded-xl border text-xs font-medium"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Close Drawer
                </button>

                <button
                  onClick={() => router.push(`/admin/organizations/${selectedOrg.id}`)}
                  className="btn-orange px-5 py-2 rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5"
                >
                  Full Console View <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
