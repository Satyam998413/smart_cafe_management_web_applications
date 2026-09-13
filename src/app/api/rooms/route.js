import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeSpace } from '@/lib/serializers.js';
import { roomsRateLimit } from '@/lib/publicRateLimit.js';
import { hasOverlappingBooking } from '@/lib/bookingHelpers.js';

// GET /api/rooms?siteId=&checkIn=&checkOut= — public guest room browsing
// for the hotel booking flow (same "public by design, a guest hasn't
// logged in yet" reasoning as GET /api/spaces/[id]/qr-context). Lists
// bookable rooms at a site with their photos and nightly rate; when
// checkIn/checkOut are both given, each room's `available` flag reflects
// whether it's free for that exact date range (checked against `bookings`),
// so the guest never has to pick an already-taken room only to be rejected
// at checkout.
export async function GET(request) {
  const limited = roomsRateLimit(request);
  if (limited) return limited;

  try {
    const siteId = request.nextUrl.searchParams.get('siteId');
    const checkIn = request.nextUrl.searchParams.get('checkIn');
    const checkOut = request.nextUrl.searchParams.get('checkOut');
    if (!siteId) {
      return NextResponse.json({ message: 'siteId query parameter is required' }, { status: 400 });
    }
    if ((checkIn && !checkOut) || (checkOut && !checkIn)) {
      return NextResponse.json({ message: 'checkIn and checkOut must be provided together' }, { status: 400 });
    }
    if (checkIn && checkOut && !(new Date(checkOut) > new Date(checkIn))) {
      return NextResponse.json({ message: 'checkOut must be after checkIn' }, { status: 400 });
    }

    const { data: rooms, error } = await supabase
      .from('spaces')
      .select('*, space_images(*)')
      .eq('site_id', siteId)
      .eq('kind', 'room')
      .eq('is_bookable', true)
      .order('price_per_night', { ascending: true });
    if (error) throw error;

    const withAvailability = await Promise.all(
      rooms.map(async (room) => {
        const serialized = serializeSpace(room);
        if (!checkIn || !checkOut) return serialized;
        const taken = await hasOverlappingBooking(room.id, checkIn, checkOut);
        return { ...serialized, available: !taken };
      })
    );

    return NextResponse.json(withAvailability);
  } catch (error) {
    logger.error('Failed to list rooms', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
