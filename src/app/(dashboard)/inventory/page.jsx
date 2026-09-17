'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, AlertCircle, Calendar, Plus, RefreshCw, Layers, DollarSign, Utensils } from 'lucide-react';

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState('items'); // 'items' | 'expiring' | 'batches'
  const [items, setItems] = useState([]);
  const [expiringBatches, setExpiringBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);

  const [itemForm, setItemForm] = useState({ name: '', category: 'Food & Raw Items', unit: 'kg', min_stock_alert: '5', cost_per_unit: '' });
  const [batchForm, setBatchForm] = useState({ item_id: '', batch_number: '', quantity: '', expiry_date: '', supplier_name: '' });

  useEffect(() => {
    fetchInventoryData();
  }, [activeTab]);

  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/inventory?view=${activeTab}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (activeTab === 'expiring') {
          setExpiringBatches(data);
        } else {
          setItems(data);
        }
      }
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(itemForm)
      });
      if (res.ok) {
        setShowAddItemModal(false);
        setItemForm({ name: '', category: 'Food & Raw Items', unit: 'kg', min_stock_alert: '5', cost_per_unit: '' });
        fetchInventoryData();
      }
    } catch (err) {
      console.error('Failed to add item:', err);
    }
  };

  const handleAddBatch = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'add_batch', ...batchForm })
      });
      if (res.ok) {
        setShowAddBatchModal(false);
        setBatchForm({ item_id: '', batch_number: '', quantity: '', expiry_date: '', supplier_name: '' });
        fetchInventoryData();
      }
    } catch (err) {
      console.error('Failed to add batch:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm tracking-wide uppercase">
            <Package className="w-5 h-5" /> Food & Stock Inventory Engine
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1">
            Ingredient Stock & Expiry Manager
          </h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">
            Track food purchases, ingredient expiry warnings, low stock thresholds, and automated BOM recipes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddItemModal(true)}
            className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer text-sm"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
          <button
            onClick={() => setShowAddBatchModal(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer text-sm"
          >
            <Plus className="w-4 h-4" /> Add Stock Batch
          </button>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-8">
        {[
          { id: 'items', label: 'Stock Items', icon: Package },
          { id: 'expiring', label: 'Expiry Alert Warnings', icon: AlertCircle },
          { id: 'batches', label: 'Purchase Batches', icon: Calendar }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
        </div>
      ) : activeTab === 'expiring' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {expiringBatches.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <AlertCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-slate-300 font-semibold">No Expiring Ingredients</p>
              <p className="text-slate-500 text-sm mt-1">All stock batches are fresh and well within expiration bounds.</p>
            </div>
          ) : (
            expiringBatches.map((batch) => (
              <div key={batch.id} className="bg-rose-950/30 border border-rose-900/50 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase font-bold text-rose-400 tracking-wider bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                    Expiring Soon
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Batch: {batch.batch_number}</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">{batch.item?.name}</h3>
                <p className="text-slate-400 text-xs mb-3">Supplier: {batch.supplier_name || 'Standard Vendor'}</p>
                <div className="pt-3 border-t border-rose-900/30 flex justify-between text-xs">
                  <div>
                    <span className="text-slate-500 block">Remaining</span>
                    <span className="text-white font-bold">{batch.quantity_remaining} {batch.item?.unit}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block">Expiry Date</span>
                    <span className="text-rose-400 font-bold">{batch.expiry_date}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item) => (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">
                  {item.category}
                </span>
                <span className="text-xs text-slate-500">Alert ≤ {item.min_stock_alert} {item.unit}</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-3">{item.name}</h3>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block">Current Stock</span>
                  <span className={`text-lg font-bold ${parseFloat(item.current_stock) <= parseFloat(item.min_stock_alert) ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {item.current_stock} {item.unit}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block">Cost / Unit</span>
                  <span className="text-sm font-semibold text-slate-200">₹{item.cost_per_unit}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Add Inventory Master Item</h2>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Milk Packet / Coffee Beans"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Unit</label>
                  <input
                    type="text"
                    required
                    placeholder="kg / liters / packets"
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Cost / Unit (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="65"
                    value={itemForm.cost_per_unit}
                    onChange={(e) => setItemForm({ ...itemForm, cost_per_unit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setShowAddItemModal(false)} className="px-4 py-2 rounded-xl text-slate-400 text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium">Save Item</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
