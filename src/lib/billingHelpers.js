import supabase from './supabaseClient.js';
import logger from './logger.js';
import { generateAccountingExport } from './accountingExportService.js';
import { serializeBill } from './serializers.js';

// Shared by /api/bills/[id]/collect-cash and
// /api/webhooks/razorpay/bill-payment — ported from
// server/src/controllers/billingController.js's module-level helper.
// Fire-and-forget: same reasoning as lib/orderHelpers.js's un-awaited
// notifyRole/notifyUser calls — a failed accounting export must never fail
// (or even slow down) the payment confirmation response it's triggered by.
export const triggerAccountingExport = (billId) => {
  generateAccountingExport(billId).catch((error) => {
    logger.error('Automatic accounting export failed', { billId, error: error.message });
  });
};

// New (not in the original server/ controller): lets a paid customer's
// client move itself from "waiting for cash collection" to the Rating
// screen in real time, the same way orderHelpers.js's emitToRooms already
// drives order_update. Same signature/convention, kept local to this file
// rather than importing orderHelpers.js's copy — each resource's helpers
// file is self-contained in this codebase (see menuHelpers.js/orderHelpers.js).
export const emitToRooms = (io, rooms, event, payload) => {
  if (!io) return;
  io.to(rooms.filter(Boolean)).emit(event, payload);
};

/**
 * Atomically marks a still-pending bill paid — shared by the Razorpay
 * webhook and the GET /api/bills/[id] / cancel-payment reconciliation
 * paths, so "a payment got confirmed" always goes through exactly one code
 * path regardless of which one noticed it first. The `.eq('status',
 * 'pending')` guard means a loser of that race gets `null` back (already
 * settled), not a duplicate paid_at/accounting export/socket emit.
 */
export const markBillPaid = async ({ billId, paymentId, io }) => {
  const { data: updated, error } = await supabase
    .from('bills')
    .update({ status: 'paid', razorpay_payment_id: paymentId, paid_at: new Date().toISOString() })
    .eq('id', billId)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!updated) return null;

  triggerAccountingExport(updated.id);
  emitToRooms(io, ['role-manager', 'role-owner', `user-${updated.customer_id}`], 'bill_update', serializeBill(updated));
  return updated;
};
