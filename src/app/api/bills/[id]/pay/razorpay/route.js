import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth } from '@/lib/auth.js';
import { getRazorpayClient } from '@/lib/razorpayClient.js';

// POST /api/bills/[id]/pay/razorpay — ported from billingController.js's
// payWithRazorpay. Creates the Razorpay order for this bill's (possibly
// coupon-discounted) total; the /api/webhooks/razorpay/bill-payment route
// is what actually marks it paid once Razorpay confirms.
/**
 * @swagger
 * /api/bills/{id}/pay/razorpay:
 *   post:
 *     tags: [Bills]
 *     summary: Create a Razorpay order for a pending bill
 *     description: Creates the Razorpay order for the bill (possibly coupon-discounted) total and returns the details the client checkout widget needs. The bill is only marked paid once the /api/webhooks/razorpay/bill-payment webhook confirms payment. Requires a bearer token.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Razorpay order created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 razorpayOrderId: { type: string }
 *                 amount: { type: integer, description: 'Amount in paise' }
 *                 currency: { type: string, example: INR }
 *                 keyId: { type: string }
 *       400:
 *         description: Bill is already settled
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Bill not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const { data: bill, error } = await scopeToOrg(supabase.from('bills').select('*').eq('id', id), auth.orgId).maybeSingle();
    if (error) throw error;
    if (!bill) return NextResponse.json({ message: 'Bill not found' }, { status: 404 });
    if (bill.status !== 'pending') {
      return NextResponse.json({ message: 'This bill is already settled' }, { status: 400 });
    }

    const amountPaise = Math.round(Number(bill.total_amount) * 100);
    const razorpayOrder = await getRazorpayClient().orders.create({
      amount: amountPaise,
      currency: 'INR',
      notes: { billId: id }
    });

    const { error: updateError } = await supabase
      .from('bills')
      .update({ razorpay_order_id: razorpayOrder.id, payment_method: 'online' })
      .eq('id', id);
    if (updateError) throw updateError;

    return NextResponse.json({
      razorpayOrderId: razorpayOrder.id,
      amount: amountPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    logger.error('Failed to start bill payment', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
