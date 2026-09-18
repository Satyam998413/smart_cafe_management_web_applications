'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Wrench,
  Wifi,
  Ticket,
  Sliders,
  CheckCircle2,
  Clock,
  Activity,
  Building2,
  ArrowRight,
  RefreshCw,
  Cpu
} from 'lucide-react';

export default function TechnicianDashboardPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/support/tickets', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalAssigned = tickets.length;
  const activeJobs = tickets.filter((t) => t.status === 'accepted' || t.status === 'need_visiting' || t.status === 'visited_pending').length;
  const resolvedJobs = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length;
  const pendingAcceptance = tickets.filter((t) => t.status === 'assigned' || t.status === 'open').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-slate-900 to-sky-900/40 border border-indigo-500/20 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
            <Wrench size={16} /> Senior Field Technician Workstation
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
            Hardware Telemetry & Setup Maintenance Portal
          </h1>
          <p className="text-slate-300 text-sm max-w-2xl">
            Inspect assigned setup tickets, measure Wi-Fi/Bluetooth RSSI signal strength (-dBm), pair smart locks & relay boards, and configure premise service flags.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/technician/tickets"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-sky-500 text-slate-950 font-bold px-5 py-3 rounded-2xl hover:from-indigo-400 hover:to-sky-400 transition shadow-lg shadow-indigo-500/20 text-xs"
          >
            <Ticket size={16} />
            <span>Tickets Queue</span>
          </Link>
          <Link
            href="/technician/device-pairing"
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-5 py-3 rounded-2xl transition border border-slate-700 text-xs"
          >
            <Wifi size={16} className="text-indigo-400" />
            <span>Pair Devices</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Tickets</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Ticket size={18} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{loading ? '...' : totalAssigned}</div>
          <div className="text-xs text-indigo-400 flex items-center gap-1 font-medium">
            Field setup & maintenance
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Field Jobs</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Clock size={18} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{loading ? '...' : activeJobs}</div>
          <div className="text-xs text-amber-400 flex items-center gap-1 font-medium">
            Accepted / Need visiting
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Resolved Installations</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{loading ? '...' : resolvedJobs}</div>
          <div className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
            Hardware verified & handed over
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Acceptance</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              <Activity size={18} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{loading ? '...' : pendingAcceptance}</div>
          <div className="text-xs text-sky-400 flex items-center gap-1 font-medium">
            Ready for technician claim
          </div>
        </motion.div>
      </div>

      {/* Workstation Quick Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/technician/tickets" className="bg-slate-900 border border-slate-800 hover:border-indigo-500/30 rounded-3xl p-6 shadow-xl space-y-3 transition group">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 transition">
            <Ticket size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition flex items-center justify-between">
              Setup & Support Tickets <ArrowRight size={18} />
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              View assigned tickets, update visiting reasons, and inspect history audit timelines.
            </p>
          </div>
        </Link>

        <Link href="/technician/device-pairing" className="bg-slate-900 border border-slate-800 hover:border-indigo-500/30 rounded-3xl p-6 shadow-xl space-y-3 transition group">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20 group-hover:scale-110 transition">
            <Wifi size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white group-hover:text-sky-400 transition flex items-center justify-between">
              Device Pairing & RSSI <ArrowRight size={18} />
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Scan smart locks & relay boards, measure RSSI signal strength (-dBm), and map to rooms.
            </p>
          </div>
        </Link>

        <Link href="/technician/services" className="bg-slate-900 border border-slate-800 hover:border-indigo-500/30 rounded-3xl p-6 shadow-xl space-y-3 transition group">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20 group-hover:scale-110 transition">
            <Sliders size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white group-hover:text-teal-400 transition flex items-center justify-between">
              Organization Services <ArrowRight size={18} />
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Toggle ON/OFF service feature flags for IoT, smart locks, biometric punching, & POS.
            </p>
          </div>
        </Link>
      </div>

      {/* Recent Assigned Tickets Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Wrench size={20} className="text-indigo-400" /> Recent Setup & Maintenance Jobs
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Tickets assigned to you or open for technician pickup</p>
          </div>

          <button
            onClick={fetchTickets}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
            title="Refresh Tickets"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-2" />
            <p className="text-sm">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800/80 p-8 space-y-2">
            <Ticket className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No active tickets assigned to you right now</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Ticket Info</th>
                  <th className="px-6 py-4">Client Premise</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {tickets.slice(0, 5).map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{ticket.title}</div>
                      <div className="text-xs text-slate-400 line-clamp-1">{ticket.description}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-200">
                      {ticket.organization?.name || 'Platform Premise'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 capitalize">
                        <Clock size={12} /> {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href="/technician/tickets"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
                      >
                        Manage <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
