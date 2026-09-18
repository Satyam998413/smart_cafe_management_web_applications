'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  TrendingUp,
  Building2,
  DollarSign,
  PlusCircle,
  Package,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Percent,
  RefreshCw
} from 'lucide-react';

export default function SalesDashboardPage() {
  const [salesLeads, setSalesLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSalesLeads();
  }, []);

  const fetchSalesLeads = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/sales-leads', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSalesLeads(data);
      }
    } catch (err) {
      console.error('Failed to load sales leads:', err);
    } finally {
      setLoading(false);
    }
  };

  // Compute metrics
  const totalOnboarded = salesLeads.length;
  const totalRevenue = salesLeads.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
  const pendingTickets = salesLeads.filter((item) => item.support_tickets?.status === 'open' || item.support_tickets?.status === 'assigned').length;
  const activeSetups = salesLeads.filter((item) => item.support_tickets?.status === 'accepted' || item.support_tickets?.status === 'need_visiting' || item.support_tickets?.status === 'visited_pending').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900/40 via-slate-900 to-teal-900/40 border border-emerald-500/20 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <TrendingUp size={16} /> Sales Executive Workstation
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
            Client Premise Onboarding & Revenue Portal
          </h1>
          <p className="text-slate-300 text-sm max-w-2xl">
            Demonstrate hardware packages, calculate 18% GST quotes, apply promo discount codes, collect payments, and trigger technician setup tickets.
          </p>
        </div>

        <Link
          href="/sales/onboarding"
          className="inline-flex items-center gap-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold px-6 py-3.5 rounded-2xl hover:from-emerald-400 hover:to-teal-400 transition shadow-lg shadow-emerald-500/25 shrink-0"
        >
          <PlusCircle size={20} />
          <span>New Client Onboarding</span>
          <ArrowRight size={18} />
        </Link>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Premises Onboarded</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Building2 size={18} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{loading ? '...' : totalOnboarded}</div>
          <div className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
            <CheckCircle2 size={14} /> Active client premises
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Sales Revenue</span>
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">
            {loading ? '...' : `₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1 font-medium">
            <Percent size={14} className="text-teal-400" /> Includes 18% GST & Coupons
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Setup Tickets</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Clock size={18} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{loading ? '...' : pendingTickets}</div>
          <div className="text-xs text-amber-400 flex items-center gap-1 font-medium">
            Awaiting technician assignment
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Field Installations</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{loading ? '...' : activeSetups}</div>
          <div className="text-xs text-indigo-400 flex items-center gap-1 font-medium">
            Technician in-progress
          </div>
        </motion.div>
      </div>

      {/* Onboarding Orders List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Package size={20} className="text-emerald-400" /> Recent Client Onboarding Orders
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Real-time status of hardware setup quotes and sales orders</p>
          </div>

          <button
            onClick={fetchSalesLeads}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
            title="Refresh Orders"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-2" />
            <p className="text-sm">Loading onboarding orders...</p>
          </div>
        ) : salesLeads.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800/80 p-8 space-y-3">
            <Building2 className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">No Client Premises Onboarded Yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Start by building your first hardware quote and onboarding a cafe, office, or hotel premise.
            </p>
            <Link
              href="/sales/onboarding"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition"
            >
              <PlusCircle size={16} /> Onboard First Client
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Organization / Premise</th>
                  <th className="px-6 py-4">Premise Type</th>
                  <th className="px-6 py-4">Order Total (inc. 18% GST)</th>
                  <th className="px-6 py-4">Payment</th>
                  <th className="px-6 py-4">Technician Setup Status</th>
                  <th className="px-6 py-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {salesLeads.map((order) => {
                  const ticketStatus = order.support_tickets?.status || 'open';
                  const isPaid = order.payment_mode === 'cash' || order.payment_mode === 'online';

                  return (
                    <tr key={order.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-4 font-bold text-white">
                        {order.org_name}
                        {order.gstin && <span className="block text-xs font-normal text-slate-400 mt-0.5">GSTIN: {order.gstin}</span>}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-300 capitalize">
                        {order.premise_type ? order.premise_type.replace('_', ' / ') : 'Cafe / Restaurant'}
                      </td>
                      <td className="px-6 py-4 font-extrabold text-emerald-400">
                        ₹{parseFloat(order.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        {order.coupon_code && <span className="block text-xs text-amber-400 font-normal">Coupon: {order.coupon_code}</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 capitalize">
                          <CheckCircle2 size={12} /> {order.payment_mode || 'Cash'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border capitalize ${
                            ticketStatus === 'resolved' || ticketStatus === 'closed'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : ticketStatus === 'accepted' || ticketStatus === 'need_visiting' || ticketStatus === 'visited_pending'
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          <Clock size={12} /> {ticketStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'Recent'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
