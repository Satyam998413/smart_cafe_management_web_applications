'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LifeBuoy, Plus, AlertTriangle, CheckCircle2, Clock, Wrench, RefreshCw, History, ChevronDown, ChevronUp, MapPin, Eye } from 'lucide-react';

const STATUS_BADGES = {
  open: { label: 'Open', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  assigned: { label: 'Assigned', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  accepted: { label: 'Accepted', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  need_visiting: { label: 'Need Site Visit', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  visited_pending: { label: 'Visited (Pending Parts)', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  in_progress: { label: 'In Progress', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  resolved: { label: 'Resolved', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  closed: { label: 'Closed', color: 'bg-slate-800 text-slate-400 border-slate-700' }
};

export default function SupportPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusModal, setStatusModal] = useState(null); // { ticket, targetStatus }
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [statusRemarks, setStatusRemarks] = useState('');

  const [form, setForm] = useState({
    title: '',
    category: 'iot_device',
    urgency: 'medium',
    description: ''
  });

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

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        setShowCreateModal(false);
        setForm({ title: '', category: 'iot_device', urgency: 'medium', description: '' });
        fetchTickets();
      }
    } catch (err) {
      console.error('Failed to create ticket:', err);
    }
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!statusModal) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/support/tickets', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ticketId: statusModal.ticket.id,
          status: statusModal.targetStatus,
          remarks: statusRemarks
        })
      });

      if (res.ok) {
        setStatusModal(null);
        setStatusRemarks('');
        fetchTickets();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm tracking-wide uppercase">
            <LifeBuoy className="w-5 h-5" /> Owner Support & Maintenance Portal
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1">
            Support Tickets & Audit Timeline History
          </h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">
            Track support tickets across all lifecycle stages: Open ➔ Accepted ➔ Need Site Visit ➔ Visited Pending ➔ Resolved. View complete history logs.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-rose-500 hover:bg-rose-400 text-white font-medium px-5 py-3 rounded-xl shadow-lg shadow-rose-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-5 h-5" /> Raise Support Ticket
        </button>
      </motion.div>

      {/* Tickets Grid */}
      {loading ? (
        <div className="flex justify-center py-20 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-rose-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tickets.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <LifeBuoy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-300">No Open Support Tickets</h3>
              <p className="text-slate-500 text-sm mt-1">All premise hardware and services are operating smoothly.</p>
            </div>
          ) : (
            tickets.map((ticket) => {
              const badge = STATUS_BADGES[ticket.status] || STATUS_BADGES.open;
              const isHistoryExpanded = expandedHistoryId === ticket.id;

              return (
                <div key={ticket.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs uppercase font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        {ticket.category.replace('_', ' ')}
                      </span>
                      <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2">{ticket.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed mb-4">{ticket.description}</p>
                  </div>

                  {/* Technician Status Action Buttons */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">Technician: <strong className="text-white">{ticket.technician?.name || 'Unassigned'}</strong></span>

                    <div className="flex gap-2">
                      {ticket.status !== 'need_visiting' && (
                        <button
                          onClick={() => setStatusModal({ ticket, targetStatus: 'need_visiting' })}
                          className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Need Site Visit
                        </button>
                      )}
                      {ticket.status !== 'visited_pending' && (
                        <button
                          onClick={() => setStatusModal({ ticket, targetStatus: 'visited_pending' })}
                          className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Visited (Pending)
                        </button>
                      )}
                      {ticket.status !== 'resolved' && (
                        <button
                          onClick={() => setStatusModal({ ticket, targetStatus: 'resolved' })}
                          className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>

                  {/* History Timeline Toggle */}
                  <div>
                    <button
                      onClick={() => setExpandedHistoryId(isHistoryExpanded ? null : ticket.id)}
                      className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" />
                      {isHistoryExpanded ? 'Hide Audit History Timeline' : `View History Timeline (${ticket.history?.length || 0} entries)`}
                      {isHistoryExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    <AnimatePresence>
                      {isHistoryExpanded && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                          {ticket.history?.map((log) => (
                            <div key={log.id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-xs">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-white">{log.actor?.name || 'User'} <span className="text-slate-500 font-normal">({log.actor_role})</span></span>
                                <span className="text-slate-500 font-mono">{new Date(log.created_at).toLocaleString()}</span>
                              </div>
                              <div className="text-slate-400">
                                Status: <span className="text-amber-400 font-mono">{log.previous_status || 'start'}</span> ➔ <span className="text-emerald-400 font-mono">{log.new_status}</span>
                              </div>
                              {log.remarks && (
                                <p className="text-slate-300 mt-1 italic bg-slate-900/60 p-2 rounded-lg border border-slate-800">"{log.remarks}"</p>
                              )}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Status Update Modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2">Update Ticket Status ➔ {STATUS_BADGES[statusModal.targetStatus]?.label}</h2>
            <p className="text-xs text-slate-400 mb-4">Provide reasons or remarks for this status transition (why, how, what parts needed):</p>

            <form onSubmit={handleStatusUpdate} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Remarks & Reason Log</label>
                <textarea
                  rows="4"
                  required
                  placeholder="e.g. Visited site; relay board replaced, testing Wi-Fi signal strength."
                  value={statusRemarks}
                  onChange={(e) => setStatusRemarks(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setStatusModal(null)} className="px-4 py-2 rounded-xl text-slate-400 text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-rose-500 text-white text-sm font-medium">Save & Record History</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Raise Support & Maintenance Ticket</h2>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Issue Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Room 201 Smart Lock Battery Dead"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="smart_lock">Smart Lock Issue</option>
                    <option value="iot_device">IoT Relay / Switch</option>
                    <option value="punching_system">Punching / Biometrics</option>
                    <option value="inventory">Inventory Engine</option>
                    <option value="billing">Billing / POS</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Urgency</label>
                  <select
                    value={form.urgency}
                    onChange={(e) => setForm({ ...form, urgency: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical / Emergency</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Description</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Describe the issue in detail..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-xl text-slate-400 text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-rose-500 text-white text-sm font-medium">Submit Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
