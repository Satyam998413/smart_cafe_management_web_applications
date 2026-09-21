import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeDevice } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { withOnlineStatus } from '@/lib/deviceStatus.js';

// GET /api/iot-devices?spaceId= — ported from iotDeviceController.js's
// listDevices. Owner or Manager. Devices + their last known state (plan
// Phase 6c). Named iot-devices (not devices) to avoid colliding with the
// existing FCM push-token registry at /api/devices — a different "device"
// concept entirely.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const spaceId = request.nextUrl.searchParams.get('spaceId');
    let query = supabase.from('devices').select('*, deviceState:device_states(state, updated_at)');
    if (spaceId) query = query.eq('space_id', spaceId);
    query = scopeToOrg(query, auth.orgId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(withOnlineStatus(data).map(serializeDevice));
  } catch (error) {
    logger.error('Failed to list IoT devices', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

const MAX_QUANTITY = 50;

// POST /api/iot-devices — ported from iotDeviceController.js's
// registerDevice. Owner only (stricter than the GET's owner-or-manager,
// same as the original router.use(owner,manager) + a second
// requireRole('owner') layered on top just for POST).
//
// `quantity` (default 1) registers that many individual device rows in one
// call — e.g. "5 lamps" creates 5 separate rows named "Lamp #1".."Lamp #5",
// each with its own device_no, not one row with a count on it. device_no is
// reserved as one contiguous block via next_device_no() so concurrent
// registrations for the same org never collide.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager') || requireRole(auth, 'owner');
  if (roleError) return roleError;

  try {
    const { spaceId, name, type, vendor = 'mock', externalDeviceId, capabilities, quantity = 1 } = await request.json();
    if (!spaceId || !name || !type) {
      return NextResponse.json({ message: 'spaceId, name, and type are required' }, { status: 400 });
    }
    const count = Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(Number(quantity)) || 1));

    const { data: startNo, error: counterError } = await supabase.rpc('next_device_no', {
      p_org_id: auth.orgId,
      p_count: count
    });
    if (counterError) throw counterError;

    const rows = Array.from({ length: count }, (_, i) => ({
      space_id: spaceId,
      device_no: startNo + i,
      name: count > 1 ? `${name} #${i + 1}` : name,
      type,
      vendor,
      external_device_id: externalDeviceId || null,
      capabilities: capabilities || [],
      ...(auth.orgId ? { org_id: auth.orgId } : {})
    }));

    const { data, error } = await supabase.from('devices').insert(rows).select('*');
    if (error) throw error;

    const devices = data.map(serializeDevice);
    return NextResponse.json(count > 1 ? devices : devices[0], { status: 201 });
  } catch (error) {
    logger.error('Failed to register IoT device', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
