import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeDeliveryRider } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';

// GET /api/delivery/riders — ported from deliveryController.js's
// listRiders. Owner or Manager. Lists my org's delivery riders.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const { data, error } = await scopeToOrg(
      supabase.from('delivery_riders').select('*').order('created_at', { ascending: false }),
      auth.orgId
    );
    if (error) throw error;
    return NextResponse.json(data.map(serializeDeliveryRider));
  } catch (error) {
    logger.error('Failed to list delivery riders', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/delivery/riders — ported from deliveryController.js's
// createRider. Owner or Manager.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const { name, phone, userId } = await request.json();
    if (!name) {
      return NextResponse.json({ message: 'name is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('delivery_riders')
      .insert({ name, phone: phone || null, user_id: userId || null, ...(auth.orgId ? { org_id: auth.orgId } : {}) })
      .select('*')
      .single();
    if (error) throw error;

    return NextResponse.json(serializeDeliveryRider(data), { status: 201 });
  } catch (error) {
    logger.error('Failed to create delivery rider', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
