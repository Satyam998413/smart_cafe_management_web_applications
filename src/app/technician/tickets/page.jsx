'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Ticket,
  Search,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
  History,
  MessageSquare,
  Wrench,
  X
} from 'lucide-react';

export default function TechnicianTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Status update modal
  const [updateModalTicket, setUpdateModalTicket] = useState(null);
  const [nextStatus, setNextStatus] = useState('need_visiting');
  const [remarks, setRemarks] = useState('');
  const [updating, setUpdating] = useState(false);

  // History timeline modal
  const [historyModalTicket, setHistoryModalTicket] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  const handleAcceptTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/support/tickets', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ticketId,
          status: 'accepted',
          remarks: 'Technician accepted assignment'
        })
      });

      if (res.ok) {
        fetchTickets();
      }
    } catch (err) {
      console.error('Failed to accept ticket:', err);
    }
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!remarks.trim()) {
      alert('Please enter a remark or reason for this status change.');
      return;
    }

    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/support/tickets', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ticketId: updateModalTicket.id,
          status: nextStatus,
          remarks
        })
      });

      if (res.ok) {
        setUpdateModalTicket(null);
        setRemarks('');
        fetchTickets();
      }
    } catch (err) {
      console.error('Failed to update ticket status:', err);
    } finally {
      setUpdating(false);
    }
  };

  const fetchTicketHistory = async (ticket) => {
    setHistoryModalTicket(ticket);
    setHistoryLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/support/tickets?ticketId=${ticket.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data.history || []);
      }
    } catch (err) {
      console.error('Failed to load ticket history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.organization && t.organization.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (filterStatus === 'all') return matchesSearch;
    return matchesSearch && t.status === filterStatus;
  });

  const getStatusBadge = (status) => {
    if (status === 'resolved' || status === 'closed') {
      return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 capitalize"><CheckCircle2 size={12} /> {status.replace('_', ' ')}</span>;
    }
    if (status === 'accepted' || status === 'need_visiting' || status === 'visited_pending') {
      return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 capitalize"><Clock size={12} /> {status.replace('_', ' ')}</span>;
    }
    return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-400 capitalize"><AlertCircle size={12} /> {status.replace('_', ' ')}</span>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Ticket className="text-indigo-400" /> Technician Setup & Support Tickets Workstation
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            Accept assigned hardware setup jobs, update visiting progress with mandatory reason logs, and inspect status audit timelines.
          </p>
        </div>

        <button
          onClick={fetchTickets}
          className="self-start md:self-auto flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-200 transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Tickets</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by ticket title, client organization..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {['all', 'open', 'assigned', 'accepted', 'need_visiting', 'visited_pending', 'resolved'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap capitalize transition ${
                filterStatus === st
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-2" />
            <p className="text-sm">Loading setup tickets...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Ticket className="w-10 h-10 text-slate-600 mx-auto mb-1" />
            <p className="text-sm font-semibold text-slate-300">No tickets found matching criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Ticket Info</th>
                  <th className="px-6 py-4">Client Premise</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Current Status</th>
                  <th className="px-6 py-4">Date Created</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{ticket.title}</div>
                      <div className="text-xs text-slate-400 line-clamp-1">{ticket.description}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-200">
                      {ticket.organization?.name || 'Platform Premise'}
                    </td>
                    <td className="px-6 py-4 text-xs capitalize text-indigo-400 font-medium">
                      {ticket.category ? ticket.category.replace('_', ' ') : 'Hardware Setup'}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(ticket.status)}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : 'Recent'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      {ticket.status === 'assigned' || ticket.status === 'open' ? (
                        <button
                          onClick={() => handleAcceptTicket(ticket.id)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold text-xs transition"
                        >
                          Accept Ticket
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setUpdateModalTicket(ticket);
                            setNextStatus(ticket.status === 'accepted' ? 'need_visiting' : ticket.status === 'need_visiting' ? 'visited_pending' : 'resolved');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
                        >
                          Update Status
                        </button>
                      )}

                      <button
                        onClick={() => fetchTicketHistory(ticket)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
                        title="View History Timeline"
                      >
                        <History size={14} className="inline mr-1" /> Audit Log
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Update Status Modal */}
      {updateModalTicket && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6 relative">
            <button
              onClick={() => setUpdateModalTicket(null)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              <X size={18} />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Update Ticket Progress</h3>
              <p className="text-xs text-slate-400">{updateModalTicket.title}</p>
            </div>

            <form onSubmit={handleStatusUpdate} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Target Status</label>
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="need_visiting">Need Visiting (Scheduled Premise Visit)</option>
                  <option value="visited_pending">Visited Pending (Visited, awaiting client setup confirmation)</option>
                  <option value="resolved">Resolved (Hardware Installed & Configured)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Mandatory Reason / Remarks Log</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Why is status changing? Provide details for history log..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUpdateModalTicket(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-500 hover:bg-indigo-400 text-slate-950 flex items-center gap-2"
                >
                  {updating ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>Save Progress Log</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Audit Timeline History Modal ("hb kyu kaise") */}
      {historyModalTicket && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setHistoryModalTicket(null)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              <X size={18} />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <History className="text-indigo-400" /> Audit History Timeline ("hb kyu kaise")
              </h3>
              <p className="text-xs text-slate-400">{historyModalTicket.title}</p>
            </div>

            {historyLoading ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-400 mx-auto mb-2" />
                <p className="text-xs">Loading audit log...</p>
              </div>
            ) : historyLogs.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs">No status change history recorded yet.</div>
            ) : (
              <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800 pl-2">
                {historyLogs.map((log) => (
                  <div key={log.id} className="relative pl-8 space-y-1">
                    <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-slate-900" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white capitalize">{log.previous_status || 'open'} ➔ {log.new_status}</span>
                      <span className="text-slate-500 font-mono">{log.created_at ? new Date(log.created_at).toLocaleString() : ''}</span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <User size={12} className="text-indigo-400" /> Changed by: <span className="text-slate-200 font-medium">{log.actor?.name || 'Staff User'} ({log.actor?.role || 'user'})</span>
                    </div>
                    {log.remarks && (
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs text-slate-300 mt-1">
                        "{log.remarks}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
