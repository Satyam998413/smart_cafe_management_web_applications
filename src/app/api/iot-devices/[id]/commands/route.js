import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { sendDeviceCommand } from '@/lib/iot/deviceCommands.js';

// POST /api/iot-devices/[id]/commands — ported from iotDeviceController.js's
// sendDeviceCommand. Owner always allowed; Manager only with
// users.permissions.canControlIot granted by the Owner (plan Phase 6c /
// vision doc §7's "Manager: on/off access as granted by the Owner"), fetched
// fresh from the DB each time — same reasoning as the staff password-reset
// route's fresh permission check.
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { capability, value } = await request.json();
    if (!capability || value === undefined) {
      return NextResponse.json({ message: 'capability and value are required' }, { status: 400 });
    }

    const { data: device, error: deviceError } = await scopeToOrg(
      supabase.from('devices').select('*').eq('id', id),
      auth.orgId
    ).maybeSingle();
    if (deviceError) throw deviceError;
    if (!device) return NextResponse.json({ message: 'Device not found' }, { status: 404 });

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

    // device_commands row IS the audit trail (gaps doc §6) — inserted
    // before the adapter call so a command is recorded even if the adapter
    // call itself throws, not just on success. See sendDeviceCommand for
    // the pending->adapter->status->state-sync sequence, shared with the
    // master-switch bulk route.
    const { commandId, status } = await sendDeviceCommand(device, capability, value, auth.userId);

    return NextResponse.json({ commandId, status });
  } catch (error) {
    logger.error('Failed to send IoT device command', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
