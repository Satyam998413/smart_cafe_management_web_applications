import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';

// GET /api/services-control?orgId=...
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const targetOrgId = searchParams.get('orgId') || auth.orgId;

    if (!targetOrgId) {
      return NextResponse.json({ message: 'orgId parameter or user org context required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('organization_services')
      .select('*')
      .eq('org_id', targetOrgId)
      .maybeSingle();

    if (error) throw error;

    // Return default enabled flags if row doesn't exist yet
    const services = data || {
      org_id: targetOrgId,
      iot_enabled: true,
      inventory_enabled: true,
      billing_connector_enabled: true,
      smart_locks_enabled: true,
      punching_system_enabled: true
    };

    return NextResponse.json(services);
  } catch (error) {
    logger.error('Failed to get organization services', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/services-control
export async function PATCH(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  const allowedRoles = ['master_admin', 'technician', 'owner'];
  if (!auth.isMasterAdmin && !allowedRoles.includes(auth.userRole)) {
    return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const targetOrgId = body.orgId || auth.orgId;

    if (!targetOrgId) {
      return NextResponse.json({ message: 'orgId is required' }, { status: 400 });
    }

    const updateData = {
      org_id: targetOrgId,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId
    };

    if (typeof body.iot_enabled === 'boolean') updateData.iot_enabled = body.iot_enabled;
    if (typeof body.inventory_enabled === 'boolean') updateData.inventory_enabled = body.inventory_enabled;
    if (typeof body.billing_connector_enabled === 'boolean') updateData.billing_connector_enabled = body.billing_connector_enabled;
    if (typeof body.smart_locks_enabled === 'boolean') updateData.smart_locks_enabled = body.smart_locks_enabled;
    if (typeof body.punching_system_enabled === 'boolean') updateData.punching_system_enabled = body.punching_system_enabled;

    const { data, error } = await supabase
      .from('organization_services')
      .upsert(updateData, { onConflict: 'org_id' })
      .select('*')
      .single();

    if (error) throw error;

    logger.info('Updated organization services toggles', { orgId: targetOrgId, updatedBy: auth.userId });
    return NextResponse.json(data);
  } catch (error) {
    logger.error('Failed to update organization services', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
