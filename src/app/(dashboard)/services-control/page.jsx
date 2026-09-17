'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sliders, Cpu, Lock, Fingerprint, Package, DollarSign, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function ServicesControlPage() {
  const [services, setServices] = useState({
    iot_enabled: true,
    inventory_enabled: true,
    billing_connector_enabled: true,
    smart_locks_enabled: true,
    punching_system_enabled: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/services-control', {
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

  const handleToggle = async (key) => {
    const nextVal = !services[key];
    setServices((prev) => ({ ...prev, [key]: nextVal }));
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/services-control', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ [key]: nextVal })
      });
    } catch (err) {
      console.error('Failed to toggle service flag:', err);
    } finally {
      setSaving(false);
    }
  };

  const SERVICE_ITEMS = [
    { key: 'iot_enabled', title: 'IoT Equipment & Smart Relays', icon: Cpu, color: 'text-sky-400', desc: 'Controls Wi-Fi smart switches, AC/Fan relays, sensors, and live telemetry.' },
    { key: 'smart_locks_enabled', title: 'Smart Locks & RFID Keycards', icon: Lock, color: 'text-cyan-400', desc: 'Enables room door lock controls, RFID card assignment, and remote unlock.' },
    { key: 'punching_system_enabled', title: 'Staff Punching & Biometrics', icon: Fingerprint, color: 'text-purple-400', desc: 'Enables RFID card, Fingerprint scanner, and Face Recognition clock-in logs.' },
    { key: 'inventory_enabled', title: 'Food & Stock Inventory', icon: Package, color: 'text-emerald-400', desc: 'Enables expiry tracking, ingredient stock purchase, and BOM menu recipes.' },
    { key: 'billing_connector_enabled', title: 'Billing POS & Accounting Connectors', icon: DollarSign, color: 'text-amber-400', desc: 'Enables Razorpay payment gateways, Cash confirmation, and Tally exports.' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm tracking-wide uppercase">
          <Sliders className="w-5 h-5" /> Master Service Switcher
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1">
          Premise Service Feature Control
        </h1>
        <p className="text-slate-400 mt-1 text-sm md:text-base">
          Turn ON or OFF specific platform hardware services and features for your organization.
        </p>
      </motion.div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
        {SERVICE_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = Boolean(services[item.key]);
          return (
            <motion.div
              key={item.key}
              whileHover={{ scale: 1.01 }}
              className={`bg-slate-900 border ${isActive ? 'border-indigo-500/50' : 'border-slate-800'} rounded-2xl p-6 shadow-xl flex flex-col justify-between transition-all`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl bg-slate-950 border border-slate-800 ${item.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{item.title}</h3>
                      <span className={`text-xs font-semibold ${isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {isActive ? 'ENABLED & ACTIVE' : 'DISABLED'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggle(item.key)}
                    className={`relative w-14 h-7 rounded-full transition-colors duration-200 cursor-pointer ${
                      isActive ? 'bg-indigo-500' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full transition-transform duration-200 ${
                        isActive ? 'transform translate-x-7' : ''
                      }`}
                    />
                  </button>
                </div>

                <p className="text-sm text-slate-400 leading-relaxed mb-4">{item.desc}</p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                <span>Access: Owner & Technicians</span>
                {isActive ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Operational
                  </span>
                ) : (
                  <span className="text-slate-500 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> Deactivated
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
