import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeBooking } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth } from '@/lib/auth.js';
import { getIo } from '@/lib/socketServer.js';
import { markBookingPaid } from '@/lib/bookingHelpers.js';
import { fetchCapturedPayment } from '@/lib/razorpayClient.js';

// GET /api/bookings/[id] — mirrors GET /api/bills/[id] exactly: reads one
// booking, actively reconciling it against Razorpay first if it's still
// pending_payment on the online path (the webhook has no delivery
// guarantee — this is the client's fallback after returning from
// checkout, or on resume while a payment was left pending). A customer may
// only fetch their own booking; owner/manager may fetch any booking in
// their org.
export async function GET(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  const io = getIo();
  try {
    const { id } = await params;
    const isStaff = ['owner', 'manager'].includes(auth.userRole);

    let query = supabase.from('bookings').select('*, space:spaces(*), site:sites(id, name)').eq('id', id);
    query = isStaff ? scopeToOrg(query, auth.orgId) : query.eq('customer_id', auth.userId);
    const { data: booking, error } = await query.maybeSingle();
    if (error) throw error;
    if (!booking) return NextResponse.json({ message: 'Booking not found' }, { status: 404 });

    if (booking.status === 'pending_payment' && booking.payment_method === 'online' && booking.razorpay_order_id) {
      try {
        const payment = await fetchCapturedPayment(booking.razorpay_order_id);
        if (payment) {
          const updated = await markBookingPaid({ bookingId: booking.id, paymentId: payment.id, io });
          if (updated) return NextResponse.json(serializeBooking(updated));
        }
      } catch (reconcileError) {
        // Best-effort, same as GET /api/bills/[id]: a Razorpay-side outage
        // returns the booking's last-known state rather than a 500.
        logger.error('Booking payment reconciliation failed', { bookingId: id, error: reconcileError.message });
      }
    }

    return NextResponse.json(serializeBooking(booking));
  } catch (error) {
    logger.error('Failed to fetch booking', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
