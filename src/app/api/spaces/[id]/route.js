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
    const { label, number, sortOrder, iotEnabled, isBookable, pricePerNight, description, maxOccupancy } =
      await request.json();
    if (pricePerNight !== undefined && pricePerNight !== null && Number(pricePerNight) < 0) {
      return NextResponse.json({ message: 'pricePerNight must not be negative' }, { status: 400 });
    }

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
    if (pricePerNight !== undefined) updates.price_per_night = pricePerNight;
    if (description !== undefined) updates.description = description;
    if (maxOccupancy !== undefined) updates.max_occupancy = maxOccupancy;

    const { data, error } = await supabase.from('spaces').update(updates).eq('id', id).select('*').single();
    if (error) throw error;

    return NextResponse.json(serializeSpace(data));
  } catch (error) {
    logger.error('Failed to update space', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/spaces/[id] — genuinely missing from the ported API surface
// (spaceController.js never had one, and the plan doc's Phase 2a layout
// builder table only lists GET/POST/PATCH) but the layout builder's tree UI
// needs a delete action, so it's added here in the same thin-handler style.
// Owner only, same org-ownership check as PATCH. Refuses to delete a space
// that still has children — the tree UI deletes leaf-first, so a non-empty
// node reaching this route is a UI bug, not a valid request, and this is
// clearer than either silently cascading or a raw FK-violation 500.
export async function DELETE(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner');
  if (roleError) return roleError;

  try {
    const { id } = await params;

    const { data: existing, error: fetchError } = await supabase
      .from('spaces')
      .select('*, site:sites(org_id)')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing || (auth.orgId && existing.site.org_id !== auth.orgId)) {
      return NextResponse.json({ message: 'Space not found' }, { status: 404 });
    }

    const { data: children, error: childrenError } = await supabase.from('spaces').select('id').eq('parent_space_id', id).limit(1);
    if (childrenError) throw childrenError;
    if (children && children.length > 0) {
      return NextResponse.json({ message: "Delete this space's children first" }, { status: 400 });
    }

    const { error } = await supabase.from('spaces').delete().eq('id', id);
    if (error) {
      // FK violation — e.g. staff still assigned to this space, or orders
      // still reference it. A clearer 409 beats a generic 500.
      if (error.code === '23503') {
        return NextResponse.json({ message: 'This space is still in use and cannot be deleted' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ message: 'Space deleted' });
  } catch (error) {
    logger.error('Failed to delete space', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
