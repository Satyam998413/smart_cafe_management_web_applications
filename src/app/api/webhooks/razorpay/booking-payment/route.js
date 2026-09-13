import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { isValidWebhookSignature } from '@/lib/razorpayClient.js';
import { getIo } from '@/lib/socketServer.js';
import { markBookingPaid } from '@/lib/bookingHelpers.js';

// POST /api/webhooks/razorpay/booking-payment — mirrors
// /api/webhooks/razorpay/bill-payment exactly: one static dashboard-
// configured URL, routed by razorpay_order_id, public/unauthenticated by
// design (the signature check IS the auth).
export async function POST(request) {
  const io = getIo();
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');
    const isValid = isValidWebhookSignature(rawBody, signature, process.env.RAZORPAY_WEBHOOK_SECRET);
    if (!isValid) {
      logger.warn('Rejected Razorpay booking-payment webhook with an invalid signature');
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

    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id')
      .eq('razorpay_order_id', payment.order_id)
      .eq('status', 'pending_payment')
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!booking) {
      return NextResponse.json({ message: 'No matching pending booking' });
    }

    await markBookingPaid({ bookingId: booking.id, paymentId: payment.id, io });

    return NextResponse.json({ message: 'Booking confirmed' });
  } catch (error) {
    logger.error('Failed to process Razorpay booking-payment webhook', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
