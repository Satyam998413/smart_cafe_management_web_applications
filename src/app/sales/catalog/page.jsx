'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ShoppingBag,
  Cpu,
  Lock,
  Fingerprint,
  PlusCircle,
  CheckCircle2,
  Tag,
  Eye,
  ShieldCheck,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function SalesCatalogPage() {
  const [hardwareItems, setHardwareItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/hardware-catalog');
      if (res.ok) {
        const data = await res.json();
        setHardwareItems(data);
      }
    } catch (err) {
      console.error('Failed to load hardware catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = hardwareItems.filter((item) =>
    selectedCategory === 'all' ? true : item.category === selectedCategory
  );

  const getCategoryIcon = (category) => {
    if (category === 'smart_lock') return Lock;
    if (category === 'punching_device') return Fingerprint;
    if (category === 'iot_controller') return Cpu;
    return Tag;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <ShoppingBag className="text-emerald-400" /> Hardware Marketplace Catalog
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            Demonstrate hardware products, multi-photo specifications, unit prices, and stock availability during client visits.
          </p>
        </div>

        <Link
          href="/sales/onboarding"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs hover:from-emerald-400 hover:to-teal-400 transition shadow-lg shadow-emerald-500/20"
        >
          <PlusCircle size={16} />
          <span>Build Quote Cart</span>
        </Link>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
        {[
          { id: 'all', label: 'All Products' },
          { id: 'iot_controller', label: 'Wi-Fi Relay Controllers' },
          { id: 'smart_lock', label: 'Smart Locks & Keypads' },
          { id: 'punching_device', label: 'Biometric & Face Punching' },
          { id: 'rfid_card', label: 'RFID Cards' }
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              selectedCategory === cat.id
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-2" />
          <p className="text-sm">Loading catalog items...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <SalesHardwareCard key={item.id} item={item} getCategoryIcon={getCategoryIcon} />
          ))}
        </div>
      )}
    </div>
  );
}

function SalesHardwareCard({ item, getCategoryIcon }) {
  const images = Array.isArray(item.images) && item.images.length > 0
    ? item.images
    : [item.imageUrl || item.image_url || 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop'];
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const Icon = getCategoryIcon(item.category);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between gap-6 hover:border-emerald-500/30 transition group"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 capitalize">
            <Icon size={14} /> {item.category?.replace('_', ' ')}
          </span>
          <span className="text-xs font-mono text-slate-400">Model: {item.modelNumber || item.model_number}</span>
        </div>

        {/* Photo Gallery Carousel */}
        <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800">
          <img
            src={images[activeImageIdx]}
            alt={item.name}
            className="w-full h-full object-cover transition duration-300"
          />

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveImageIdx((prev) => (prev - 1 + images.length) % images.length); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-950/70 text-white hover:bg-slate-900 opacity-80 hover:opacity-100 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveImageIdx((prev) => (prev + 1) % images.length); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-950/70 text-white hover:bg-slate-900 opacity-80 hover:opacity-100 transition"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>

        <div>
          <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition">{item.name}</h3>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
        <div>
          <span className="text-xs text-slate-500 block">Unit Price</span>
          <span className="text-xl font-extrabold text-white">₹{parseFloat(item.unitPrice || item.unit_price).toLocaleString('en-IN')}</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/sales/catalog/${item.id}`}
            className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-2.5 rounded-xl transition"
          >
            <Eye size={14} /> Details
          </Link>

          <Link
            href="/sales/onboarding"
            className="inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold px-3 py-2.5 rounded-xl transition"
          >
            <PlusCircle size={14} /> Quote
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
