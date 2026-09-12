import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeBill } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth } from '@/lib/auth.js';
import { getIo } from '@/lib/socketServer.js';
import { markBillPaid } from '@/lib/billingHelpers.js';
import { fetchCapturedPayment } from '@/lib/razorpayClient.js';

// GET /api/bills/[id] — reads a bill, actively reconciling it against
// Razorpay first if it's still pending on the online path. There is no
// delivery guarantee on the payment webhook (Razorpay retries its own
// webhook calls, but they can be delayed by minutes, or never arrive at all
// if this deployment's webhook URL is briefly unreachable/misconfigured) —
// this is the client's fallback to actively ask "did my payment actually
// go through?" (e.g. right after returning from checkout, or on app
// resume/login while a payment was left pending) instead of only ever
// passively waiting on the bill_update socket event.
export async function GET(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  const io = getIo();
  try {
    const { id } = await params;
    const { data: bill, error } = await scopeToOrg(supabase.from('bills').select('*').eq('id', id), auth.orgId).maybeSingle();
    if (error) throw error;
    if (!bill) return NextResponse.json({ message: 'Bill not found' }, { status: 404 });

    if (bill.status === 'pending' && bill.payment_method === 'online' && bill.razorpay_order_id) {
      try {
        const payment = await fetchCapturedPayment(bill.razorpay_order_id);
        if (payment) {
          const updated = await markBillPaid({ billId: bill.id, paymentId: payment.id, io });
          if (updated) return NextResponse.json(serializeBill(updated));
        }
      } catch (reconcileError) {
        // Best-effort: a Razorpay-side outage returns the bill's last-known
        // (pending) state rather than a 500, so callers can still see
        // *something* instead of the reconciliation attempt failing the
        // whole request.
        logger.error('Payment reconciliation failed', { billId: id, error: reconcileError.message });
      }
    }

    return NextResponse.json(serializeBill(bill));
  } catch (error) {
    logger.error('Failed to fetch bill', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
