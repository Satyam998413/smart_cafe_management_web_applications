import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';
import { serializeRfidCard } from '@/lib/serializers.js';

const ALLOWED_ROLES = ['master_admin', 'technician'];

// POST /api/technician/rfid-cards — the ONLY way an RFID card gets created.
// Technician-only (or master admin): the technician reads a physical card
// through a paired RFID-reader punching_device and this creates the
// org-linked record for it, unassigned (assigned_to_user_id stays null,
// access_level 'unassigned') — an Owner/Manager decides who or which room
// it's for afterward via PATCH /api/rfid/[id]. Deliberately excludes
// owner/manager: they can update a card's assignment but never mint one.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  if (!auth.isMasterAdmin && !ALLOWED_ROLES.includes(auth.userRole)) {
    return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const orgId = (body.orgId || '').trim();
    const cardNumber = (body.cardNumber || '').trim();
    const readerDeviceId = body.readerDeviceId || null;

    if (!orgId || !cardNumber) {
      return NextResponse.json({ message: 'orgId and cardNumber are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('rfid_cards')
      .insert([
        {
          org_id: orgId,
          card_number: cardNumber,
          assigned_to_user_id: null,
          status: 'active',
          access_level: 'unassigned',
          created_by: auth.userId,
          reader_device_id: readerDeviceId
        }
      ])
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ message: 'This card is already registered for this organization.' }, { status: 409 });
      }
      throw error;
    }

    logger.info('Technician registered an RFID card', { orgId, cardId: data.id, technicianId: auth.userId });
    return NextResponse.json(serializeRfidCard(data), { status: 201 });
  } catch (error) {
    logger.error('Failed to register RFID card', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
