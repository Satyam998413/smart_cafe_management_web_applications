'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Wrench, CheckCircle2, UserCheck, RefreshCw, Building, DollarSign, Tag, ShieldCheck } from 'lucide-react';

export default function AdminSalesLeadsPage() {
  const [leads, setLeads] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeadsAndTechnicians();
  }, []);

  const fetchLeadsAndTechnicians = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [leadsRes, techsRes] = await Promise.all([
        fetch('/api/admin/sales-leads', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/users?role=technician', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setLeads(leadsData);
      }
      if (techsRes.ok) {
        const techsData = await techsRes.json();
        setTechnicians(techsData);
      }
    } catch (err) {
      console.error('Failed to load sales leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTechnician = async (orderId, technicianId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/sales-leads', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ orderId, technicianId, ticketStatus: 'assigned' })
      });

      if (res.ok) {
        fetchLeadsAndTechnicians();
      }
    } catch (err) {
      console.error('Failed to assign technician:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm tracking-wide uppercase">
          <ShoppingCart className="w-5 h-5" /> Manufacturer & Sales Pipeline
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1">
          Fresh Client Onboardings & Technician Setup Tickets
        </h1>
        <p className="text-slate-400 mt-1 text-sm md:text-base">
          Track sales leads created by Sales Executives, verify payment modes, and assign installation setup tickets to field Technicians.
        </p>
      </motion.div>

      {/* Leads Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Client Organization</th>
                  <th className="px-6 py-4">Sales Executive</th>
                  <th className="px-6 py-4">Order Total (inc. GST)</th>
                  <th className="px-6 py-4">Payment</th>
                  <th className="px-6 py-4">Setup Ticket Status</th>
                  <th className="px-6 py-4">Assign Field Technician</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12 text-slate-500">
                      No sales onboarding orders submitted yet.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-bold text-white">
                        {lead.org_name}
                        <span className="block text-xs text-slate-500 font-normal uppercase">{lead.premise_type?.replace('_', ' ')}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {lead.salesman?.name || 'Sales Executive'}
                      </td>
                      <td className="px-6 py-4 font-extrabold text-emerald-400 font-mono">
                        ₹{lead.total_amount}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-800 text-cyan-400 border border-slate-700">
                          {lead.payment_mode}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          lead.ticket_status === 'accepted'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : lead.ticket_status === 'assigned'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {lead.ticket_status || 'pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={lead.assigned_technician_id || ''}
                          onChange={(e) => handleAssignTechnician(lead.id, e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- Assign Technician --</option>
                          {technicians.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
