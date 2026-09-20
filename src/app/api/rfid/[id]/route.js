import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';
import { serializeRfidCard } from '@/lib/serializers.js';

const ASSIGN_ROLES = ['owner', 'manager'];
const DELETE_ROLES = ['technician'];
const STATUS_VALUES = ['active', 'blocked', 'lost'];

// PATCH /api/rfid/[id] — Owner/Manager assigns a card an existing
// technician already registered: which staff member holds it
// (assignedToUserId), which room it opens (spaceId), its access level, an
// expiry, or its status (active/blocked/lost). Deliberately can't touch
// org_id/card_number — a card's identity and organization are fixed at
// creation time (POST /api/technician/rfid-cards), never editable here.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  if (!auth.isMasterAdmin && !ASSIGN_ROLES.includes(auth.userRole)) {
    return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { assignedToUserId, spaceId, accessLevel, validUntil, status } = body;

    if (status !== undefined && !STATUS_VALUES.includes(status)) {
      return NextResponse.json({ message: `status must be one of: ${STATUS_VALUES.join(', ')}` }, { status: 400 });
    }

    const updateData = {};
    if (assignedToUserId !== undefined) updateData.assigned_to_user_id = assignedToUserId || null;
    if (spaceId !== undefined) updateData.space_id = spaceId || null;
    if (accessLevel !== undefined) updateData.access_level = accessLevel;
    if (validUntil !== undefined) updateData.valid_until = validUntil || null;
    if (status !== undefined) updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: 'Nothing to update' }, { status: 400 });
    }

    // Owner/manager may only touch cards within their own org — scope the
    // update itself rather than trusting the id alone.
    let query = supabase.from('rfid_cards').update(updateData).eq('id', id);
    if (!auth.isMasterAdmin) query = query.eq('org_id', auth.orgId);

    const { data, error } = await query.select('*, space:spaces(label)').single();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ message: 'RFID card not found' }, { status: 404 });
    }

    logger.info('Updated RFID card assignment', { cardId: id, updatedBy: auth.userId });
    return NextResponse.json(serializeRfidCard(data));
  } catch (error) {
    logger.error('Failed to update RFID card', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/rfid/[id] — technician or master admin only, same as
// creation. An owner/manager can reassign or block a card but never
// permanently remove its record.
export async function DELETE(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  if (!auth.isMasterAdmin && !DELETE_ROLES.includes(auth.userRole)) {
    return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { error } = await supabase.from('rfid_cards').delete().eq('id', id);
    if (error) throw error;

    logger.info('Deleted RFID card', { cardId: id, deletedBy: auth.userId });
    return NextResponse.json({ success: true, message: 'RFID card deleted' });
  } catch (error) {
    logger.error('Failed to delete RFID card', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
