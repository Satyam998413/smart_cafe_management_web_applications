'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Wrench, CheckCircle2, UserCheck, RefreshCw, Building, DollarSign, Tag, ShieldCheck } from 'lucide-react';

export default function AdminSalesLeadsPage() {
  const [leads, setLeads] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeadsAndTechnicians();
  }, []);

  const fetchLeadsAndTechnicians = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
      const [leadsRes, techsRes] = await Promise.all([
        fetch('/api/admin/sales-leads', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/users?role=technician', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setLeads(leadsData);
      }
      if (techsRes.ok) {
        const techsData = await techsRes.json();
        setTechnicians(techsData);
      }
    } catch (err) {
      console.error('Failed to load sales leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTechnician = async (orderId, technicianId) => {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
      const res = await fetch('/api/admin/sales-leads', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ orderId, technicianId, ticketStatus: 'assigned' })
      });

      if (res.ok) {
        fetchLeadsAndTechnicians();
      }
    } catch (err) {
      console.error('Failed to assign technician:', err);
    }
  };

  return (
    <div style={{ padding: '1.5rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Sales Pipeline & Setup Tickets
        </h1>
      </div>

      {/* Leads Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
          <RefreshCw className="w-8 h-8 animate-spin mb-2" style={{ color: 'var(--accent-primary)' }} />
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="admin-table w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-6 py-4">Client Organization</th>
                  <th className="px-6 py-4">Sales Executive</th>
                  <th className="px-6 py-4">Order Total (inc. GST)</th>
                  <th className="px-6 py-4">Payment</th>
                  <th className="px-6 py-4">Setup Ticket Status</th>
                  <th className="px-6 py-4">Assign Field Technician</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                      No sales onboarding orders submitted yet.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id}>
                      <td className="px-6 py-4 font-bold" style={{ color: 'var(--text-primary)' }}>
                        {lead.org_name}
                        <span className="block text-xs font-normal uppercase" style={{ color: 'var(--text-muted)' }}>{lead.premise_type?.replace('_', ' ')}</span>
                      </td>
                      <td className="px-6 py-4" style={{ color: 'var(--text-secondary)' }}>
                        {lead.salesman?.name || 'Sales Executive'}
                      </td>
                      <td className="px-6 py-4 font-extrabold font-mono" style={{ color: 'var(--accent-primary)' }}>
                        ₹{lead.total_amount}
                      </td>
                      <td className="px-6 py-4">
                        <span className="status-badge" style={{ background: 'var(--accent-wash)', color: 'var(--accent-primary)', textTransform: 'uppercase', fontSize: '0.72rem', fontWeight: 700 }}>
                          {lead.payment_mode}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="status-badge" style={{
                          background: lead.ticket_status === 'accepted' ? 'rgba(16,185,129,0.15)' : lead.ticket_status === 'assigned' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)',
                          color: lead.ticket_status === 'accepted' ? '#10b981' : lead.ticket_status === 'assigned' ? '#6366f1' : '#f59e0b',
                          textTransform: 'uppercase',
                          fontSize: '0.72rem',
                          fontWeight: 700
                        }}>
                          {lead.ticket_status || 'pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={lead.assigned_technician_id || ''}
                          onChange={(e) => handleAssignTechnician(lead.id, e.target.value)}
                          className="field-input px-3 py-1.5 text-xs"
                        >
                          <option value="">-- Assign Technician --</option>
                          {technicians.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
