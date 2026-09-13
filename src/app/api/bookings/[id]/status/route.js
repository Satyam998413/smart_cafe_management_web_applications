import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeBooking } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { getIo } from '@/lib/socketServer.js';
import { emitToRooms } from '@/lib/billingHelpers.js';

// Which status a booking may move to from its current one. `confirmed` is
// reached two ways: a cash booking gets confirmed here once staff collects
// payment (mirrors bills' collect-cash), while an online booking is
// confirmed automatically by the Razorpay webhook instead — so
// 'pending_payment' -> 'confirmed' is only valid here when payment_method
// is already 'cash' (checked below, not encoded in this table).
const ALLOWED_TRANSITIONS = {
  pending_payment: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled'],
  checked_in: ['checked_out'],
  checked_out: [],
  cancelled: []
};

// PATCH /api/bookings/[id]/status — Owner/Manager only: confirm a cash
// booking, check a guest in, check them out, or cancel. Guests cannot
// self-cancel through this route (out of scope here — would need its own
// customer-facing cancel policy/refund story).
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  const io = getIo();
  try {
    const { id } = await params;
    const { status } = await request.json();

    const { data: booking, error: fetchError } = await scopeToOrg(
      supabase.from('bookings').select('*').eq('id', id),
      auth.orgId
    ).maybeSingle();
    if (fetchError) throw fetchError;
    if (!booking) return NextResponse.json({ message: 'Booking not found' }, { status: 404 });

    const allowed = ALLOWED_TRANSITIONS[booking.status] || [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { message: `Cannot move a ${booking.status} booking to ${status}` },
        { status: 400 }
      );
    }
    if (status === 'confirmed' && booking.payment_method !== 'cash') {
      return NextResponse.json(
        { message: 'Only a cash booking can be confirmed manually — online bookings confirm via the payment webhook' },
        { status: 400 }
      );
    }

    const updates = { status };
    if (status === 'confirmed') {
      updates.cash_collected_by = auth.userId;
      updates.cash_collected_at = new Date().toISOString();
      updates.paid_at = new Date().toISOString();
    }

    const { data: updated, error } = await supabase.from('bookings').update(updates).eq('id', id).select('*').single();
    if (error) throw error;

    const serialized = serializeBooking(updated);
    emitToRooms(io, ['role-manager', 'role-owner', `user-${updated.customer_id}`], 'booking_update', serialized);

    return NextResponse.json(serialized);
  } catch (error) {
    logger.error('Failed to update booking status', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
