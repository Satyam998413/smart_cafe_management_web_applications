'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wifi, Bluetooth, Signal, Cpu, Lock, Fingerprint, CheckCircle2, RefreshCw, MapPin } from 'lucide-react';

export default function TechnicianDevicePairingPage() {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [pairingData, setPairingData] = useState({ controllers: [], locks: [], punchingDevices: [] });
  const [loading, setLoading] = useState(true);
  const [pairingModal, setPairingModal] = useState(null); // { type, device }
  const [pairForm, setPairForm] = useState({ wifiSsid: 'SmartCafe-Staff-WiFi', bluetoothMac: 'AA:BB:CC:DD:EE:FF', mobileBleRssi: -45, mobileWifiRssi: -45, spaceId: '' });

  useEffect(() => {
    fetchOrgs();
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      fetchDevices(selectedOrgId);
    }
  }, [selectedOrgId]);

  const fetchOrgs = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/organizations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data);
        if (data.length > 0) setSelectedOrgId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load orgs:', err);
    }
  };

  const fetchDevices = async (orgId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/technician/device-pairing?orgId=${orgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPairingData(data);
      }
    } catch (err) {
      console.error('Failed to load pairing data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePairSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/technician/device-pairing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          deviceType: pairingModal.type,
          deviceId: pairingModal.device.id,
          ...pairForm
        })
      });

      if (res.ok) {
        setPairingModal(null);
        fetchDevices(selectedOrgId);
      }
    } catch (err) {
      console.error('Failed to pair device:', err);
    }
  };

  const getSignalColor = (rssi) => {
    if (rssi >= -60) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (rssi >= -75) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm tracking-wide uppercase">
          <Wifi className="w-5 h-5" /> Technician Hardware Telemetry Studio
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1">
          Wi-Fi & Bluetooth Device Pairing & RSSI Scanner
        </h1>
        <p className="text-slate-400 mt-1 text-sm md:text-base">
          Pair hardware controllers, smart locks, and biometric punching terminals with site Wi-Fi / Bluetooth and monitor signal strength (-dBm).
        </p>
      </motion.div>

      {/* Select Org */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
        <label className="text-xs text-slate-400 font-semibold uppercase block mb-2">Target Organization</label>
        <select
          value={selectedOrgId}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          className="w-full sm:w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-indigo-500"
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Smart Locks */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-cyan-400" /> Smart Door Locks ({pairingData.locks.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pairingData.locks.map((lock) => (
                <div key={lock.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">{lock.lock_type?.replace('_', ' ')}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-mono border ${getSignalColor(lock.rssi_signal_strength || -50)}`}>
                        <Signal className="w-3 h-3 inline mr-1" />
                        {lock.rssi_signal_strength || -50} dBm
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-base mb-1">{lock.lock_name}</h3>
                    <p className="text-xs text-slate-400 mb-3">Space: {lock.space?.label || 'Unassigned'}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-mono">MAC: {lock.bluetooth_mac || 'Pending Pair'}</span>
                    <button
                      onClick={() => setPairingModal({ type: 'lock', device: lock })}
                      className="bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                      Pair Device
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pairing Modal */}
      {pairingModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Pair {pairingModal.device.lock_name || pairingModal.device.name}</h2>
            <form onSubmit={handlePairSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Wi-Fi SSID Network</label>
                <input
                  type="text"
                  required
                  value={pairForm.wifiSsid}
                  onChange={(e) => setPairForm({ ...pairForm, wifiSsid: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Bluetooth MAC Address</label>
                <input
                  type="text"
                  required
                  value={pairForm.bluetoothMac}
                  onChange={(e) => setPairForm({ ...pairForm, bluetoothMac: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Device ↔ Mobile Signal (dBm): {pairForm.mobileBleRssi} dBm</label>
                <input
                  type="range"
                  min="-95"
                  max="-30"
                  value={pairForm.mobileBleRssi}
                  onChange={(e) => setPairForm({ ...pairForm, mobileBleRssi: parseInt(e.target.value, 10) })}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Mobile ↔ Router Signal (dBm): {pairForm.mobileWifiRssi} dBm</label>
                <input
                  type="range"
                  min="-95"
                  max="-30"
                  value={pairForm.mobileWifiRssi}
                  onChange={(e) => setPairForm({ ...pairForm, mobileWifiRssi: parseInt(e.target.value, 10) })}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setPairingModal(null)} className="px-4 py-2 rounded-xl text-slate-400 text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-medium">Confirm Pairing</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
