import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { isValidWebhookSignature } from '@/lib/razorpayClient.js';
import { getIo } from '@/lib/socketServer.js';
import { markBillPaid } from '@/lib/billingHelpers.js';

// POST /api/webhooks/razorpay/bill-payment — ported from
// billingController.js's billPaymentWebhook. One static dashboard-configured
// URL, same reasoning as the coin-purchase webhook. Routed by order_id, not
// bill id. Public and unauthenticated by design — signature verification IS
// the auth. See the coin-purchase webhook route for why request.text() is
// used instead of request.json().
export async function POST(request) {
  const io = getIo();
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');
    const isValid = isValidWebhookSignature(rawBody, signature, process.env.RAZORPAY_WEBHOOK_SECRET);
    if (!isValid) {
      logger.warn('Rejected Razorpay bill-payment webhook with an invalid signature');
      return NextResponse.json({ message: 'Invalid signature' }, { status: 400 });
    }

    const body = JSON.parse(rawBody);
    if (body.event !== 'payment.captured') {
      return NextResponse.json({ message: 'Event ignored' });
    }

    const payment = body.payload?.payment?.entity;
    if (!payment?.order_id) {
      return NextResponse.json({ message: 'No order_id on payload' });
    }

    const { data: bill, error: fetchError } = await supabase
      .from('bills')
      .select('id')
      .eq('razorpay_order_id', payment.order_id)
      .eq('status', 'pending')
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!bill) {
      return NextResponse.json({ message: 'No matching pending bill' });
    }

    // Shared with the GET /api/bills/[id] reconciliation path — see
    // markBillPaid's own doc comment for why.
    await markBillPaid({ billId: bill.id, paymentId: payment.id, io });

    return NextResponse.json({ message: 'Bill marked paid' });
  } catch (error) {
    logger.error('Failed to process Razorpay bill-payment webhook', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
