import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeDevice } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';

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

    return NextResponse.json(data.map(serializeDevice));
  } catch (error) {
    logger.error('Failed to list IoT devices', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/iot-devices — ported from iotDeviceController.js's
// registerDevice. Owner only (stricter than the GET's owner-or-manager,
// same as the original router.use(owner,manager) + a second
// requireRole('owner') layered on top just for POST).
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager') || requireRole(auth, 'owner');
  if (roleError) return roleError;

  try {
    const { spaceId, name, type, vendor = 'mock', externalDeviceId, capabilities } = await request.json();
    if (!spaceId || !name || !type) {
      return NextResponse.json({ message: 'spaceId, name, and type are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('devices')
      .insert({
        space_id: spaceId,
        name,
        type,
        vendor,
        external_device_id: externalDeviceId || null,
        capabilities: capabilities || [],
        ...(auth.orgId ? { org_id: auth.orgId } : {})
      })
      .select('*')
      .single();
    if (error) throw error;

    return NextResponse.json(serializeDevice(data), { status: 201 });
  } catch (error) {
    logger.error('Failed to register IoT device', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
