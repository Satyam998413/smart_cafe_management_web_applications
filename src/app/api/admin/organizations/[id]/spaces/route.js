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
