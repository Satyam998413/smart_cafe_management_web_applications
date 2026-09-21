import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { withOnlineStatus } from '@/lib/deviceStatus.js';

// GET/POST /api/punching-devices — the registry for punching_devices rows
// (RFID readers, thumbprint scanners, face-recognition cams, hybrid
// biometric terminals). Deliberately a separate noun-shaped path from
// /api/punching, which is exclusively the attendance-*punch* webhook+list
// (a verb, not a registry) — punching_devices never had its own creation
// route before this, unlike smart_locks (registered via /api/locks) and
// devices (registered via /api/iot-devices).
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const targetOrgId = searchParams.get('orgId') || auth.orgId;
    if (!targetOrgId) {
      return NextResponse.json({ message: 'orgId required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('punching_devices')
      .select('*')
      .eq('org_id', targetOrgId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return NextResponse.json(withOnlineStatus(data || []));
  } catch (error) {
    logger.error('Failed to list punching devices', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/punching-devices — registers a new punching device. Mirrors
// /api/locks's registration shape (same org resolution, same
// .select('*').single() insert, same 23505-on-duplicate handling as
// staff/route.js's email/phone check, here on serial_number).
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager', 'technician', 'master_admin');
  if (roleError) return roleError;

  try {
    const body = await request.json();
    const { device_name, device_type, site_id, ip_address, serial_number } = body;
    const targetOrgId = body.org_id || auth.orgId;

    if (!device_name || !device_type || !targetOrgId) {
      return NextResponse.json({ message: 'device_name, device_type, and org_id are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('punching_devices')
      .insert({
        org_id: targetOrgId,
        site_id: site_id || null,
        device_name,
        device_type,
        ip_address: ip_address || null,
        serial_number: serial_number || null
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ message: 'That serial number is already registered.' }, { status: 409 });
      }
      throw error;
    }

    logger.info('Registered punching device', { deviceId: data.id, orgId: targetOrgId, actor: auth.userId });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    logger.error('Failed to register punching device', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
