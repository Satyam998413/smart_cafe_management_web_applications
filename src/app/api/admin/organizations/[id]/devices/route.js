import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeDevice } from '@/lib/serializers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';

// GET /api/admin/organizations/[id]/devices?spaceId= — read-only visibility
// into a tenant's registered IoT equipment for Master Admin. Scoped by both
// org_id (the URL param) and spaceId directly on `devices` — that table
// carries its own org_id column, so this doesn't need the site->space
// membership check the spaces route does.
export async function GET(request, { params }) {
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

    const { data, error } = await supabase
      .from('devices')
      .select('*, deviceState:device_states(state, updated_at)')
      .eq('org_id', id)
      .eq('space_id', spaceId);
    if (error) throw error;

    return NextResponse.json(data.map(serializeDevice));
  } catch (error) {
    logger.error('Failed to list organization devices (admin)', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
