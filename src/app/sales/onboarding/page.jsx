'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Plus, Trash2, Tag, Percent, DollarSign, CheckCircle2, ShieldCheck, Building, User, Mail, Lock, MapPin, Receipt } from 'lucide-react';

export default function SalesmanOnboardingPage() {
  const [hardwareItems, setHardwareItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' | 'online'
  const [loading, setLoading] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState(null);

  const [form, setForm] = useState({
    orgName: '',
    premiseType: 'cafe_restaurant',
    contactEmail: '',
    address: '',
    gstin: '',
    themePreset: 'ocean',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: ''
  });

  useEffect(() => {
    fetchHardwareCatalog();
  }, []);

  const fetchHardwareCatalog = async () => {
    try {
      const res = await fetch('/api/admin/hardware-catalog');
      if (res.ok) {
        const data = await res.json();
        setHardwareItems(data);
      }
    } catch (err) {
      console.error('Failed to load catalog:', err);
    }
  };

  const addToCart = (item) => {
    const existing = cart.find((i) => i.id === item.id);
    if (existing) {
      setCart(cart.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCart = (id) => {
    setCart(cart.filter((i) => i.id !== id));
  };

  const updateQuantity = (id, qty) => {
    if (qty <= 0) {
      removeFromCart(id);
    } else {
      setCart(cart.map((i) => (i.id === id ? { ...i, quantity: qty } : i)));
    }
  };

  // Pricing calculations
  const subtotal = cart.reduce((sum, item) => sum + parseFloat(item.unit_price) * item.quantity, 0);

  const applyCoupon = () => {
    if (couponCode.toUpperCase() === 'ONETIME10') {
      setDiscountAmount(subtotal * 0.1);
    } else if (couponCode.toUpperCase() === 'FLAT2000') {
      setDiscountAmount(2000);
    } else {
      setDiscountAmount(0);
    }
  };

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const gstAmount = Math.round(discountedSubtotal * 0.18 * 100) / 100; // 18% GST
  const grandTotal = Math.round((discountedSubtotal + gstAmount) * 100) / 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert('Please add at least one hardware product to the cart.');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/sales/onboard-cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          items: cart,
          couponCode,
          paymentMode
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSubmittedOrder(data);
      }
    } catch (err) {
      console.error('Failed to submit onboarding order:', err);
    } finally {
      setLoading(false);
    }
  };

  if (submittedOrder) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-xl w-full shadow-2xl text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-3xl font-extrabold text-white mb-2">Onboarding & Sale Completed!</h1>
          <p className="text-slate-400 text-sm mb-6">
            Organization <strong className="text-white">{submittedOrder.organization?.name}</strong> created and assigned to Field Technician for Wi-Fi & Bluetooth hardware installation.
          </p>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-left mb-6 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal:</span><span className="text-white font-mono">₹{submittedOrder.summary?.subtotal}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Discount Applied:</span><span className="text-emerald-400 font-mono">-₹{submittedOrder.summary?.discountAmount}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">18% GST:</span><span className="text-sky-400 font-mono">+₹{submittedOrder.summary?.gstAmount}</span></div>
            <div className="flex justify-between pt-2 border-t border-slate-800 text-base font-bold"><span className="text-white">Grand Total:</span><span className="text-emerald-400 font-mono">₹{submittedOrder.summary?.totalAmount}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Payment Mode:</span><span className="text-cyan-400 font-semibold uppercase">{submittedOrder.summary?.paymentMode}</span></div>
          </div>

          <button onClick={() => { setSubmittedOrder(null); setCart([]); }} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 rounded-xl transition-all cursor-pointer">
            Create Next Onboarding Order
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm tracking-wide uppercase">
          <ShoppingBag className="w-5 h-5" /> Sales Executive Portal
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1">
          Tenant Onboarding & Hardware Quote Cart
        </h1>
        <p className="text-slate-400 mt-1 text-sm md:text-base">
          Demo products to client, enter organization GST details, configure hardware packages, apply discount coupons, and finalize payment.
        </p>
      </motion.div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 columns: Org Details & Catalog */}
        <div className="lg:col-span-2 space-y-8">
          {/* Org Basic Details */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-emerald-400" /> Client Premise Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Organization / Premise Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grand Royal Hotel & Cafe"
                  value={form.orgName}
                  onChange={(e) => setForm({ ...form, orgName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Premise Type</label>
                <select
                  value={form.premiseType}
                  onChange={(e) => setForm({ ...form, premiseType: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="cafe_restaurant">Cafe / Restaurant</option>
                  <option value="company_office">Company / Office</option>
                  <option value="hotel">Hotel & Rooms</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Contact Email</label>
                <input
                  type="email"
                  required
                  placeholder="owner@grandroyal.com"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">GSTIN Number (Optional)</label>
                <input
                  type="text"
                  placeholder="29AAAAA0000A1Z5"
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1 font-medium">Premise Address & Layout Notes</label>
              <textarea
                rows="2"
                placeholder="Full address, floor count, corridor layout notes..."
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              ></textarea>
            </div>
          </div>

          {/* Hardware Catalog Items */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-4">Select Hardware Products & Equipment</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hardwareItems.map((item) => (
                <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block mb-1">{item.category.replace('_', ' ')}</span>
                    <h4 className="font-bold text-white text-sm mb-1">{item.name}</h4>
                    <p className="text-xs text-slate-400 mb-3">{item.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <span className="text-lg font-extrabold text-white font-mono">₹{item.unit_price}</span>
                    <button
                      type="button"
                      onClick={() => addToCart(item)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add to Quote
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Cart & Checkout Summary */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl sticky top-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-400" /> Quote Cart & Final Pricing
            </h2>

            {cart.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">Cart is empty. Select hardware items from the left to build quote.</p>
            ) : (
              <div className="space-y-3 mb-6">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs">
                    <div>
                      <span className="font-bold text-white block">{item.name}</span>
                      <span className="text-slate-400">₹{item.unit_price} x {item.quantity}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold cursor-pointer">-</button>
                      <span className="font-bold text-white">{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold cursor-pointer">+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* One-Time Coupon Code */}
            <div className="mb-6">
              <label className="text-xs text-slate-400 block mb-1">One-Time Offer Coupon Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ONETIME10"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
                />
                <button type="button" onClick={applyCoupon} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-xl text-xs font-bold cursor-pointer">
                  Apply
                </button>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 text-xs mb-6">
              <div className="flex justify-between text-slate-400"><span>Subtotal:</span><span className="font-mono text-white">₹{subtotal.toFixed(2)}</span></div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400"><span>Offer Discount:</span><span className="font-mono">-₹{discountAmount.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between text-slate-400"><span>GST (18%):</span><span className="font-mono text-sky-400">+₹{gstAmount.toFixed(2)}</span></div>
              <div className="flex justify-between pt-2 border-t border-slate-800 text-sm font-extrabold text-white">
                <span>Final Price:</span>
                <span className="font-mono text-emerald-400">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Mode Choice */}
            <div className="mb-6">
              <label className="text-xs text-slate-400 block mb-2 font-medium">Payment Collection Mode</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMode('cash')}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    paymentMode === 'cash' ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  Offline / Cash
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('online')}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    paymentMode === 'online' ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  Online Payment
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || cart.length === 0}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Processing Onboarding...' : 'Finalize Sale & Assign Technician'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
