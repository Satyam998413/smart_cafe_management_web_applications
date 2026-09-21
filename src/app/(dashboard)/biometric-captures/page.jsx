'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, ScanFace, RefreshCw, UserPlus, Clock, ShieldCheck } from 'lucide-react';
import { useDeviceStatusSocket } from '@/lib/useDeviceStatusSocket.js';

const FINGER_LABELS = {
  right_thumb: 'Right Thumb',
  left_thumb: 'Left Thumb',
  right_index: 'Right Index',
  left_index: 'Left Index'
};

export default function BiometricCapturesPage() {
  const [captures, setCaptures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignModal, setAssignModal] = useState(null); // capture being assigned
  const { lastCaptureEvent } = useDeviceStatusSocket();

  const fetchCaptures = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/biometrics/captures?status=unassigned', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setCaptures(await res.json());
    } catch (err) {
      console.error('Failed to load biometric captures:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCaptures();
  }, [fetchCaptures]);

  // A new enrollment arriving, or a face capture finishing its async
  // embedding extraction (pending -> ready), both change what this list
  // should show — refetch rather than try to patch the socket payload's
  // partial shape into local state.
  useEffect(() => {
    if (lastCaptureEvent) fetchCaptures();
  }, [lastCaptureEvent, fetchCaptures]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm tracking-wide uppercase">
            <Fingerprint className="w-5 h-5" /> Biometric Enrollment Queue
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1">Unassigned Fingerprints &amp; Faces</h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">
            Captured by lock and punching devices, newest first. Assign each one to a staff member to turn it into their access credential.
          </p>
        </div>
        <button
          onClick={fetchCaptures}
          className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      ) : captures.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl">
          <Fingerprint className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-300">No unassigned captures</h3>
          <p className="text-slate-500 text-sm mt-1">New fingerprint or face enrollments from devices will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {captures.map((capture) => (
            <motion.div
              key={capture.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                    {capture.modality === 'face' ? <ScanFace className="w-3.5 h-3.5" /> : <Fingerprint className="w-3.5 h-3.5" />}
                    {capture.modality === 'face' ? 'Face' : FINGER_LABELS[capture.fingerPosition] || capture.fingerPosition}
                  </span>
                  {capture.status !== 'ready' && (
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {capture.status}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-medium">
                  <span>Captured Images ({(capture.imageUrls || []).length})</span>
                  <span className="font-mono text-[10px] text-slate-500">ID: {capture.id.slice(0, 8)}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {(capture.imageUrls || []).map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={url} alt={`Thumb scan ${i+1}`} className="w-full aspect-square object-cover rounded-lg border border-slate-800 hover:scale-105 transition-transform" />
                  ))}
                </div>

                <p className="text-xs text-slate-500">{new Date(capture.capturedAt).toLocaleString()}</p>
                {capture.extractionError && <p className="text-xs text-rose-400 mt-1">{capture.extractionError}</p>}
              </div>

              <button
                onClick={() => setAssignModal(capture)}
                disabled={capture.status !== 'ready'}
                className="mt-4 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" /> Assign to Staff
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {assignModal && (
        <AssignModal
          capture={assignModal}
          onClose={() => setAssignModal(null)}
          onAssigned={() => {
            setAssignModal(null);
            fetchCaptures();
          }}
        />
      )}
    </div>
  );
}

function AssignModal({ capture, onClose, onAssigned }) {
  const [mode, setMode] = useState('existing'); // 'existing' | 'new'
  const [staff, setStaff] = useState([]);
  const [userId, setUserId] = useState('');
  const [newUser, setNewUser] = useState({ name: '', email: '', phone: '', password: '', role: 'waiter' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/staff', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then(setStaff)
      .catch(() => setStaff([]));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const body = mode === 'existing' ? { userId } : { newUser };
      const res = await fetch(`/api/biometrics/captures/${capture.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to assign');
      }
      onAssigned();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" /> Assign Credential
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          {capture.modality === 'face' ? 'This face capture' : `This ${FINGER_LABELS[capture.fingerPosition] || capture.fingerPosition} capture`} will become the selected staff member&apos;s access credential.
        </p>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold ${mode === 'existing' ? 'bg-emerald-500 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'}`}
          >
            Existing Staff
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold ${mode === 'new' ? 'bg-emerald-500 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'}`}
          >
            New Staff
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'existing' ? (
            <select
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Select a staff member…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.role}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                required
                placeholder="Full name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <input
                placeholder="Phone"
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <input
                type="email"
                placeholder="Email (optional if phone given)"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <input
                required
                type="password"
                placeholder="Temporary password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="manager">Manager</option>
                <option value="cook">Cook</option>
                <option value="waiter">Waiter</option>
              </select>
            </>
          )}

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-slate-400 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-emerald-500 disabled:opacity-60 text-white text-sm font-medium">
              {submitting ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
