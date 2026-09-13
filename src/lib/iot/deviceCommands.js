import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { resolveAdapter } from './adapterResolver.js';

// A capability name is treated as "the on/off one" purely by this naming
// heuristic — the server (like the adapter) treats every capability as an
// opaque string, so this is a shared display/targeting convention, not a
// schema contract. Both the client (device row rendering) and the server
// (master-switch route) import this so they never drift on what counts.
export const isOnOffCapability = (name) => /^(on_off|on|off|power|switch)$/i.test(name);

// Extracted from what used to be inlined in
// src/app/api/iot-devices/[id]/commands/route.js — records a pending
// device_commands row, calls the device's vendor adapter, updates the
// command's final status, and (only on ack) upserts device_states. Shared
// by the single-device commands route and the master-switch bulk route so
// this pending->adapter->status->state-sync sequence exists in one place.
export async function sendDeviceCommand(device, capability, value, issuedBy) {
  const { data: command, error: commandError } = await supabase
    .from('device_commands')
    .insert({ device_id: device.id, capability, value, issued_by: issuedBy, status: 'pending' })
    .select('*')
    .single();
  if (commandError) throw commandError;

  let finalStatus = 'sent';
  try {
    const result = await resolveAdapter(device.vendor).sendCommand(device, capability, value);
    finalStatus = result?.status === 'acked' ? 'acked' : 'sent';
  } catch (adapterError) {
    finalStatus = 'failed';
    logger.error('IoT adapter command failed', { deviceId: device.id, error: adapterError.message });
  }

  const { error: statusUpdateError } = await supabase.from('device_commands').update({ status: finalStatus }).eq('id', command.id);
  if (statusUpdateError) throw statusUpdateError;

  if (finalStatus === 'acked') {
    const { data: existingState } = await supabase.from('device_states').select('state').eq('device_id', device.id).maybeSingle();
    const mergedState = { ...(existingState?.state || {}), [capability]: value };
    const { error: stateError } = await supabase
      .from('device_states')
      .upsert({ device_id: device.id, state: mergedState, updated_at: new Date().toISOString() }, { onConflict: 'device_id' });
    if (stateError) throw stateError;
  }

  return { commandId: command.id, status: finalStatus };
}
