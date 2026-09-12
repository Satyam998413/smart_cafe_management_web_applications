import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { resolveAdapter } from '@/lib/iot/adapterResolver.js';

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
    // call itself throws, not just on success.
    const { data: command, error: commandError } = await supabase
      .from('device_commands')
      .insert({ device_id: id, capability, value, issued_by: auth.userId, status: 'pending' })
      .select('*')
      .single();
    if (commandError) throw commandError;

    let finalStatus = 'sent';
    try {
      const result = await resolveAdapter(device.vendor).sendCommand(device, capability, value);
      finalStatus = result?.status === 'acked' ? 'acked' : 'sent';
    } catch (adapterError) {
      finalStatus = 'failed';
      logger.error('IoT adapter command failed', { deviceId: id, error: adapterError.message });
    }

    const { error: statusUpdateError } = await supabase.from('device_commands').update({ status: finalStatus }).eq('id', command.id);
    if (statusUpdateError) throw statusUpdateError;

    if (finalStatus === 'acked') {
      const { data: existingState } = await supabase.from('device_states').select('state').eq('device_id', id).maybeSingle();
      const mergedState = { ...(existingState?.state || {}), [capability]: value };
      const { error: stateError } = await supabase
        .from('device_states')
        .upsert({ device_id: id, state: mergedState, updated_at: new Date().toISOString() }, { onConflict: 'device_id' });
      if (stateError) throw stateError;
    }

    return NextResponse.json({ commandId: command.id, status: finalStatus });
  } catch (error) {
    logger.error('Failed to send IoT device command', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
