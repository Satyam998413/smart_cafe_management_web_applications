'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Sliders,
  Building2,
  Cpu,
  Lock,
  Fingerprint,
  Package,
  Receipt,
  CheckCircle2,
  RefreshCw,
  Save
} from 'lucide-react';

export default function TechnicianServicesPage() {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [services, setServices] = useState({
    iot_enabled: true,
    smart_locks_enabled: true,
    punching_system_enabled: true,
    inventory_enabled: true,
    billing_connector_enabled: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    fetchOrgs();
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      fetchOrgServices(selectedOrgId);
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

  const fetchOrgServices = async (orgId) => {
    setLoading(true);
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
      console.error('Failed to load services:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key) => {
    setServices((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/services-control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          orgId: selectedOrgId,
          ...services
        })
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save service flags:', err);
    } finally {
      setSaving(false);
    }
  };

  const serviceDefs = [
    { key: 'iot_enabled', label: 'IoT Multi-Channel Relay Switchboards', icon: Cpu, desc: 'Controls 4-combination Wi-Fi relay switches (ESP32/Tuya) for equipment on/off' },
    { key: 'smart_locks_enabled', label: 'Smart Lock Security System', icon: Lock, desc: 'Controls Wi-Fi, RFID cards, keypad PINs, and remote open capabilities' },
    { key: 'punching_system_enabled', label: 'Biometric & AI Face Attendance', icon: Fingerprint, desc: 'Tracks staff punching via RFID, Thumbprint, or AI Face Recognition' },
    { key: 'inventory_enabled', label: 'Food Inventory & Expiry Engine', icon: Package, desc: 'Stock tracking, purchase batch expiry alerts, and BOM recipe deductions' },
    { key: 'billing_connector_enabled', label: 'POS & Accounting Connectors', icon: Receipt, desc: 'Integrates Razorpay checkout, Cash billing collection, and Tally accounting sync' }
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Sliders className="text-indigo-400" /> Organization Service Control Switchboard
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            Enable or disable hardware and software modules per client premise based on subscription or setup scope.
          </p>
        </div>
      </div>

      {/* Organization Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Building2 className="text-indigo-400" /> Select Target Client Organization:
        </div>

        <select
          value={selectedOrgId}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 w-full md:w-80"
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>
      </div>

      {/* Services Switchboard */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-2" />
            <p className="text-sm">Loading service flags...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="divide-y divide-slate-800/80">
              {serviceDefs.map((def) => {
                const Icon = def.icon;
                const isEnabled = !!services[def.key];

                return (
                  <div key={def.key} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition ${isEnabled ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{def.label}</div>
                        <div className="text-xs text-slate-400">{def.desc}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggle(def.key)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isEnabled ? 'bg-indigo-500' : 'bg-slate-800'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              {savedSuccess ? (
                <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={16} /> Service feature flags saved successfully!
                </div>
              ) : (
                <div className="text-xs text-slate-500">Changes take effect immediately across web & mobile apps</div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-lg shadow-indigo-500/20"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Save Service Configuration</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
