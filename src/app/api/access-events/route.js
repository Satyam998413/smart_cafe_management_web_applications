import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, requireRole } from '@/lib/auth.js';

// GET /api/access-events?userId=  or  ?deviceId= — the audit trail: every
// verification attempt (fingerprint/face/rfid), matched or not, against
// which device, with the lock allow/deny outcome where applicable. This is
// "insert every person's access to a device, success or fail, so I can
// reconstruct who accessed what" — filterable by person (userId) or by
// device/area (deviceId), one history feed serving both questions.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager', 'technician', 'master_admin');
  if (roleError) return roleError;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const deviceId = searchParams.get('deviceId');
    const targetOrgId = searchParams.get('orgId') || auth.orgId;

    let query = supabase
      .from('access_events')
      .select('*, user:users(id, name, email)')
      .eq('org_id', targetOrgId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (userId) query = query.eq('user_id', userId);
    if (deviceId) query = query.eq('device_id', deviceId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('Failed to list access events', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
