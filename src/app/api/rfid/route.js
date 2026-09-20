import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';
import { serializeRfidCard } from '@/lib/serializers.js';

const READ_ROLES = ['master_admin', 'technician', 'owner', 'manager'];

// GET /api/rfid?orgId=... — list an org's RFID cards. Read-only here for
// everyone who can reach it; creation is technician/master-admin-only (see
// POST /api/technician/rfid-cards) and assignment updates are owner/manager
// (see PATCH /api/rfid/[id]) — this route never writes.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  if (!auth.isMasterAdmin && !READ_ROLES.includes(auth.userRole)) {
    return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const targetOrgId = searchParams.get('orgId') || auth.orgId;
    if (!targetOrgId) {
      return NextResponse.json({ message: 'orgId is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('rfid_cards')
      // spaces' display column is `label`, not `name` — caught via
      // end-to-end testing (PostgREST error 42703). This exact mistake was
      // already present elsewhere in the codebase (locks/route.js,
      // device-pairing/route.js) before this route existed.
      .select('*, space:spaces(label)')
      .eq('org_id', targetOrgId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return NextResponse.json(data.map(serializeRfidCard));
  } catch (error) {
    logger.error('Failed to list RFID cards', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
