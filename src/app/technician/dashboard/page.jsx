'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wrench, Wifi, Server, Sliders, CheckCircle2, AlertTriangle, Activity, Building, Plus } from 'lucide-react';

export default function TechnicianDashboardPage() {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [services, setServices] = useState({
    iot_enabled: true,
    inventory_enabled: true,
    billing_connector_enabled: true,
    smart_locks_enabled: true,
    punching_system_enabled: true
  });
  const [mqttStatus, setMqttStatus] = useState('Connected');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      fetchOrgServices(selectedOrgId);
    }
  }, [selectedOrgId]);

  const fetchOrganizations = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/organizations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data);
        if (data.length > 0) {
          setSelectedOrgId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load organizations:', err);
    }
  };

  const fetchOrgServices = async (orgId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/services-control?orgId=${orgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setServices(data);
      }
    } catch (err) {
      console.error('Failed to load org services:', err);
    }
  };

  const handleToggleService = async (serviceKey, currentValue) => {
    const updated = { ...services, [serviceKey]: !currentValue };
    setServices(updated);
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/services-control', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ orgId: selectedOrgId, [serviceKey]: !currentValue })
      });
    } catch (err) {
      console.error('Failed to update service:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm tracking-wide uppercase">
            <Wrench className="w-5 h-5" /> Technician Operations & Setup Center
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1">
            Premise Onboarding & IoT Setup Console
          </h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">
            Pair hardware boards, manage smart lock access, configure biometric punching, and toggle active tenant services.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-400">Gateway Status:</span>
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{mqttStatus}</span>
        </div>
      </motion.div>

      {/* Select Organization */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
          Select Target Organization / Premise
        </label>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="w-full sm:w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-indigo-500"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.premiseType?.replace('_', ' ')})
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">
            Selected Org ID: <code className="text-indigo-400 font-mono">{selectedOrgId}</code>
          </span>
        </div>
      </div>

      {/* Service Feature Flags Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {[
          { key: 'iot_enabled', name: 'IoT Relay Controllers', desc: 'Smart Wi-Fi boards for AC, Fans, Lights & Appliances' },
          { key: 'smart_locks_enabled', name: 'Smart Locks & RFID', desc: 'Wi-Fi Smart locks, keypad entry & RFID card access' },
          { key: 'punching_system_enabled', name: 'Biometric Attendance', desc: 'RFID, Fingerprint & Face Recognition punching devices' },
          { key: 'inventory_enabled', name: 'Food & Stock Inventory', desc: 'Batch expiry tracking, food purchase & BOM recipe deducts' },
          { key: 'billing_connector_enabled', name: 'Billing & POS Connectors', desc: 'Razorpay, Cash confirmation & Tally POS export integration' }
        ].map((item) => {
          const isEnabled = Boolean(services[item.key]);
          return (
            <motion.div
              key={item.key}
              whileHover={{ scale: 1.02 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-white text-base">{item.name}</h3>
                  <button
                    onClick={() => handleToggleService(item.key, isEnabled)}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer ${
                      isEnabled ? 'bg-indigo-500' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${
                        isEnabled ? 'transform translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">{item.desc}</p>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold">
                {isEnabled ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Service Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-500 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                    <AlertTriangle className="w-3.5 h-3.5" /> Service Offline
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
