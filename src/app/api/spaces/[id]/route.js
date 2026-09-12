import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeSpace } from '@/lib/serializers.js';
import { requireAuth, requireRole } from '@/lib/auth.js';

// PATCH /api/spaces/[id] — ported from spaceController.js's updateSpace.
// Rename/reorder/toggle IoT on an existing node. Owner only.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner');
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { label, number, sortOrder, iotEnabled, isBookable } = await request.json();

    const { data: existing, error: fetchError } = await supabase
      .from('spaces')
      .select('*, site:sites(org_id)')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing || (auth.orgId && existing.site.org_id !== auth.orgId)) {
      return NextResponse.json({ message: 'Space not found' }, { status: 404 });
    }

    const updates = {};
    if (label !== undefined) updates.label = label;
    if (number !== undefined) updates.number = number;
    if (sortOrder !== undefined) updates.sort_order = sortOrder;
    if (iotEnabled !== undefined) updates.iot_enabled = iotEnabled;
    if (isBookable !== undefined) updates.is_bookable = isBookable;

    const { data, error } = await supabase.from('spaces').update(updates).eq('id', id).select('*').single();
    if (error) throw error;

    return NextResponse.json(serializeSpace(data));
  } catch (error) {
    logger.error('Failed to update space', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
