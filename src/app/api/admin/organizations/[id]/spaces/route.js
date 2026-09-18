import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeSpace } from '@/lib/serializers.js';
import { assertSiteInOrg } from '@/lib/spaceHelpers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';

// GET /api/admin/organizations/[id]/spaces?siteId= — read-only visibility
// into a tenant's floors/halls/tables/rooms/galleries/canteens for Master
// Admin. siteId is required and must belong to this org (assertSiteInOrg,
// the same defense-in-depth check the owner-facing /api/spaces uses) —
// otherwise Master Admin could pull one org's spaces by guessing another
// org's siteId in the query string.
export async function GET(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json({ message: 'siteId query parameter is required' }, { status: 400 });
    }
    if (!(await assertSiteInOrg(siteId, id))) {
      return NextResponse.json({ message: 'Site not found in this organization' }, { status: 404 });
    }

    const { data, error } = await supabase.from('spaces').select('*').eq('site_id', siteId).order('sort_order', { ascending: true });
    if (error) throw error;

    return NextResponse.json(data.map(serializeSpace));
  } catch (error) {
    logger.error('Failed to list organization spaces (admin)', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/admin/organizations/[id]/spaces — Master Admin creates space
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const body = await request.json();
    const { siteId, parentSpaceId, kind, label, number, length, width, isBookable, pricePerNight, maxOccupancy, description } = body;

    if (!siteId || !kind || !label) {
      return NextResponse.json({ message: 'siteId, kind, and label are required' }, { status: 400 });
    }
    if (!(await assertSiteInOrg(siteId, id))) {
      return NextResponse.json({ message: 'Site not found in this organization' }, { status: 404 });
    }

    const { data: space, error } = await supabase
      .from('spaces')
      .insert({
        site_id: siteId,
        parent_space_id: parentSpaceId || null,
        kind,
        label,
        number: number || null,
        length: length ? parseFloat(length) : null,
        width: width ? parseFloat(width) : null,
        is_bookable: !!isBookable,
        price_per_night: pricePerNight ? parseFloat(pricePerNight) : null,
        max_occupancy: maxOccupancy ? parseInt(maxOccupancy) : null,
        description: description || null
      })
      .select('*')
      .single();

    if (error) throw error;

    logger.info('Master Admin created space', { spaceId: space.id, orgId: id });
    return NextResponse.json(serializeSpace(space), { status: 201 });
  } catch (error) {
    logger.error('Failed to create space (admin)', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/admin/organizations/[id]/spaces — Master Admin updates space
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const body = await request.json();
    const { spaceId, label, number, kind, length, width, isBookable, pricePerNight, maxOccupancy } = body;

    if (!spaceId) {
      return NextResponse.json({ message: 'spaceId is required' }, { status: 400 });
    }

    const updateData = {};
    if (label !== undefined) updateData.label = label;
    if (number !== undefined) updateData.number = number;
    if (kind !== undefined) updateData.kind = kind;
    if (length !== undefined) updateData.length = length ? parseFloat(length) : null;
    if (width !== undefined) updateData.width = width ? parseFloat(width) : null;
    if (isBookable !== undefined) updateData.is_bookable = !!isBookable;
    if (pricePerNight !== undefined) updateData.price_per_night = pricePerNight ? parseFloat(pricePerNight) : null;
    if (maxOccupancy !== undefined) updateData.max_occupancy = maxOccupancy ? parseInt(maxOccupancy) : null;

    const { data: space, error } = await supabase
      .from('spaces')
      .update(updateData)
      .eq('id', spaceId)
      .select('*')
      .single();

    if (error) throw error;

    logger.info('Master Admin updated space', { spaceId, orgId: id });
    return NextResponse.json(serializeSpace(space));
  } catch (error) {
    logger.error('Failed to update space (admin)', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/admin/organizations/[id]/spaces — Master Admin deletes space
export async function DELETE(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const spaceId = request.nextUrl.searchParams.get('spaceId');

    if (!spaceId) {
      return NextResponse.json({ message: 'spaceId query parameter is required' }, { status: 400 });
    }

    const { error } = await supabase.from('spaces').delete().eq('id', spaceId);
    if (error) throw error;

    logger.info('Master Admin deleted space', { spaceId, orgId: id });
    return NextResponse.json({ message: 'Space deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete space (admin)', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
