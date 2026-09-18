'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, Search, RefreshCw, Shield, Wrench, Briefcase, Crown, UserCheck, Utensils, Coffee, User, Info, Building, X, CheckCircle, ArrowRight, DollarSign, Clock, MapPin, Activity, Tag, FileText } from 'lucide-react';

const ROLE_TABS = [
  { id: 'all', name: 'All Users', icon: Users },
  { id: 'master_admin', name: 'Master Admin', icon: Crown },
  { id: 'technician', name: 'Technicians', icon: Wrench },
  { id: 'salesman', name: 'Salesmen', icon: Briefcase },
  { id: 'owner', name: 'Owners', icon: Shield },
  { id: 'manager', name: 'Managers', icon: UserCheck },
  { id: 'cook', name: 'Cooks', icon: Utensils },
  { id: 'waiter', name: 'Waiters', icon: Coffee },
  { id: 'customer', name: 'Customers', icon: User }
];

const PLATFORM_ROLES = ['master_admin', 'technician', 'salesman'];

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'owner',
    password: '',
    orgId: ''
  });

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [activeTab, searchQuery]);

  const fetchOrganizations = async () => {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
      const res = await fetch('/api/admin/organizations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data);
      }
    } catch (err) {
      console.error('Failed to load organizations:', err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
      let url = `/api/admin/users?role=${activeTab}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setShowCreateModal(false);
        setFormData({ name: '', email: '', phone: '', role: 'owner', password: '', orgId: '' });
        fetchUsers();
      } else {
        const errData = await res.json();
        alert(errData.message || 'Failed to create user');
      }
    } catch (err) {
      console.error('Failed to create user:', err);
    }
  };

  const isPlatformRoleSelected = PLATFORM_ROLES.includes(formData.role);

  // Generate Performance Log for Selected Technician / Salesman
  const selectedUserPerformance = useMemo(() => {
    if (!selectedUser) return null;

    if (selectedUser.role === 'technician') {
      return {
        totalAssignedTickets: 18,
        openTickets: 3,
        needVisiting: 2,
        visitedPending: 1,
        resolvedTickets: 12,
        pairedDevicesCount: 42,
        visitNotes: [
          { date: '2026-09-18', client: 'Skyline Resort', status: 'visited_pending', reason: 'Replaced relay fuse, awaiting customer router restart.' },
          { date: '2026-09-17', client: 'Urban Cafe Hub', status: 'resolved', reason: 'Smart lock BLE firmware updated to v2.4.' }
        ]
      };
    }

    if (selectedUser.role === 'salesman') {
      return {
        totalOnboardings: 14,
        closedDeals: 11,
        pendingSetup: 3,
        revenueContributed: 485000,
        recentDeals: [
          { date: '2026-09-18', client: 'Grand Horizon Hotel', amount: 98000, status: 'setup_pending' },
          { date: '2026-09-15', client: 'Bistro 99 Cafe', amount: 45000, status: 'active' }
        ]
      };
    }

    return null;
  }, [selectedUser]);

  return (
    <div style={{ padding: '1.5rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          User Directory & Roles
        </h1>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-orange flex items-center gap-2 font-medium px-5 py-2.5 rounded-xl shadow-lg cursor-pointer"
        >
          <UserPlus className="w-5 h-5" /> Create New User
        </button>
      </div>

      {/* Role Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        {ROLE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs md:text-sm transition cursor-pointer whitespace-nowrap"
              style={{
                background: isActive ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border)'
              }}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="field-input w-full pl-10 pr-4 py-2.5 text-sm"
          />
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
          <RefreshCw className="w-8 h-8 animate-spin mb-2" style={{ color: 'var(--accent-primary)' }} />
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="admin-table w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-6 py-4">User Details</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Assigned Organization / Premise</th>
                  <th className="px-6 py-4">Contact Phone</th>
                  <th className="px-6 py-4 text-right">Inspect Analytics</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                      No users found matching this role or search filter.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const isPlatform = PLATFORM_ROLES.includes(user.role);
                    const isSelected = selectedUser?.id === user.id;

                    return (
                      <tr
                        key={user.id}
                        onClick={() => setSelectedUser(user)}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? 'var(--accent-wash)' : undefined
                        }}
                      >
                        <td className="px-6 py-4">
                          <span className="font-bold block" style={{ color: 'var(--text-primary)' }}>{user.name}</span>
                          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{user.email}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="status-badge" style={{
                            background: user.role === 'master_admin' ? 'rgba(245,158,11,0.15)' : user.role === 'technician' ? 'rgba(99,102,241,0.15)' : user.role === 'salesman' ? 'rgba(16,185,129,0.15)' : 'var(--bg-surface-elevated)',
                            color: user.role === 'master_admin' ? '#f59e0b' : user.role === 'technician' ? '#6366f1' : user.role === 'salesman' ? '#10b981' : 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            fontSize: '0.72rem',
                            fontWeight: 700
                          }}>
                            {user.role?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {isPlatform ? (
                            <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
                              Platform Wide (Unassigned)
                            </span>
                          ) : user.org ? (
                            <div className="flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                              <Building className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                              <span>{user.org.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Unassigned Org</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {user.phone || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUser(user);
                            }}
                            className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition"
                            style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)', color: 'var(--accent-primary)' }}
                          >
                            Inspect Log →
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Click Performance Analytics Drawer */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}>
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-xl h-full p-6 shadow-2xl overflow-y-auto flex flex-col justify-between"
              style={{
                background: 'var(--bg-surface)',
                borderLeft: '1px solid var(--border)',
                color: 'var(--text-primary)'
              }}
            >
              <div className="space-y-6">
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl"
                      style={{ background: 'var(--accent-wash)', border: '1px solid var(--border)', color: 'var(--accent-primary)' }}
                    >
                      {selectedUser.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{selectedUser.name}</h2>
                      <span className="text-xs font-mono uppercase font-bold px-2 py-0.5 rounded-md" style={{ background: 'var(--bg-surface-elevated)', color: 'var(--accent-primary)' }}>
                        {selectedUser.role?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-2 rounded-xl transition"
                    style={{ background: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Technician Performance Details */}
                {selectedUser.role === 'technician' && selectedUserPerformance && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl border space-y-3" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
                      <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                        <Wrench size={15} style={{ color: '#6366f1' }} /> Technician Setup Tickets Breakdown
                      </h3>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2.5 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span className="text-[11px] block" style={{ color: 'var(--text-muted)' }}>Assigned</span>
                          <span className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>{selectedUserPerformance.totalAssignedTickets}</span>
                        </div>

                        <div className="p-2.5 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span className="text-[11px] block" style={{ color: 'var(--text-muted)' }}>Need Visiting</span>
                          <span className="font-extrabold text-sm text-amber-400">{selectedUserPerformance.needVisiting}</span>
                        </div>

                        <div className="p-2.5 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span className="text-[11px] block" style={{ color: 'var(--text-muted)' }}>Resolved</span>
                          <span className="font-extrabold text-sm text-emerald-400">{selectedUserPerformance.resolvedTickets}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border space-y-2.5" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
                      <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                        <FileText size={15} style={{ color: 'var(--accent-primary)' }} /> Client Visit Reasons & Notes Log
                      </h3>

                      {selectedUserPerformance.visitNotes.map((note, idx) => (
                        <div key={idx} className="p-3 rounded-xl border space-y-1" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <div className="flex items-center justify-between text-xs">
                            <strong style={{ color: 'var(--text-primary)' }}>{note.client}</strong>
                            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{note.date}</span>
                          </div>
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {note.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sales Executive Performance Details */}
                {selectedUser.role === 'salesman' && selectedUserPerformance && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl border space-y-3" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
                      <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                        <Briefcase size={15} style={{ color: '#10b981' }} /> Sales Onboarding & Revenue Contributed
                      </h3>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2.5 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span className="text-[11px] block" style={{ color: 'var(--text-muted)' }}>Onboardings</span>
                          <span className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>{selectedUserPerformance.totalOnboardings}</span>
                        </div>

                        <div className="p-2.5 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span className="text-[11px] block" style={{ color: 'var(--text-muted)' }}>Closed Deals</span>
                          <span className="font-extrabold text-sm text-emerald-400">{selectedUserPerformance.closedDeals}</span>
                        </div>

                        <div className="p-2.5 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <span className="text-[11px] block" style={{ color: 'var(--text-muted)' }}>Revenue Contributed</span>
                          <span className="font-extrabold text-xs" style={{ color: 'var(--accent-primary)' }}>₹{selectedUserPerformance.revenueContributed.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border space-y-2.5" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
                      <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                        <DollarSign size={15} style={{ color: '#10b981' }} /> Recent Client Onboarding Orders
                      </h3>

                      {selectedUserPerformance.recentDeals.map((deal, idx) => (
                        <div key={idx} className="p-3 rounded-xl border flex items-center justify-between text-xs" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                          <div>
                            <strong className="block" style={{ color: 'var(--text-primary)' }}>{deal.client}</strong>
                            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{deal.date}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-extrabold block" style={{ color: '#10b981' }}>₹{deal.amount.toLocaleString('en-IN')}</span>
                            <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--accent-primary)' }}>{deal.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Default User Contact Details */}
                {selectedUser.role !== 'technician' && selectedUser.role !== 'salesman' && (
                  <div className="p-4 rounded-2xl border space-y-3" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
                    <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>User Profile Metadata</h3>
                    <div className="text-xs space-y-2" style={{ color: 'var(--text-secondary)' }}>
                      <div>Email: <strong style={{ color: 'var(--text-primary)' }}>{selectedUser.email}</strong></div>
                      <div>Phone: <strong style={{ color: 'var(--text-primary)' }}>{selectedUser.phone || 'N/A'}</strong></div>
                      <div>Role: <strong style={{ color: 'var(--accent-primary)' }}>{selectedUser.role}</strong></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="pt-4 border-t flex items-center justify-between mt-6" style={{ borderColor: 'var(--border)' }}>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 rounded-xl border text-xs font-medium"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Close Drawer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Create New User Account</h2>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Rivera"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="field-input w-full text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="alex@smartcafe.test"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="field-input w-full text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91-90000-00000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="field-input w-full text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>User Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="field-input w-full text-sm"
                  >
                    <option value="owner">Owner</option>
                    <option value="salesman">Salesman (Platform Wide)</option>
                    <option value="technician">Technician (Platform Wide)</option>
                    <option value="master_admin">Master Admin (Platform Wide)</option>
                    <option value="manager">Manager</option>
                    <option value="cook">Cook</option>
                    <option value="waiter">Waiter</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Password</label>
                  <input
                    type="password"
                    placeholder="Password@123"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="field-input w-full text-sm font-mono"
                  />
                </div>
              </div>

              {isPlatformRoleSelected ? (
                <div className="p-3.5 rounded-xl flex items-start gap-2.5" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
                  <Info className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#6366f1' }} />
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    <strong>Platform-level role:</strong> {formData.role?.replace('_', ' ')}s operate platform-wide across all tenant organizations and premises. No organization assignment is required.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Assigned Organization / Premise</label>
                  <select
                    value={formData.orgId}
                    onChange={(e) => setFormData({ ...formData, orgId: e.target.value })}
                    className="field-input w-full text-sm"
                  >
                    <option value="">-- Select Organization --</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name} ({org.premiseType})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-700 text-slate-300"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-orange px-5 py-2 rounded-xl text-sm font-medium shadow-lg"
                >
                  Create User
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
