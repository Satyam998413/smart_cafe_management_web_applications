'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Fingerprint, ScanFace, CreditCard, RefreshCw, CheckCircle2, XCircle, Search, Filter, Clock } from 'lucide-react';
import { useDeviceStatusSocket } from '@/lib/useDeviceStatusSocket.js';

export default function AccessHistoryPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalityFilter, setModalityFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { lastAccessEvent } = useDeviceStatusSocket();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/access-events', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error('Failed to load access history logs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Prepend real-time access events arriving over socket
  useEffect(() => {
    if (lastAccessEvent) {
      fetchEvents();
    }
  }, [lastAccessEvent, fetchEvents]);

  const filteredEvents = events.filter((ev) => {
    if (modalityFilter !== 'all' && ev.modality !== modalityFilter) return false;
    if (resultFilter !== 'all') {
      if (resultFilter === 'granted' && ev.access_result !== 'granted' && !(ev.device_category === 'punching' && ev.matched)) return false;
      if (resultFilter === 'denied' && (ev.access_result === 'granted' || (ev.device_category === 'punching' && ev.matched))) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const userName = ev.user?.name?.toLowerCase() || '';
      const deviceId = ev.device_id?.toLowerCase() || '';
      const category = ev.device_category?.toLowerCase() || '';
      return userName.includes(q) || deviceId.includes(q) || category.includes(q);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm tracking-wide uppercase">
            <ShieldCheck className="w-5 h-5" /> Security & Access Audit History
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1">
            Real-Time Access Logs
          </h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">
            Complete audit history of biometric scans, door locks, and punching terminal attempts.
          </p>
        </div>

        <button
          onClick={fetchEvents}
          className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </motion.div>

      {/* Filters & Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by staff name or device ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Modality Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {['all', 'fingerprint', 'face', 'rfid'].map((mod) => (
              <button
                key={mod}
                onClick={() => setModalityFilter(mod)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-all ${
                  modalityFilter === mod ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {mod}
              </button>
            ))}
          </div>

          {/* Outcome Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'all', label: 'All Results' },
              { id: 'granted', label: 'Granted / Green' },
              { id: 'denied', label: 'Denied / Red' }
            ].map((res) => (
              <button
                key={res.id}
                onClick={() => setResultFilter(res.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  resultFilter === res.id ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {res.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Access Event Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-cyan-400 mb-2" />
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl">
          <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-300">No Access Logs Found</h3>
          <p className="text-slate-500 text-sm mt-1">Verification attempts from smart locks and punching terminals will appear here.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">User / Identity</th>
                  <th className="py-3.5 px-4">Verification Method</th>
                  <th className="py-3.5 px-4">Device & Category</th>
                  <th className="py-3.5 px-4">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEvents.map((ev) => {
                  const isGranted = ev.access_result === 'granted' || (ev.device_category === 'punching' && ev.matched);
                  return (
                    <tr key={ev.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {new Date(ev.created_at).toLocaleString()}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {ev.user ? (
                          <div>
                            <p className="font-semibold text-white">{ev.user.name}</p>
                            <p className="text-xs text-slate-500">{ev.user.email}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">Unknown / Unassigned</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 capitalize">
                          {ev.modality === 'fingerprint' && <Fingerprint className="w-3.5 h-3.5 text-emerald-400" />}
                          {ev.modality === 'face' && <ScanFace className="w-3.5 h-3.5 text-cyan-400" />}
                          {ev.modality === 'rfid' && <CreditCard className="w-3.5 h-3.5 text-purple-400" />}
                          {ev.modality}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div>
                          <p className="text-xs font-mono text-slate-300">{ev.device_id}</p>
                          <span className="text-[10px] uppercase font-bold text-slate-500">
                            {ev.device_category}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {isGranted ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Granted (Green)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-full">
                            <XCircle className="w-3.5 h-3.5" /> Denied (Red)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
