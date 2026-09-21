'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Unlock, Key, Battery, RefreshCw, Plus, ShieldCheck, Wifi, Users, X, Trash2 } from 'lucide-react';
import DeviceStatusBadge from '@/components/DeviceStatusBadge.jsx';
import { useDeviceStatusSocket } from '@/lib/useDeviceStatusSocket.js';

export default function SmartLocksPage() {
  const [locks, setLocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [accessModal, setAccessModal] = useState(null); // lock whose access grants are being managed
  const [formData, setFormData] = useState({ lock_name: '', lock_type: 'rfid_wifi', transport_type: 'mqtt', mac_address: '', ip_address: '' });
  const { heartbeats, accessEvents } = useDeviceStatusSocket();

  useEffect(() => {
    fetchLocks();
  }, []);

  const fetchLocks = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/locks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLocks(data);
      }
    } catch (err) {
      console.error('Failed to load locks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLock = async (lockId, currentIsLocked) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/locks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: currentIsLocked ? 'unlock' : 'lock', lockId })
      });
      if (res.ok) {
        fetchLocks();
      }
    } catch (err) {
      console.error('Failed to toggle lock:', err);
    }
  };

  const handleAddLock = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/locks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({ lock_name: '', lock_type: 'rfid_wifi', mac_address: '', ip_address: '' });
        fetchLocks();
      }
    } catch (err) {
      console.error('Failed to add lock:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm tracking-wide uppercase">
            <ShieldCheck className="w-5 h-5" /> Smart Access & Locks Control
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1">
            Wi-Fi & RFID Smart Locks Grid
          </h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">
            Remote door lock controls, room access window rules, RFID card key assignments, and battery monitors.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium px-5 py-3 rounded-xl shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-5 h-5" /> Add Smart Lock
        </button>
      </motion.div>

      {/* Locks Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-cyan-400 mb-2" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {locks.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <Lock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-300">No Smart Locks Registered</h3>
              <p className="text-slate-500 text-sm mt-1">Register a Wi-Fi or RFID door lock to start remote controlling room entry.</p>
            </div>
          ) : (
            locks.map((lock) => {
              const lastHeartbeatAt = heartbeats[lock.id] ?? lock.last_heartbeat_at;
              const latestAccessEvent = accessEvents[lock.id];
              const flashClass =
                latestAccessEvent?.accessResult === 'granted'
                  ? 'ring-2 ring-emerald-400'
                  : latestAccessEvent?.accessResult === 'denied'
                    ? 'ring-2 ring-rose-500'
                    : '';
              return (
              <motion.div
                key={lock.id}
                whileHover={{ y: -4 }}
                className={`bg-slate-900 border ${lock.is_locked ? 'border-slate-800' : 'border-emerald-500/50'} ${flashClass} rounded-2xl p-5 shadow-xl flex flex-col justify-between transition-all`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs uppercase font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
                      {lock.lock_type.replace('_', ' ')}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Battery className="w-4 h-4 text-emerald-400" />
                        <span>{lock.battery_level || 100}%</span>
                      </div>
                      <DeviceStatusBadge lastHeartbeatAt={lastHeartbeatAt} />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1">{lock.lock_name}</h3>
                  <p className="text-xs text-slate-400 mb-4">{lock.space?.label || 'Unassigned Room/Entry'}</p>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {lock.is_locked ? (
                      <span className="text-xs font-semibold text-rose-400 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" /> Locked
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                        <Unlock className="w-3.5 h-3.5" /> Unlocked
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAccessModal(lock)}
                      title="Manage who can open this lock"
                      className="p-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleLock(lock.id, lock.is_locked)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        lock.is_locked
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                          : 'bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/20'
                      }`}
                    >
                      {lock.is_locked ? 'Remote Unlock' : 'Remote Lock'}
                    </button>
                  </div>
                </div>
              </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Add Lock Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Register Smart Lock</h2>
            <form onSubmit={handleAddLock} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Lock / Door Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Room 204 Main Door"
                  value={formData.lock_name}
                  onChange={(e) => setFormData({ ...formData, lock_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Lock Type</label>
                <select
                  value={formData.lock_type}
                  onChange={(e) => setFormData({ ...formData, lock_type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="rfid_wifi">RFID + Wi-Fi Smart Lock</option>
                  <option value="keypad_wifi">Keypad + Wi-Fi Lock</option>
                  <option value="biometric_lock">Biometric Lock</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Communication Protocol</label>
                <select
                  value={formData.transport_type}
                  onChange={(e) => setFormData({ ...formData, transport_type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="mqtt">MQTT Broker (Topic: locks/&lt;id&gt;)</option>
                  <option value="api">HTTP API (REST Endpoints)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-xl text-slate-400 text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium">Save Lock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {accessModal && <AccessGrantsModal lock={accessModal} onClose={() => setAccessModal(null)} />}
    </div>
  );
}

function AccessGrantsModal({ lock, onClose }) {
  const [staff, setStaff] = useState([]);
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const [staffRes, grantsRes] = await Promise.all([
      fetch('/api/staff', { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/access-grants?lockId=${lock.id}`, { headers: { Authorization: `Bearer ${token}` } })
    ]);
    setStaff(staffRes.ok ? await staffRes.json() : []);
    setGrants(grantsRes.ok ? await grantsRes.json() : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lock.id]);

  const grantedUserIds = new Set(grants.map((g) => g.user_id));
  const availableStaff = staff.filter((s) => !grantedUserIds.has(s.id));

  const handleGrant = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setBusy(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/access-grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: selectedUserId, lockId: lock.id })
      });
      if (res.ok) {
        setSelectedUserId('');
        fetchAll();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (userId) => {
    setBusy(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/access-grants', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, lockId: lock.id })
      });
      if (res.ok) fetchAll();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" /> Access — {lock.lock_name}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">Only staff granted access here can unlock this door via fingerprint or face verification.</p>

        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
              {grants.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No one has access yet.</p>
              ) : (
                grants.map((grant) => (
                  <div key={grant.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                    <div>
                      <p className="text-sm text-white font-medium">{grant.user?.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500">{grant.user?.email}</p>
                    </div>
                    <button
                      onClick={() => handleRevoke(grant.user_id)}
                      disabled={busy}
                      title="Revoke access"
                      className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleGrant} className="flex gap-2">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">Grant access to…</option>
                {availableStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.role}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={busy || !selectedUserId}
                className="px-4 py-2 rounded-xl bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium cursor-pointer"
              >
                Grant
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
