'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Cpu, Lock, CreditCard, Fingerprint, Plus, RefreshCw, Eye, Edit3, Trash2, ShieldCheck, Image as ImageIcon, ChevronLeft, ChevronRight, Upload, X, Check } from 'lucide-react';

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
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    category: 'iot_controller',
    model_number: '',
    unit_price: '',
    stock_quantity: '',
    description: '',
    images: ['']
  });
  const [selectedFileBlobs, setSelectedFileBlobs] = useState([]);

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

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      category: 'iot_controller',
      model_number: '',
      unit_price: '',
      stock_quantity: '',
      description: '',
      images: ['']
    });
    setSelectedFileBlobs([]);
    setShowModal(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    const itemImages = Array.isArray(item.images) && item.images.length > 0 ? item.images : [item.imageUrl || item.image_url || ''];
    setFormData({
      name: item.name || '',
      category: item.category || 'iot_controller',
      model_number: item.modelNumber || item.model_number || '',
      unit_price: item.unitPrice || item.unit_price || '',
      stock_quantity: item.stockQuantity || item.stock_quantity || '',
      description: item.description || '',
      images: itemImages
    });
    setSelectedFileBlobs([]);
    setShowModal(true);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const remainingSlots = 5 - formData.images.filter(Boolean).length;
      const filesToTake = files.slice(0, remainingSlots > 0 ? remainingSlots : 5);
      setSelectedFileBlobs((prev) => [...prev, ...filesToTake].slice(0, 5));
    }
  };

  const handleRemoveFileBlob = (index) => {
    setSelectedFileBlobs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddImageUrl = () => {
    if (formData.images.length < 5) {
      setFormData({ ...formData, images: [...formData.images, ''] });
    }
  };

  const handleRemoveImageUrl = (index) => {
    if (formData.images.length > 1) {
      setFormData({ ...formData, images: formData.images.filter((_, i) => i !== index) });
    }
  };

  const handleImageUrlChange = (index, value) => {
    const updated = [...formData.images];
    updated[index] = value;
    setFormData({ ...formData, images: updated });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
    let validImages = formData.images.map((img) => img.trim()).filter(Boolean);

    try {
      setUploadingFiles(true);
      let targetId = editingItem ? editingItem.id : null;

      if (!editingItem) {
        const createRes = await fetch('/api/admin/hardware-catalog', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: formData.name,
            category: formData.category,
            model_number: formData.model_number,
            unit_price: formData.unit_price,
            stock_quantity: formData.stock_quantity,
            description: formData.description,
            images: validImages.length > 0 ? validImages : ['https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop'],
            image_url: validImages[0] || 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop'
          })
        });

        if (!createRes.ok) {
          const err = await createRes.json();
          alert(err.message || 'Failed to create item');
          setUploadingFiles(false);
          return;
        }

        const newCreatedItem = await createRes.json();
        targetId = newCreatedItem.id;
      }

      if (selectedFileBlobs.length > 0 && targetId) {
        const uploadForm = new FormData();
        uploadForm.append('hardwareId', targetId);
        uploadForm.append('imageUrls', JSON.stringify(validImages));
        selectedFileBlobs.forEach((file) => {
          uploadForm.append('files', file);
        });

        await fetch('/api/admin/hardware-catalog/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: uploadForm
        });
      } else if (editingItem) {
        const updateRes = await fetch(`/api/admin/hardware-catalog/${editingItem.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: formData.name,
            category: formData.category,
            model_number: formData.model_number,
            unit_price: formData.unit_price,
            stock_quantity: formData.stock_quantity,
            description: formData.description,
            images: validImages,
            image_url: validImages[0]
          })
        });

        if (!updateRes.ok) {
          const err = await updateRes.json();
          alert(err.message || 'Failed to update item');
          setUploadingFiles(false);
          return;
        }
      }

      setShowModal(false);
      fetchCatalog();
    } catch (err) {
      console.error('Error saving equipment:', err);
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleDeleteItem = async (id) => {
    const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/hardware-catalog/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setDeleteConfirmId(null);
        fetchCatalog();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to delete hardware item');
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  return (
    <div style={{ padding: '1.5rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Action Header Bar */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Hardware Marketplace
        </h1>

        <button
          onClick={handleOpenAddModal}
          className="btn-orange flex items-center gap-2 font-medium px-5 py-2.5 rounded-xl shadow-lg cursor-pointer"
        >
          <Plus className="w-5 h-5" /> Add New Equipment
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition cursor-pointer whitespace-nowrap"
              style={{
                background: isActive ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border)'
              }}
            >
              <Icon className="w-4 h-4" />
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
          <RefreshCw className="w-8 h-8 animate-spin mb-3" style={{ color: 'var(--accent-primary)' }} />
          <p>Fetching hardware catalog...</p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {items.length === 0 ? (
              <div className="col-span-full text-center py-16 glass-card">
                <Cpu className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>No Hardware Items Found</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Add your first equipment or controller board to populate the catalog.</p>
              </div>
            ) : (
              items.map((item) => (
                <HardwareCard
                  key={item.id}
                  item={item}
                  onEdit={() => handleOpenEditModal(item)}
                  onDelete={() => setDeleteConfirmId(item.id)}
                />
              ))
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Add / Edit Item Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {editingItem ? 'Edit Hardware Equipment' : 'Add Equipment to Catalog'}
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>Upload image files directly or paste URLs (1 to 5 images per equipment item)</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Equipment Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 4-Channel Wi-Fi Relay Switchboard"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="field-input w-full text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="field-input w-full text-sm"
                  >
                    <option value="iot_controller">IoT Controller</option>
                    <option value="smart_lock">Smart Lock</option>
                    <option value="rfid_card">RFID Card</option>
                    <option value="punching_device">Punching Scanner</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Model Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="ESP32-RELAY-V2"
                    value={formData.model_number}
                    onChange={(e) => setFormData({ ...formData, model_number: e.target.value })}
                    className="field-input w-full text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Unit Price (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="2499"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                    className="field-input w-full text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Stock Quantity *</label>
                  <input
                    type="number"
                    required
                    placeholder="50"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    className="field-input w-full text-sm font-mono"
                  />
                </div>
              </div>

              {/* Direct Image Upload Section */}
              <div className="space-y-3 p-3.5 rounded-xl" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)' }}>
                <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--accent-primary)' }}>
                  <Upload size={14} /> Direct Image Upload (1 to 5 Photos)
                </label>

                <div className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer relative" style={{ borderColor: 'var(--border)' }}>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <ImageIcon className="w-8 h-8 mx-auto mb-1.5" style={{ color: 'var(--accent-primary)' }} />
                  <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                    Click or drag image files here to upload directly
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Supports JPG, PNG, WEBP (stored in bucket <code style={{ color: 'var(--accent-primary)' }}>hardware/&#123;id&#125;/images</code>)
                  </p>
                </div>

                {selectedFileBlobs.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedFileBlobs.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono" style={{ background: 'var(--accent-wash)', color: 'var(--accent-primary)', border: '1px solid var(--border)' }}>
                        <Check size={12} />
                        <span className="truncate max-w-[120px]">{file.name}</span>
                        <button type="button" onClick={() => handleRemoveFileBlob(idx)} className="hover:text-rose-400">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 space-y-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>Or paste image URLs directly:</span>
                    {formData.images.length < 5 && (
                      <button
                        type="button"
                        onClick={handleAddImageUrl}
                        className="text-xs font-semibold flex items-center gap-1"
                        style={{ color: 'var(--accent-primary)' }}
                      >
                        <Plus size={13} /> Add URL Slot
                      </button>
                    )}
                  </div>

                  {formData.images.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="url"
                        placeholder={`Image URL #${idx + 1}`}
                        value={url}
                        onChange={(e) => handleImageUrlChange(idx, e.target.value)}
                        className="field-input flex-1 py-1.5 text-xs font-mono"
                      />
                      {formData.images.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveImageUrl(idx)}
                          className="p-1.5 text-rose-400 bg-rose-500/10 rounded-lg"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Description</label>
                <textarea
                  rows="3"
                  placeholder="Hardware specifications, relay channels, and installation notes..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="field-input w-full text-sm"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-700 text-slate-300"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={uploadingFiles}
                  className="btn-orange px-5 py-2 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {uploadingFiles && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {editingItem ? 'Update Equipment' : 'Save Equipment'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-6 w-full max-w-sm shadow-2xl text-center">
            <Trash2 className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Delete Equipment?</h3>
            <p className="text-xs mb-6" style={{ color: 'var(--text-secondary)' }}>Are you sure you want to remove this hardware catalog item? This action cannot be undone.</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteItem(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30"
              >
                Confirm Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function HardwareCard({ item, onEdit, onDelete }) {
  const images = Array.isArray(item.images) && item.images.length > 0 ? item.images : [item.imageUrl || item.image_url || 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop'];
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const nextImage = (e) => {
    e.stopPropagation();
    setActiveImageIdx((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e) => {
    e.stopPropagation();
    setActiveImageIdx((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      className="glass-card p-5 flex flex-col justify-between shadow-xl transition duration-300"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="status-badge" style={{ background: 'var(--accent-wash)', color: 'var(--accent-primary)', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 700 }}>
            {item.category?.replace('_', ' ')}
          </span>
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            Model: {item.modelNumber || item.model_number}
          </span>
        </div>

        <div className="relative w-full h-44 rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)' }}>
          <img
            src={images[activeImageIdx]}
            alt={item.name}
            className="w-full h-full object-cover transition-all duration-300"
          />

          {images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-950/70 text-white hover:bg-slate-900 opacity-80 hover:opacity-100 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-950/70 text-white hover:bg-slate-900 opacity-80 hover:opacity-100 transition"
              >
                <ChevronRight size={16} />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-950/80 px-2 py-0.5 rounded-full">
                {images.map((_, i) => (
                  <span
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setActiveImageIdx(i); }}
                    className={`w-1.5 h-1.5 rounded-full cursor-pointer ${i === activeImageIdx ? 'bg-orange-400' : 'bg-slate-600'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <h3 className="text-lg font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>{item.name}</h3>
        <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {item.description || 'High quality Wi-Fi enabled hardware component engineered for Smart Cafe & Premises.'}
        </p>
      </div>

      <div className="space-y-3 pt-3">
        <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <div>
            <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>Unit Price</span>
            <span className="text-xl font-extrabold" style={{ color: 'var(--accent-primary)' }}>₹{item.unitPrice || item.unit_price}</span>
          </div>

          <div className="text-right">
            <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>Stock</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${(item.stockQuantity || item.stock_quantity) > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {(item.stockQuantity || item.stock_quantity) > 0 ? `${item.stockQuantity || item.stock_quantity} units` : 'Out of Stock'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <Link
            href={`/admin/marketplace/${item.id}`}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--accent-wash)', color: 'var(--accent-primary)' }}
          >
            <Eye size={14} /> Details
          </Link>

          <button
            type="button"
            onClick={onEdit}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-semibold border border-slate-700 text-slate-300"
          >
            <Edit3 size={14} /> Edit
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-400"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </motion.div>
  );
}
