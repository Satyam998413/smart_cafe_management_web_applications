'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  Search,
  Building2,
  CheckCircle2,
  Clock,
  RefreshCw,
  Percent,
  Receipt,
  User,
  ShieldCheck,
  Eye,
  X
} from 'lucide-react';

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/sales-leads', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to load sales orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.org_name.toLowerCase().includes(search.toLowerCase()) ||
      (order.gstin && order.gstin.toLowerCase().includes(search.toLowerCase())) ||
      order.contact_email.toLowerCase().includes(search.toLowerCase());

    const ticketStatus = order.support_tickets?.status || 'open';
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'pending') return matchesSearch && (ticketStatus === 'open' || ticketStatus === 'assigned');
    if (statusFilter === 'in_progress') return matchesSearch && (ticketStatus === 'accepted' || ticketStatus === 'need_visiting' || ticketStatus === 'visited_pending');
    if (statusFilter === 'resolved') return matchesSearch && (ticketStatus === 'resolved' || ticketStatus === 'closed');
    return matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Package className="text-emerald-400" /> Onboarding Sales Orders & Setup Pipeline
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            Track client premise setup status, hardware line items, 18% GST invoices, and assigned field technicians.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          className="self-start md:self-auto flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-200 transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Orders</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by org name, GSTIN, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {['all', 'pending', 'in_progress', 'resolved'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap capitalize transition ${
                statusFilter === st
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-2" />
            <p className="text-sm">Loading onboarding orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-1" />
            <p className="text-sm font-semibold text-slate-300">No sales orders found matching criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Client Premise Details</th>
                  <th className="px-6 py-4">Premise Type</th>
                  <th className="px-6 py-4">Invoice Subtotal</th>
                  <th className="px-6 py-4">18% GST Amount</th>
                  <th className="px-6 py-4">Total Amount Paid</th>
                  <th className="px-6 py-4">Technician Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredOrders.map((order) => {
                  const ticketStatus = order.support_tickets?.status || 'open';

                  return (
                    <tr key={order.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-white">{order.org_name}</div>
                        <div className="text-xs text-slate-400">{order.contact_email}</div>
                        {order.gstin && <div className="text-xs text-emerald-400 font-mono mt-0.5">GSTIN: {order.gstin}</div>}
                      </td>
                      <td className="px-6 py-4 text-xs capitalize text-slate-300">
                        {order.premise_type ? order.premise_type.replace('_', ' / ') : 'Cafe / Restaurant'}
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-300">
                        ₹{parseFloat(order.subtotal || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-teal-400">
                        +₹{parseFloat(order.gst_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 font-extrabold text-emerald-400">
                        ₹{parseFloat(order.total_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        {order.payment_mode && <span className="block text-xs font-normal text-slate-400 capitalize">Mode: {order.payment_mode}</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border capitalize ${
                            ticketStatus === 'resolved' || ticketStatus === 'closed'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : ticketStatus === 'accepted' || ticketStatus === 'need_visiting' || ticketStatus === 'visited_pending'
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          <Clock size={12} /> {ticketStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
                        >
                          <Eye size={14} /> View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Receipt size={22} />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-white">{selectedOrder.org_name}</h3>
                <p className="text-xs text-slate-400">Order Ref #{selectedOrder.id?.substring(0, 8)}</p>
              </div>
            </div>

            {/* Premise Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block">Contact Email</span>
                <span className="font-semibold text-slate-200">{selectedOrder.contact_email}</span>
              </div>
              <div>
                <span className="text-slate-500 block">GSTIN</span>
                <span className="font-mono text-emerald-400 font-semibold">{selectedOrder.gstin || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Premise Type</span>
                <span className="font-semibold text-slate-200 capitalize">{selectedOrder.premise_type ? selectedOrder.premise_type.replace('_', ' ') : 'Cafe'}</span>
              </div>
            </div>

            {/* Hardware Items Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Package size={14} className="text-emerald-400" /> Ordered Hardware Line Items
              </h4>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 divide-y divide-slate-800/80 space-y-2">
                {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-slate-200">{item.name}</div>
                        <div className="text-slate-500 font-mono">Model: {item.model_number || 'STD-HW'}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400">{item.quantity} x ₹{item.unit_price}</span>
                        <div className="font-bold text-white">₹{(item.quantity * item.unit_price).toFixed(2)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500 py-2">Standard hardware package included</div>
                )}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Hardware Subtotal</span>
                <span className="font-semibold text-slate-200">₹{parseFloat(selectedOrder.subtotal || 0).toFixed(2)}</span>
              </div>
              {selectedOrder.discount_amount > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Discount ({selectedOrder.coupon_code || 'PROMO'})</span>
                  <span>-₹{parseFloat(selectedOrder.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-teal-400">
                <span>Applicable 18% GST</span>
                <span>+₹{parseFloat(selectedOrder.gst_amount || 0).toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-emerald-500/30 flex justify-between text-sm font-extrabold text-white">
                <span>Grand Total (Paid via {selectedOrder.payment_mode})</span>
                <span className="text-emerald-400 text-base">₹{parseFloat(selectedOrder.total_amount || 0).toFixed(2)}</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
