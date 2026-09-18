'use client';

import React, { useState, useEffect, use } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, ShoppingBag, ChevronLeft, ChevronRight, Cpu, Lock, Fingerprint, ShieldCheck, Tag, PlusCircle, CheckCircle2, Zap, Layers } from 'lucide-react';

export default function SalesProductDetailPage({ params }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  useEffect(() => {
    fetchItemDetails();
  }, [id]);

  const fetchItemDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/hardware-catalog/${id}`);
      if (res.ok) {
        const data = await res.json();
        setItem(data);
      } else {
        const catRes = await fetch('/api/admin/hardware-catalog');
        if (catRes.ok) {
          const list = await catRes.json();
          const match = list.find((i) => i.id === id);
          if (match) setItem(match);
        }
      }
    } catch (err) {
      console.error('Failed to load sales item details:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-medium">Loading product showcase...</p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center justify-center">
        <Cpu className="w-16 h-16 text-slate-600 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Equipment Not Found</h2>
        <p className="text-slate-400 text-sm mb-6">The requested hardware product is not in the sales demo catalog.</p>
        <Link href="/sales/catalog" className="flex items-center gap-2 bg-emerald-500 text-slate-950 font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/25">
          <ArrowLeft size={16} /> Back to Sales Catalog
        </Link>
      </div>
    );
  }

  const images = Array.isArray(item.images) && item.images.length > 0
    ? item.images
    : [item.imageUrl || item.image_url || 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Top Breadcrumb */}
      <div>
        <Link
          href="/sales/catalog"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-400 text-sm font-medium transition cursor-pointer"
        >
          <ArrowLeft size={16} /> Back to Sales Demo Catalog
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Gallery Slider */}
        <div className="lg:col-span-6 space-y-4">
          <div className="relative w-full h-[360px] md:h-[420px] rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl">
            <img
              src={images[activeImageIdx]}
              alt={item.name}
              className="w-full h-full object-cover transition-all duration-300"
            />

            {images.length > 1 && (
              <>
                <button
                  onClick={() => setActiveImageIdx((prev) => (prev - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-950/70 text-white hover:bg-slate-900 border border-slate-800 transition"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setActiveImageIdx((prev) => (prev + 1) % images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-950/70 text-white hover:bg-slate-900 border border-slate-800 transition"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}

            <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono text-emerald-400 border border-slate-800">
              Photo {activeImageIdx + 1} of {images.length}
            </div>
          </div>

          {images.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIdx(idx)}
                  className={`relative w-20 h-20 rounded-2xl overflow-hidden border-2 shrink-0 transition ${
                    idx === activeImageIdx ? 'border-emerald-400 scale-105 shadow-lg shadow-emerald-400/20' : 'border-slate-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details & Quote Builder */}
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {item.category?.replace('_', ' ')}
              </span>
              <span className="text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                Model: {item.modelNumber || item.model_number}
              </span>
            </div>

            <h1 className="text-3xl font-extrabold text-white leading-tight">
              {item.name}
            </h1>

            <p className="text-slate-300 text-sm leading-relaxed">
              {item.description || 'High quality Wi-Fi enabled hardware component engineered for Smart Cafe & Premises.'}
            </p>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between shadow-xl">
            <div>
              <span className="text-xs text-slate-400 block">Unit Price (Demonstration)</span>
              <span className="text-3xl font-extrabold text-emerald-400">₹{parseFloat(item.unitPrice || item.unit_price).toLocaleString('en-IN')}</span>
            </div>

            <Link
              href="/sales/onboarding"
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold px-5 py-3 rounded-xl shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 transition"
            >
              <PlusCircle size={16} /> Add to Client Quote
            </Link>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 shadow-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" /> Compatible System Capabilities
            </h3>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>Compatible with Smart Cafe Master Admin Services Switchboard</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>Supports direct Technician BLE & Wi-Fi pairing workflow</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>Includes 1 Year Manufacturer Replacement Warranty</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
