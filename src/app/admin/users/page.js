'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, Search, RefreshCw, Shield, Wrench, Briefcase, Crown, UserCheck, Utensils, Coffee, User, Info, Building } from 'lucide-react';

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
      const token = localStorage.getItem('token');
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
      const token = localStorage.getItem('token');
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
    const token = localStorage.getItem('token');
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm tracking-wide uppercase">
            <Users className="w-5 h-5" /> Master Admin Directory
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1">
            Global User & Role Management
          </h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">
            Create, manage, and assign organization premises to Owners, Managers, Cooks, and Waiters, or configure Platform-wide Technicians and Salesmen.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-medium px-5 py-3 rounded-xl shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
        >
          <UserPlus className="w-5 h-5" /> Create New User
        </button>
      </motion.div>

      {/* Role Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
        {ROLE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs md:text-sm transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25 scale-105'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="mb-6 max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-sky-400 mb-2" />
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">User Details</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Assigned Organization / Premise</th>
                  <th className="px-6 py-4">Contact Phone</th>
                  <th className="px-6 py-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-12 text-slate-500">
                      No users found matching this role or search filter.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const isPlatform = PLATFORM_ROLES.includes(user.role);
                    return (
                      <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-bold text-white block">{user.name}</span>
                          <span className="text-xs text-slate-500 font-mono">{user.email}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            user.role === 'master_admin'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : user.role === 'technician'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : user.role === 'salesman'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : user.role === 'owner'
                              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {user.role?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {isPlatform ? (
                            <span className="text-xs font-medium text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                              Platform Wide (Unassigned)
                            </span>
                          ) : user.org ? (
                            <div className="flex items-center gap-1.5 text-slate-200">
                              <Building className="w-3.5 h-3.5 text-sky-400" />
                              <span>{user.org.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">Unassigned Org</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-400">
                          {user.phone || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-500">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
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

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-4">Create New User Account</h2>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Rivera"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="alex@smartcafe.test"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91-90000-00000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">User Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-sky-500"
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
                  <label className="text-xs text-slate-400 font-medium block mb-1">Password</label>
                  <input
                    type="password"
                    placeholder="Password@123"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
              </div>

              {/* Organization Assignment Logic */}
              {isPlatformRoleSelected ? (
                <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-start gap-2.5">
                  <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-indigo-300 leading-relaxed">
                    <strong>Platform-level role:</strong> {formData.role?.replace('_', ' ')}s operate platform-wide across all tenant organizations and premises. No organization assignment is required.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Assigned Organization / Premise</label>
                  <select
                    value={formData.orgId}
                    onChange={(e) => setFormData({ ...formData, orgId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-sky-500"
                  >
                    <option value="">-- Select Organization --</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name} ({org.premiseType})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium shadow-lg shadow-sky-500/25 transition-all"
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
