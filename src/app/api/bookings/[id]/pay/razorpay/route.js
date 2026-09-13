import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth } from '@/lib/auth.js';
import { getRazorpayClient } from '@/lib/razorpayClient.js';

// POST /api/bookings/[id]/pay/razorpay — mirrors POST /api/bills/[id]/pay/razorpay
// exactly: creates the Razorpay order for the booking's total, and the
// /api/webhooks/razorpay/booking-payment route is what confirms it.
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const { data: booking, error } = await scopeToOrg(supabase.from('bookings').select('*').eq('id', id), auth.orgId).maybeSingle();
    if (error) throw error;
    if (!booking) return NextResponse.json({ message: 'Booking not found' }, { status: 404 });
    if (booking.status !== 'pending_payment') {
      return NextResponse.json({ message: 'This booking is already settled' }, { status: 400 });
    }

    const amountPaise = Math.round(Number(booking.total_price) * 100);
    const razorpayOrder = await getRazorpayClient().orders.create({
      amount: amountPaise,
      currency: 'INR',
      notes: { bookingId: id }
    });

    const { error: updateError } = await supabase
      .from('bookings')
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
    logger.error('Failed to start booking payment', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
