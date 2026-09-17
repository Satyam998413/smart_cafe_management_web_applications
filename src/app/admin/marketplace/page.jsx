'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Lock, CreditCard, Fingerprint, Plus, RefreshCw, ShoppingCart, Check, Tag, ShieldCheck } from 'lucide-react';

const CATEGORIES = [
  { id: 'all', name: 'All Equipment', icon: Cpu },
  { id: 'iot_controller', name: 'IoT Controllers', icon: Cpu },
  { id: 'smart_lock', name: 'Smart Locks', icon: Lock },
  { id: 'rfid_card', name: 'RFID Cards', icon: CreditCard },
  { id: 'punching_device', name: 'Punching Scanners', icon: Fingerprint }
];

export default function HardwareMarketplacePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'iot_controller',
    model_number: '',
    unit_price: '',
    stock_quantity: '',
    description: ''
  });

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const url = activeCategory === 'all' ? '/api/admin/hardware-catalog' : `/api/admin/hardware-catalog?category=${activeCategory}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.error('Failed to load hardware catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, [activeCategory]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/hardware-catalog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({ name: '', category: 'iot_controller', model_number: '', unit_price: '', stock_quantity: '', description: '' });
        fetchCatalog();
      }
    } catch (err) {
      console.error('Failed to add hardware:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm tracking-wide uppercase">
            <ShieldCheck className="w-5 h-5" /> Master Admin & Technician Portal
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1">
            Hardware Marketplace & CRUD Catalog
          </h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">
            Manage smart Wi-Fi controllers, RFID locks, biometric scanners, and sensor equipment for all premise setups.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-medium px-5 py-3 rounded-xl shadow-lg shadow-sky-500/20 transition-all duration-200 cursor-pointer"
        >
          <Plus className="w-5 h-5" /> Add New Equipment
        </button>
      </motion.div>

      {/* Category Pills */}
      <div className="flex items-center gap-3 overflow-x-auto pb-4 mb-8 no-scrollbar">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25 scale-105'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-sky-400 mb-3" />
          <p>Fetching hardware catalog...</p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {items.length === 0 ? (
              <div className="col-span-full text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <Cpu className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-300">No Hardware Items Found</h3>
                <p className="text-slate-500 text-sm mt-1">Add your first equipment or controller board to populate the catalog.</p>
              </div>
            ) : (
              items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  whileHover={{ y: -5 }}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl backdrop-blur-sm hover:border-slate-700 transition-all duration-200"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs uppercase font-bold tracking-wider px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        {item.category.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Model: {item.model_number}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2 leading-snug">{item.name}</h3>
                    <p className="text-slate-400 text-xs line-clamp-2 mb-4 leading-relaxed">
                      {item.description || 'High quality Wi-Fi enabled hardware component engineered for Smart Cafe & Premises.'}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-500 block">Unit Price</span>
                      <span className="text-xl font-extrabold text-sky-400">₹{item.unit_price}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-500 block">Stock Available</span>
                      <span className={`text-sm font-semibold ${item.stock_quantity > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {item.stock_quantity > 0 ? `${item.stock_quantity} units` : 'Out of Stock'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-4">Add Equipment to Catalog</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Equipment Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 4-Channel Wi-Fi Relay Board"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-sky-500"
                  >
                    <option value="iot_controller">IoT Controller</option>
                    <option value="smart_lock">Smart Lock</option>
                    <option value="rfid_card">RFID Card</option>
                    <option value="punching_device">Punching Scanner</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Model Number</label>
                  <input
                    type="text"
                    required
                    placeholder="ESP32-RELAY-V2"
                    value={formData.model_number}
                    onChange={(e) => setFormData({ ...formData, model_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="2499"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    required
                    placeholder="50"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Description</label>
                <textarea
                  rows="3"
                  placeholder="Hardware features and setup instructions..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-sky-500"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium shadow-lg shadow-sky-500/25 transition-all"
                >
                  Save Equipment
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
