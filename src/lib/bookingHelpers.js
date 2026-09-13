import supabase from './supabaseClient.js';
import { serializeBooking } from './serializers.js';
import { emitToRooms } from './billingHelpers.js';

export const nightsBetween = (checkIn, checkOut) => {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
};

/**
 * A room is unavailable for [checkIn, checkOut) if any non-cancelled
 * booking for it overlaps that range. Standard half-open interval overlap
 * check: two ranges overlap unless one ends before the other starts.
 */
export const hasOverlappingBooking = async (spaceId, checkIn, checkOut, excludeBookingId) => {
  let query = supabase
    .from('bookings')
    .select('id')
    .eq('space_id', spaceId)
    .neq('status', 'cancelled')
    .lt('check_in', checkOut)
    .gt('check_out', checkIn)
    .limit(1);
  if (excludeBookingId) query = query.neq('id', excludeBookingId);
  const { data, error } = await query;
  if (error) throw error;
  return data.length > 0;
};

/**
 * Atomically marks a still-pending_payment booking confirmed — shared by
 * the Razorpay webhook and the GET-style reconciliation path, mirroring
 * billingHelpers.js's markBillPaid for exactly the same race-safety reason:
 * the `.eq('status', 'pending_payment')` guard means whichever caller loses
 * the race gets `null` back instead of double-confirming.
 */
export const markBookingPaid = async ({ bookingId, paymentId, io }) => {
  const { data: updated, error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed', razorpay_payment_id: paymentId, paid_at: new Date().toISOString() })
    .eq('id', bookingId)
    .eq('status', 'pending_payment')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!updated) return null;

  emitToRooms(io, ['role-manager', 'role-owner', `user-${updated.customer_id}`], 'booking_update', serializeBooking(updated));
  return updated;
};
