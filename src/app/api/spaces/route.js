import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeSpace } from '@/lib/serializers.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { SPACE_KINDS, assertSiteInOrg } from '@/lib/spaceHelpers.js';

// GET /api/spaces?siteId=&kind=&includeImages= — ported from
// spaceController.js's listSpaces. The layout tree for one site (plan
// Phase 2a's layout builder). Flat list, ordered by sort_order; the tree
// shape (floor -> table/room/canteen) is reconstructed client-side from
// parentSpaceId. `kind` is an optional narrowing filter — added for the
// Rooms management page (hotel premise), which only ever wants
// kind='room' and would otherwise have to pull (and re-filter) every
// floor/table/canteen at the site just to find its rooms.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json({ message: 'siteId query parameter is required' }, { status: 400 });
    }
    if (!(await assertSiteInOrg(siteId, auth.orgId))) {
      return NextResponse.json({ message: 'Site not found' }, { status: 404 });
    }

    const kind = request.nextUrl.searchParams.get('kind');
    const includeImages = request.nextUrl.searchParams.get('includeImages') === '1';
    let query = supabase
      .from('spaces')
      .select(includeImages ? '*, space_images(*)' : '*')
      .eq('site_id', siteId);
    if (kind) query = query.eq('kind', kind);
    const { data, error } = await query.order('sort_order', { ascending: true });
    if (error) throw error;

    return NextResponse.json(data.map(serializeSpace));
  } catch (error) {
    logger.error('Failed to list spaces', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/spaces — ported from spaceController.js's createSpace. Owner
// adds a floor/hall/table/room/canteen node.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner');
  if (roleError) return roleError;

  try {
    const {
      siteId,
      parentSpaceId,
      kind,
      label,
      number,
      isBookable,
      iotEnabled,
      sortOrder,
      pricePerNight,
      description,
      maxOccupancy,
      length,
      width
    } = await request.json();
    if (!siteId || !kind || !label) {
      return NextResponse.json({ message: 'siteId, kind, and label are required' }, { status: 400 });
    }
    if (!SPACE_KINDS.includes(kind)) {
      return NextResponse.json({ message: `kind must be one of: ${SPACE_KINDS.join(', ')}` }, { status: 400 });
    }
    if (pricePerNight !== undefined && pricePerNight !== null && Number(pricePerNight) < 0) {
      return NextResponse.json({ message: 'pricePerNight must not be negative' }, { status: 400 });
    }
    if ((length !== undefined && length !== null && Number(length) <= 0) || (width !== undefined && width !== null && Number(width) <= 0)) {
      return NextResponse.json({ message: 'length and width must be greater than 0' }, { status: 400 });
    }
    if (!(await assertSiteInOrg(siteId, auth.orgId))) {
      return NextResponse.json({ message: 'Site not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('spaces')
      .insert({
        site_id: siteId,
        parent_space_id: parentSpaceId || null,
        kind,
        label,
        number: number || null,
        is_bookable: Boolean(isBookable),
        iot_enabled: Boolean(iotEnabled),
        sort_order: sortOrder ?? 0,
        price_per_night: pricePerNight ?? null,
        description: description || null,
        max_occupancy: maxOccupancy ?? null,
        length: length ?? null,
        width: width ?? null
      })
      .select('*')
      .single();
    if (error) throw error;

    return NextResponse.json(serializeSpace(data), { status: 201 });
  } catch (error) {
    logger.error('Failed to create space', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
