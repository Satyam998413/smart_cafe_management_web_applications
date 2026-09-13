import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeBooking } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth } from '@/lib/auth.js';
import { getIo } from '@/lib/socketServer.js';
import { emitToRooms } from '@/lib/billingHelpers.js';

// POST /api/bookings/[id]/pay/cash — mirrors POST /api/bills/[id]/pay/cash:
// records the choice, does not confirm the booking — see
// /api/bookings/[id]/status for the owner/manager confirming it once cash
// is in hand.
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  const io = getIo();
  try {
    const { id } = await params;
    const { data: booking, error: fetchError } = await scopeToOrg(
      supabase.from('bookings').select('*').eq('id', id),
      auth.orgId
    ).maybeSingle();
    if (fetchError) throw fetchError;
    if (!booking) return NextResponse.json({ message: 'Booking not found' }, { status: 404 });
    if (booking.status !== 'pending_payment') {
      return NextResponse.json({ message: 'This booking is already settled' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('bookings')
      .update({ payment_method: 'cash' })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    const serialized = serializeBooking(updated);
    emitToRooms(io, ['role-manager', 'role-owner'], 'booking_update', serialized);

    return NextResponse.json(serialized);
  } catch (error) {
    logger.error('Failed to record cash payment choice for booking', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
