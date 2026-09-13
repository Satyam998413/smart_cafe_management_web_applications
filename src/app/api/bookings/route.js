import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeBooking } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth } from '@/lib/auth.js';
import { nightsBetween, hasOverlappingBooking } from '@/lib/bookingHelpers.js';

// POST /api/bookings — a customer reserves a room for a date range.
// Created in `pending_payment`; becomes `confirmed` once
// POST /api/bookings/[id]/pay/razorpay|cash completes (mirrors bills'
// generate -> pay two-step). `nightlyRate`/`totalPrice` are snapshotted
// from the room's current price at booking time — a later price change by
// the owner must never retroactively reprice an existing booking.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { spaceId, checkIn, checkOut, numGuests, specialRequests } = await request.json();
    if (!spaceId || !checkIn || !checkOut) {
      return NextResponse.json({ message: 'spaceId, checkIn, and checkOut are required' }, { status: 400 });
    }
    if (!(new Date(checkOut) > new Date(checkIn))) {
      return NextResponse.json({ message: 'checkOut must be after checkIn' }, { status: 400 });
    }

    const { data: room, error: roomError } = await supabase
      .from('spaces')
      .select('id, kind, is_bookable, price_per_night, max_occupancy, site:sites(id, org_id)')
      .eq('id', spaceId)
      .maybeSingle();
    if (roomError) throw roomError;
    if (!room || room.kind !== 'room' || !room.is_bookable) {
      return NextResponse.json({ message: 'Room not found' }, { status: 404 });
    }
    if (room.price_per_night == null) {
      return NextResponse.json({ message: 'This room has no nightly rate set yet' }, { status: 400 });
    }
    if (room.max_occupancy && numGuests > room.max_occupancy) {
      return NextResponse.json({ message: `This room sleeps at most ${room.max_occupancy} guest(s)` }, { status: 400 });
    }
    if (await hasOverlappingBooking(spaceId, checkIn, checkOut)) {
      return NextResponse.json({ message: 'This room is already booked for those dates' }, { status: 409 });
    }

    const nights = nightsBetween(checkIn, checkOut);
    const nightlyRate = Number(room.price_per_night);
    const totalPrice = Math.round(nightlyRate * nights * 100) / 100;

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        org_id: room.site.org_id,
        site_id: room.site.id,
        space_id: spaceId,
        customer_id: auth.userId,
        check_in: checkIn,
        check_out: checkOut,
        num_guests: numGuests || 1,
        nightly_rate: nightlyRate,
        total_price: totalPrice,
        special_requests: specialRequests || null
      })
      .select('*')
      .single();
    if (error) throw error;

    return NextResponse.json(serializeBooking(booking), { status: 201 });
  } catch (error) {
    logger.error('Failed to create booking', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// GET /api/bookings — a customer sees their own bookings; Owner/Manager see
// every booking in their org, optionally filtered by status.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const isStaff = ['owner', 'manager'].includes(auth.userRole);
    const status = request.nextUrl.searchParams.get('status');

    let query = supabase.from('bookings').select('*, space:spaces(*), site:sites(id, name)').order('check_in', { ascending: true });
    query = isStaff ? scopeToOrg(query, auth.orgId) : query.eq('customer_id', auth.userId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data.map(serializeBooking));
  } catch (error) {
    logger.error('Failed to list bookings', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
