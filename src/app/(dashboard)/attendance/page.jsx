'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, CreditCard, Camera, Clock, UserCheck, RefreshCw, ShieldCheck } from 'lucide-react';

export default function AttendancePage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/punching', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch attendance logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case 'face_recognition': return <Camera className="w-4 h-4 text-purple-400" />;
      case 'thumbprint': return <Fingerprint className="w-4 h-4 text-emerald-400" />;
      default: return <CreditCard className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm tracking-wide uppercase">
            <UserCheck className="w-5 h-5" /> Staff Attendance & Punching Terminal
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1">
            Biometric & RFID Clock-In Logs
          </h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">
            Live attendance log watcher for RFID card scans, Thumbprint scanners, and AI Face Recognition devices.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Refresh Logs
        </button>
      </motion.div>

      {/* Attendance Logs Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-400 mb-2" />
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Staff Member</th>
                  <th className="px-6 py-4">Punch Type</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Device</th>
                  <th className="px-6 py-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-12 text-slate-500">
                      No attendance punches recorded yet today.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-white">
                        {log.user?.name || 'Staff Member'}
                        <span className="block text-xs text-slate-500 font-normal">{log.user?.email}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          log.punch_type === 'in' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          Punch {log.punch_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 capitalize text-slate-200">
                          {getMethodIcon(log.verification_method)}
                          {log.verification_method?.replace('_', ' ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {log.device?.device_name || 'Wi-Fi Punching Reader'}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-400">
                        {new Date(log.timestamp).toLocaleString()}
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
