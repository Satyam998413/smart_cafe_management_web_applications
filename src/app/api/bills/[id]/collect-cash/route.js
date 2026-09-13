import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeBill } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { getIo } from '@/lib/socketServer.js';
import { triggerAccountingExport, emitToRooms } from '@/lib/billingHelpers.js';

// POST /api/bills/[id]/collect-cash — ported from billingController.js's
// collectCash. Owner or Manager. Confirms cash physically collected. The
// WHERE clause (status='pending' AND payment_method='cash') is the whole
// guard — same atomic-conditional-UPDATE pattern as the orders claim route,
// so a double-confirm affects 0 rows the second time.
/**
 * @swagger
 * /api/bills/{id}/collect-cash:
 *   post:
 *     tags: [Bills]
 *     summary: Confirm cash has been physically collected for a bill
 *     description: Owner or Manager only. Marks a pending cash-payment-method bill as paid. Safe to call twice - the second call matches zero rows and 404s instead of double-processing.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Cash collection confirmed, bill marked paid
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Bill' }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       403:
 *         description: Caller is not an Owner or Manager
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: No pending cash bill found with that id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  const io = getIo();
  try {
    const { id } = await params;
    const now = new Date().toISOString();

    const { data: bill, error } = await scopeToOrg(
      supabase
        .from('bills')
        .update({ status: 'paid', cash_collected_by: auth.userId, cash_collected_at: now, paid_at: now })
        .eq('id', id)
        .eq('status', 'pending')
        .eq('payment_method', 'cash'),
      auth.orgId
    )
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!bill) {
      return NextResponse.json({ message: 'No pending cash bill found with that id' }, { status: 404 });
    }

    triggerAccountingExport(bill.id);

    const serialized = serializeBill(bill);
    // Lets the paying customer's client move itself from "waiting for cash
    // collection" to the Rating screen in real time — same room convention
    // as orderController's order_update (role rooms + the customer's own).
    emitToRooms(io, ['role-manager', 'role-owner', `user-${bill.customer_id}`], 'bill_update', serialized);

    return NextResponse.json(serialized);
  } catch (error) {
    logger.error('Failed to confirm cash collection', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
