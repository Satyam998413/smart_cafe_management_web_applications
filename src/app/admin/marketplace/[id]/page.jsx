'use client';

import React, { useState, useEffect, use } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowLeft, Cpu, Lock, CreditCard, Fingerprint, ShieldCheck, Tag, CheckCircle, Package, Edit3, Trash2, Image as ImageIcon, Layers, Zap } from 'lucide-react';

export default function HardwareDetailsPage({ params }) {
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
      console.error('Failed to fetch hardware details:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Loading hardware details...</p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen p-6 md:p-10 flex flex-col items-center justify-center" style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
        <Cpu className="w-16 h-16 mb-4" style={{ color: 'var(--text-muted)' }} />
        <h2 className="text-2xl font-bold mb-2">Equipment Not Found</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>The requested hardware catalog item does not exist or was removed.</p>
        <Link href="/admin/marketplace" className="btn-orange flex items-center gap-2 font-medium px-5 py-2.5 rounded-xl shadow-lg">
          <ArrowLeft size={16} /> Return to Hardware Marketplace
        </Link>
      </div>
    );
  }

  const images = Array.isArray(item.images) && item.images.length > 0
    ? item.images
    : [item.imageUrl || item.image_url || 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop'];

  return (
    <div style={{ padding: '1.5rem', width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header Title Bar with Icon + Back on Left Side */}
      <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-4">
          <Link
            href="/admin/marketplace"
            className="inline-flex items-center gap-2 text-sm font-bold transition hover:opacity-80 cursor-pointer"
            style={{ color: 'var(--text-primary)' }}
          >
            <ArrowLeft size={18} style={{ color: 'var(--accent-primary)' }} />
            <span>Back</span>
          </Link>
          <span className="text-xs font-mono px-3 py-1 rounded-full border" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            Catalog Item #{item.id}
          </span>
        </div>

        <span className="status-badge" style={{ background: 'var(--accent-wash)', color: 'var(--accent-primary)', textTransform: 'uppercase', fontSize: '0.72rem', fontWeight: 700 }}>
          {item.category?.replace('_', ' ')}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Multi-Photo Interactive Lightbox Gallery */}
        <div className="lg:col-span-6 space-y-4">
          <div className="relative w-full h-[380px] md:h-[440px] rounded-2xl overflow-hidden shadow-2xl" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)' }}>
            <img
              src={images[activeImageIdx]}
              alt={item.name}
              className="w-full h-full object-cover transition-all duration-300"
            />

            {images.length > 1 && (
              <>
                <button
                  onClick={() => setActiveImageIdx((prev) => (prev - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full border transition"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setActiveImageIdx((prev) => (prev + 1) % images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full border transition"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}

            <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-mono border backdrop-blur-md" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--accent-primary)' }}>
              Photo {activeImageIdx + 1} of {images.length}
            </div>
          </div>

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIdx(idx)}
                  className="relative w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer"
                  style={{
                    borderColor: idx === activeImageIdx ? 'var(--accent-primary)' : 'var(--border)',
                    opacity: idx === activeImageIdx ? 1 : 0.6
                  }}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Consolidated Single Technical Info Card */}
        <div className="lg:col-span-6 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-3 py-1 rounded-full border" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                Model: {item.modelNumber || item.model_number}
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight" style={{ color: 'var(--text-primary)' }}>
              {item.name}
            </h1>

            <p className="text-sm md:text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {item.description || 'High quality Wi-Fi enabled hardware component engineered for Smart Cafe & Premises.'}
            </p>
          </div>

          {/* Streamlined All-in-One Information Container (No redundant extra stacked cards) */}
          <div className="glass-card p-6 space-y-5 shadow-xl">
            {/* Price & Stock Header Row */}
            <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>Unit Price (GST Included)</span>
                <span className="text-3xl font-extrabold" style={{ color: 'var(--accent-primary)' }}>₹{item.unitPrice || item.unit_price}</span>
              </div>

              <div className="text-right">
                <span className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Stock Status</span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full inline-block ${(item.stockQuantity || item.stock_quantity) > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {(item.stockQuantity || item.stock_quantity) > 0 ? `${item.stockQuantity || item.stock_quantity} units available` : 'Out of Stock'}
                </span>
              </div>
            </div>

            {/* Technical Specifications Grid */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Zap className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} /> Technical Specifications
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl border" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
                  <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>Connectivity</span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>2.4GHz Wi-Fi + BLE 4.2</span>
                </div>
                <div className="p-3 rounded-xl border" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
                  <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>Operating Voltage</span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>5V - 12V DC / Relay</span>
                </div>
                <div className="p-3 rounded-xl border" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
                  <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>Bucket Path</span>
                  <span className="font-mono text-[11px]" style={{ color: 'var(--accent-primary)' }}>hardware/{item.id}/images</span>
                </div>
                <div className="p-3 rounded-xl border" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
                  <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>Gallery Count</span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{images.length} High-Res Photos</span>
                </div>
              </div>
            </div>

            {/* System Integrations Row */}
            <div className="pt-3 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Layers className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} /> Compatible System Modules
              </h3>

              <div className="flex flex-wrap gap-2 pt-1">
                <span className="px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5" style={{ background: 'var(--accent-wash)', borderColor: 'var(--border)', color: 'var(--accent-primary)' }}>
                  <CheckCircle size={13} /> IoT Gateway
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                  <CheckCircle size={13} /> Smart Locks
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5">
                  <CheckCircle size={13} /> Punching Attendance
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
