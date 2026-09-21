'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Boxes,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  QrCode,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  Sparkles,
  Users,
  Grid,
  RefreshCw,
  X
} from 'lucide-react';

export default function WarehousePage() {
  const [rooms, setRooms] = useState([]);
  const [racks, setRacks] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('all');
  const [loading, setLoading] = useState(true);

  // Figma-like Interactive Canvas State
  const [zoomScale, setZoomScale] = useState(1);
  const [focusedRack, setFocusedRack] = useState(null); // Double-clicked rack sub-layout focus

  // Modals state
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [showAddRackModal, setShowAddRackModal] = useState(false);
  const [selectedBoxModal, setSelectedBoxModal] = useState(null);
  const [showStickerModal, setShowStickerModal] = useState(null); // Box/Item for QR sticker print
  const [showPickListModal, setShowPickListModal] = useState(false);

  // Forms
  const [roomForm, setRoomForm] = useState({ name: '', code: '', description: '' });
  const [rackForm, setRackForm] = useState({ room_id: '', name: '', rack_code: '', total_rows: 4, total_cols: 4 });
  const [boxForm, setBoxForm] = useState({ item_id: '', current_quantity: '', unit: 'counts', batch_id: '' });
  const [pickListForm, setPickListForm] = useState({ cook_id: '', notes: '', selectedItems: [] });
  const [cooks, setCooks] = useState([]);

  useEffect(() => {
    fetchWarehouseData();
    fetchStaffCooks();
  }, []);

  const fetchWarehouseData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/warehouse?view=overview', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
        setRacks(data.racks || []);
        setInventoryItems(data.inventoryItems || []);
        if (data.rooms?.length > 0 && selectedRoomId === 'all') {
          setSelectedRoomId('all');
        }
      }
    } catch (err) {
      console.error('Failed to load warehouse data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffCooks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCooks((data || []).filter((u) => u.role === 'cook' || u.role === 'manager'));
      }
    } catch (err) {
      console.error('Failed to load staff list:', err);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/warehouse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'create_room', ...roomForm })
      });
      if (res.ok) {
        setShowAddRoomModal(false);
        setRoomForm({ name: '', code: '', description: '' });
        fetchWarehouseData();
      }
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  const handleCreateRack = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/warehouse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'create_rack', ...rackForm })
      });
      if (res.ok) {
        setShowAddRackModal(false);
        setRackForm({ room_id: '', name: '', rack_code: '', total_rows: 4, total_cols: 4 });
        fetchWarehouseData();
      }
    } catch (err) {
      console.error('Failed to create rack:', err);
    }
  };

  const handleUpdateBoxItem = async (e) => {
    e.preventDefault();
    if (!selectedBoxModal) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/warehouse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'update_box_item',
          box_id: selectedBoxModal.id,
          ...boxForm
        })
      });
      if (res.ok) {
        setSelectedBoxModal(null);
        setBoxForm({ item_id: '', current_quantity: '', unit: 'counts', batch_id: '' });
        fetchWarehouseData();
      }
    } catch (err) {
      console.error('Failed to update box:', err);
    }
  };

  const handleCreatePickList = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/warehouse/pick-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          assigned_cook_id: pickListForm.cook_id,
          notes: pickListForm.notes,
          items: pickListForm.selectedItems
        })
      });
      if (res.ok) {
        setShowPickListModal(false);
        setPickListForm({ cook_id: '', notes: '', selectedItems: [] });
        alert('Pick List successfully generated and assigned to cook!');
      }
    } catch (err) {
      console.error('Failed to create pick list:', err);
    }
  };

  // Zoom handlers
  const zoomIn = () => setZoomScale((prev) => Math.min(prev + 0.2, 2.0));
  const zoomOut = () => setZoomScale((prev) => Math.max(prev - 0.2, 0.6));
  const resetZoom = () => {
    setZoomScale(1);
    setFocusedRack(null);
  };

  const filteredRacks = selectedRoomId === 'all'
    ? racks
    : racks.filter((r) => r.room_id === selectedRoomId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <Boxes className="w-5 h-5" /> Warehouse Management & Grid Layout Engine
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1">
            Warehouse Interactive Layout & Box Racks
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage storage rooms, interactive rack grid layouts, color-coded box statuses, QR sticker generation & cook pick lists.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAddRoomModal(true)}
            className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 font-medium px-4 py-2.5 rounded-xl text-sm transition-all cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4 text-emerald-400" /> Create Room
          </button>
          <button
            onClick={() => setShowAddRackModal(true)}
            className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 font-medium px-4 py-2.5 rounded-xl text-sm transition-all cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4 text-emerald-400" /> Create Rack Grid
          </button>
          <button
            onClick={() => setShowPickListModal(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-sm shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <QrCode className="w-4 h-4" /> Assign Pick List to Cook
          </button>
        </div>
      </motion.div>

      {/* Toolbar: Room Filter, Zoom Canvas Controls, Legend */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/70 border border-slate-800 rounded-2xl p-4 mb-6 backdrop-blur-md">
        {/* Room Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedRoomId('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedRoomId === 'all'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            All Storage Rooms ({rooms.length})
          </button>
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => setSelectedRoomId(room.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedRoomId === room.id
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {room.name} ({room.code})
            </button>
          ))}
        </div>

        {/* Figma-like Zoom Controls & Legend */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-slate-800 pt-3 md:pt-0">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs font-medium border-r border-slate-800 pr-4">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-3 h-3 rounded-full bg-slate-700 border border-slate-500 inline-block" /> Empty (Gray)
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm shadow-emerald-500/50" /> Stocked (Green)
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block shadow-sm shadow-amber-500/50" /> Expiring/Expired (Orange)
            </span>
          </div>

          {/* Zoom Canvas Controls */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
            <button
              onClick={zoomOut}
              title="Zoom Out"
              className="p-2 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-emerald-400 font-bold px-2 min-w-[50px] text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              title="Zoom In"
              className="p-2 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={resetZoom}
              title="Reset View"
              className="p-2 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Figma-like Layout Canvas */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
        </div>
      ) : filteredRacks.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8">
          <Boxes className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-white mb-1">No Storage Racks Found</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
            Create your first storage room and add rack grids (e.g. 4x4 matrix) to start managing unique box IDs.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setShowAddRoomModal(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition-all"
            >
              + Add Storage Room
            </button>
            <button
              onClick={() => setShowAddRackModal(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-sm transition-all"
            >
              + Add Rack Grid
            </button>
          </div>
        </div>
      ) : (
        <div className="relative overflow-auto bg-slate-950/80 border border-slate-800 rounded-3xl p-6 min-h-[600px] shadow-2xl">
          {/* Focused Sub-Layout Header (when double clicked) */}
          {focusedRack && (
            <div className="flex items-center justify-between bg-emerald-950/60 border border-emerald-500/30 p-4 rounded-2xl mb-6">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    Sub-Layout Zoom Mode: {focusedRack.name} ({focusedRack.rack_code})
                  </h3>
                  <p className="text-slate-400 text-xs">
                    Double-click box to inspect details or click Reset to view all racks.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFocusedRack(null)}
                className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold text-xs px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                Exit Focus Mode
              </button>
            </div>
          )}

          {/* Canvas Scale Container */}
          <div
            style={{ transform: `scale(${zoomScale})`, transformOrigin: 'top left' }}
            className="transition-transform duration-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8 p-2"
          >
            {(focusedRack ? [focusedRack] : filteredRacks).map((rack) => {
              const boxes = rack.boxes || [];
              const colLabels = rack.col_labels || ['A', 'B', 'C', 'D'];
              const rowLabels = rack.row_labels || ['1', '2', '3', '4'];

              return (
                <div
                  key={rack.id}
                  onDoubleClick={() => setFocusedRack(rack)}
                  className={`bg-slate-900/90 border rounded-3xl p-5 shadow-2xl transition-all ${
                    focusedRack?.id === rack.id
                      ? 'border-emerald-500/80 ring-2 ring-emerald-500/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Rack Header */}
                  <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                          {rack.rack_code}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {rack.room?.name || 'Main Room'}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-white mt-1">{rack.name}</h2>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                      {rack.total_rows}x{rack.total_cols} Grid
                    </span>
                  </div>

                  {/* Grid Matrix with Column Headers & Row Headers */}
                  <div className="overflow-x-auto">
                    {/* Top Column Header Names (A, B, C...) */}
                    <div className="flex items-center mb-2 pl-8">
                      {colLabels.map((cName, idx) => (
                        <div key={idx} className="flex-1 text-center font-mono font-bold text-xs text-slate-400 uppercase">
                          {cName}
                        </div>
                      ))}
                    </div>

                    {/* Rows Matrix */}
                    {rowLabels.map((rName, rIdx) => {
                      const rowNum = rIdx + 1;
                      return (
                        <div key={rIdx} className="flex items-center mb-2 gap-2">
                          {/* Row Number Header (1, 2, 3...) */}
                          <div className="w-6 text-center font-mono font-bold text-xs text-slate-400">
                            {rName}
                          </div>

                          {/* Columns in Row */}
                          <div className="flex-1 grid grid-cols-4 gap-2" style={{ gridTemplateColumns: `repeat(${colLabels.length}, minmax(0, 1fr))` }}>
                            {colLabels.map((cName, cIdx) => {
                              const colNum = cIdx + 1;
                              const box = boxes.find((b) => b.row_index === rowNum && b.col_index === colNum);
                              const boxId = box?.box_unique_id || `${rack.rack_code}-${rName}${cName}`;
                              const status = box?.status_color || 'gray';
                              const qty = box?.current_quantity || 0;
                              const unit = box?.unit || 'counts';
                              const itemName = box?.item?.name || null;

                              // Color styling
                              let statusBg = 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-600';
                              if (status === 'green') {
                                statusBg = 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 shadow-md shadow-emerald-500/10 hover:border-emerald-400';
                              } else if (status === 'orange') {
                                statusBg = 'bg-amber-950/40 border-amber-500/60 text-amber-200 shadow-md shadow-amber-500/10 hover:border-amber-400';
                              }

                              return (
                                <button
                                  key={cIdx}
                                  onClick={() => {
                                    if (box) {
                                      setSelectedBoxModal(box);
                                      setBoxForm({
                                        item_id: box.item_id || '',
                                        current_quantity: box.current_quantity || '',
                                        unit: box.unit || 'counts',
                                        batch_id: box.batch_id || ''
                                      });
                                    }
                                  }}
                                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[95px] relative group ${statusBg}`}
                                >
                                  {/* Slot Position Label */}
                                  <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                                    <span className="opacity-75">{rName}{cName}</span>
                                    {status === 'orange' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />}
                                    {status === 'green' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                                  </div>

                                  {/* Item Details inside Box */}
                                  <div className="my-1">
                                    {itemName ? (
                                      <span className="text-xs font-bold text-white block line-clamp-1 leading-snug">
                                        {itemName}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-500 italic block">
                                        Empty Slot
                                      </span>
                                    )}
                                  </div>

                                  {/* Quantity & Sticker Button */}
                                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-800/40">
                                    <span className="font-semibold font-mono">
                                      {qty} {unit}
                                    </span>
                                    {box && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowStickerModal({ box, rack });
                                        }}
                                        title="Print QR Sticker"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-slate-900 border border-slate-700 hover:bg-emerald-500 hover:text-slate-950 text-slate-200 rounded-md"
                                      >
                                        <Printer className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: Create Storage Room */}
      {showAddRoomModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" /> Create Storage Room
            </h2>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Room Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Kitchen Cold Storage / Dry Pantry"
                  value={roomForm.name}
                  onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Room Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RM-01"
                  value={roomForm.code}
                  onChange={(e) => setRoomForm({ ...roomForm, code: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Description (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="Storage details..."
                  value={roomForm.description}
                  onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setShowAddRoomModal(false)} className="px-4 py-2 rounded-xl text-slate-400 text-sm">Cancel</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-500/20">Save Room</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Rack Grid */}
      {showAddRackModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Grid className="w-5 h-5 text-emerald-400" /> Create Storage Rack Grid
            </h2>
            <form onSubmit={handleCreateRack} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Storage Room</label>
                <select
                  required
                  value={rackForm.room_id}
                  onChange={(e) => setRackForm({ ...rackForm, room_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select Room</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Rack Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dairy Rack 1"
                    value={rackForm.name}
                    onChange={(e) => setRackForm({ ...rackForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Rack Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RACK-01"
                    value={rackForm.rack_code}
                    onChange={(e) => setRackForm({ ...rackForm, rack_code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Rows (1, 2, 3...)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={rackForm.total_rows}
                    onChange={(e) => setRackForm({ ...rackForm, total_rows: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Columns (A, B, C...)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={rackForm.total_cols}
                    onChange={(e) => setRackForm({ ...rackForm, total_cols: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setShowAddRackModal(false)} className="px-4 py-2 rounded-xl text-slate-400 text-sm">Cancel</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-500/20">Generate Rack Grid</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Assign / Edit Box Slot Content */}
      {selectedBoxModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {selectedBoxModal.box_unique_id}
                </span>
                <h2 className="text-lg font-bold text-white mt-1">
                  Slot Position: Row {selectedBoxModal.row_label}, Col {selectedBoxModal.col_label}
                </h2>
              </div>
              <button onClick={() => setSelectedBoxModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateBoxItem} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Select Inventory Item</label>
                <select
                  value={boxForm.item_id}
                  onChange={(e) => setBoxForm({ ...boxForm, item_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">(Empty / Remove Item)</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={boxForm.current_quantity}
                    onChange={(e) => setBoxForm({ ...boxForm, current_quantity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Unit Parameter</label>
                  <select
                    value={boxForm.unit}
                    onChange={(e) => setBoxForm({ ...boxForm, unit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="counts">counts (Default)</option>
                    <option value="kg">kg</option>
                    <option value="liters">liters</option>
                    <option value="packets">packets</option>
                    <option value="boxes">boxes</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setSelectedBoxModal(null)} className="px-4 py-2 rounded-xl text-slate-400 text-sm">Cancel</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-500/20">Save Slot Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: QR Code Sticker Generator & Print Dialog */}
      {showStickerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">QR Sticker Preview</span>
              <button onClick={() => setShowStickerModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Sticker Box */}
            <div id="printable-qr-sticker" className="bg-white text-slate-950 p-6 rounded-2xl shadow-xl border-2 border-slate-300 mx-auto max-w-[260px]">
              <h4 className="font-extrabold text-sm uppercase tracking-wide border-b-2 border-slate-900 pb-1 mb-2">
                SMART WAREHOUSE
              </h4>
              <p className="text-xs font-bold leading-tight mb-2">
                {showStickerModal.box?.item?.name || 'Box Slot'}
              </p>

              {/* QR Image */}
              <div className="bg-white p-2 border border-slate-300 rounded-xl my-2 inline-block">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(showStickerModal.box?.box_unique_id)}`}
                  alt="QR Sticker"
                  className="w-32 h-32 mx-auto"
                />
              </div>

              <p className="text-[11px] font-mono font-extrabold uppercase mt-1">
                {showStickerModal.box?.box_unique_id}
              </p>
              <div className="flex justify-between text-[10px] font-bold mt-2 pt-2 border-t border-slate-300">
                <span>Rack: {showStickerModal.rack?.rack_code}</span>
                <span>Qty: {showStickerModal.box?.current_quantity} {showStickerModal.box?.unit}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowStickerModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <Printer className="w-4 h-4" /> Print Sticker
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Assign Pick List to Cook */}
      {showPickListModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" /> Assign Cook Pick List
            </h2>
            <form onSubmit={handleCreatePickList} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Select Cook Staff</label>
                <select
                  required
                  value={pickListForm.cook_id}
                  onChange={(e) => setPickListForm({ ...pickListForm, cook_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select Cook / Chef</option>
                  {cooks.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-2">Select Items to Pick from Warehouse Boxes</label>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 border border-slate-800 p-2 rounded-xl">
                  {racks.flatMap((r) => r.boxes || []).filter((b) => b.item_id && b.current_quantity > 0).map((box) => {
                    const isSelected = pickListForm.selectedItems.some((i) => i.box_id === box.id);
                    return (
                      <div
                        key={box.id}
                        onClick={() => {
                          if (isSelected) {
                            setPickListForm({
                              ...pickListForm,
                              selectedItems: pickListForm.selectedItems.filter((i) => i.box_id !== box.id)
                            });
                          } else {
                            setPickListForm({
                              ...pickListForm,
                              selectedItems: [
                                ...pickListForm.selectedItems,
                                {
                                  box_id: box.id,
                                  item_id: box.item_id,
                                  rack_id: box.rack_id,
                                  required_quantity: 1,
                                  unit: box.unit
                                }
                              ]
                            });
                          }
                        }}
                        className={`p-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                          isSelected ? 'bg-emerald-950/60 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <span className="font-bold block">{box.item?.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Box: {box.box_unique_id}</span>
                        </div>
                        <span className="font-mono font-semibold text-emerald-400">
                          Available: {box.current_quantity} {box.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Notes / Instructions</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Pick 2 kg coffee beans for morning shift"
                  value={pickListForm.notes}
                  onChange={(e) => setPickListForm({ ...pickListForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setShowPickListModal(false)} className="px-4 py-2 rounded-xl text-slate-400 text-sm">Cancel</button>
                <button
                  type="submit"
                  disabled={pickListForm.selectedItems.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  Generate & Assign Pick List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
