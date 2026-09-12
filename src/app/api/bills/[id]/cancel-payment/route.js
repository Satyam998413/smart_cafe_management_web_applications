import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeBill } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth } from '@/lib/auth.js';
import { getIo } from '@/lib/socketServer.js';
import { markBillPaid } from '@/lib/billingHelpers.js';
import { fetchCapturedPayment } from '@/lib/razorpayClient.js';

// POST /api/bills/[id]/cancel-payment — the client's explicit "give up"
// call after its own retry loop (see flutter_app's BillingCubit) has
// exhausted its attempts at GET /api/bills/[id] with no confirmed payment.
//
// This does NOT cancel the bill itself or touch its linked orders — the
// bills.status column has no 'cancelled' value in the current schema
// (adding one needs a migration this environment has no credentials to
// apply against the live database), and there is no product reason to make
// a customer lose their order over one failed payment attempt anyway.
// Instead this resets payment_method/razorpay_order_id back to null,
// returning the bill to its original "awaiting a payment method choice"
// state — the exact same bill can immediately be retried with Cash or a
// fresh Online attempt.
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  const io = getIo();
  try {
    const { id } = await params;
    const { data: bill, error } = await scopeToOrg(supabase.from('bills').select('*').eq('id', id), auth.orgId).maybeSingle();
    if (error) throw error;
    if (!bill) return NextResponse.json({ message: 'Bill not found' }, { status: 404 });
    if (bill.status !== 'pending') {
      return NextResponse.json({ message: 'This bill is already settled' }, { status: 400 });
    }

    // One last check before giving up — don't cancel a payment that
    // actually just succeeded (e.g. the client's retries and the payment
    // landing raced each other).
    if (bill.payment_method === 'online' && bill.razorpay_order_id) {
      try {
        const payment = await fetchCapturedPayment(bill.razorpay_order_id);
        if (payment) {
          const updated = await markBillPaid({ billId: bill.id, paymentId: payment.id, io });
          if (updated) return NextResponse.json(serializeBill(updated));
        }
      } catch (reconcileError) {
        logger.error('Final reconciliation before cancel-payment failed', { billId: id, error: reconcileError.message });
      }
    }

    const { data: reset, error: resetError } = await supabase
      .from('bills')
      .update({ payment_method: null, razorpay_order_id: null })
      .eq('id', id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();
    if (resetError) throw resetError;
    if (!reset) {
      return NextResponse.json({ message: 'This bill is already settled' }, { status: 400 });
    }

    return NextResponse.json(serializeBill(reset));
  } catch (error) {
    logger.error('Failed to cancel payment attempt', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
