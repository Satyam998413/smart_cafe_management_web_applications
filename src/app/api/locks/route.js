import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';

// GET /api/locks?orgId=...
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const targetOrgId = searchParams.get('orgId') || auth.orgId;

    if (!targetOrgId) {
      return NextResponse.json({ message: 'orgId required' }, { status: 400 });
    }

    // spaces' display column is `label`, not `name` — this was 500ing for
    // any org with a smart lock actually assigned to a space, caught via
    // end-to-end testing of the (structurally identical) RFID cards route.
    const { data, error } = await supabase
      .from('smart_locks')
      .select('*, space:spaces(label)')
      .eq('org_id', targetOrgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('Failed to list smart locks', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/locks (Register new smart lock or dispatch remote lock/unlock action)
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { action, lockId, lock_name, space_id, lock_type, mac_address, ip_address } = body;

    // Dispatch unlock/lock remote command
    if (action === 'toggle' || action === 'unlock' || action === 'lock') {
      if (!lockId) {
        return NextResponse.json({ message: 'lockId required for action' }, { status: 400 });
      }

      const isLockedTarget = action === 'lock' ? true : action === 'unlock' ? false : null;

      let updatePayload = { last_heartbeat: new Date().toISOString() };
      if (isLockedTarget !== null) {
        updatePayload.is_locked = isLockedTarget;
      } else {
        // Toggle current lock state
        const { data: currentLock } = await supabase.from('smart_locks').select('is_locked').eq('id', lockId).single();
        updatePayload.is_locked = !currentLock?.is_locked;
      }

      const { data, error } = await supabase
        .from('smart_locks')
        .update(updatePayload)
        .eq('id', lockId)
        .select('*')
        .single();

      if (error) throw error;

      logger.info('Smart lock remote action executed', { lockId, action, isLocked: data.is_locked, actor: auth.userId });
      return NextResponse.json({ message: `Lock ${data.is_locked ? 'Locked' : 'Unlocked'} successfully`, lock: data });
    }

    // Register new smart lock
    const targetOrgId = body.org_id || auth.orgId;
    if (!lock_name || !targetOrgId) {
      return NextResponse.json({ message: 'lock_name and org_id are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('smart_locks')
      .insert({
        org_id: targetOrgId,
        space_id: space_id || null,
        lock_name,
        lock_type: lock_type || 'rfid_wifi',
        mac_address: mac_address || null,
        ip_address: ip_address || null,
        is_locked: true,
        battery_level: 100,
        last_heartbeat: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    logger.error('Failed smart lock operation', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
