import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { sendDeviceCommand, isOnOffCapability } from '@/lib/iot/deviceCommands.js';

// POST /api/iot-devices/master-switch — the MCB-style bulk toggle. Body is
// { spaceId?, value }: with spaceId, only that space's devices toggle (the
// per-space "main area" switch, independent — never cascades into nested
// child spaces); without spaceId, every device in the caller's org toggles
// (the one whole-organization master switch). Same auth gate as the
// single-device commands route. Devices with no on/off-shaped capability
// are skipped, not errored — a sensor-only device has nothing to toggle.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const { spaceId, value } = await request.json();
    if (value === undefined) {
      return NextResponse.json({ message: 'value is required' }, { status: 400 });
    }

    if (auth.userRole === 'manager') {
      const { data: actor, error: actorError } = await supabase
        .from('users')
        .select('permissions')
        .eq('id', auth.userId)
        .maybeSingle();
      if (actorError) throw actorError;
      if (!actor?.permissions?.canControlIot) {
        return NextResponse.json({ message: 'IoT control has not been granted to you by the Owner' }, { status: 403 });
      }
    }

    let query = scopeToOrg(supabase.from('devices').select('*'), auth.orgId);
    if (spaceId) query = query.eq('space_id', spaceId);
    const { data: devices, error: devicesError } = await query;
    if (devicesError) throw devicesError;

    let toggled = 0;
    let skipped = 0;
    for (const device of devices) {
      const capability = (device.capabilities || []).find(isOnOffCapability);
      if (!capability) {
        skipped += 1;
        continue;
      }
      await sendDeviceCommand(device, capability, value, auth.userId);
      toggled += 1;
    }

    return NextResponse.json({ toggled, skipped });
  } catch (error) {
    logger.error('Failed to run IoT master switch', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
